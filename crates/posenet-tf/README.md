# PoseNet TF on OSCAR

This crate deploys the `ai4oshub/posenet-tf` container as an OSCAR exposed service and forwards the DEEPaaS API through the OSCAR ingress.

## Runtime behavior

- The container listens on port `5000`.
- OSCAR runs the image default command (`deepaas-run`) because `expose.default_command` is enabled.
- The proxied DEEPaaS health endpoint is `/system/services/posenet-tf/exposed/v2`.
- The pod health probes run directly against `/v2` inside the container because `probe_mode: direct` is enabled.
- The proxied OpenAPI UI is `/system/services/posenet-tf/exposed/api`.

## Accessing the API

After deploying the service, open:

`https://<oscar-endpoint>/system/services/posenet-tf/exposed/api`

This service enables `set_auth: true`, so use the service name as the username and the OSCAR service token as the password when prompted.

If you want to test inference, use the Swagger UI to inspect the available `posenetclas` endpoints and submit an image through the DEEPaaS `predict` operation exposed by the container.

## Upstream references

- AI4EOSC catalog: `https://dashboard.cloud.ai4eosc.eu/catalog/modules/posenet-tf`
- Source repository: `https://github.com/ai4os-hub/posenet-tf`
- Docker image: `https://hub.docker.com/r/ai4oshub/posenet-tf`
