# Ghostty Web Terminal with OSCAR CLI

This crate deploys an OSCAR exposed service that provides a browser-based terminal powered by `ghostty-web`. The terminal runs inside the service container and includes `oscar-cli`, `tmux`, and a standard Bash shell.

The service is intended to be deployed per user. Authentication is delegated to OSCAR via the `expose.set_auth` option, so the web UI itself does not implement a second login layer.

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

Optional persistent workspace:

1. Edit `fdl.yml`
2. Uncomment the `mount` block
3. Set the bucket path you want to mount
4. Apply the file again

## Access the terminal

After deployment, access the service through:

```text
https://<OSCAR-ENDPOINT>/system/services/ghostty-web/exposed/
```

OSCAR will protect the exposed endpoint using the service credentials because `set_auth: true` is enabled in the FDL.

## Notes

- This crate assumes one deployed instance per user.
- The service is stateful from the user's point of view if a bucket is mounted, even though the exposed service itself runs as a single pod.
- If your OSCAR cluster expects `port` instead of `api_port` in the `expose` block, replace that key accordingly.
