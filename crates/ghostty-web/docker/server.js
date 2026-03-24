import fs from "fs";
import http from "http";
import path from "path";
import { homedir } from "os";
import { createRequire } from "module";

import pty from "@lydell/node-pty";
import { WebSocketServer } from "ws";

const require = createRequire(import.meta.url);

const HTTP_PORT = Number.parseInt(process.env.PORT || "8080", 10);
const SHELL = process.env.SHELL || "/bin/bash";
const SHELL_WORKDIR = process.env.SHELL_WORKDIR || homedir();

const MIME_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "application/javascript",
  ".json": "application/json",
  ".mjs": "application/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm"
};

const { distPath, wasmPath } = findGhosttyWeb();

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = resolveRoute(url.pathname);
  const pathname = route.pathname;

  if (pathname === "/" || pathname === "/index.html") {
    sendResponse(res, 200, "text/html", buildHtmlTemplate(route.basePath));
    return;
  }

  if (pathname === "/healthz") {
    sendResponse(res, 200, "text/plain", "ok");
    return;
  }

  if (pathname.startsWith("/dist/")) {
    const filePath = path.join(distPath, pathname.slice("/dist/".length));
    serveFile(filePath, res);
    return;
  }

  if (pathname === "/ghostty-vt.wasm") {
    serveFile(wasmPath, res);
    return;
  }

  sendResponse(res, 404, "text/plain", "Not Found");
});

const sessions = new Map();
const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = resolveRoute(url.pathname);

  if (route.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cols = Number.parseInt(url.searchParams.get("cols") || "80", 10);
  const rows = Number.parseInt(url.searchParams.get("rows") || "24", 10);

  const ptyProcess = pty.spawn(SHELL, [], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: SHELL_WORKDIR,
    env: {
      ...process.env,
      COLORTERM: "truecolor",
      TERM: "xterm-256color"
    }
  });

  sessions.set(ws, ptyProcess);

  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(`\r\n\x1b[33mShell exited with code ${exitCode}\x1b[0m\r\n`);
      ws.close();
    }
  });

  ws.on("message", (raw) => {
    const message = raw.toString("utf8");
    if (message.startsWith("{")) {
      try {
        const payload = JSON.parse(message);
        if (payload.type === "resize") {
          ptyProcess.resize(payload.cols, payload.rows);
          return;
        }
      } catch {
        // Fall through and treat the message as terminal input.
      }
    }

    ptyProcess.write(message);
  });

  ws.on("close", () => {
    const session = sessions.get(ws);
    if (session) {
      session.kill();
      sessions.delete(ws);
    }
  });

  ws.send(
    [
      "\x1b[1;36mGhostty Web Terminal with OSCAR CLI\x1b[0m",
      `\x1b[32mWorkspace:\x1b[0m ${SHELL_WORKDIR}`,
      "\x1b[32mTips:\x1b[0m run `oscar-cli version` or start `tmux` for a persistent shell multiplexer."
    ].join("\r\n") + "\r\n\r\n"
  );
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

httpServer.listen(HTTP_PORT, () => {
  console.log(`ghostty-web listening on http://0.0.0.0:${HTTP_PORT}`);
  console.log(`Shell: ${SHELL}`);
  console.log(`Workspace: ${SHELL_WORKDIR}`);
});

function shutdown() {
  for (const [ws, session] of sessions.entries()) {
    session.kill();
    ws.close();
  }
  wss.close();
  process.exit(0);
}

