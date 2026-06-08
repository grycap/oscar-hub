#!/bin/bash

# 1. Start RabbitMQ in the background
rabbitmq-server & 

# 2. Wait for the node to become operational
rabbitmq-diagnostics -q wait --timeout 60

# 3. Enable plugins
rabbitmq-plugins enable rabbitmq_auth_backend_http 
rabbitmq-plugins enable rabbitmq_mqtt
rabbitmq-plugins enable rabbitmq_management

# Get the service name
SERVICE_NAME=$(grep "^name:" /oscar/config/function_config.yaml | awk '{print $2}')

# Get the service token
SERVICE_TOKEN=$(grep "^token:" /oscar/config/function_config.yaml | awk '{print $2}')

# --- ADMIN ---
ADMIN_USER="${SERVICE_NAME}-admin"


# Create admin user (We add '|| true' in case the service restarts and already exists)
rabbitmqctl add_user "$ADMIN_USER" "$SERVICE_TOKEN" || true

# CHANGE 1: Changed 'management' to 'administrator' to give full access to the CLI/API
rabbitmqctl set_user_tags "$ADMIN_USER" administrator

# CHANGE 2: Grants full permissions (Configure, Write, Read) on any resource (.*) of the vhost '/'
# This allows you to create/delete queues, exchanges, and add other users.
rabbitmqctl set_permissions -p / "$ADMIN_USER" ".*" ".*" ".*"

# CHANGE 3: Grants full Topic permissions on any exchange and for any routing key
rabbitmqctl set_topic_permissions -p / "$ADMIN_USER" ".*" ".*" ".*"

# Keep the process in the foreground so that Service's Pod doesn't die
wait
