# FileBrowser Quantum for OSCAR Hub

This crate deploys FileBrowser Quantum as an exposed OSCAR service.

Default deployment values match the provided working payload:

- `name: filebrowser-for-openclaw`
- `memory: 512Mi`
- `cpu: 0.5`
- `image: ghcr.io/gtsteffaniak/filebrowser:latest`

## Storage

The service mounts the existing OpenClaw volume at `/data`:

- `volume.name: openclaw-volume`
- `volume.mount_path: /data`

## Access

The script derives the service name from `function_config.yaml` and sets:

```text
/system/services/<service-name>/exposed/
```

OSCAR authentication is disabled for this service:

- `set_auth: false`

Application access is intended to use the
`FILEBROWSER_ADMIN_PASSWORD` secret.
