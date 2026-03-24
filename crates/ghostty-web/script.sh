#!/bin/bash
set -euo pipefail

PORT="${PORT:-8080}"
SERVICE_NAME="${SERVICE_NAME:-ghostty-web}"
BASE_PATH="${BASE_PATH:-/}"
WORKSPACE_DIR="${WORKSPACE_DIR:-/mnt}"
DEFAULT_WORKDIR="/tmp/${SERVICE_NAME}"

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
export OSCAR_CLI_CONFIG_FILE="${OSCAR_CLI_CONFIG_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/oscar/config.yaml}"
export PATH="/usr/local/bin:${PATH}"

echo "Starting ghostty-web on port ${PORT}"
echo "Base path: ${BASE_PATH}"
echo "Workspace: ${SHELL_WORKDIR}"

exec node /opt/ghostty-web/server.js
