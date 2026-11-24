# VS Code Server on OSCAR

This crate deploys [code-server](https://github.com/coder/code-server), providing a browser-accessible VS Code environment with the LinuxServer `linuxserver/code-server:latest` image.

## Deploy

Requires an OSCAR cluster with exposed services and managed volumes, and an `oscar-cli` profile with permission to create services. The `workspace` bucket must already exist in the `minio.default` storage provider; OSCAR mounts it at `/mnt/workspace`, the configured default workspace. The service requests 1 CPU and 1 GiB of memory, runs one replica, and reserves a 1 GiB volume at `/config` with the `retain` lifecycle policy. The volume preserves code-server's configuration and user data when the service is recreated; it is retained when the service is deleted.

```sh
oscar-cli hub deploy vscode --cluster <cluster> --local-path /path/to/oscar-hub/crates
oscar-cli service deployment status vscode --cluster <cluster>
```

## Access and health check

Open the HTTPS service endpoint assigned by OSCAR and sign in with the configured password. The FDL exposes port `8443` and configures `/healthz` as the health-check path. The image's default startup command is used (`default_command: true`); `script.sh` remains listed in the FDL but is not the startup command.

The FDL currently contains `PASSWORD: password` as an example. Replace it with a strong secret before deploying, and do not commit real credentials to the repository.
