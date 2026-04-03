#!/bin/sh
set -eu

[ -n "${FILEBROWSER_ADMIN_PASSWORD:-}" ] || \
  export FILEBROWSER_ADMIN_PASSWORD="${OSCAR_SERVICE_TOKEN:-}"

: "${FILEBROWSER_ADMIN_PASSWORD:?OSCAR service token is required}"
[ -n "${OSCAR_SERVICE_BASE_PATH:-}" ] || \
  : "${OSCAR_SERVICE_BASE_PATH:?OSCAR service base path is required}"

mkdir -p /data /home/filebrowser/data
rm -f /home/filebrowser/data/database.db
rm -f /home/filebrowser/data/database.db.bak

BASE_URL="${OSCAR_SERVICE_BASE_PATH%/}/"

cat > /home/filebrowser/data/config.yaml <<EOF
server:
  port: 80
  baseURL: "${BASE_URL}"
  database: "/home/filebrowser/data/database.db"
  sources:
    - path: "/data"
      config:
        defaultEnabled: true
        defaultUserScope: "/"
auth:
  methods:
    password:
      enabled: true
  adminUsername: admin
EOF

exec /home/filebrowser/filebrowser \
  -c /home/filebrowser/data/config.yaml
