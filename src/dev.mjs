#!/usr/bin/env node
import http from 'http';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const buildModuleUrl = new URL('./build.mjs', import.meta.url);

const args = new Set(process.argv.slice(2));
const port = Number.parseInt(process.env.PORT ?? '4173', 10);
const once = args.has('--once') || args.has('--check');

const clients = new Set();
const watchers = [];
let isBuilding = false;
let pendingBuild = false;
let scheduled = false;

await runBuildModule();

if (once) {
  process.exit(0);
}

startWatchers();
startServer();

function startServer() {
  const server = http.createServer(async (req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    if (urlPath === '/__dev_reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write('retry: 1000\n\n');
      clients.add(res);
      req.on('close', () => {
        clients.delete(res);
      });
      return;
    }

    try {
      const safePath = getSafeFilePath(urlPath);
      const data = await fsp.readFile(safePath);
      res.writeHead(200, {
        'Content-Type': getContentType(safePath),
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
      console.error(err);
    }
  });

  server.listen(port, () => {
    console.log(`OSCAR Hub landing page available at http://localhost:${port}`);
    console.log('Watching for changes. Saving files will rebuild and trigger a live reload.');
  });

  const closeAll = () => {
    server.close();
    watchers.forEach((watcher) => watcher.close());
    clients.forEach((client) => client.end());
  };

  process.on('SIGINT', () => {
    closeAll();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    closeAll();
    process.exit(0);
  });
}

function startWatchers() {
  const handleChange = (filename = '') => {
    if (!filename) return;
    if (filename.startsWith('dist')) return;
    if (filename.startsWith('node_modules')) return;
    if (filename.startsWith('.git')) return;
    scheduleBuild(filename);
  };

  try {
    const watcher = fs.watch(repoRoot, { recursive: true }, (_event, filename) =>
      handleChange(filename?.toString() ?? '')
    );
    watchers.push(watcher);
  } catch (err) {
    console.warn('Recursive file watching not supported; falling back to top-level directories.');
    setupFallbackWatchers(handleChange);
  }
}

function setupFallbackWatchers(callback) {
  fsp
    .readdir(repoRoot, { withFileTypes: true })
    .then((entries) => {
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (['dist', 'node_modules', '.git'].includes(entry.name)) continue;
        const watcher = fs.watch(path.join(repoRoot, entry.name), { recursive: false }, (_event, filename) =>
          callback(entry.name + '/' + (filename?.toString() ?? ''))
        );
        watchers.push(watcher);
      }
    })
    .catch((error) => {
      console.error('Failed to set up fallback watchers:', error);
    });
}

function scheduleBuild(reason) {
  if (scheduled) {
    pendingBuild = true;
    return;
  }
  scheduled = true;
  setTimeout(() => runBuild(reason), 150);
}

async function runBuild(reason) {
  if (isBuilding) {
    pendingBuild = true;
    scheduled = false;
    return;
  }

  scheduled = false;
  isBuilding = true;
  try {
    await runBuildModule();
    console.log(`[dev] rebuilt due to ${reason ?? 'manual trigger'}`);
    broadcastReload();
  } catch (err) {
    console.error('[dev] build failed:', err);
  } finally {
    isBuilding = false;
    if (pendingBuild) {
      pendingBuild = false;
      scheduleBuild('queued-change');
    }
  }
}

function broadcastReload() {
  for (const client of clients) {
    client.write('data: reload\n\n');
  }
}

async function runBuildModule() {
  const bust = `${buildModuleUrl.href}?update=${Date.now()}`;
  try {
    const module = await import(bust);
    if (typeof module.buildSite !== 'function') {
      throw new Error('buildSite export not found in build.mjs');
    }
    await module.buildSite();
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('[dev] Syntax error during build:', error.message);
    }
    throw error;
  }
}

function getSafeFilePath(requestPath) {
  let relativePath = requestPath.replace(/^\/*/, '');
  if (!relativePath || relativePath.endsWith('/')) {
    relativePath = path.join(relativePath, 'index.html');
  }
  const candidate = path.join(distDir, relativePath);
  const normalised = path.normalize(candidate);
  if (!normalised.startsWith(distDir)) {
    throw Object.assign(new Error('Forbidden path'), { code: 'EACCES' });
  }
  return normalised;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}
