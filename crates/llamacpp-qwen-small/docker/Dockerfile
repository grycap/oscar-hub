FROM debian:bookworm-slim AS builder

ARG DEBIAN_FRONTEND=noninteractive
ARG LLAMA_CPP_COMMIT=a1cfb645307edc61a89e41557f290f441043d3c2
ARG TARGETARCH

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    git \
    libcurl4-openssl-dev \
    libopenblas-dev \
    pkg-config && \
    rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/ggml-org/llama.cpp.git /src/llama.cpp

WORKDIR /src/llama.cpp

RUN git checkout "$LLAMA_CPP_COMMIT" && \
    CMAKE_ARCH_ARGS="" && \
    if [ "$TARGETARCH" = "arm64" ]; then \
      CMAKE_ARCH_ARGS="$CMAKE_ARCH_ARGS -DGGML_CPU_ARM_ARCH=armv8-a"; \
    fi && \
    cmake -S . -B build \
      -DBUILD_SHARED_LIBS=OFF \
      -DCMAKE_BUILD_TYPE=Release \
      -DLLAMA_BUILD_TESTS=OFF \
      -DLLAMA_BUILD_EXAMPLES=OFF \
      -DLLAMA_BUILD_TOOLS=ON \
      -DLLAMA_BUILD_SERVER=ON \
      -DGGML_NATIVE=OFF \
      -DGGML_LLAMAFILE=OFF \
      -DGGML_BLAS=ON \
      -DGGML_BLAS_VENDOR=OpenBLAS \
      $CMAKE_ARCH_ARGS && \
    cmake --build build --config Release --target llama-server -j"$(nproc)"

FROM python:3.12-slim-bookworm AS model

ARG MODEL_REPO=Qwen/Qwen2.5-0.5B-Instruct-GGUF
ARG MODEL_FILE=qwen2.5-0.5b-instruct-q4_k_m.gguf
ARG MODEL_REVISION=9217f5db79a29953eb74d5343926648285ec7e67

RUN pip install --no-cache-dir huggingface_hub

RUN hf download "$MODEL_REPO" "$MODEL_FILE" \
      --revision "$MODEL_REVISION" \
      --local-dir /models

FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libgomp1 \
    libopenblas0-pthread && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /src/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server
COPY --from=model /models /models
COPY script.sh /opt/service/script.sh

RUN chmod +x /opt/service/script.sh

WORKDIR /opt/service

ENV MODEL_PATH=/models/qwen2.5-0.5b-instruct-q4_k_m.gguf

CMD ["/opt/service/script.sh"]
