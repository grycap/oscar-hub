# Cowsay

```
 __________
< Hi there >
 ----------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||

```

This example shows the basic functionality to invoke OSCAR services
synchronously.

## Deployment

Deployment of synchronous services doesn't differ from asynchronous ones, the
only requirement is that the Knative serverless backend must be deployed and
configured in the cluster. Then, the `/run/<SERVICE_NAME>` path will be available within the
[OSCAR's API](https://grycap.github.io/oscar/api/).

To deploy this service through
[OSCAR-CLI](https://github.com/grycap/oscar-cli) you only have to place in
this folder and run:

```sh
oscar-cli apply cowsay.yaml
```

It can also be deployed through the OSCAR's web interface using the container
image `ghcr.io/grycap/cowsay` and the user script available in this folder.
**Remember to set the service's log_level to "CRITICAL" to avoid FaaS
Supervisor logs in the response.**

## Invoking the service

### OSCAR-CLI

The easy way to invoke a service synchronously is by running the
[`oscar-cli service run`](https://github.com/grycap/oscar-cli#run) command.
For example, if the `INPUT_TYPE` is configured as `json`:

```sh
oscar-cli service run cowsay --text-input '{"message": "Hi there"}'
```

### cURL

Naturally, OSCAR services can also be invoked via traditional HTTP clients
such as [cURL](https://curl.se/) via the path `/run/<SERVICE_NAME>`. 

```sh
curl -H 'Authorization: Bearer <SERVICE_TOKEN>' -d '{"message": "Hi there"}' https://<CLUSTER_ENDPOINT>/run/cowsay
```