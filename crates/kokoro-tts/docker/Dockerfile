# Lightweight image of Python
FROM python:3.10-slim

# Installation of necessary system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app


# Install the libraries
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir kokoro-onnx onnxruntime pydub soundfile

# Copy the files, making sure the destination is the /app/model/ folder.
# NOTE: Make sure these files are located next to your Dockerfile on your computer
COPY ./model/kokoro-v1.0.onnx /app/model/kokoro-v1.0.onnx
COPY ./model/voices-v1.0.bin /app/model/voices-v1.0.bin

# Copy logic scripts
COPY kokoro_factory.py .
COPY script.sh .

RUN chmod +x script.sh

ENTRYPOINT ["/bin/bash", "/app/script.sh"]
