#!/bin/bash

mv $INPUT_FILE_PATH "$INPUT_FILE_PATH.png"
INPUT="$INPUT_FILE_PATH.png"
OUTPUT_FILE="$TMP_OUTPUT_DIR/output.json"
deepaas-cli predict --files "$INPUT" 2>&1 | grep -Po "{'status'.*}" > "$OUTPUT_FILE" 

cat "$OUTPUT_FILE"