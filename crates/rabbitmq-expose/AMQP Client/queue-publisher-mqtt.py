import paho.mqtt.client as mqtt
import time

# Configuration
BROKER = 'cluster.im.grycap.net' 
PORT = 30351 # nodePort
TOPIC = "oscar/service-name" # RabbitMQ routes the MQTT topic 'oscar' to the amq.topic exchange with routing key 'oscar'
USER = "service-name"
PASSWORD = "tokenService"

delay=4 # We send one every x second

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Simulator connected to the RabbitMQ broker via MQTT")
    else:
        print(f"❌ Connection error. Code: {rc}")

# Create client
client = mqtt.Client()
client.username_pw_set(USER, PASSWORD)
client.on_connect = on_connect

try:
    client.connect(BROKER, PORT, 60)
    client.loop_start()

    print("Sending messages... (Press CTRL+C to stop)")
    count = 1
    
    while True:
        message = f"Message -  {count}"
        # Send message
        client.publish(TOPIC, message)
        print(f" [>>] Published in MQTT: {message}")
        
        count += 1
        time.sleep(delay) 

except KeyboardInterrupt:
    print("\nSimulator stopped.")
    client.loop_stop()
    client.disconnect()
