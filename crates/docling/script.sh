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
        if python3 -c 'import sys, zipfile; sys.exit(not zipfile.is_zipfile(sys.argv[1]))' "$INPUT_FILE_PATH"; then
            is_zip=1
            : "${TMP_OUTPUT_DIR:?OSCAR did not provide TMP_OUTPUT_DIR for a synchronous ZIP invocation}"
        else
            is_zip=0
        fi
        ;;
    *)
        is_synchronous=0
        is_zip=0
        : "${TMP_OUTPUT_DIR:?OSCAR did not provide TMP_OUTPUT_DIR for an asynchronous invocation}"
        ;;
esac

work_dir=$(mktemp -d)
cleanup() {
    rm -rf "$work_dir"
}
trap cleanup EXIT

# Storage-triggered ZIPs retain their filename. Synchronous requests are
# staged as event-file-<uuid>, so their original ZIP name is unavailable.
case "$input_extension" in
    [Zz][Ii][Pp]) is_zip=1 ;;
esac
if [ "$is_zip" = "1" ]; then
    python3 - "$INPUT_FILE_PATH" "$TMP_OUTPUT_DIR" "$work_dir" "$is_synchronous" <<'PY'
import shutil
import stat
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath

archive_path, output_dir, work_dir = map(Path, sys.argv[1:4])
is_synchronous = sys.argv[4] == "1"
input_root = work_dir / "inputs"
staged_output = work_dir / "outputs"
supported = {".pdf", ".md", ".markdown", ".tex", ".latex", ".html", ".htm",
             ".csv", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg",
             ".tif", ".tiff"}

try:
    with zipfile.ZipFile(archive_path) as archive:
        documents = []
        output_names = set()
        for entry in archive.infolist():
            name = entry.filename
            parts = name.rstrip("/").split("/")
            mode = stat.S_IFMT(entry.external_attr >> 16)
            if (name.startswith("/") or "\\" in name or
                    any(part in ("", ".", "..") for part in parts) or
                    mode not in (0, stat.S_IFREG, stat.S_IFDIR)):
                raise ValueError(f"Unsafe ZIP entry: {name!r}")
            if entry.is_dir():
                continue
            # macOS adds AppleDouble sidecars whose names can end in .pdf,
            # although their contents are metadata rather than documents.
            if "__MACOSX" in parts or parts[-1].startswith("._") or parts[-1] == ".DS_Store":
                continue
            relative_path = PurePosixPath(*parts)
            # Asynchronous output already uses the archive name as its root.
            # Synchronous output preserves every directory inside the ZIP.
            if not is_synchronous and len(parts) > 1 and parts[0] == archive_path.stem:
                relative_path = PurePosixPath(*parts[1:])
            if relative_path.suffix.lower() not in supported:
                raise ValueError(f"Unsupported ZIP entry: {name!r}")
            output_path = relative_path.with_suffix(".md")
            if output_path in output_names:
                raise ValueError(f"Duplicate Markdown output in ZIP: {output_path}")
            output_names.add(output_path)
            documents.append((entry, relative_path, output_path))

        if not documents:
            raise ValueError("ZIP contains no supported documents")

        for index, (entry, relative_path, output_path) in enumerate(documents):
            input_path = input_root.joinpath(*relative_path.parts)
            input_path.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, input_path.open("wb") as destination:
                shutil.copyfileobj(source, destination)

            conversion_dir = work_dir / f"conversion-{index}"
            conversion_dir.mkdir()
            result = subprocess.run(
                ["docling", str(input_path), "--pipeline", "standard", "--output", str(conversion_dir)],
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
            )
            if result.returncode:
                raise ValueError(f"Docling failed for {relative_path}: {result.stderr.strip()}")
            input_path.unlink()
            markdown_files = list(conversion_dir.rglob("*.md"))
            if len(markdown_files) != 1:
                raise ValueError(f"Docling produced {len(markdown_files)} Markdown files for {relative_path}")
            destination = staged_output.joinpath(*output_path.parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(markdown_files[0], destination)

    if is_synchronous:
        with zipfile.ZipFile(output_dir / "result.zip", "w", zipfile.ZIP_DEFLATED) as result:
            for markdown in staged_output.rglob("*.md"):
                result.write(markdown, markdown.relative_to(staged_output).as_posix())
        print(f"Generated ZIP with {len(documents)} Markdown files", file=sys.stderr)
    else:
        shutil.copytree(staged_output, output_dir / archive_path.stem)
        print(f"Generated {len(documents)} Markdown files in {archive_path.stem}/", file=sys.stderr)
except (OSError, ValueError, zipfile.BadZipFile) as error:
    print(f"Cannot process {archive_path.name}: {error}", file=sys.stderr)
    sys.exit(1)
PY
    exit
fi

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

recognized_input="$work_dir/input.$input_extension"
cp "$INPUT_FILE_PATH" "$recognized_input"
conversion_output="$work_dir/output"
mkdir -p "$conversion_output"

docling "$recognized_input" \
    --pipeline standard \
    --output "$conversion_output" > /dev/null 2>&1

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
