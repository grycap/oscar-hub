#!/usr/bin/env bash
set -euo pipefail

DEFAULT_DATA_DIR="/data/open-webui"
if [[ -z "${DATA_DIR:-}" ]]; then
  DATA_DIR="${DEFAULT_DATA_DIR}"
fi

export DATA_DIR
export WEBUI_AUTH="${WEBUI_AUTH:-True}"
export ENABLE_SIGNUP="${ENABLE_SIGNUP:-False}"
export ENABLE_PERSISTENT_CONFIG="${ENABLE_PERSISTENT_CONFIG:-True}"
export ENABLE_OPENAI_API="${ENABLE_OPENAI_API:-True}"
export ENABLE_OLLAMA_API="${ENABLE_OLLAMA_API:-False}"
export PORT="${PORT:-8080}"
export HOST="${HOST:-0.0.0.0}"

mkdir -p "${DATA_DIR}"

patch_open_webui_base_path() {
  local base_path="${OSCAR_SERVICE_BASE_PATH:-}"
  [[ -n "${base_path}" && "${base_path}" != "/" ]] || return 0
  [[ -f /app/build/index.html ]] || return 0

  python - <<'PY'
import os
from pathlib import Path

base = os.environ.get("OSCAR_SERVICE_BASE_PATH", "").rstrip("/")
if not base or base == "/":
    raise SystemExit(0)

prefixes = (
    "_app/",
    "api/",
    "assets/",
    "audio/",
    "manifest.json",
    "openai/",
    "ollama/",
    "pyodide/",
    "static/",
    "themes/",
    "wasm/",
    "ws/",
)

files = [Path("/app/build/index.html")]
files.extend(Path("/app/build/_app").rglob("*.js"))
files.extend(Path("/app/build/_app").rglob("*.css"))

for path in files:
    try:
        text = path.read_text()
    except UnicodeDecodeError:
        continue

    updated = text
    for prefix in prefixes:
        for quote in ('"', "'", "`"):
            updated = updated.replace(f"{quote}/{prefix}", f"{quote}{base}/{prefix}")
        updated = updated.replace(f"url(/{prefix}", f"url({base}/{prefix}")

    if updated != text:
        path.write_text(updated)
PY
}

patch_open_webui_base_path

echo "Starting Open WebUI for OSCAR"
echo "Data directory: ${DATA_DIR}"
echo "Listen address: ${HOST}:${PORT}"
echo "OpenAI-compatible backend: ${OPENAI_API_BASE_URL:-not configured}"
echo "Signup enabled: ${ENABLE_SIGNUP}"

cd /app/backend

if [[ -f /app/backend/start.sh ]]; then
  exec bash /app/backend/start.sh
fi

if command -v open-webui >/dev/null 2>&1; then
  exec open-webui serve --host "${HOST}" --port "${PORT}"
fi

exec python -m open_webui.main --host "${HOST}" --port "${PORT}"
