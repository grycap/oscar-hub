import pika
import time
import boto3
import io
import os
from datetime import datetime

# --- Configuration ---
# RABBIT_USER = os.environ.get('SERVICE_NAME')
# RABBIT_PASS = os.environ.get('SERVICE_TOKEN')
QUEUE_NAME = os.environ.get('QUEUE_NAME')

BATCH_SIZE = int(os.environ.get('BATCH_SIZE', 5))
MINIO_ENDPOINT = os.environ.get('MINIO_ENDPOINT')
MINIO_ACCESS = os.environ.get('MINIO_ACCESS')
MINIO_SECRET = os.environ.get('MINIO_SECRET')
BUCKET = os.environ.get('BUCKET')


RABBIT_VHOST = '/'
FILE_EXTENSION='txt'


# --- Inicialization MinIO ---
s3_client = boto3.client(
    's3',
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_ACCESS,
    aws_secret_access_key=MINIO_SECRET
)

def check_count(channel):
    """Gets the number of messages ready in the queue."""
    res = channel.queue_declare(queue=QUEUE_NAME, durable=True, passive=True)
    return res.method.message_count

def process_batch(channel):
    received_messages = []
    
    # 1. Extract the batch of messages
    for _ in range(BATCH_SIZE):
        method_frame, header_frame, body = channel.basic_get(queue=QUEUE_NAME, auto_ack=False)
        if method_frame:
            received_messages.append({
                "body": body.decode(),
                "tag": method_frame.delivery_tag,
                "routing_key": method_frame.routing_key # <--- topic
            })

    if received_messages:
        original_topic = received_messages[0]['routing_key']
        # print(original_topic)
        # # Normalize: oscar.sensor -> oscar-sensor (MinIO prefers hyphens)
        # BUCKET = original_topic.replace(".", "-").replace("/", "-").lower()

        # 3. Ensure that the bucket exists dynamically
        try:
            s3_client.head_bucket(Bucket=BUCKET)
        except:
            print(f"[*] Creating a new bucket for the topic: {BUCKET}")
            s3_client.create_bucket(Bucket=BUCKET)

        # 4. Prepare the batch contents in memory
        buffer = io.StringIO()
        for msg in received_messages:
            buffer.write(f"{msg['body']}\n")
        
        # 5. Upload to MinIO
        filename = f"batch_{datetime.now().strftime('%H%M%S')}.{FILE_EXTENSION}"
        try:
            s3_client.put_object(
                Bucket=BUCKET,
                Key=filename,
                Body=buffer.getvalue().encode('utf-8')
            )
            print(f"✅ Batch of '{original_topic}' uploaded to bucket '{BUCKET}' as {filename}")

            # 6. Confirm to RabbitMQ (multiple ACKs until the last message in the batch)
            channel.basic_ack(delivery_tag=received_messages[-1]['tag'], multiple=True)
            print("--- Messages removed from the queue ---")

        except Exception as e:
            print(f"❌ Error uploading to MinIO: {e}")
            print("(!) The messages remain in the queue to retry.")

# --- CONNECTION AND MAIN LOOP ---

#  Only the admin user is used.
credentials = pika.PlainCredentials('guest', 'guest') 
# use user created for the service
# credentials = pika.PlainCredentials(RABBIT_USER,RABIT_PASS ) 
host_cluster = 'localhost' 
amqp_port = 5672 

parameters = pika.ConnectionParameters(
        host=host_cluster, 
        port=amqp_port, 
        virtual_host='/',
        credentials=credentials,
        connection_attempts=3,
    retry_delay=5
    )


# parameters = pika.ConnectionParameters(    host='localhost',      credentials=credentials)

try:
    connection = pika.BlockingConnection(parameters)
   
    channel = connection.channel()
    print(f"[*] Batch Monitor started on vhost: {RABBIT_VHOST}")
    print(f"[*] {BATCH_SIZE} messages will be grouped per file in {BUCKET} bucket")
    count=0
    while True:
        
        count = check_count(channel)
        if count >= BATCH_SIZE:
            process_batch(channel)
        else:
            print(f"Message ... ({count}/{BATCH_SIZE})", end="\r")
            time.sleep(2)

except KeyboardInterrupt:
    print("\nStopping service......")
    connection.close()
