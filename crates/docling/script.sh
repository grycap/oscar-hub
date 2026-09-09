#!/bin/sh

set -eu

: "${INPUT_FILE_PATH:?OSCAR did not provide INPUT_FILE_PATH}"

input_basename=$(basename "$INPUT_FILE_PATH")
file_stem=${input_basename%.*}
input_extension=${input_basename##*.}

# The LOCAL provider used by synchronous requests stages the body as
# event-file-<uuid>. Storage-triggered jobs preserve the original filename.
case "$input_basename" in
    event-file-*)
        is_synchronous=1
        ;;
    *)
        is_synchronous=0
        : "${TMP_OUTPUT_DIR:?OSCAR did not provide TMP_OUTPUT_DIR for an asynchronous invocation}"
        ;;
esac

# Synchronous request bodies may be staged without an extension. Give Docling
# a recognizable suffix while preserving the input stem for async output.
case "$input_extension" in
    pdf|md|markdown|tex|latex|html|htm|csv|docx|pptx|xlsx|png|jpg|jpeg|tif|tiff) ;;
    *)
        if [ "$(dd if="$INPUT_FILE_PATH" bs=4 count=1 2>/dev/null)" = "%PDF" ]; then
            input_extension=pdf
        else
            input_extension=md
        fi
        ;;
esac

work_dir=$(mktemp -d)
cleanup() {
    rm -rf "$work_dir"
}
trap cleanup EXIT

recognized_input="$work_dir/input.$input_extension"
cp "$INPUT_FILE_PATH" "$recognized_input"
conversion_output="$work_dir/output"
mkdir -p "$conversion_output"

printf 'Converting %s with Docling standard pipeline\n' "$input_basename" >&2

docling "$recognized_input" \
    --pipeline standard \
    --output "$conversion_output"

generated_file=''
for candidate in "$conversion_output"/*.md "$conversion_output"/*/*.md; do
    if [ -f "$candidate" ]; then
        generated_file=$candidate
        break
    fi
done

if [ -z "$generated_file" ]; then
    printf 'Docling did not produce a Markdown file for %s\n' "$input_basename" >&2
    exit 1
fi

if [ "$is_synchronous" = "1" ]; then
    # OSCAR returns stdout directly for this single-file response.
    cat "$generated_file"
else
    output_file="$TMP_OUTPUT_DIR/${file_stem}.md"
    cp "$generated_file" "$output_file"
    printf 'Generated %s\n' "$(basename "$output_file")" >&2
fi
