#!/bin/sh
set -eu

CFG="/oscar/config/function_config.yaml"

set_cfg() {
  node /app/openclaw.mjs config set "$1" "$2" \
    --json >/dev/null 2>&1 || true
}

if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ] && [ -f "${CFG}" ]; then
  OPENCLAW_GATEWAY_TOKEN="$(
    awk -F': ' '/^token:/ {print $2; exit}' "${CFG}" \
      | tr -d '"' || true
  )"
  export OPENCLAW_GATEWAY_TOKEN
fi

[ -n "${OPENCLAW_STATE_DIR:-}" ] || \
  export OPENCLAW_STATE_DIR="/data/openclaw-state"
[ -n "${OPENCLAW_CONFIG_PATH:-}" ] || \
  export OPENCLAW_CONFIG_PATH="${OPENCLAW_STATE_DIR}/openclaw.json"

mkdir -p "${OPENCLAW_STATE_DIR}" "$(dirname "${OPENCLAW_CONFIG_PATH}")"

set_cfg gateway.trustedProxies \
  '["10.0.0.0/8","172.16.0.0/12","192.168.0.0/16","127.0.0.1/32","::1/128"]'
set_cfg gateway.auth.mode '"token"'

if [ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  set_cfg gateway.auth.token "\"${OPENCLAW_GATEWAY_TOKEN}\""
fi

if [ "${OPENCLAW_DISABLE_DEVICE_AUTH:-1}" = "1" ]; then
  set_cfg gateway.controlUi.allowInsecureAuth true
  set_cfg gateway.controlUi.dangerouslyDisableDeviceAuth true
fi

if [ -n "${OPENCLAW_GATEWAY_ALLOWED_ORIGINS:-}" ]; then
  set_cfg gateway.controlUi.allowedOrigins \
    "${OPENCLAW_GATEWAY_ALLOWED_ORIGINS}"
else
  set_cfg gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true
fi

set -- node /app/openclaw.mjs gateway \
  --allow-unconfigured \
  --bind lan \
  --port "${OPENCLAW_GATEWAY_PORT:-18789}"

if [ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  set -- "$@" --token "${OPENCLAW_GATEWAY_TOKEN}"
fi

exec "$@"
