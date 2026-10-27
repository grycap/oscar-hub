# Docling Service for OSCAR

This crate provides a Docling-based OSCAR service that converts documents to Markdown using Docling's standard local pipeline.

The service supports both invocation modes exposed by OSCAR:

- synchronous: `oscar-cli service run docling --file-input <file>` returns the result directly
- asynchronous: `oscar-cli service put-file docling <file>` uploads to `docling/input`; retrieve results from `docling/output`

For example, `paper.pdf` is converted to `paper.md`.

## Processing model

The service uses the official CPU image:

```text
quay.io/docling-project/docling-serve-cpu:v1.32.0
```

The standard pipeline does not require an external LLM. It uses Docling's local parsing, layout, table, and OCR components. A VLM or remote OpenAI-compatible service is intentionally not enabled in this proof of concept. The official image bundles the required standard-pipeline models at build time, so asynchronous jobs do not download them repeatedly; a cold start may still require pulling the container image and loading the models into memory.

## Synchronous invocation

### Single document

```bash
oscar-cli service run docling \
  --file-input crates/docling/input.pdf \
  --output result.md
```

Omit `--output result.md` to print the Markdown instead of saving it locally. This invocation does not create an object in the output bucket.

### ZIP of documents

For a ZIP input, save the synchronous response as a ZIP:

```bash
oscar-cli service run docling \
  --file-input ./test-oscar-77.zip \
  --decode-output \
  --output ./result.zip
```

`--decode-output` extracts the binary ZIP from OSCAR's base64 response. The response is a ZIP even when the input has only one document. It preserves the input ZIP's directory structure: `test-oscar-77/test00.pdf` becomes `test-oscar-77/test00.md`. OSCAR does not pass the original filename to synchronous invocations, so the service does not add an outer folder named after the input ZIP. This invocation does not create objects in the output bucket.

## Asynchronous invocation

### Single document

Upload the sample document:

```bash
oscar-cli service put-file docling crates/docling/input.pdf
```

After the job completes, download the latest output:

```bash
oscar-cli service get-file docling \
  --download-latest-into ./output
```

`--download-latest-into` downloads one object: the most recent result under the configured output path. The asynchronous output is named `input.md` because the sample input is `input.pdf`. For `paper.pdf`, the output is `paper.md`.

### ZIP of documents

For asynchronous batch processing, upload a ZIP containing documents in the formats listed below:

```bash
oscar-cli service put-file docling ./batch.zip
```

Each document is converted separately. The results appear under `docling/output/batch/` in the MinIO bucket, preserving the ZIP's subdirectories. For example, `paper.pdf` and `tables/data.xlsx` produce `batch/paper.md` and `batch/tables/data.md`. The folder uses the ZIP filename without its `.zip` extension. If the ZIP already contains a top-level `batch/` folder, that redundant level is removed, so `batch/paper.pdf` still produces `batch/paper.md`. Download the individual Markdown objects from that output path.

List the batch results and download a specific Markdown file:

```bash
oscar-cli service list-files docling minio.default docling/output/batch/
oscar-cli service get-file docling minio.default \
  docling/output/batch/paper.md ./paper.md
```

ZIP processing ignores macOS metadata (`__MACOSX/`, `._*`, and `.DS_Store`). It fails if another entry is unsupported, a conversion fails, or two entries would produce the same Markdown path. The script validates archive paths before extraction. Single-document synchronous and asynchronous behavior is unchanged.

## Deployment

```bash
oscar-cli hub deploy docling \
  --cluster <cluster> \
  --local-path <oscar-hub>/crates
```

The service requires a MinIO provider for asynchronous invocation and a Knative Serverless Backend for synchronous invocation.

## Scope and limitations

This is intentionally a small proof of concept. It does not expose Docling Serve's native HTTP API and does not use a VLM or external LLM. The container is large because the official image includes the standard pipeline dependencies and models. The version is pinned to avoid floating-image changes.

Supported document extensions, including those inside ZIPs, are `.pdf`, `.md`, `.markdown`, `.tex`, `.latex`, `.html`, `.htm`, `.csv`, `.docx`, `.pptx`, `.xlsx`, `.png`, `.jpg`, `.jpeg`, `.tif`, and `.tiff`.
