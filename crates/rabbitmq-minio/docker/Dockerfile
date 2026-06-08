# We use the official RabbitMQ image with management included
FROM rabbitmq:4.3.0-management

# Avoid interactive dialogues during installation
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# 1. Install Python and the necessary libraries (Pika for RabbitMQ and Boto3 for MinIO)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-pika \
    python3-boto3 \
    && rm -rf /var/lib/apt/lists/*


# 3. Copy your local files to the image
# (Make sure these files are in the same folder as the Dockerfile)
COPY queue-subscribe.py .

# 5. Define the entry point

CMD ["python3", "queue-subscribe.py"]
