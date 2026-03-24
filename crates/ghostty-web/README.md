# Ghostty Web Terminal with OSCAR CLI

This crate deploys an OSCAR exposed service that provides a browser-based terminal powered by `ghostty-web`. The terminal runs inside the service container and includes `oscar-cli`, `tmux`, and a standard Bash shell.

The service is intended to be deployed per user. Access is controlled by the application itself using a token passed in the URL, similar to the access pattern used by Jupyter notebooks.

## What the container provides

- `ghostty-web` frontend with a PTY-backed WebSocket session
- `oscar-cli` preinstalled in the container image
- `tmux` for optional session management inside the terminal
- Optional persistent workspace when a MinIO bucket is mounted

## Workspace persistence

If you deploy the service without a mounted bucket, the shell workspace is ephemeral.

If you uncomment the `mount` section in `fdl.yml`, OSCAR will mount the selected bucket inside `/mnt` in the container. The launcher script uses `/mnt` as the working directory and also stores shell history plus `oscar-cli` user config there.

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

Before deploying, replace the placeholder `TERMINAL_TOKEN` secret in `fdl.yml` with a strong random value.

Optional persistent workspace:

1. Edit `fdl.yml`
2. Uncomment the `mount` block
3. Set the bucket path you want to mount
4. Apply the file again

## Access the terminal

After deployment, access the service through:

```text
https://<OSCAR-ENDPOINT>/system/services/<service-name>/exposed/?token=<your-token>
```

On first access, the server validates the token, issues an `HttpOnly` session cookie, and redirects the browser to the same URL without the `token` query parameter. The WebSocket terminal then reuses that cookie.

## Notes

- This crate assumes one deployed instance per user.
- The service is stateful from the user's point of view if a bucket is mounted, even though the exposed service itself runs as a single pod.
- If your OSCAR cluster expects `port` instead of `api_port` in the `expose` block, replace that key accordingly.
- If `TERMINAL_TOKEN` is empty, the application-side authentication is disabled and the terminal becomes publicly accessible.
