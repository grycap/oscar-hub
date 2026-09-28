#!/bin/sh
set -eu

: "${INPUT_FILE_PATH:?OSCAR must provide INPUT_FILE_PATH}"
: "${TMP_OUTPUT_DIR:?OSCAR must provide TMP_OUTPUT_DIR}"

# Upstream deepaas-cli hands --image/--zip a path string, whereas predict_data
# expects UploadedFile instances. Call the upstream inference routine with the
# same UploadedFile class it uses for HTTP uploads, without patching the image.
python3 - "$INPUT_FILE_PATH" "$TMP_OUTPUT_DIR" <<'PY'
import json
import mimetypes
import os
import sys

from planktonclas import api

input_path, output_dir = sys.argv[1:]
filename = os.path.basename(input_path)
content_type = mimetypes.guess_type(filename)[0] or "image/jpeg"
upload = api.UploadedFile(
    name="data",
    filename=input_path,
    content_type=content_type,
    original_filename=filename,
)
result = api.predict_data({
    "files": [upload],
    "timestamp": "Phytoplankton_EfficientNetV2B0",
    "ckpt_name": "final_model.h5",
})
if not result.get("pred_lab") or not result.get("pred_prob"):
    raise RuntimeError("Classifier returned no predictions")
with open(os.path.join(output_dir, "prediction.json"), "w", encoding="utf-8") as output:
    json.dump(result, output, indent=2)
print("Prediction saved to prediction.json")
PY
