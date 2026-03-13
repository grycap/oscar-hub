import sys
import os
import json
import soundfile as sf
from kokoro_onnx import Kokoro
from pydub import AudioSegment
import io

def main():
    if len(sys.argv) < 3:
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    model_path = "/app/model/kokoro-v1.0.onnx" 
    voices_path = "/app/model/voices-v1.0.bin"

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            job = json.load(f)

        message = job.get("message", job.get("message", "")) 
        model = job.get("model", "ef_dora") 
        speed = job.get("config", {}).get("speed", 1.0) 
        language = job.get("language", "es") 
        
        volume = job.get("config", {}).get("volume", 1.0) # 1.0 is normal
        output = job.get("config", {}).get("output", "wav").lower()

        if not message:
            raise ValueError("The 'message' field is required.")

        kokoro = Kokoro(model_path, voices_path)
        samples, sample_rate = kokoro.create(
            message, 
            voice=model, 
            speed=speed, 
            lang=language
        ) 

        # Temporarily store in memory for volume/format processing
        buffer = io.BytesIO()
        sf.write(buffer, samples, sample_rate, format='WAV')
        buffer.seek(0)
        
        audio = AudioSegment.from_wav(buffer)

        # Apply Volume (intonation/gain)
        if volume != 1.0:
            # Volume in PyDub is handled in dB.
            # A factor of 2.0 is approximately +6dB, 0.5 is approximately -6dB
            import math
            db_change = 20 * math.log10(volume)
            audio = audio + db_change

        # Export to the requested format
        # Change the output_path extension if necessary
        final_path = os.path.splitext(output_path)[0] + f".{output}"
        audio.export(final_path, format=output)
        
        print(f"✅ Success: Generated {final_path} with volume {volume}")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
