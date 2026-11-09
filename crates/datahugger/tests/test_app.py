"""Offline tests: no bucket, cluster, DOI resolver, or external network calls."""

import http.client
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "docker" / "app"))
import app  # noqa: E402
import worker  # noqa: E402


class FakeDataset:
    files = [{"name": "data.txt", "size": 5}]

    def download(self, target):
        (target / "data.txt").write_text("hello")


class WorkerTests(unittest.TestCase):
    def test_doi_validation(self):
        self.assertEqual(worker.validate_doi(" 10.5061/dryad.mj8m0 "), "10.5061/dryad.mj8m0")
        self.assertEqual(worker.validate_doi("10.5281/zenodo.20596323"), "10.5281/zenodo.20596323")
        self.assertEqual(worker.validate_doi(" https://doi.org/10.5281/zenodo.20596323 "), "10.5281/zenodo.20596323")
        for value in ("http://localhost/", "http://doi.org/10.5281/zenodo.20596323", "https://doi.org.evil.test/10.5281/zenodo.20596323", "https://doi.org@evil.test/10.5281/zenodo.20596323", "https://doi.org:443/10.5281/zenodo.20596323", "https://doi.org/10.5281/zenodo.20596323?download=1", "../tmp", "10.123/x\nother"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                worker.validate_doi(value)

    def test_reject_unsafe_manifest(self):
        for name in ("../a", "/tmp/a", "a/../../x", "a\\b", "a//b", ".datahugger-complete.json"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                worker.validate_files([{"name": name, "size": 5}], 10, 100, 50)
        for size in (None, -1, "5", True, 51):
            with self.subTest(size=size), self.assertRaises(ValueError):
                worker.validate_files([{"name": "a", "size": size}], 10, 100, 50)
        with self.assertRaises(ValueError):
            worker.validate_files([{"name": "a", "size": 50}, {"name": "b", "size": 51}], 10, 100, 100)

    def test_download_and_marker(self):
        fake = type("FakeModule", (), {"info": lambda *args, **kwargs: FakeDataset()})()
        with tempfile.TemporaryDirectory() as folder, patch.dict(sys.modules, {"datahugger": fake}), patch.object(worker.resource, "setrlimit"), patch.object(worker, "is_mounted_directory", return_value=True):
            result = worker.download("10.5061/dryad.mj8m0", folder, 10, 100, 50)
            target = Path(folder) / result["directory"]
            self.assertEqual((target / "data.txt").read_text(), "hello")
            self.assertEqual(json.loads((target / worker.MARKER).read_text()), {"doi": "10.5061/dryad.mj8m0", "files": 1, "bytes": 5})
            self.assertTrue(result["directory"].startswith("doi-10-5061-dryad-mj8m0-"))

    def test_incomplete_data_is_not_deleted_or_marked(self):
        class Partial(FakeDataset):
            def download(self, target):
                (target / "data.txt").write_text("partial")
                raise RuntimeError("interrupted")

        fake = type("FakeModule", (), {"info": lambda *args, **kwargs: Partial()})()
        with tempfile.TemporaryDirectory() as folder, patch.dict(sys.modules, {"datahugger": fake}), patch.object(worker.resource, "setrlimit"), patch.object(worker, "is_mounted_directory", return_value=True):
            with self.assertRaises(RuntimeError):
                worker.download("10.5061/dryad.mj8m0", folder, 10, 100, 50)
            [target] = Path(folder).iterdir()
            self.assertEqual((target / "data.txt").read_text(), "partial")
            self.assertFalse((target / worker.MARKER).exists())

    def test_missing_mount_does_not_create_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "missing"
            with self.assertRaises(ValueError):
                worker.download("10.5061/dryad.mj8m0", target, 10, 100, 50)
            self.assertFalse(target.exists())
            self.assertFalse(worker.is_mounted_directory(folder))
            with self.assertRaisesRegex(ValueError, "active mount"):
                worker.download("10.5061/dryad.mj8m0", folder, 10, 100, 50)
            self.assertEqual(list(Path(folder).iterdir()), [])


class WebTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_dir = app.DATA_DIR
        self.old_static_dir = app.STATIC_DIR
        self.old_status = app.STATUS
        self.old_history = app.HISTORY
        # Mirror the Docker image layout: source icon.png lives at the crate root.
        app.STATIC_DIR = Path(self.temp.name) / "app"
        app.STATIC_DIR.mkdir()
        for name in ("index.html", "style.css", "app.js"):
            shutil.copyfile(self.old_static_dir / name, app.STATIC_DIR / name)
        shutil.copyfile(Path(__file__).resolve().parents[1] / "icon.png", app.STATIC_DIR / "icon.png")
        app.DATA_DIR = self.temp.name
        app.STATUS = {"state": "idle"}
        app.HISTORY = []
        self.server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        app.DATA_DIR = self.old_dir
        app.STATIC_DIR = self.old_static_dir
        app.STATUS = self.old_status
        app.HISTORY = self.old_history
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None):
        status, response_headers, payload = self.request_bytes(method, path, body, headers)
        return status, response_headers, payload.decode()

    def request_bytes(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        result = (response.status, dict(response.getheaders()), response.read())
        conn.close()
        return result

    def test_form_csrf_doi_and_status(self):
        status, headers, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("DataHugger", body)
        self.assertNotIn("<footer", body)
        self.assertNotIn("Open data, ready for your workflow", body)
        self.assertNotIn("Bring an open research dataset", body)
        self.assertNotIn("in this service’s mounted bucket or volume", body)
        self.assertIn('width="96" height="96"', body)
        self.assertEqual(headers["Referrer-Policy"], "same-origin")
        self.assertIn(f'name="csrf" value="{app.CSRF}"', body)
        cookie = headers["Set-Cookie"].split(";", 1)[0]
        form = urlencode({"doi": "10.5061/dryad.mj8m0", "csrf": app.CSRF})
        basic = {"Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie}
        self.assertEqual(self.request("POST", "/download", form, {"Content-Type": basic["Content-Type"]})[0], 400)
        self.assertEqual(self.request("POST", "/download", urlencode({"doi": "http://127.0.0.1", "csrf": app.CSRF}), basic)[0], 400)
        self.assertEqual(self.request("POST", "/download", form, {**basic, "Origin": "https://attacker.invalid"})[0], 403)
        with patch.object(app, "run_download") as run:
            self.assertEqual(self.request("POST", "/download", form, basic)[0], 303)
            run.assert_called_once()
        self.assertEqual(json.loads(self.request("GET", "/status")[2])["state"], "running")
        self.assertEqual(json.loads(self.request("GET", "/status")[2])["downloads"][0]["doi"], "10.5061/dryad.mj8m0")
        self.assertEqual(self.request("POST", "/download", form, basic)[0], 409)

    def test_bare_and_doi_url_submit_as_same_identifier(self):
        _, headers, _ = self.request("GET", "/")
        basic = {"Content-Type": "application/x-www-form-urlencoded", "Cookie": headers["Set-Cookie"].split(";", 1)[0]}
        for value in ("10.5281/zenodo.20596323", "https://doi.org/10.5281/zenodo.20596323"):
            with self.subTest(value=value), patch.object(app, "run_download") as run:
                app.STATUS = {"state": "idle"}
                form = urlencode({"doi": value, "csrf": app.CSRF})
                self.assertEqual(self.request("POST", "/download", form, basic)[0], 303)
                run.assert_called_once()
                self.assertEqual(run.call_args.args[0], "10.5281/zenodo.20596323")
                self.assertEqual(json.loads(self.request("GET", "/status")[2])["doi"], "10.5281/zenodo.20596323")
        self.assertEqual(len(app.HISTORY), 2)

    def test_web_assets_and_table_markup(self):
        status, headers, page = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn('href="https://github.com/grycap/datahugger"', page)
        self.assertIn('src="icon.png"', page)
        self.assertIn('<tbody id="downloads">', page)
        self.assertNotIn('<pre id="status">', page)
        self.assertIn("script-src 'self'", headers["Content-Security-Policy"])
        self.assertNotIn("unsafe-inline", headers["Content-Security-Policy"])
        for path, content_type in (("/style.css", "text/css"), ("/app.js", "text/javascript")):
            with self.subTest(path=path):
                status, headers, body = self.request("GET", path)
                self.assertEqual(status, 200)
                self.assertIn(content_type, headers["Content-Type"])
                self.assertTrue(body)
        status, headers, body = self.request_bytes("GET", "/icon.png")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "image/png")
        self.assertEqual(body, (app.STATIC_DIR / "icon.png").read_bytes())
        self.assertTrue(body.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertEqual(self.request("GET", "/datahugger_logo.svg")[0], 404)
        self.assertEqual(self.request("GET", "/anything-else")[0], 404)

    def test_download_history_completion_and_bound(self):
        import types
        app.HISTORY = [{"state": "running", "job": "new", "doi": "10.5061/dryad.mj8m0"},
                       {"state": "failed", "job": "older", "doi": "10.1234/old", "error": "Unavailable"}]
        result = types.SimpleNamespace(returncode=0, stdout=json.dumps({"directory": "doi-test", "files": 2, "bytes": 2048}))
        with patch.object(app.subprocess, "run", return_value=result):
            app.run_download("10.5061/dryad.mj8m0", "new")
        snapshot = json.loads(self.request("GET", "/status")[2])
        self.assertEqual(snapshot["state"], "completed")
        self.assertEqual(snapshot["downloads"][0]["directory"], "doi-test")
        self.assertEqual(snapshot["downloads"][0]["bytes"], 2048)
        self.assertEqual(snapshot["downloads"][1]["state"], "failed")
        app.HISTORY = []
        _, headers, _ = self.request("GET", "/")
        form = urlencode({"doi": "10.5061/dryad.mj8m0", "csrf": app.CSRF})
        basic = {"Content-Type": "application/x-www-form-urlencoded", "Cookie": headers["Set-Cookie"].split(";", 1)[0]}
        with patch.object(app, "run_download"):
            for _ in range(app.MAX_HISTORY + 1):
                app.STATUS = {"state": "idle"}
                self.assertEqual(self.request("POST", "/download", form, basic)[0], 303)
        snapshot = json.loads(self.request("GET", "/status")[2])
        self.assertEqual(len(snapshot["downloads"]), app.MAX_HISTORY)
        self.assertEqual(snapshot["downloads"][0]["job"], snapshot["job"])

    def test_health_requires_destination(self):
        with patch.object(app, "is_mounted_directory", return_value=True):
            self.assertEqual(self.request("GET", "/health")[0], 200)
        app.DATA_DIR = str(Path(self.temp.name) / "missing")
        self.assertEqual(self.request("GET", "/health")[0], 503)
        app.DATA_DIR = self.temp.name
        self.assertEqual(self.request("GET", "/health")[0], 503)  # Directory alone is not a mount.


if __name__ == "__main__":
    unittest.main()
