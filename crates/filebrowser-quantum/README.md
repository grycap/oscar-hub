# FileBrowser Quantum for OSCAR Hub

This crate deploys FileBrowser Quantum as an exposed OSCAR service.

Default deployment values match the generated OSCAR payload:

- `name: filebrowser-quantum`
- `memory: 512Mi`
- `cpu: 0.5`
- `image: ghcr.io/gtsteffaniak/filebrowser:latest`

## Storage

The service mounts the OSCAR volume selected by the user at `/data`:

- `volume.name: your-volume-name`
- `volume.mount_path: /data`

## Access

The script uses OSCAR-managed metadata environment variables and sets:

```text
/system/services/<service-name>/exposed/
```

OSCAR injects:

- `OSCAR_SERVICE_TOKEN`
- `OSCAR_SERVICE_BASE_PATH`

OSCAR authentication is disabled for this service:

- `set_auth: false`

Application access uses:

- user: `admin`
- password: OSCAR service token
