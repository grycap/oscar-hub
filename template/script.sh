#!/bin/bash
set -euo pipefail

# Example entrypoint script for OSCAR services.
# Replace the placeholder logic with the commands needed to run your workload.

INPUT_FILE=${INPUT_FILE_PATH:-}
TMP_OUTPUT=${TMP_OUTPUT_DIR:-/tmp}
OUTPUT_FILE="$TMP_OUTPUT/result.txt"

echo "Processing input: ${INPUT_FILE:-<none>}"

echo "Hello from your OSCAR service" > "$OUTPUT_FILE"

echo "Result written to $OUTPUT_FILE"
