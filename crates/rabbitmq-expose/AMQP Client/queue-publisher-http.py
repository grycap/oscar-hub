import requests
import json
import time

def send_burst_of_messages(number):
    # --- Configuration---
    USER = "service-name"
    PASS = "service-token"
    URL = "http://cluster.im.grycap.net:30100/api/exchanges/%2f/amq.topic/publish"

    print(f"🚀 Starting to send {number} messages...")

    for i in range(1, number + 1):
        # Variable message body
        message = {
            "id": i,
            "timestamp": time.time(),
            "content": f"Burst message number {i}",
            "source": "python-script"
        }

        payload_api = {
            "properties": {
                "content_type": "application/json",
                "delivery_mode": 2
            },
            "routing_key": f"oscar.{USER}",
            "payload": json.dumps(message),
            "payload_encoding": "string"
        }

        try:
            response = requests.post(
                URL, 
                auth=(USER, PASS), 
                data=json.dumps(payload_api),
                allow_redirects=False,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("routed"):
                    print(f"✅ [{i}/{number}] Message successfully routed.")
                else:
                    print(f"⚠️ [{i}/{number}] Sent but NOT routed. Check routing_key.")
            else:
                print(f"❌ Error in message {i}: {response.status_code} - {response.text}")

        except Exception as e:
            print(f"❌ Connection error in message {i}: {e}")
            break 

        # Optional: a short pause of 3s between messages for improved flow
        time.sleep(3)

    print("🏁 Process completed.")

if __name__ == "__main__":
    # Change this value as needed
    AMOUNT_TO_SEND = 10 
    send_burst_of_messages(AMOUNT_TO_SEND)
