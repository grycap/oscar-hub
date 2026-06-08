import pika
import time

# topic username and password 
SERVICE_NAME= 'service-name'
SERVICE_TOKEN= 'token-service'
TOPIC='oscar.service-name'

delay=5 # Delay time between messages

credentials = pika.PlainCredentials(SERVICE_NAME,SERVICE_TOKEN)

#connection = pika.BlockingConnection(pika.ConnectionParameters('localhost', credentials=credentials))

# REPLACE the long URL with the mapped host and port
# If you're in the same environment as Rabbit: 'localhost'
# If it's remote: the domain without 'https://' or routes
host_cluster = 'cluster.im.grycap.net' 
amqp_port = 30300 # # Make sure this is the AMQP NodePort, not the HTTPS one

connection = pika.BlockingConnection(
    pika.ConnectionParameters(
        host=host_cluster, 
        port=amqp_port, 
        credentials=credentials
    )
)

channel = connection.channel()
number_message=8
# We posted x messages in a row to test the accumulator
for i in range(1, number_message):
    message = f"Message - {i}"
    channel.basic_publish(
        exchange='amq.topic',
        routing_key=TOPIC, # topic
        body=message
    )
    print(f" [!] Send: {message}")
    time.sleep(delay)

connection.close()
