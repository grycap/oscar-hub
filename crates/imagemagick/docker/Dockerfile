FROM debian:bookworm-slim

ARG TARGETPLATFORM
ARG BUILD_DATE
ARG VCS_REF

LABEL org.opencontainers.image.source="https://github.com/grycap/oscar-hub"
LABEL org.opencontainers.image.description="Multi-arch ImageMagick runtime for the OSCAR Hub imagemagick service"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/bin/sh", "-lc"]
CMD ["magick -version || convert -version"]
