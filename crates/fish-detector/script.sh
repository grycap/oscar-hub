#!/bin/sh
set -e

mkdir -p "$TMP_OUTPUT_DIR"

python3 fish_detector.py -i "$INPUT_FILE_PATH" -o "$TMP_OUTPUT_DIR"
