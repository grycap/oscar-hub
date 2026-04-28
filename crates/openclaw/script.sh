#!/bin/sh
set -eu

[ -n "${OPENCLAW_STATE_DIR:-}" ] || \
  export OPENCLAW_STATE_DIR="/data/openclaw-state"
[ -n "${OPENCLAW_CONFIG_PATH:-}" ] || \
  export OPENCLAW_CONFIG_PATH="${OPENCLAW_STATE_DIR}/openclaw.json"
[ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ] || \
  export OPENCLAW_GATEWAY_TOKEN="${OSCAR_SERVICE_TOKEN:-}"

: "${OPENCLAW_GATEWAY_TOKEN:?OSCAR service token is required}"
mkdir -p "${OPENCLAW_STATE_DIR}" "$(dirname "${OPENCLAW_CONFIG_PATH}")"

export npm_config_bin_links=false
npm config set bin-links false --global || true

if [ -n "${OPENCLAW_CONTROL_UI_BASE_PATH:-}" ]; then
  OPENCLAW_BASE_PATH="${OPENCLAW_CONTROL_UI_BASE_PATH}"
elif [ -n "${OSCAR_SERVICE_BASE_PATH:-}" ]; then
  OPENCLAW_BASE_PATH="${OSCAR_SERVICE_BASE_PATH}"
else
  OPENCLAW_SERVICE_NAME="${OSCAR_SERVICE_NAME:-openclaw-volume}"
  OPENCLAW_BASE_PATH="/system/services/${OPENCLAW_SERVICE_NAME}/exposed"
fi
OPENCLAW_BASE_PATH="${OPENCLAW_BASE_PATH%/}"
export OPENCLAW_BASE_PATH

TRUSTED_PROXIES='["10.0.0.0/8","172.16.0.0/12","192.168.0.0/16"]'
TRUSTED_PROXIES="${TRUSTED_PROXIES%]},\"127.0.0.1/32\",\"::1/128\"]"
export OPENCLAW_TRUSTED_PROXIES="${TRUSTED_PROXIES}"

node <<'EOF'
const fs = require("fs");
const path = process.env.OPENCLAW_CONFIG_PATH;
let cfg = {};
if (fs.existsSync(path)) {
  const raw = fs.readFileSync(path, "utf8").trim();
  cfg = raw ? JSON.parse(raw) : {};
}

cfg.gateway = cfg.gateway || {};
cfg.gateway.trustedProxies = JSON.parse(process.env.OPENCLAW_TRUSTED_PROXIES);
cfg.gateway.auth = cfg.gateway.auth || {};
cfg.gateway.auth.mode = "token";
cfg.gateway.auth.token = process.env.OPENCLAW_GATEWAY_TOKEN;
cfg.gateway.controlUi = cfg.gateway.controlUi || {};
cfg.gateway.controlUi.basePath = process.env.OPENCLAW_BASE_PATH;
cfg.gateway.controlUi.allowInsecureAuth = true;
cfg.gateway.controlUi.dangerouslyDisableDeviceAuth = true;

if (process.env.OPENCLAW_GATEWAY_ALLOWED_ORIGINS) {
  cfg.gateway.controlUi.allowedOrigins = JSON.parse(
    process.env.OPENCLAW_GATEWAY_ALLOWED_ORIGINS,
  );
} else {
  cfg.gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback = true;
}

fs.writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`);
EOF

set -- node /app/openclaw.mjs gateway \
  --allow-unconfigured \
  --bind lan \
  --port "${OPENCLAW_GATEWAY_PORT:-18789}" \
  --token "${OPENCLAW_GATEWAY_TOKEN}"

exec "$@"
