# OpenClaw Gateway for OSCAR Hub

This crate packages the OpenClaw exposed-service example for OSCAR Hub.

Default deployment values match the working OSCAR payload:

- `name: openclaw-volume`
- `cpu: 2.0`
- `image: ghcr.io/openclaw/openclaw:2026.3.8`

## Storage

The service uses an OSCAR managed volume mounted at `/data`:

- `volume.size: 1Gi`
- `volume.mount_path: /data`
- `volume.name` is intentionally omitted

Because `volume.name` is not set, OSCAR derives the managed volume name
from the deployed service name.

OpenClaw stores its persistent state in:

- `/data/openclaw-state`
- `/data/openclaw-state/openclaw.json`

## Access

Once deployed, the UI is exposed at:

```text
https://<OSCAR_ENDPOINT>/system/services/<service-name>/exposed/
```

With `set_auth: true`, use:

- user: `<service-name>`
- password: service token
