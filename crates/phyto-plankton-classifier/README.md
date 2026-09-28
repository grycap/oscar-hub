# Phytoplankton Classifier on OSCAR

This RO-Crate packages the [AI4OS phytoplankton image classifier](https://dashboard.cloud.imagine-ai.eu/catalog/modules/phyto-plankton-classification), from the [iMagine](https://www.imagine-ai.eu/) Horizon Europe project, as an OSCAR service. It accepts a JPEG input through a synchronous invocation or the MinIO `input/` prefix, and writes `prediction.json` into `TMP_OUTPUT_DIR` (synchronous results can be decoded from OSCAR's response; asynchronous results go to the bucket's `output/` prefix).

## Deploy

```sh
oscar-cli hub deploy phyto-plankton-classifier --cluster <cluster> --local-path <oscar-hub>/crates
oscar-cli service deployment status phyto-plankton-classifier --cluster <cluster>
```

The upstream image is `ai4oshub/phyto-plankton-classification` (floating tag). Deployment requires a MinIO provider for asynchronous jobs, Knative for synchronous invocations, and capacity for a 1-CPU/4-GiB container. 

## Invoke

```sh
oscar-cli service run phyto-plankton-classifier --cluster <cluster> --file-input sample.jpg --decode-output --output /path/to/prediction.json
oscar-cli service put-file phyto-plankton-classifier sample.jpg --cluster <cluster>
oscar-cli service logs list phyto-plankton-classifier --cluster <cluster>
oscar-cli service logs get phyto-plankton-classifier --latest --cluster <cluster>
oscar-cli bucket get phyto-plankton-classifier --prefix output --cluster <cluster>
```

`put-file` uploads to the input prefix and triggers a job; do not also call `service job` unless you deliberately want a second invocation. 

## Upstream compatibility and validation status

The upstream `deepaas-cli predict --image <path>` and `--zip <path>` hand `planktonclas/api.py` a path string where an `UploadedFile` object is required (`content_type` for an image, `filename` for a ZIP). This crate calls the upstream `predict_data()` routine directly with an `UploadedFile` and checks for nonempty predictions before writing `prediction.json`. This does not modify the upstream image.

References: 

- [upstream source](https://github.com/ai4os-hub/phyto-plankton-classification). The upstream model is AGPL-3.0; 
- [iMagine catalog entry](https://dashboard.cloud.imagine-ai.eu/catalog/modules/phyto-plankton-classification)
