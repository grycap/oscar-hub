# Ghostty Web Terminal with OSCAR CLI

This crate deploys an OSCAR exposed service that provides a browser-based terminal powered by `ghostty-web`. The terminal runs inside the service container and includes `oscar-cli`, `tmux`, and a standard Bash shell.

The service is intended to be deployed per user. Access is controlled by the application itself using a token passed in the URL, similar to the access pattern used by Jupyter notebooks.

The container can also preconfigure `oscar-cli` against the in-cluster OSCAR API by injecting an OIDC refresh token as a secret.

## What the container provides

- `ghostty-web` frontend with a PTY-backed WebSocket session
- `oscar-cli` preinstalled in the container image
- `tmux` for optional session management inside the terminal
- Persistent workspace backed by a mounted MinIO bucket

## Workspace persistence

The example `fdl.yml` mounts the bucket path `/ghostty-web` from `minio.default` into `/mnt/ghostty-web` inside the container. The launcher script uses `WORKSPACE_DIR` directly as the working directory and also stores shell history plus `oscar-cli` user config there.

Keep `mount.path` and `WORKSPACE_DIR` aligned if you want to bind a different bucket or prefix for each user.

## Build the image

Run the build from the crate root so the Dockerfile can copy `script.sh` and the files under `docker/`:

```bash
docker build -f docker/Dockerfile -t ghcr.io/grycap/ghostty-web:0.1.0 .
```

Push the resulting image to the registry you plan to use and update `fdl.yml` if needed.

## Deploy with OSCAR CLI

Base deployment:

```bash
oscar-cli apply fdl.yml
```

Before deploying, replace the placeholder secrets in `fdl.yml`:

- `TERMINAL_TOKEN`: token used to access the terminal URL
- `OSCAR_OIDC_REFRESH_TOKEN`: OIDC refresh token used by `oscar-cli`

Persistent workspace:

1. Edit `fdl.yml`
2. Set `mount.path` to the bucket or prefix you want to expose in `/mnt`
3. Apply the file again

## Access the terminal

After deployment, access the service through:

```text
https://<OSCAR-ENDPOINT>/system/services/<service-name>/exposed/?token=<your-token>
```

On first access, the server validates the token, issues an `HttpOnly` session cookie, and redirects the browser to the same URL without the `token` query parameter. The WebSocket terminal then reuses that cookie.

When `OSCAR_OIDC_REFRESH_TOKEN` is set, the startup script generates `~/.oscar-cli/config.yaml` with a default cluster that points to the in-cluster OSCAR service endpoint:

```yaml
oscar:
  local-cluster:
    endpoint: http://oscar.oscar.svc.cluster.local:8080
    oidc_refresh_token: <refresh-token>
    ssl_verify: false
default: local-cluster
```

## Notes

- This crate assumes one deployed instance per user.
- The service is stateful from the user's point of view if a bucket is mounted, even though the exposed service itself runs as a single pod.
- If your OSCAR cluster expects `port` instead of `api_port` in the `expose` block, replace that key accordingly.
- If `TERMINAL_TOKEN` is empty, the application-side authentication is disabled and the terminal becomes publicly accessible.
- The generated `oscar-cli` config is written to `~/.config/oscar/config.yaml` inside the container and uses mode `0600`.
- If you mount `/mnt`, the workspace can persist independently from the in-container credentials. Review whether you want the generated CLI config to persist together with that workspace.
