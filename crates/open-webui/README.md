# Open WebUI for OSCAR

This crate deploys [Open WebUI](https://github.com/open-webui/open-webui) as an OSCAR exposed service. It is intended to provide a browser UI for OpenAI-compatible model services running in the same OSCAR/Kubernetes environment, such as the existing `vllm-llama` crate.

The proposal is to treat Open WebUI as a stateful, user-facing companion service rather than as an event-driven function:

- OSCAR exposes the web application on port `8080`.
- Open WebUI stores users, chats, settings, uploaded files, and local databases under `/data/open-webui`.
- The FDL defines an OSCAR volume mounted at `/data`, so SQLite uses a POSIX filesystem instead of an object-storage mount.
- The default provider is an OpenAI-compatible backend configured with `OPENAI_API_BASE_URL` and `OPENAI_API_KEY`.
- OSCAR-level authentication remains enabled with `set_auth: true`, while Open WebUI also keeps its own login enabled.
- The launcher patches the generated Open WebUI frontend at startup so absolute asset and API paths are prefixed with `OSCAR_SERVICE_BASE_PATH`.

## Architecture

```text
Browser
  |
  | https://<OSCAR-ENDPOINT>/system/services/open-webui/exposed/
  v
OSCAR exposed service: open-webui
  |
  | OPENAI_API_BASE_URL=http://vllm-gpu-llama.oscar.svc.cluster.local:8000/v1
  v
OSCAR exposed/internal LLM service: vllm-gpu-llama
```

The service can also point to any external OpenAI-compatible endpoint by changing `OPENAI_API_BASE_URL` and `OPENAI_API_KEY` in `fdl.yml`.

## Container image

The FDL uses the official Open WebUI image directly:

```text
ghcr.io/open-webui/open-webui:v0.9.0
```

This makes the crate deployable without first publishing a GRyCAP-specific image. The included `docker/Dockerfile` is optional and only needed if you want to publish a pinned derivative image with the launcher script baked in:

```bash
docker build -f docker/Dockerfile -t ghcr.io/grycap/open-webui-oscar:0.1.0 .
docker push ghcr.io/grycap/open-webui-oscar:0.1.0
```

If you publish that derivative image, update the `image` field in `fdl.yml`.

## Configure before deployment

Edit `fdl.yml` and replace these placeholders:

- `WEBUI_SECRET_KEY`: persistent secret used by Open WebUI sessions. Generate it with `openssl rand -hex 32`.
- `WEBUI_ADMIN_EMAIL`: initial administrator email.
- `WEBUI_ADMIN_PASSWORD`: initial administrator password.
- `OPENAI_API_KEY`: API key expected by the OpenAI-compatible backend.
- `OPENAI_API_BASE_URL`: backend URL. The default assumes a `vllm-gpu-llama` service reachable inside the cluster.

Keep `WEBUI_AUTH=True` for normal deployments. `WEBUI_AUTH=False` is useful only for isolated demos because it disables Open WebUI login.

## Deploy with OSCAR CLI

```bash
oscar-cli apply fdl.yml
```

After deployment, open:

```text
https://<OSCAR-ENDPOINT>/system/services/open-webui/exposed/
```

Because `set_auth: true` is enabled, OSCAR protects the exposed route. Use the service name as the username and the OSCAR service token as the password when prompted. Then sign in to Open WebUI with the configured admin account.

## Connect to `vllm-llama`

The default FDL points Open WebUI to:

```text
http://vllm-gpu-llama.oscar.svc.cluster.local:8000/v1
```

This assumes the `vllm-llama` crate is deployed with service name `vllm-gpu-llama`, serving an OpenAI-compatible API on port `8000`, and using the same API key as `OPENAI_API_KEY`.

If the backend is exposed only through the OSCAR public URL, use:

```text
https://<OSCAR-ENDPOINT>/system/services/vllm-gpu-llama/exposed/v1
```

## Persistence notes

OSCAR mounts the configured volume at `/data`. The FDL sets `DATA_DIR=/data/open-webui`, keeping Open WebUI's SQLite database and generated files on a POSIX filesystem. This is required because SQLite is not reliable on the previous rclone/S3 bucket mount.

The sample requests a `5Gi` volume because some OSCAR deployments cap the maximum size per managed volume. Increase `volume.size` in `fdl.yml` only if your quota allows it and you expect many uploads, embeddings, or cached models.

Open WebUI persists several configuration values in its database after the first launch. If you later change variables such as `OPENAI_API_BASE_URL`, `ENABLE_SIGNUP`, or `WEBUI_AUTH`, the database value may take precedence. For deterministic redeployments, either update the setting in the Admin Panel or set `ENABLE_PERSISTENT_CONFIG=False` temporarily.

Do not reuse the same persistent data directory for unrelated deployments unless you intentionally want to share users, chats, and configuration.

## Operational notes

- Run one replica unless Open WebUI is configured with external PostgreSQL and Redis. The sample FDL sets `min_scale: 1` and `max_scale: 1`.
- Keep `WEBUI_SECRET_KEY` stable across redeployments to avoid invalidating sessions.
- Review Open WebUI licensing before changing branding or redistributing modified images.
- WebSocket support is required by Open WebUI and must be allowed by the OSCAR ingress path.

## References

- Open WebUI repository: <https://github.com/open-webui/open-webui>
- Open WebUI quick start: <https://docs.openwebui.com/getting-started/quick-start/>
- Open WebUI environment variables: <https://docs.openwebui.com/reference/env-configuration/>
- OSCAR FDL documentation: <https://docs.oscar.grycap.net/fdl/>
