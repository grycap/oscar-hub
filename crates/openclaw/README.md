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

## In-Cluster Access

When OpenClaw or another OSCAR service needs to call an exposed service from
inside the Kubernetes cluster, use the Kubernetes `Service` DNS name instead of
`https://localhost/...`.

For a service named `llama-qwen`, the internal base URL is:

```text
http://llama-qwen-svc/system/services/llama-qwen/exposed/v1
```

OSCAR creates several Kubernetes resources for each deployed service and uses
suffixes to distinguish them:

- `*-svc` for the internal Kubernetes `Service`
- `*-dlp` for the `Deployment`
- `*-ing` for the `Ingress`

That is why the internal hostname carries the `-svc` suffix. From another pod,
`localhost` points to that pod itself, not to the OSCAR ingress running on the
host.
