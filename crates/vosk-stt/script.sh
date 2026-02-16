#!/bin/bash


echo "--- Starting Vosk STT Service ---"


# Example: test2_es.wav -> test2_es.txt
FILENAME=$(basename "$INPUT_FILE_PATH")

OUTPUT_FILE="$TMP_OUTPUT_DIR/${FILENAME%.*}.txt"

echo "Input: $INPUT_FILE_PATH"
echo "Output: $OUTPUT_FILE"

# 2. Language detection by filename (Syntax compatible)
case "$FILENAME" in
    *_en.*)
        LANG="en"
        ;;
    *_es.*)
        LANG="es"
        ;;
    *)
        LANG="es"
        echo "⚠️ Suffix not detected (_es/_en). Using Spanish by default."
        ;;
esac

echo "📢 Language detected: $LANG"

echo "🚀 Running Vosk engine..."
python3 /app/transcribe_vosk.py "$INPUT_FILE_PATH" "$OUTPUT_FILE" "$LANG"

# 5. Final verification for the logs
if [ -f "$OUTPUT_FILE" ]; then
    echo "--- Process Completed Successfully ---"
    echo "File generated in: $OUTPUT_FILE"
    ls -lh "$OUTPUT_FILE"
else
    echo "--- ERROR: The transcript file was not generated"
    exit 1
fi


