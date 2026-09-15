# Docling Service for OSCAR

This crate provides a Docling-based OSCAR service that converts a document to Markdown using Docling's standard local pipeline.

The service supports both invocation modes exposed by OSCAR:

- synchronous: `oscar-cli service run docling --file-input <file>`
- asynchronous: upload a file to the `docling/input` path and retrieve the result from `docling/output`

For example, `paper.pdf` is converted to `paper.md`.

## Processing model

The service uses the official CPU image:

```text
quay.io/docling-project/docling-serve-cpu:v1.32.0
```

The standard pipeline does not require an external LLM. It uses Docling's local parsing, layout, table, and OCR components. A VLM or remote OpenAI-compatible service is intentionally not enabled in this proof of concept. The official image bundles the required standard-pipeline models at build time, so asynchronous jobs do not download them repeatedly; a cold start may still require pulling the container image and loading the models into memory.

## Synchronous invocation

```bash
oscar-cli service run docling \
  --file-input crates/docling/input.pdf \
  [--output result.md]
```

The `[--output result.md]` notation means that the output option is optional. When omitted, `oscar-cli` returns the synchronous result without saving it to a local file.

For synchronous invocations, the script returns the converted Markdown on standard output. For asynchronous storage-triggered jobs, it writes the result to `TMP_OUTPUT_DIR`; OSCAR then uploads the single Markdown file to the configured output storage.

## Asynchronous invocation

Upload the sample document:

```bash
oscar-cli service put-file docling crates/docling/input.pdf
```

After the job completes, download the latest output:

```bash
oscar-cli service get-file docling \
  --download-latest-into ./output
```

The asynchronous output is named `input.md` because the sample input is `input.pdf`. For `paper.pdf`, the output is `paper.md`.

## Deployment

```bash
oscar-cli hub deploy docling \
  --cluster <cluster> \
  --local-path <oscar-hub>/crates
```

The service requires a MinIO provider for asynchronous invocation and a Knative Serverless Backend for synchronous invocation.

## Scope and limitations

This is intentionally a small proof of concept. It does not expose Docling Serve's native HTTP API and does not use a VLM or external LLM. The container is large because the official image includes the standard pipeline dependencies and models. The version is pinned to avoid floating-image changes.
