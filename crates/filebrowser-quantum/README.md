# FileBrowser Quantum

This crate deploys [FileBrowser Quantum](https://github.com/gtsteffaniak/filebrowser) as an OSCAR exposed service for browsing a mounted storage folder from the web UI.

## Deployment defaults

- `name: filebrowser-quantum`
- `memory: 512Mi`
- `cpu: 0.5`
- `image: ghcr.io/gtsteffaniak/filebrowser:latest`
- `api_port: 80`

## Existing Volume

The example FDL mounts an existing OSCAR volume at `/data`, and FileBrowser exposes that path as its default source:

```text
/data
```

Before deploying, set `volume.name` to the existing volume you want to browse. The example currently targets:

- `volume.name: openclaw-volume`
- `volume.mount_path`

## Access

The service is exposed at:

```text
/system/services/<service-name>/exposed/
```

OSCAR ingress authentication is disabled with `set_auth: false` because FileBrowser provides its own login screen.

Application access:

- user: `admin`
- password: `FILEBROWSER_ADMIN_PASSWORD` if provided, otherwise `OSCAR_SERVICE_TOKEN`

OSCAR injects `OSCAR_SERVICE_NAME`, `OSCAR_SERVICE_TOKEN`, and `OSCAR_SERVICE_BASE_PATH` in the container. The startup script uses those variables directly to configure FileBrowser.

## Notes

- FileBrowser stores its runtime config, database, and cache in `/home/filebrowser/data`.
- Keep the service exposed with `rewrite_target: true` so FileBrowser runs under the OSCAR base path.
