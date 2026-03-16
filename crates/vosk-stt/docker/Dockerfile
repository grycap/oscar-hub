FROM python:3.9-slim

# Install FFmpeg and dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Vosk
RUN pip install --no-cache-dir vosk

# Copy templates
COPY ./model-es /opt/vosk-model-es
COPY ./model-en /opt/vosk-model-en

# Copy scripts
COPY transcribe_vosk.py .
COPY script.sh .

RUN chmod +x /app/script.sh

ENTRYPOINT ["/bin/bash", "/app/script.sh"]
