import sys
import os
import json
import wave
import subprocess
from vosk import Model, KaldiRecognizer


def convert_audio_to_wav(input_path):
    """
Convert any audio file to WAV (PCM 16-bit, 16kHz, Mono) using FFmpeg.
    """
    temp_wav = "/tmp/converted_vosk.wav"
    print(f"🔄 Converting {input_path} to a compatible format...")
    
    command = [
        'ffmpeg',
        '-y',              # Overwrite if existing
        '-i', input_path,   # Input file
        '-ar', '16000',     # Sampling 16kHz
        '-ac', '1',         # Mono
        '-acodec', 'pcm_s16le', # Codec PCM 16-bit (required by wave)
        temp_wav
    ]
    
    try:
        # # We perform the conversion
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return temp_wav
    except subprocess.CalledProcessError as e:
        print(f"❌ Error during conversion with FFmpeg: {e}")
        sys.exit(1)

def transcribe(audio_in, text_out, lang):
    model_path = f"/opt/vosk-model-{lang}"
    
    if not os.path.exists(model_path):
        print(f"❌ Error: The model for '{lang}' does not exist in {model_path}")
        sys.exit(1)

    # We internally convert the input file to a compatible WAV format.
    wav_path = convert_audio_to_wav(audio_in)

    model = Model(model_path)
    
    try:
        wf = wave.open(wav_path, "rb")
    except Exception as e:
        print(f"❌ Error opening converted WAV file: {e}")
        sys.exit(1)

    rec = KaldiRecognizer(model, wf.getframerate())
    final_text = ""

    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            res = json.loads(rec.Result())
            final_text += res.get("text", "") + " "

    res_final = json.loads(rec.FinalResult())
    final_text += res_final.get("text", "")
    
    with open(text_out, "w", encoding="utf-8") as f:
        f.write(final_text.strip())
    
    print(f"✅ Transcript saved in: {text_out}")
    
# Cleaning the temporary file
    if os.path.exists(wav_path):
        os.remove(wav_path)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(1)
   
    transcribe(sys.argv[1], sys.argv[2], sys.argv[3])
