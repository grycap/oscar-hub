# ImageMagick Service for OSCAR

This crate packages an OSCAR service built on top of an ImageMagick container. Each input image is processed with lightweight ImageMagick operations to generate derived artifacts that are useful for simple image-analysis workflows.

For every uploaded PNG or JPG image, the service produces:

- a grayscale version (`*_gray.png`),
- an edge-enhanced version (`*_edges.png`),
- a JSON report (`*_metrics.json`) with width, height, average brightness, contrast, and edge density.

This crate also includes teaching material:

- `oscar-image-processing-notebook.ipynb`, an English-language Jupyter notebook with didactic explanations of the OSCAR + MinIO + Jupyter workflow,
- `sample-images/`, a ready-to-use image collection for classroom demonstrations and local testing.

The included `fdl.yml` uses generic paths:

```yaml
name: imagemagick
path: imagemagick/input
path: imagemagick/output
```

Adjust the service name, OSCAR cluster identifier, and MinIO storage provider/path values before deployment if your environment requires different values.

## Teaching workflow

The bundled notebook is meant to be used after the service has processed one or more images. A typical learning flow is:

1. Deploy the service from `fdl.yml`.
2. Upload one or more files from `sample-images/` to the service input bucket.
3. Download or mount the generated artifacts into a local `output/` directory inside this crate.
4. Open `oscar-image-processing-notebook.ipynb` and inspect the metrics, plots, and galleries.

Example asynchronous upload loop using the bundled sample data:

```bash
for image in crates/imagemagick/sample-images/*; do
  oscar-cli service put-file imagemagick "$image"
done
```

## Build a multi-arch container image

This crate includes a local build context at `docker/Dockerfile` based on `debian:bookworm-slim`, which is available for multiple architectures.

Build and push a multi-arch image with Docker Buildx:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f crates/imagemagick/docker/Dockerfile \
  -t ghcr.io/<your-org>/imagemagick:latest \
  --push \
  .
```

If you only want to test locally on your current architecture:

```bash
docker build \
  -f crates/imagemagick/docker/Dockerfile \
  -t imagemagick:local \
  crates/imagemagick
```

To verify the image:

```bash
docker run --rm ghcr.io/<your-org>/imagemagick:latest 'magick -version || convert -version'
```

After publishing the image, update `image:` in `fdl.yml` to point to your registry, for example:

```yaml
image: ghcr.io/<your-org>/imagemagick:latest
```

The Debian package currently exposes ImageMagick 6 style commands such as `convert` and `identify`. The service script is already compatible with both ImageMagick 6 and 7 runtimes.

Example deployment:

```bash
oscar-cli apply crates/imagemagick/fdl.yml
```

Example asynchronous execution flow:

```bash
oscar-cli service put-file imagemagick crates/imagemagick/input.png
sleep 20
oscar-cli service get-file imagemagick --download-latest-into ./output
```

Example synchronous invocation:

```bash
oscar-cli service run imagemagick --input ./crates/imagemagick/input.png --output ./result.zip
```

Because the script generates three output files, synchronous execution returns a ZIP archive containing `*_gray.png`, `*_edges.png`, and `*_metrics.json`.