function buildHtmlTemplate(basePath) {
  const baseHref = basePath === "/" ? "/" : `${basePath}/`;
  const title = "Ghostty Web Terminal";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="${escapeHtml(baseHref)}" />
    <title>${title}</title>
    <style>
      * {
        box-sizing: border-box;
      }

      :root {
        color-scheme: dark;
        --bg: #0d1117;
        --panel: #161b22;
        --panel-border: #30363d;
        --text: #e6edf3;
        --muted: #8b949e;
        --accent: #2f81f7;
        --good: #3fb950;
        --warn: #d29922;
        --bad: #f85149;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Iosevka", "JetBrains Mono", monospace;
        color: var(--text);
        background:
          radial-gradient(circle at top, rgba(47, 129, 247, 0.2), transparent 40%),
          linear-gradient(180deg, #0b0f14 0%, var(--bg) 100%);
      }

      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }

      .shell {
        border: 1px solid var(--panel-border);
        border-radius: 18px;
        overflow: hidden;
        background: var(--panel);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      }

      .shell__topbar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 14px 18px;
        border-bottom: 1px solid var(--panel-border);
        background: rgba(255, 255, 255, 0.02);
      }

      .shell__lights {
        display: flex;
        gap: 8px;
      }

      .shell__light {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }

      .shell__light--red {
        background: var(--bad);
      }

      .shell__light--yellow {
        background: var(--warn);
      }

      .shell__light--green {
        background: var(--good);
      }

      .shell__title {
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .shell__status {
        margin-left: auto;
        font-size: 12px;
        color: var(--muted);
      }

      .shell__status span {
        color: var(--text);
      }

      #terminal {
        height: calc(100vh - 170px);
        min-height: 480px;
        padding: 18px;
      }

      @media (max-width: 720px) {
        main {
          padding: 12px;
        }

        .shell__topbar {
          gap: 10px;
          padding: 12px;
        }

        #terminal {
          height: calc(100vh - 120px);
          min-height: 420px;
          padding: 12px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="shell">
        <div class="shell__topbar">
          <div class="shell__lights">
            <span class="shell__light shell__light--red"></span>
            <span class="shell__light shell__light--yellow"></span>
            <span class="shell__light shell__light--green"></span>
          </div>
          <div class="shell__title">Ghostty Web Terminal</div>
          <div class="shell__status">Status: <span id="status">connecting</span></div>
        </div>
        <div id="terminal"></div>
      </section>
    </main>

    <script type="module">
      import { init, Terminal, FitAddon } from "./dist/ghostty-web.js";

      const statusNode = document.getElementById("status");
      const basePath = ${JSON.stringify(basePath)};
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

      function setStatus(value) {
        statusNode.textContent = value;
      }

      await init();

      const terminal = new Terminal({
        cols: 100,
        rows: 28,
        cursorBlink: true,
        fontFamily: "Iosevka, JetBrains Mono, monospace",
        fontSize: 14,
        theme: {
          background: "#161b22",
          foreground: "#e6edf3"
        }
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      const container = document.getElementById("terminal");
      await terminal.open(container);
      fitAddon.fit();
      fitAddon.observeResize();

      const wsPath = (basePath === "/" ? "" : basePath) + "/ws";
      const wsUrl = wsProtocol + "//" + window.location.host + wsPath +
        "?cols=" + terminal.cols + "&rows=" + terminal.rows;
      const ws = new WebSocket(wsUrl);

      ws.addEventListener("open", () => {
        setStatus("connected");
      });

      ws.addEventListener("message", (event) => {
        terminal.write(event.data);
      });

      ws.addEventListener("close", () => {
        setStatus("disconnected");
        terminal.write("\\r\\n\\x1b[31mConnection closed. Reload the page to reconnect.\\x1b[0m\\r\\n");
      });

      ws.addEventListener("error", () => {
        setStatus("error");
      });

      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      terminal.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });

      window.addEventListener("resize", () => {
        fitAddon.fit();
      });
    </script>
  </body>
</html>`;
}

function findGhosttyWeb() {
  const ghosttyWebMain = require.resolve("ghostty-web");
  const packageRoot = ghosttyWebMain.replace(/[/\\\\]dist[/\\\\].*$/, "");
  const distPath = path.join(packageRoot, "dist");
  const wasmPath = path.join(packageRoot, "ghostty-vt.wasm");

  if (!fs.existsSync(path.join(distPath, "ghostty-web.js"))) {
    throw new Error(`ghostty-web dist not found in ${distPath}`);
  }

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`ghostty-web wasm asset not found in ${wasmPath}`);
  }

  return { distPath, wasmPath };
}

function normalizeBasePath(basePath) {
  if (!basePath || basePath === "/") {
    return "/";
  }

  return `/${basePath.replace(/^\/+|\/+$/g, "")}`;
}

function resolveRoute(pathname) {
  const match = pathname.match(/^\/system\/services\/([^/]+)\/exposed(\/.*)?$/);
  if (!match) {
    return {
      basePath: "/",
      pathname
    };
  }

  return {
    basePath: `/system/services/${match[1]}/exposed`,
    pathname: match[2] || "/"
  };
}

function sendResponse(res, statusCode, contentType, body) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function serveFile(filePath, res) {
  const extension = path.extname(filePath);
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendResponse(res, 404, "text/plain", "Not Found");
      return;
    }

    sendResponse(res, 200, contentType, data);
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
