# Kokoro TTS Service for OSCAR

This service contains the configuration necessary to implement a Text-to-Speech (TTS) service using the [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) model. The service is optimized to run asynchronously on the CPU only, allowing its deployment on infrastructures without a GPU, including AMD64 and ARM64 architectures.

Kokoro is an open-source TTS model with 82 million parameters. Despite its lightweight architecture, it offers comparable quality to larger models, while being significantly faster and more cost-effective. Thanks to its Apache-licensed weights, it can be deployed in any environment.

To run the service, a .json file must be used that contains both the message to be processed and the execution configuration parameters. This makes the service flexible for any environment. The service's input file must have the following structure.

```json
{
  "model": "af_bella",
  "language": "en-gb",
  "message": "This is an audio sample generated using the kokoro-tts service.",
  "config": {
    "speed": 1.0,
    "volume": 3.1,
    "output": "wav"
     }
}
```

Description of the configuration parameters:

* model: Voice identifier (all available models in [voices](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/tree/main/voices)).
* language: Language of the text to be processed ([lang_code](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)).
* speed: Speech speed (0.5 to 2).
* volume: Output audio volume level.
* output: Output audio file format (for example: "mp3","wav", "flac").

