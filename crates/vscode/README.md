# VS Code Server on OSCAR

This crate deploys [code-server](https://github.com/coder/code-server), providing a browser-accessible VS Code environment with the LinuxServer `linuxserver/code-server:4.146.0` image.

## Deploy

Requires an OSCAR cluster with exposed services using HTTPRoute/Traefik ForwardAuth and managed volumes, and an `oscar-cli` profile with permission to create services. The service requests 1 CPU and 1 GiB of memory, runs one replica, and reserves a 1 GiB volume at `/config` with the `retain` lifecycle policy. The default workspace is `/config/workspace`, so workspace files are stored on that volume.

The volume preserves code-server's configuration, user data, and workspace when the service is recreated; it is retained when the service is deleted. The private MinIO bucket `vscode-data` is also mounted at `/mnt/vscode-data`. Use it for large datasets to process or data shared with other OSCAR services; it is separate from the workspace and is not intended for Git working trees.

```sh
oscar-cli hub deploy vscode --cluster <cluster> --local-path /path/to/oscar-hub/crates
oscar-cli service deployment status vscode --cluster <cluster>
```

Changing an existing deployment from another bucket does not migrate its objects; preserve and transfer any data separately if needed.

## Access and health check

Open the HTTPS service endpoint assigned by OSCAR and authenticate through OSCAR ForwardAuth. The FDL enables `expose.set_auth: true` with `auth_type: forward` and do not set `PASSWORD` or `HASHED_PASSWORD`, so code-server does not present a second login. ForwardAuth protects the external route, not direct in-cluster access to the application; restrict access to the pod and internal Service accordingly.

The FDL exposes port `8443` and configures `/healthz` as the health-check path. The image's default startup command is used (`default_command: true`); `script.sh` remains listed in the FDL but is not the startup command.
