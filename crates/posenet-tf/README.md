# PoseNet TF on OSCAR

This crate deploys the `ai4oshub/posenet-tf` container as an OSCAR exposed service and forwards the DEEPaaS API through the OSCAR gateway.

## Runtime behavior

- The container listens on port `5000`.
- OSCAR runs the image default command (`deepaas-run`) because `expose.default_command` is enabled.
- With subdomain routing, the DEEPaaS health endpoint is `https://posenet-tf.<cluster-host>/v2`.
- The FDL specifies `/v2` as the health path.
- The OpenAPI UI is at `https://posenet-tf.<cluster-host>/api`.

## Accessing the API

After deploying the service, open:

`https://posenet-tf.<cluster-host>/api`

For example, with the OSCAR API at `https://localhost.direct`, the UI is at `https://posenet-tf.localhost.direct/api`. The acceptance test sends the sample image to `/v2/models/posenetclas/predict/` on that same service host. On older clusters using path-based routing, use `https://<cluster-host>/system/services/posenet-tf/exposed/api` instead.

This service enables `set_auth: true`, so use the service name as the username and the OSCAR service token as the password when prompted.

If you want to test inference, use the Swagger UI to inspect the available `posenetclas` endpoints and submit an image through the DEEPaaS `predict` operation exposed by the container.

## Upstream references

- AI4EOSC catalog: `https://dashboard.cloud.ai4eosc.eu/catalog/modules/posenet-tf`
- Source repository: `https://github.com/ai4os-hub/posenet-tf`
- Docker image: `https://hub.docker.com/r/ai4oshub/posenet-tf`
