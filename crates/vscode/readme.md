# VS Code Server on OSCAR

This crate deploys [code-server](https://github.com/coder/code-server), providing a browser-accessible VS Code environment. It uses the LinuxServer `linuxserver/code-server:latest` image and its default startup command.

## Deploy

The `workspace` bucket must already exist in the `minio.default` storage provider. OSCAR mounts it at `/mnt/workspace`, which is also configured as the default workspace. Files saved there are persisted in the bucket. The service requests 1 CPU and 1 GiB of memory and runs one replica.

Deploy the service with an `oscar-cli` profile that can access the target cluster:

```sh
oscar-cli hub deploy vscode --cluster <cluster> --local-path /path/to/oscar-hub/crates
oscar-cli service deployment status vscode --cluster <cluster>
```

## Access and health check

Open the HTTPS service endpoint assigned by OSCAR and sign in with the configured password. The FDL exposes port `8443` and sets `/healthz` as the health-check path.

The FDL currently contains `PASSWORD: password` as an example. Replace it with a strong secret before deploying the service, and do not commit real credentials to the repository. The container runs with `PUID=1000`, `PGID=1000`, and `TZ=Etc/UTC`.

The `script.sh` file is retained for the crate's FDL configuration; `default_command: true` selects the image's default startup command instead of using the script as the startup command.
