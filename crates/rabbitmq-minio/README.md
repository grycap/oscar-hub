# RabbitMQ to MinIO Bridge for OSCAR

This project implements a batch processing service designed to run within the OSCAR ecosystem. The architecture uses a custom RabbitMQ 4.3.0 image that acts as a multiprotocol messaging broker, allowing data ingestion from IoT devices, currently over MQTT, HTTP, and AMQP and subsequent processing using Python scripts. The processed messages are sent as a text file to a MinIO bucket.

## Definition of the service in the fdl file

- The image used is based on a RabbitMQ Docker image (rabbitmq:4.3.0-management) on which a Python script is executed that listens to the queue created in the service and when it has a certain number of messages, it sends them as a text file to a MinIO bucket.
- Ensure that the API port is the one for the desired protocol (AMQP - port 5672, MQTT - port 1883 and RabbitMQ broker API - 15672)
- You can assign nodePorts statically ([30100, 30200, 30300]), but ensure these ports have not been previously assigned. If you define nodePorts as an array of zeros ([0,0,0]), they will be assigned dynamically; that is, random ports will be assigned for each protocol.
- Define the name of the MinIO bucket where the data will be sent, as well as the credentials. The bucket must be created before launching the service.
- Define the number of messages you want to process

```
functions:
  oscar:
  - rabbitMQ-broker:
      name: rabbitmq-service
      image: vrodben1/rabbitmq-expose:0.0.3
      memory: 2Gi
      cpu: '1.0'
      script: script-rabbitMQ.sh
      expose:
        min_scale: 1
        max_scale: 1
        api_port: [15672,1883,5672]  
        cpu_threshold: 80     
        default_command: false 
        rewrite_target: false
        nodePort: [30100, 30200, 30300]
      environment:
        variables:
          BATCH_SIZE: "10"
          MINIO_ENDPOINT: "https://minio.cluster.im.grycap.net"
          BUCKET: "oscar-bucket"
        secrets:
          MINIO_ACCESS: "xxxxxxxxx"
          MINIO_SECRET: "xxxxxxxxx"
```

## Service script configuration

The service script configures the RabbitMQ broker:

- Launches the broker in the background and installs the necessary plugins.
- Creates a broker user based on the SERVICE_NAME and uses the broker's token as the password. Configures the user with write permissions to the queue and the topic exchange.
- Defines the service queue characteristics and connects the amq.topic exchange to the queue, ensuring messages reach their destination. A maximum queue length (QUEUE_MAX_LENGTH) is set, currently defined as 100 messages.
- Keeps the Python script running.This Python script implements a batch processor that acts as a bridge between RabbitMQ and MinIO. It uses the pika library to monitor a specific queue and boto3 for integration with S3 storage. Its core logic consists of a loop that queries the queue's status. When the number of accumulated messages equals or exceeds the configured BATCH_SIZE, the script extracts the messages, saves them to a memory buffer, and generates a .txt file. It then uploads the file to MinIO. Finally, it removes the processed messages from the queue.

## Run client

You can use any client that sends AMQP messages, MQTT messages, or HTTP requests.

We have developed 3 Python scripts that will allow you to interact with the broker through different channels.

Key elements:

- Username: This will be the name you assigned to the service (SERVICE_NAME).

- Password: This will be the token for the created service.

- Publishing topic: This will have the format oscar.SERVICE_NAME for AMQP and HTTP requests, and oscar/SERVICE_NAME for MQTT.

- RabbitMQ broker URL: The domain name of the cluster where you deployed the service. The domain without HTTPS.

- Port: The nodePort defined when creating the service. If the protocols were created dynamically, use the OSCAR API (/system/services/serviceName) to view the port assigned to each protocol.

Important libraries for each script:

- queue-publisher-amqp.py

pika: This is the official Python client library for communicating with RabbitMQ.

boto3: This is the standard library for any S3-compatible system (like your MinIO).

- queue-publisher-mqtt.py

paho.mqtt: The most widely used open-source library for implementing the MQTT protocol.

- queue-publisher-http.py

requests: Python's most popular way to make HTTP requests.

## Notes




