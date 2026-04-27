#!/bin/sh
set -eu

FILEBROWSER_ADMIN_PASSWORD="${FILEBROWSER_ADMIN_PASSWORD:-${OSCAR_SERVICE_TOKEN:-}}"
: "${FILEBROWSER_ADMIN_PASSWORD:?FILEBROWSER_ADMIN_PASSWORD or OSCAR_SERVICE_TOKEN is required}"
export FILEBROWSER_ADMIN_PASSWORD

SERVICE_NAME="${OSCAR_SERVICE_NAME:-filebrowser-quantum}"
BASE_PATH="${OSCAR_SERVICE_BASE_PATH:-/system/services/${SERVICE_NAME}/exposed}"
BASE_URL="${BASE_PATH%/}/"

mkdir -p /data /home/filebrowser/data
rm -f /home/filebrowser/data/database.db /home/filebrowser/data/database.db.bak

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

echo "Starting FileBrowser Quantum on port 80"
echo "Base path: ${BASE_URL}"
echo "Service name: ${SERVICE_NAME}"
echo "Source path: /data"

exec /home/filebrowser/filebrowser -c /home/filebrowser/data/config.yaml
