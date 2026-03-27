FROM --platform=$BUILDPLATFORM golang:1.25-bookworm AS oscar-cli-builder

ARG TARGETPLATFORM
ARG BUILDPLATFORM

ARG OSCAR_CLI_VERSION=v1.13.0

RUN GOBIN=/tmp/bin go install github.com/grycap/oscar-cli@${OSCAR_CLI_VERSION}

FROM --platform=$BUILDPLATFORM node:22-bookworm-slim

ARG TARGETPLATFORM
ARG BUILDPLATFORM

WORKDIR /opt/ghostty-web

LABEL org.opencontainers.image.source="https://github.com/grycap/oscar-hub"
LABEL org.opencontainers.image.description="Ghostty Web terminal for OSCAR Hub with OSCAR CLI preinstalled"
LABEL org.opencontainers.image.licenses="MIT"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    g++ \
    make \
    python3 \
    tmux \
    && rm -rf /var/lib/apt/lists/*

COPY --from=oscar-cli-builder /tmp/bin/oscar-cli /usr/local/bin/oscar-cli
COPY docker/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force

COPY docker/server.js ./server.js
COPY script.sh ./script.sh

RUN chmod +x ./script.sh

EXPOSE 8080

ENTRYPOINT ["/opt/ghostty-web/script.sh"]
