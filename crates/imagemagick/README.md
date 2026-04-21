# ImageMagick Service for OSCAR

This crate packages an OSCAR service built on top of an ImageMagick container. Each input image is processed with lightweight ImageMagick operations to generate derived artifacts that are useful for teaching, testing, and simple image-analysis workflows.

For every uploaded PNG or JPG image, the service produces:

- a grayscale version (`*_gray.png`),
- an edge-enhanced version (`*_edges.png`),
- a JSON report (`*_metrics.json`) with width, height, average brightness, contrast, and edge density.

The included `fdl.yml` uses generic paths:

```yaml
name: imagemagick
path: imagemagick/input
path: imagemagick/output
```

Adjust the service name, OSCAR cluster identifier, and MinIO storage provider/path values before deployment if your environment requires different values.

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
oscar-cli service get-file imagemagick
```

Example synchronous invocation:

```bash
oscar-cli service run imagemagick --input ./crates/imagemagick/input.png --output ./result.zip
```

Because the script generates three output files, synchronous execution returns a ZIP archive containing `*_gray.png`, `*_edges.png`, and `*_metrics.json`.
