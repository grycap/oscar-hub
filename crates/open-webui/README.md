# Open WebUI on OSCAR

An exposed, persistent [Open WebUI](https://github.com/open-webui/open-webui) frontend for external OpenAI-compatible models. The pinned `slim` image does not bundle a model or the optional local document/voice dependencies. This crate **does not deploy a model**.

## Deploy

Requires an OSCAR cluster with exposed services and managed volumes, and an `oscar-cli` profile with permission to create services. The crate reserves 1 vCPU, 2 GiB RAM and a 1 GiB persistent volume mounted at `/app/backend/data`. OSCAR retains the volume on service deletion; removal is a separate, destructive operation.

```sh
oscar-cli hub deploy open-webui --cluster <cluster> --local-path /path/to/oscar-hub/crates
oscar-cli service deployment status open-webui --cluster <cluster>
```

To check readiness on a cluster using subdomain routing, run `curl -fsS https://open-webui.<cluster-host>/ready` and expect `{"status":true}`. This checks startup and database connectivity. Account creation and model connectivity still need manual checks.

The service runs the upstream image's default command on port 8080. **Open WebUI's own login is the only access gate** (`WEBUI_AUTH=True`): `set_auth: false` disables OSCAR's per-request authentication and service visibility restrictions on this exposed route. Do not disable Open WebUI authentication.

**First-run security:** Open the assigned HTTPS service route immediately after deployment and create the first account yourself. On a fresh database, this first user becomes the administrator even with `ENABLE_SIGNUP=False`; Open WebUI v0.12.2 then disables further signups. Before the first account exists, anyone who can reach the route could claim the administrator account. Do not expose a fresh deployment to untrusted clients during that window; for an internet-facing installation, restrict network access or provision the admin through a secure channel first. The `ENABLE_SIGNUP` environment value can be superseded by Open WebUI's persistent database configuration on subsequent deployments; check the signup state in the Admin Panel and do not assume changing the FDL alone overrides an existing setting. Keep the persistent data (including the signing key) private and backed up. To use organizational SSO, configure Open WebUI's own OIDC provider separately rather than assuming OSCAR's login is forwarded.

Open the assigned HTTPS service host at `/`, typically `https://open-webui.<cluster-host>/`. On clusters using path-based routing, use `https://<cluster-host>/system/services/open-webui/exposed/` instead.

## Connect a model

In Open WebUI, log in as an administrator and open **Admin Panel → Settings → Connections → OpenAI API**. Add the provider's base URL ending in `/v1` and its API key using Open WebUI's admin UI. Connection settings are stored in Open WebUI's database on the persistent volume.

The `slim` variant is suited to remote OpenAI-compatible APIs; features needing bundled embeddings, speech or local document extraction require a different image or external services. Scale remains at one replica because Open WebUI uses a local database on the managed volume.

## Brand attribution

The catalog icon is the unmodified [official Open WebUI icon](https://docs.openwebui.com/brand/) (© Open WebUI Inc.). This OSCAR Hub crate is a community integration and is not endorsed or maintained by the Open WebUI team. Open WebUI's [license](https://docs.openwebui.com/license/) and branding remain with the upstream project.
