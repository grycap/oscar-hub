#!/bin/bash

echo "--- Initiating Kokoro TTS Processing ---"
set -e
FILENAME_BASE=$(basename "$INPUT_FILE_PATH" .json)
OUTPUT_BASE="$TMP_OUTPUT_DIR/${FILENAME_BASE}"

python3 /app/kokoro_factory.py "$INPUT_FILE_PATH" "$OUTPUT_BASE"
