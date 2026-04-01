#!/bin/bash
set -euo pipefail

PORT="${PORT:-8080}"
SERVICE_NAME="${SERVICE_NAME:-ghostty-web}"
BASE_PATH="${BASE_PATH:-/}"
WORKSPACE_DIR="${WORKSPACE_DIR:-/mnt}"
DEFAULT_WORKDIR="/tmp/${SERVICE_NAME}"
OSCAR_SERVICE_FDL_PATH="${OSCAR_SERVICE_FDL_PATH:-/oscar/config/function_config.yaml}"
OSCAR_CLUSTER_ID="${OSCAR_CLUSTER_ID:-local-cluster}"
OSCAR_CLUSTER_ENDPOINT="${OSCAR_CLUSTER_ENDPOINT:-http://oscar.oscar.svc.cluster.local:8080}"
OSCAR_CLUSTER_SSL_VERIFY="${OSCAR_CLUSTER_SSL_VERIFY:-false}"
OSCAR_OIDC_REFRESH_TOKEN="${OSCAR_OIDC_REFRESH_TOKEN:-}"

mkdir -p "${DEFAULT_WORKDIR}"

if [[ -d "${WORKSPACE_DIR}" && -w "${WORKSPACE_DIR}" ]]; then
  RUNTIME_WORKDIR="${WORKSPACE_DIR}"
  mkdir -p "${RUNTIME_WORKDIR}/.config" "${RUNTIME_WORKDIR}/.cache" "${RUNTIME_WORKDIR}/.local"
  export HISTFILE="${RUNTIME_WORKDIR}/.bash_history"
  export XDG_CONFIG_HOME="${RUNTIME_WORKDIR}/.config"
  export XDG_CACHE_HOME="${RUNTIME_WORKDIR}/.cache"
  export XDG_DATA_HOME="${RUNTIME_WORKDIR}/.local/share"
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

read_oscar_service_token() {
  local fdl_path="$1"

  [[ -r "${fdl_path}" ]] || return 1

  awk '/^token:[[:space:]]*/ { sub(/^token:[[:space:]]*/, ""); print; exit }' "${fdl_path}"
}

mkdir -p "$(dirname "${OSCAR_CLI_CONFIG_FILE}")"

if OSCAR_SERVICE_TOKEN="$(read_oscar_service_token "${OSCAR_SERVICE_FDL_PATH}")"; then
  export TERMINAL_TOKEN="${OSCAR_SERVICE_TOKEN}"
fi

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
fi

echo "Starting ghostty-web on port ${PORT}"
echo "Base path: ${BASE_PATH}"
echo "Workspace: ${SHELL_WORKDIR}"
echo "OSCAR endpoint: ${OSCAR_CLUSTER_ENDPOINT}"
if [[ -n "${TERMINAL_TOKEN:-}" ]]; then
  echo "Terminal auth token: OSCAR service token"
else
  echo "Terminal auth token: disabled"
fi
if [[ -n "${OSCAR_OIDC_REFRESH_TOKEN}" ]]; then
  echo "OSCAR CLI config: ${OSCAR_CLI_CONFIG_FILE}"
fi

exec node /opt/ghostty-web/server.js
