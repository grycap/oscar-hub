"""Small ForwardAuth-protected DOI form for a single OSCAR exposed service."""

import hmac
import html
import json
import os
import secrets
import subprocess
import sys
import threading
import uuid
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from worker import is_mounted_directory, validate_doi

DATA_DIR = os.environ.get("DATAHUGGER_DATA_DIR", "/mnt/datahugger-datasets")
MAX_FILES = int(os.environ.get("DATAHUGGER_MAX_FILES", "100"))
MAX_BYTES = int(os.environ.get("DATAHUGGER_MAX_BYTES", str(2 * 1024**3)))
MAX_FILE_BYTES = int(os.environ.get("DATAHUGGER_MAX_FILE_BYTES", str(1024**3)))
TIMEOUT = int(os.environ.get("DATAHUGGER_TIMEOUT_SECONDS", "3600"))
PORT = int(os.environ.get("PORT", "8080"))
STATIC_DIR = Path(__file__).parent
CONTENT_SECURITY_POLICY = "default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
CSRF = secrets.token_urlsafe(32)
LOCK = threading.Lock()
STATUS: dict[str, object] = {"state": "idle"}
HISTORY: list[dict[str, object]] = []
MAX_HISTORY = 20


def run_download(doi, job_id):
    global STATUS
    try:
        proc = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("worker.py")), doi, DATA_DIR,
             str(MAX_FILES), str(MAX_BYTES), str(MAX_FILE_BYTES)],
            capture_output=True, text=True, timeout=TIMEOUT, check=False,
        )
        payload = json.loads(proc.stdout)
        if proc.returncode:
            result = {"state": "failed", "error": payload.get("error", "Download failed")}
        else:
            result = {"state": "completed", **payload}
    except subprocess.TimeoutExpired:
        result = {"state": "failed", "error": "Download timed out; partial files may remain"}
    except (OSError, ValueError, json.JSONDecodeError):
        result = {"state": "failed", "error": "Download process failed; partial files may remain"}
    with LOCK:
        STATUS = {"job": job_id, "doi": doi, **result}
        for entry in HISTORY:
            if entry["job"] == job_id:
                entry.update(result)
                break


class Handler(BaseHTTPRequestHandler):
    def respond(self, code, body, content_type):
        self.respond_bytes(code, body.encode("utf-8"), content_type)

    def respond_bytes(self, code, data, content_type):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        self.send_header("Referrer-Policy", "same-origin")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            available = is_mounted_directory(DATA_DIR)
            self.respond(200 if available else 503, "ok" if available else "storage unavailable", "text/plain; charset=utf-8")
            return
        if path == "/status":
            with LOCK:
                snapshot = dict(STATUS)
                snapshot["downloads"] = [dict(entry) for entry in HISTORY]
            self.respond(200, json.dumps(snapshot), "application/json")
            return
        assets = {
            "/style.css": ("style.css", "text/css; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
            "/icon.png": ("icon.png", "image/png"),
        }
        if path in assets:
            filename, content_type = assets[path]
            self.respond_bytes(200, (STATIC_DIR / filename).read_bytes(), content_type)
            return
        if path != "/":
            self.respond(404, "Not found", "text/plain")
            return
        body = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
        self.send_response(200)
        raw = body.replace("__CSRF_TOKEN__", html.escape(CSRF, quote=True)).encode("utf-8")
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Set-Cookie", "dh_csrf=" + CSRF + "; Path=/; HttpOnly; SameSite=Strict" + ("; Secure" if self.headers.get("X-Forwarded-Proto") == "https" else ""))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        global STATUS
        if urlsplit(self.path).path != "/download":
            self.respond(404, "Not found", "text/plain")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= 4096 or self.headers.get("Content-Type", "").split(";")[0] != "application/x-www-form-urlencoded":
            self.respond(400, "Invalid form", "text/plain")
            return
        origin = self.headers.get("Origin")
        if origin and urlsplit(origin).netloc != self.headers.get("Host"):
            self.respond(403, "Invalid origin", "text/plain")
            return
        cookie = cookies.SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            fields = parse_qs(self.rfile.read(length).decode("utf-8"), keep_blank_values=True)
            supplied = fields.get("csrf", [""])[0]
            stored = cookie["dh_csrf"].value if "dh_csrf" in cookie else ""
            if not (hmac.compare_digest(CSRF, supplied) and hmac.compare_digest(CSRF, stored)):
                raise ValueError("Invalid form token")
            doi = validate_doi(fields.get("doi", [""])[0])
        except (KeyError, UnicodeError, ValueError) as exc:
            self.respond(400, str(exc), "text/plain; charset=utf-8")
            return
        with LOCK:
            if STATUS.get("state") == "running":
                self.respond(409, "A download is already running", "text/plain")
                return
            job_id = uuid.uuid4().hex[:12]
            STATUS = {"state": "running", "job": job_id, "doi": doi}
            HISTORY.insert(0, dict(STATUS))
            del HISTORY[MAX_HISTORY:]
        threading.Thread(target=run_download, args=(doi, job_id), daemon=True).start()
        self.send_response(303)
        self.send_header("Location", "./")
        self.send_header("Content-Length", "0")
        self.end_headers()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
