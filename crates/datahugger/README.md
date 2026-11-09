# DataHugger DOI downloader on OSCAR

This crate runs a web application so that a user enters a **bare DOI or a `https://doi.org/` link** and the service downloads the files locally with [DataHugger](https://github.com/J535D165/datahugger) into the storage **already mounted on this service**. A Jupyter Notebook may attach the same bucket or named volume separately for further data processing.

## Build and deploy

The FDL references the published multi-architecture image `ghcr.io/grycap/oscar-datahugger:0.1.0`.

```sh
oscar-cli hub deploy datahugger --cluster <cluster> --local-path /path/to/oscar-hub/crates
oscar-cli service deployment status datahugger --cluster <cluster>
```

When deploying under a custom service name, copy `fdl.yml` and `script.sh` to a private temporary directory, edit only the copy's `name` (and image if needed), and run `oscar-cli apply` on that copy without `-n`. Keep `mount.path: datahugger` and `DATAHUGGER_DATA_DIR: /mnt/datahugger` together.

The default `mount` uses a private MinIO bucket named `datahugger` (as the name of the service), mounted at `/mnt/datahugger`. Create/authorize the bucket through OSCAR separately, or change `mount.path` to your own bucket and set `DATAHUGGER_DATA_DIR` to `/mnt/<bucket>`. The Notebook must mount **that same bucket**; no `input` or `output` bucket is needed in this FDL. For a managed volume instead, replace the `mount` block with the following (the volume must already exist in the same user namespace), and set `DATAHUGGER_DATA_DIR: /datasets`:

```yaml
volume:
  name: my-existing-volume
  mount_path: /datasets
```

Do not specify `volume.size` when reusing an existing volume. The image runs as UID 1000; check that this UID can write the selected mount. The FDL allocates 1 vCPU and 1 GiB of memory. The web endpoint is the OSCAR exposed-service route, normally `https://datahugger.<cluster-host>/` with subdomain routing.

## Behavior and limitations

- Only DOI strings and exact `https://doi.org/<DOI>` links are accepted, not arbitrary URLs or caller-supplied filesystem paths. Links are normalized to their bare DOI before resolution and storage. One download at a time per pod. The page shows the latest 20 downloads in a table; the background subprocess times out after one hour by default and the table refreshes automatically. Status and history are **in memory** and do not survive pod restarts. This is a single-pod prototype, not a durable distributed job queue.
- DataHugger first resolves metadata and downloads using `info(..., unzip=False)`. A dataset must disclose nonnegative integer sizes for every file. Filenames are checked for traversal, duplicates and reserved names; defaults allow up to 100 files, 2 GiB total declared size, and 1 GiB per file. Linux also enforces a per-file write limit, and downloaded files are checked again after completion. Metadata can be wrong; the total-size precheck is **not** a hard disk or network quota. Apply a real bucket/PVC quota and limit egress at the cluster level. Archives are not extracted.
- Each request creates a new directory in the mount, e.g. `doi-10-5061-dryad-mj8m0-<id>`. A `.datahugger-complete.json` marker appears **last**, only on success. An error, restart or interrupted copy can leave partial files; they are **not deleted or overwritten automatically**. Inspect these directories before consuming data. Repeating a DOI creates another directory.

## Run locally with a Docker volume

From the `oscar-hub` repository root, build the current app and start it with a named Docker volume:

```sh
cd crates/datahugger
docker build -f docker/Dockerfile -t datahugger-preview .
docker run --rm -p 127.0.0.1:18080:8080 \
  --mount type=volume,source=datahugger-preview-data,target=/home/app \
  -e DATAHUGGER_DATA_DIR=/home/app \
  datahugger-preview
```

Open `http://127.0.0.1:18080/`; stop the container with Ctrl+C. Stop any previous container using port 18080 first. Docker creates `datahugger-preview-data` on first use; downloaded datasets remain in that volume after the container stops. The mount target `/home/app` is writable by the image's non-root UID 1000; the application still requires an active mount, so a plain unmounted container cannot download. This is **local test storage**, not the OSCAR bucket; in OSCAR, keep `DATAHUGGER_DATA_DIR=/mnt/datahugger` and its matching bucket mount. This direct local port does not provide OSCAR ForwardAuth; bind it only to loopback as shown.

## Verify locally (without an OSCAR deployment)

```sh
python3 -m unittest discover -s crates/datahugger/tests -v
npm test
npm run build
uvx --from roc-validator rocrate-validator validate -p ro-crate-1.2 --no-paging --verbose crates/datahugger
```

For an end-to-end deployment, check the service readiness; test the anonymous route is denied and an authorized form submission succeeds; confirm the completion marker and dataset files in the **same** bucket or volume from a Notebook. No cluster acceptance test is declared in this crate because it would write real external dataset files and needs explicit storage/image/egress provisioning.

## Sources

- DataHugger fork and logo: https://github.com/grycap/datahugger (MIT license). The single `icon.png` is a 512×512 PNG rendered from the fork's logo at the revision pinned in the Dockerfile; it is used by both the catalog and the application.
- OSCAR exposed-service and mount documentation: https://docs.oscar.grycap.net/latest/exposed-services/ and https://docs.oscar.grycap.net/latest/mount/.
