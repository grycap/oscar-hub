import requests
import json
import time

def enviar_rafaga_mensajes(cantidad):
    # --- CONFIGURACIÓN ---
    USER = "rabbitmq-http-service"
    PASS = "b331a494f03d7baf4c9f11d9697fd9d52838096077bbe2d2f34eef750e4706a1"
    URL = "http://graspi.im.grycap.net:30352/api/exchanges/%2f/amq.topic/publish"

    print(f"🚀 Iniciando envío de {cantidad} mensajes...")

    for i in range(1, cantidad + 1):
        # Cuerpo del mensaje variable
        mensaje_cuerpo = {
            "id": i,
            "timestamp": time.time(),
            "contenido": f"Mensaje número {i} de la ráfaga",
            "origen": "python-script"
        }

        payload_api = {
            "properties": {
                "content_type": "application/json",
                "delivery_mode": 2
            },
            "routing_key": f"oscar.{USER}",
            "payload": json.dumps(mensaje_cuerpo),
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
                    print(f"✅ [{i}/{cantidad}] Mensaje encolado con éxito.")
                else:
                    print(f"⚠️ [{i}/{cantidad}] Enviado pero NO enrutado. Revisa routing_key.")
            else:
                print(f"❌ Error en mensaje {i}: {response.status_code} - {response.text}")

        except Exception as e:
            print(f"❌ Error de conexión en mensaje {i}: {e}")
            break # Detener si hay un fallo de red grave

        # Opcional: un pequeño respiro de 0.1s entre mensajes para fluidez
        time.sleep(3)

    print("🏁 Proceso finalizado.")

if __name__ == "__main__":
    # Cambia este valor según necesites
    CANTIDAD_A_ENVIAR = 10 
    enviar_rafaga_mensajes(CANTIDAD_A_ENVIAR)
