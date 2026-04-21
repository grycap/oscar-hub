#!/bin/sh

set -eu

# OSCAR provides:
# - INPUT_FILE_PATH: staged input file
# - TMP_OUTPUT_DIR: directory whose contents will be uploaded to the output path

run_im() {
  if command -v magick >/dev/null 2>&1; then
    magick "$@"
  else
    convert "$@"
  fi
}

run_identify() {
  if command -v magick >/dev/null 2>&1; then
    magick identify "$@"
  else
    identify "$@"
  fi
}

echo "Processing image from: $INPUT_FILE_PATH"

INPUT_BASENAME="$(basename "$INPUT_FILE_PATH")"
FILE_STEM="${INPUT_BASENAME%.*}"

GRAY_FILE="$TMP_OUTPUT_DIR/${FILE_STEM}_gray.png"
EDGES_FILE="$TMP_OUTPUT_DIR/${FILE_STEM}_edges.png"
METRICS_FILE="$TMP_OUTPUT_DIR/${FILE_STEM}_metrics.json"
EDGE_MASK_FILE="$(mktemp "/tmp/${FILE_STEM}_edge_mask_XXXXXX.png")"

# Create two lightweight visual outputs.
run_im "$INPUT_FILE_PATH" -auto-orient -resize "512x512>" -colorspace Gray "$GRAY_FILE"
run_im "$INPUT_FILE_PATH" -auto-orient -resize "512x512>" -colorspace Gray -edge 1 "$EDGES_FILE"

# Extract simple visual metrics from the original image.
WIDTH="$(run_identify -format "%w" "$INPUT_FILE_PATH")"
HEIGHT="$(run_identify -format "%h" "$INPUT_FILE_PATH")"
BRIGHTNESS_MEAN="$(run_im "$INPUT_FILE_PATH" -colorspace Gray -format "%[fx:mean]" info:)"
CONTRAST_STDDEV="$(run_im "$INPUT_FILE_PATH" -colorspace Gray -format "%[fx:standard_deviation]" info:)"

# Approximate edge density from the edge map after thresholding.
run_im "$EDGES_FILE" -threshold 20% "$EDGE_MASK_FILE"
EDGE_DENSITY="$(run_im "$EDGE_MASK_FILE" -format "%[fx:mean]" info:)"
rm -f "$EDGE_MASK_FILE"

cat > "$METRICS_FILE" <<EOF
{
  "original_file": "$INPUT_BASENAME",
  "gray_file": "$(basename "$GRAY_FILE")",
  "edges_file": "$(basename "$EDGES_FILE")",
  "width": $WIDTH,
  "height": $HEIGHT,
  "brightness_mean": $BRIGHTNESS_MEAN,
  "contrast_stddev": $CONTRAST_STDDEV,
  "edge_density": $EDGE_DENSITY
}
EOF

echo "Generated:"
echo "  - $GRAY_FILE"
echo "  - $EDGES_FILE"
echo "  - $METRICS_FILE"
