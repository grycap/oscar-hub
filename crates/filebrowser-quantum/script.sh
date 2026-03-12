#!/bin/sh
set -eu

: "${FILEBROWSER_ADMIN_PASSWORD:?FILEBROWSER_ADMIN_PASSWORD is required}"

mkdir -p /data /home/filebrowser/data
rm -f /home/filebrowser/data/database.db
rm -f /home/filebrowser/data/database.db.bak

SERVICE_NAME="$(
  awk -F': ' '/^name:/ {print $2; exit}' \
    /oscar/config/function_config.yaml
)"
BASE_URL="/system/services/${SERVICE_NAME}/exposed/"

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
