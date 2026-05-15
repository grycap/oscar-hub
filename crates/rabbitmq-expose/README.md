# RabbitMQ to MinIO Bridge for OSCAR

This project implements a batch processing service designed to run within the OSCAR ecosystem. The architecture uses a custom RabbitMQ 4.3.0 image that acts as a multiprotocol messaging broker, allowing data ingestion from IoT devices (currently only via AMQP) and subsequent processing using Python scripts. The processed messages are sent as a text file to a MinIO bucket.
