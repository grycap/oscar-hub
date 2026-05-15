#!/bin/bash

# 1. Start RabbitMQ in the background
rabbitmq-server & 

# 2. Wait for the node to become operational
# rabbitmq-diagnostics -q wait_for_startup

# 3.Enable plugins
rabbitmq-plugins enable rabbitmq_auth_backend_http 
rabbitmq-plugins enable rabbitmq_mqtt



# Get the service name
SERVICE_NAME=$(grep "^name:" /oscar/config/function_config.yaml | awk '{print $2}')

# Get the service token
SERVICE_TOKEN=$(grep "^token:" /oscar/config/function_config.yaml | awk '{print $2}')

QUEUE_NAME="queue-oscar-${SERVICE_NAME}"
TOPIC_NAME="oscar.${SERVICE_NAME}"


# Create user and permissions (We add '|| true' in case the service restarts and already exists)
rabbitmqctl add_user $SERVICE_NAME $SERVICE_TOKEN || true
rabbitmqctl set_user_tags $SERVICE_NAME management
# write-only user in the created queue
rabbitmqctl set_permissions -p / $SERVICE_NAME "^${QUEUE_NAME}$" "^(amq\.topic|${QUEUE_NAME})$" "" 
# user with full privileges in the created queue
# rabbitmqctl set_permissions -p / $SERVICE_NAME "^${QUEUE_NAME}$" "^(amq\.topic|${QUEUE_NAME})$" "^${QUEUE_NAME}$"

TOPIC_REGEX="^oscar\.${SERVICE_NAME}$"

rabbitmqctl set_topic_permissions -p / "$SERVICE_NAME" amq.topic "$TOPIC_REGEX" "$TOPIC_REGEX"
# rabbitmqctl set_topic_permissions -p / oscar_user amq.topic "^oscar\.sensor$" "^oscar\.sensor$"

# ---Topology Configuration (Queues and Bindings)---

# The queue length must be greater than BATCH_SIZE
QUEUE_MAX_LENGTH=100 
  
cat <<EOF > /tmp/definitions.json
{
  "queues": [
    {
      "name": "${QUEUE_NAME}",
      "vhost": "/",
      "durable": true,
      "arguments": {
        "x-max-length": ${QUEUE_MAX_LENGTH}
      }
    }
  ],
  "bindings": [
    {
      "source": "amq.topic",
      "vhost": "/",
      "destination": "${QUEUE_NAME}",
      "destination_type": "queue",
      "routing_key": "${TOPIC_NAME}",
      "arguments": {}
    }
  ]
}
EOF

# 2. Import the definitions using rabbitmqctl
# This will create the queue with the defined limit and binding in one step
rabbitmqctl import_definitions /tmp/definitions.json

LIMIT_POLICY_SERVICE="limit-oscar-${SERVICE_NAME}"

# 3. Apply the security policy (as a reinforcement)
rabbitmqctl set_policy $LIMIT_POLICY_SERVICE "^${QUEUE_NAME}$" '{"max-length":10}' --apply-to queues

# Export the variables so that the Python script can read them

BATCH_SIZE=${BATCH_SIZE}
MINIO_ENDPOINT=${MINIO_ENDPOINT}
MINIO_ACCESS=${MINIO_ACCESS}
MINIO_SECRET=${MINIO_SECRET}
BUCKET=${BUCKET}

export QUEUE_NAME BATCH_SIZE MINIO_ENDPOINT MINIO_ACCESS MINIO_SECRET BUCKET

echo "Configuration of the exposed service with RabbitMQ broker completed successfully."
echo "Queue listening process initiated"


python3 /app/queue-subscribe.py &

# 4. Keep the process in the foreground so that Service's Pod doesn't die
wait
