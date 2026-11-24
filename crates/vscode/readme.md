# VS Code in the browser

This OSCAR service runs the LinuxServer `code-server` image, providing a browser-accessible VS Code environment.

## Configuration

The service starts `code-server` on `0.0.0.0:8080` using password authentication. OSCAR exposes that container port through the service API. The `workspace` bucket must already exist in the `minio.default` storage provider; OSCAR mounts it at `/mnt/workspace`, which is configured as the default workspace.

The FDL currently sets `PASSWORD: password` as an example. Change it before deploying anywhere accessible, and do not commit real credentials to this repository. The image also uses `PUID=1000`, `PGID=1000`, and `TZ=Etc/UTC`.

## Access

Deploy the service with the OSCAR Hub/CLI workflow for your cluster, then open the service endpoint returned by OSCAR in a browser and authenticate with the configured password. Keep `script.sh` and the FDL port in sync when changing the code-server bind address.

## Storage

Files saved under `/mnt/workspace` are stored in the mounted MinIO bucket. Ensure the bucket exists and the configured storage provider is available to the OSCAR cluster before deployment.
