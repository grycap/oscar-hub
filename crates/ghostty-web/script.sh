#!/bin/bash
set -euo pipefail

PORT="${PORT:-8080}"
SERVICE_NAME="${SERVICE_NAME:-ghostty-web}"
BASE_PATH="${BASE_PATH:-/}"
WORKSPACE_DIR="${WORKSPACE_DIR:-/mnt}"
DEFAULT_WORKDIR="/tmp/${SERVICE_NAME}"
OSCAR_CLUSTER_ID="${OSCAR_CLUSTER_ID:-local-cluster}"
OSCAR_CLUSTER_ENDPOINT="${OSCAR_CLUSTER_ENDPOINT:-http://oscar.oscar.svc.cluster.local:8080}"
OSCAR_CLUSTER_SSL_VERIFY="${OSCAR_CLUSTER_SSL_VERIFY:-false}"
OSCAR_OIDC_REFRESH_TOKEN="${OSCAR_OIDC_REFRESH_TOKEN:-}"

mkdir -p "${DEFAULT_WORKDIR}"

if [[ -d "${WORKSPACE_DIR}" && -w "${WORKSPACE_DIR}" ]]; then
  RUNTIME_WORKDIR="${WORKSPACE_DIR}"
  mkdir -p "${WORKSPACE_DIR}/.config" "${WORKSPACE_DIR}/.cache" "${WORKSPACE_DIR}/.local"
  export HISTFILE="${WORKSPACE_DIR}/.bash_history"
  export XDG_CONFIG_HOME="${WORKSPACE_DIR}/.config"
  export XDG_CACHE_HOME="${WORKSPACE_DIR}/.cache"
  export XDG_DATA_HOME="${WORKSPACE_DIR}/.local/share"
else
  RUNTIME_WORKDIR="${DEFAULT_WORKDIR}"
fi

mkdir -p "${RUNTIME_WORKDIR}"

export PORT
export BASE_PATH
export SHELL="${SHELL:-/bin/bash}"
export SHELL_WORKDIR="${RUNTIME_WORKDIR}"
export OSCAR_CLI_CONFIG_FILE="${OSCAR_CLI_CONFIG_FILE:-$HOME/.oscar-cli/config.yaml}"
export PATH="/usr/local/bin:${PATH}"

mkdir -p "$(dirname "${OSCAR_CLI_CONFIG_FILE}")"
XDG_OSCAR_CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/oscar/config.yaml"
mkdir -p "$(dirname "${XDG_OSCAR_CONFIG_FILE}")"

if [[ -n "${OSCAR_OIDC_REFRESH_TOKEN}" ]]; then
  cat > "${OSCAR_CLI_CONFIG_FILE}" <<EOF
oscar:
  ${OSCAR_CLUSTER_ID}:
    endpoint: ${OSCAR_CLUSTER_ENDPOINT}
    oidc_refresh_token: ${OSCAR_OIDC_REFRESH_TOKEN}
    ssl_verify: ${OSCAR_CLUSTER_SSL_VERIFY}
    memory: 256Mi
    log_level: INFO
default: ${OSCAR_CLUSTER_ID}
EOF
  chmod 600 "${OSCAR_CLI_CONFIG_FILE}"
  ln -sf "${OSCAR_CLI_CONFIG_FILE}" "${XDG_OSCAR_CONFIG_FILE}"
fi

echo "Starting ghostty-web on port ${PORT}"
echo "Base path: ${BASE_PATH}"
echo "Workspace: ${SHELL_WORKDIR}"
echo "OSCAR endpoint: ${OSCAR_CLUSTER_ENDPOINT}"
if [[ -n "${OSCAR_OIDC_REFRESH_TOKEN}" ]]; then
  echo "OSCAR CLI config: ${OSCAR_CLI_CONFIG_FILE}"
fi

exec node /opt/ghostty-web/server.js
