# VS Code in the browser

This OSCAR service runs the LinuxServer `code-server` image, providing a browser-accessible VS Code environment.

## Configuration

The FDL uses the image's default startup (`default_command: true`) and exposes its web interface on container port 8443. The `script.sh` file is retained for the OSCAR service definition, but is not used as the startup command while `default_command` is enabled.

The `workspace` bucket must already exist in the `minio.default` storage provider. OSCAR mounts it at `/mnt/workspace`, configured as the default workspace. Files saved there are persisted in that bucket.

The FDL currently sets `PASSWORD: password` as an example. Replace it before deploying anywhere accessible, and do not commit real credentials to this repository. The image also uses `PUID=1000`, `PGID=1000`, and `TZ=Etc/UTC`.

## Access and health check

Deploy the service with the OSCAR Hub/CLI workflow for your cluster, then open the service endpoint returned by OSCAR in a browser and authenticate with the configured password. The FDL configures `/healthz` as the health-check path.

Ensure the configured storage provider is available to the OSCAR cluster before deployment.
