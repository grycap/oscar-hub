"""Download a DOI into the OSCAR-mounted directory without accepting paths from HTTP clients."""

import json
import os
import re
import resource
import sys
import uuid
from pathlib import Path, PurePosixPath

DOI_RE = re.compile(r"^10\.\d{4,9}/[-._;()/:A-Z0-9]+$", re.IGNORECASE)
DOI_URL_RE = re.compile(r"^https://doi\.org/(.+)$", re.IGNORECASE)
MARKER = ".datahugger-complete.json"


def is_mounted_directory(root):
    """Reject an empty local fallback directory when OSCAR's mount is absent."""
    root = Path(root)
    if not root.is_dir() or root.is_symlink():
        return False
    try:
        with open("/proc/self/mountinfo", encoding="utf-8") as mounts:
            # Unlike ismount(), mountinfo also detects bind mounts on the same device.
            return any(line.split()[4].replace("\\040", " ") == str(root.resolve()) for line in mounts)
    except FileNotFoundError:
        return os.path.ismount(root)  # Development outside Linux.


def validate_doi(value):
    raw = value.strip()
    url_match = DOI_URL_RE.fullmatch(raw)
    doi = url_match.group(1) if url_match else raw
    if len(raw) > 255 or not DOI_RE.fullmatch(doi):
        raise ValueError("Enter a DOI such as 10.5281/zenodo.20596323 or its https://doi.org/ URL")
    return doi


def validate_files(files, max_files, max_bytes, max_file_bytes):
    if not files or len(files) > max_files:
        raise ValueError("Dataset is empty or exceeds the file-count limit")
    total = 0
    names = set()
    for item in files:
        name = item.get("name")
        if not isinstance(name, str) or not name or "\\" in name or "\x00" in name:
            raise ValueError("Repository returned an unsafe filename")
        path = PurePosixPath(name)
        if path.is_absolute() or any(p in ("", ".", "..") for p in name.split("/")) or name.startswith(".datahugger-"):
            raise ValueError("Repository returned an unsafe filename")
        if name in names or name == MARKER:
            raise ValueError("Repository returned a duplicate or reserved filename")
        names.add(name)
        size = item.get("size")
        if isinstance(size, bool) or not isinstance(size, int) or size < 0:
            raise ValueError("Repository did not provide a reliable file size")
        if size > max_file_bytes:
            raise ValueError("A file exceeds the configured size limit")
        total += size
        if total > max_bytes:
            raise ValueError("Dataset exceeds the configured size limit")
    return total


def inspect_download(root, max_files, max_bytes, max_file_bytes):
    total = count = 0
    for current, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            if (Path(current) / name).is_symlink():
                raise ValueError("Download contains a symbolic link")
        for name in files:
            file = Path(current) / name
            if not file.is_file():
                raise ValueError("Download contains a non-regular file")
            count += 1
            total += file.stat().st_size
            if count > max_files or total > max_bytes or file.stat().st_size > max_file_bytes:
                raise ValueError("Downloaded data exceeds configured limits")
    if count == 0:
        raise ValueError("No files were downloaded")
    return count, total


def download(doi, root, max_files, max_bytes, max_file_bytes):
    doi = validate_doi(doi)
    root = Path(root)
    if not is_mounted_directory(root):
        raise ValueError("The configured destination is not an active mount")
    import datahugger

    # Guard individual writes even if a repository lies about Content-Length.
    resource.setrlimit(resource.RLIMIT_FSIZE, (max_file_bytes, max_file_bytes))
    dataset = datahugger.info(doi, unzip=False, progress=True)
    validate_files(dataset.files, max_files, max_bytes, max_file_bytes)
    name = "doi-" + re.sub(r"[^a-z0-9]+", "-", doi.lower()).strip("-")[:55] + "-" + uuid.uuid4().hex[:10]
    target = root / name
    target.mkdir(mode=0o750)  # No overwrite, including after an incomplete attempt.
    # DataHugger resolves the DOI and downloads files locally. Never auto-delete
    # incomplete content in a user's bucket or volume.
    dataset.download(target)
    count, total = inspect_download(target, max_files, max_bytes, max_file_bytes)
    (target / MARKER).write_text(json.dumps({"doi": doi, "files": count, "bytes": total}) + "\n")
    return {"directory": name, "files": count, "bytes": total}


def main():
    doi, root, max_files, max_bytes, max_file_bytes = sys.argv[1:]
    stdout = sys.stdout
    try:
        with open(os.devnull, "w") as sink:
            sys.stdout = sink  # DataHugger may print remote filenames/URLs.
            result = download(doi, root, int(max_files), int(max_bytes), int(max_file_bytes))
    except Exception as exc:
        sys.stdout = stdout
        print(json.dumps({"error": str(exc) if isinstance(exc, ValueError) else type(exc).__name__}))
        return 1
    sys.stdout = stdout
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
