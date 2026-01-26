#!/bin/bash

#
# This script raises CPU usage for a configurable duration.
# It uses environment variables set by the OSCAR framework:
# - INPUT_FILE_PATH: the path to the input file containing the duration in seconds
# - TMP_OUTPUT_DIR: the directory where output files should be written

DURATION_DEFAULT=10
DURATION_RAW=""
OUTPUT_BASENAME="stress-test-output"

if [ -n "${INPUT_FILE_PATH:-}" ] && [ -f "$INPUT_FILE_PATH" ]; then
  FILE_BASENAME=$(basename "$INPUT_FILE_PATH")
  OUTPUT_BASENAME="${FILE_BASENAME%.*}-out"
  DURATION_RAW=$(tr -d ' \t\n\r' < "$INPUT_FILE_PATH")
fi

if [ -z "$DURATION_RAW" ] && [ -n "${STRESS_DURATION_SECONDS:-}" ]; then
  DURATION_RAW="$STRESS_DURATION_SECONDS"
fi

if [[ "$DURATION_RAW" =~ ^[0-9]+$ ]]; then
  DURATION_SECONDS="$DURATION_RAW"
else
  DURATION_SECONDS="$DURATION_DEFAULT"
fi

START_TS=$(date +%s)
END_TS=$((START_TS + DURATION_SECONDS))

while [ "$(date +%s)" -lt "$END_TS" ]; do
  :
done

OUTPUT_FILE="$TMP_OUTPUT_DIR/${OUTPUT_BASENAME}.txt"
{
  echo "CPU stress completed."
  echo "Duration seconds: $DURATION_SECONDS"
  echo "Start timestamp: $START_TS"
  echo "End timestamp: $(date +%s)"
} > "$OUTPUT_FILE"

cat "$OUTPUT_FILE"
