# Deploy Qwen2.5-0.5B-Instruct with llama.cpp on OSCAR

This crate deploys an OSCAR exposed service that serves a small quantized LLM through `llama.cpp` and the OpenAI-compatible HTTP API. It is intended for OSCAR clusters with limited CPU and memory resources, including CPU-only `linux/arm64` nodes.

The image compiles `llama.cpp` from source during the Docker build and stores the GGUF model inside the final image, so the service can start without downloading weights at runtime.

## Why this crate

- OpenAI-compatible endpoint for tools such as Hermes Agent or OpenClaw
- Small memory footprint compared with GPU-first runtimes such as `vLLM`
- Works on CPU-only clusters
- Suitable for lightweight integrations, validation environments, and low-throughput use cases

## Model and runtime

- Runtime: `llama.cpp`
- Model: `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
- Quantization: `q4_k_m`
- Model file: `qwen2.5-0.5b-instruct-q4_k_m.gguf`

The default `fdl.yml` requests `2 vCPU` and `3 GiB` of memory. That is a reasonable starting point for small OSCAR deployments.

## Build the image

Run the build from the crate root so Docker can access `script.sh` and `docker/Dockerfile`:

```bash
docker buildx build \
  --platform linux/arm64 \
  --load \
  -f docker/Dockerfile \
  -t <registry>/llamacpp-qwen-small:0.1.0 \
  .
```

Use `--push` instead of `--load` to publish the image directly to a registry. Update `fdl.yml` so the `image:` field matches the registry and tag used in your environment.

## Deploy with OSCAR CLI

```bash
oscar-cli apply fdl.yml
```

Before deploying, make sure the `image:` reference in `fdl.yml` points to an image that is reachable from the target OSCAR cluster.

The service is exposed on:

```text
https://<OSCAR-ENDPOINT>/system/services/llamacpp-qwen-small/exposed
```

If you deploy the service with a different name, replace `llamacpp-qwen-small` in the URL examples with the actual deployed service name.

The crate uses OSCAR-managed service metadata to configure the exposed base path and the runtime API key. When available, it reads `OSCAR_SERVICE_NAME`, `OSCAR_SERVICE_TOKEN`, and `OSCAR_SERVICE_BASE_PATH` from the container environment. For compatibility with older OSCAR deployments, it can still fall back to the mounted service configuration file.

To keep the OSCAR readiness probe working, the crate exposes a lightweight `/health` route in the local compatibility proxy and sets `probe_mode: direct` in the `fdl.yml`.

The Web UI is also protected by the compatibility proxy. When you open the UI in a browser, the proxy presents a small login page, stores the service token in an HTTP-only cookie, and reuses it for the UI requests sent to `llama-server`.

## Why this crate uses a proxy

This crate keeps `llama.cpp` upstream and does not patch its server implementation. A small compatibility proxy is needed because the OSCAR exposed-service model and `llama.cpp` authentication do not line up cleanly when `--api-prefix` and `--api-key` are used together.

In practice, three issues appear:

- OSCAR pod probes cannot send `Authorization` headers.
- `llama.cpp` protects prefixed routes such as `/system/services/<name>/exposed/v1/models` when `--api-key` is enabled, so the pod stays `Running` but `0/1`.
- The browser Web UI can load static pages, but its API calls still need a token and would otherwise fail with `401`.

The proxy solves those integration points without modifying upstream `llama.cpp`:

- it exposes a direct `/health` endpoint for OSCAR readiness and liveness probes;
- it keeps Bearer-token authentication for OpenAI-compatible clients;
- it provides a simple login flow for the Web UI and forwards the token to the backend.

## Test the OpenAI-compatible API

List models:

```bash
curl -X GET \
  "https://<OSCAR-ENDPOINT>/system/services/llamacpp-qwen-small/exposed/v1/models" \
  -H "Authorization: Bearer <OSCAR-SERVICE-TOKEN>"
```

Create a chat completion:

```bash
curl -X POST \
  "https://<OSCAR-ENDPOINT>/system/services/llamacpp-qwen-small/exposed/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OSCAR-SERVICE-TOKEN>" \
  --data '{
    "model": "Qwen2.5-0.5B-Instruct",
    "messages": [
      {
        "role": "user",
        "content": "Respond with a short JSON object confirming that the API works."
      }
    ]
  }'
```

## Use with Hermes Agent or OpenClaw

Point the client at the exposed `/v1` base URL:

```text
https://<OSCAR-ENDPOINT>/system/services/llamacpp-qwen-small/exposed/v1
```

Use the OSCAR service token as the API key. The model name to configure in the client is:

```text
Qwen2.5-0.5B-Instruct
```

## Tuning notes

- `CONTEXT_SIZE=2048` keeps RAM use under control for small nodes.
- `N_THREADS=2` matches the default CPU request.
- `N_PARALLEL=1` avoids extra memory pressure.
- `N_PREDICT=512` is enough for short integration tests.

If the service is stable and you want a bit more quality, the next change to try is `q5_k_m` instead of `q4_k_m`.

## Configurable variables

The `fdl.yml` exposes two tuning variables by default:

- `CONTEXT_SIZE`: Maximum context window used by the model for each request. Higher values allow longer prompts and conversation history, but they also increase memory usage.
- `N_PREDICT`: Maximum number of tokens the model is allowed to generate in a response. Higher values allow longer answers, but they also increase latency and runtime cost.

For small CPU-oriented deployments, `CONTEXT_SIZE=2048` and `N_PREDICT=512` are conservative defaults that work well for integration and validation scenarios.
