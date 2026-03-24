FROM golang:1.25-bookworm AS oscar-cli-builder

ARG OSCAR_CLI_VERSION=v1.13.0

RUN GOBIN=/tmp/bin go install github.com/grycap/oscar-cli@${OSCAR_CLI_VERSION}

FROM node:22-bookworm-slim

WORKDIR /opt/ghostty-web

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
