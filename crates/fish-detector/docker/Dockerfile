# Construction phase
FROM ubuntu:22.04 AS builder

ARG TARGETARCH
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-dev \
        gcc \
        ffmpeg \
        wget \
        jq && \
    rm -rf /var/lib/apt/lists/*

# Copy source files
COPY ./fish_detector.py ./requirements.txt /app/

# Download YOLO model
RUN wget https://github.com/obsea-upc/obsea-fish-detector-oscar/releases/download/model_v1/yolov8x_obsea_19sp_2538img.pt \
    -O /app/yolov8x_obsea_19sp_2538img.pt

# Install torch and torchvision according to architecture
RUN if [ "$TARGETARCH" = "arm64" ]; then \
        pip3 install --no-cache-dir torch==2.0.1 torchvision==0.15.2; \
    else \
        pip3 install --no-cache-dir torch==2.3.0+cpu torchvision==0.18.0+cpu --index-url https://download.pytorch.org/whl/cpu; \
    fi && \
    pip3 install --no-cache-dir -r requirements.txt && \
    rm -rf /root/.cache/pip

# Final stage: light image
FROM ubuntu:22.04
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ffmpeg \
        gawk && \
    rm -rf /var/lib/apt/lists/*


# 1. Copy code and model
COPY --from=builder /app /app

# 2. Strictly copy all installed library directories
COPY --from=builder /usr/local/lib/python3.10/dist-packages /usr/local/lib/python3.10/dist-packages
COPY --from=builder /usr/lib/python3/dist-packages /usr/lib/python3/dist-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Ensure that the system finds executables in the user path
ENV PATH="/root/.local/bin:$PATH"

# Run the detection script
ENTRYPOINT ["python3", "fish_detector.py"]

