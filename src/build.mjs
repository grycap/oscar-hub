#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { build as bundle } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const staticDir = path.join(__dirname, 'static');

export async function buildSite({ root = repoRoot, destination = path.join(root, 'dist') } = {}) {
  // Keep renderer changes visible to the existing dev server's rebuild loop.
  const rendererUrl = new URL('./render.mjs', import.meta.url);
  rendererUrl.searchParams.set('update', Date.now());
  const { renderCatalog, renderService } = await import(rendererUrl.href);
  const services = await collectServices(path.join(root, 'crates'));
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.join(destination, 'assets'), { recursive: true });
  await fs.cp(staticDir, path.join(destination, 'assets'), { recursive: true });
  await bundle({
    entryPoints: [path.join(__dirname, 'highlight.mjs')],
    outfile: path.join(destination, 'assets', 'highlight.js'),
    bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true
  });
  await fs.copyFile(path.join(repoRoot, 'node_modules', 'highlight.js', 'LICENSE'), path.join(destination, 'assets', 'highlight-LICENSE.txt'));
  await copyServiceIcons(services, destination);
  await Promise.all([
    fs.writeFile(path.join(destination, 'index.html'), renderCatalog(services), 'utf8'),
    fs.writeFile(path.join(destination, '.nojekyll'), '', 'utf8'),
    writeServicePages(services, destination, renderService),
    copyDocsGuide(path.join(root, 'docs', 'dist'), destination)
  ]);
  console.log(`Generated catalog and detail pages for ${services.length} services.`);
  return services;
}

async function copyDocsGuide(source, destination) {
  if (!(await fileExists(source))) {
    console.warn('Documentation bundle not found. Run `npm run docs:build` to include /guide.');
    return;
  }
  await fs.cp(source, path.join(destination, 'guide'), { recursive: true });
}

async function writeServicePages(services, destination, renderService) {
  await Promise.all(services.map(async (service) => {
    const directory = path.join(destination, 'services', service.slug);
    await fs.mkdir(directory, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(directory, 'index.html'), renderService(service), 'utf8'),
      fs.writeFile(path.join(directory, 'ro-crate-metadata.json'), service.rawMetadata, 'utf8'),
      ...service.parts.filter(part => part.preview).map(async part => {
        const target = path.join(directory, part.preview.url);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, part.preview.bytes);
      })
    ]);
  }));
}

async function copyServiceIcons(services, destinationRoot) {
  const iconsToCopy = services.filter((service) => service.icon?.sourcePath);
  if (iconsToCopy.length === 0) return;
  await fs.mkdir(path.join(destinationRoot, 'assets', 'icons'), { recursive: true });
  await Promise.all(
    iconsToCopy.map(async (service) => {
      const destination = path.join(destinationRoot, service.icon.webRelative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(service.icon.sourcePath, destination);
    })
  );
}

async function collectServices(cratesDir) {
  const hasCratesDir = await fileExists(cratesDir);
  if (!hasCratesDir) {
    console.warn('No crates directory found; skipping service collection.');
    return [];
  }

  const entries = await fs.readdir(cratesDir, { withFileTypes: true });
  const services = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const serviceDir = path.join(cratesDir, entry.name);
    const cratePath = path.join(serviceDir, 'ro-crate-metadata.json');
    const exists = await fileExists(cratePath);
    if (!exists) continue;

    try {
      const service = await parseService(cratePath, entry.name, path.join('crates', entry.name));
      services.push(service);
    } catch (err) {
      console.warn(`Skipping ${entry.name}: ${err.message}`);
    }
  }

  services.sort((a, b) => a.name.localeCompare(b.name));
  return services;
}

async function parseService(cratePath, slug, repoPath) {
  const raw = await fs.readFile(cratePath, 'utf8');
  const crate = JSON.parse(raw);
  const graph = crate['@graph'] ?? [];

  const dataset = graph.find((node) => node['@id'] === './');
  if (!dataset) {
    throw new Error('missing dataset node in RO-Crate metadata');
  }

  const name = dataset.name ?? slug;
  const description = dataset.description ?? '';
  const serviceType = asArray(dataset.serviceType ?? 'unknown');
  const url = dataset.url ?? dataset.URL ?? null;
  const memory = dataset.memoryRequirements ?? null;
  const processors = asArray(dataset.processorRequirements);
  const software = asArray(dataset.softwareRequirements)
    .map((ref) => resolveReference(graph, ref))
    .filter(Boolean);
  const datePublished = dataset.datePublished ?? null;

  let iconInfo = resolveIcon(graph, dataset, cratePath, slug);
  if (iconInfo?.sourcePath) {
    const exists = await fileExists(iconInfo.sourcePath);
    if (!exists) {
      console.warn(`Icon not found for ${slug} at ${iconInfo.sourcePath}`);
      iconInfo = null;
    }
  }

  const safeDescription = truncate(description, 240);
  const authors = asArray(dataset.author).map(ref => resolveReference(graph, ref)).filter(Boolean);
  const licenses = asArray(dataset.license).map(ref => resolveReference(graph, ref)).filter(Boolean);
  const sources = asArray(dataset.isBasedOn).map(ref => resolveReference(graph, ref)).filter(Boolean);
  const serviceDirectory = await fs.realpath(path.dirname(cratePath));
  const parts = await Promise.all(asArray(dataset.hasPart).map(async (ref, index) => {
    const node = resolveReference(graph, ref);
    const id = typeof ref === 'string' ? ref : ref?.['@id'];
    // Contextual nodes (e.g. expected outputs) aren't files in the repository.
    const local = id && !/^(#|[a-z][a-z0-9+.-]*:|\/)/i.test(id);
    const candidate = local ? path.resolve(path.dirname(cratePath), id) : null;
    const contained = candidate?.startsWith(path.dirname(cratePath) + path.sep);
    const exists = !!(contained && await fileExists(candidate));
    const preview = exists ? await filePreview(candidate, serviceDirectory, id, node?.encodingFormat, index) : null;
    return { ...node, id, exists, preview };
  }));

  return {
    slug,
    repoPath: repoPath.split(path.sep).join('/'),
    name,
    description: safeDescription,
    fullDescription: description,
    serviceType,
    url,
    memory,
    processors: processors.filter(Boolean),
    software: software.map((item) => ({
      name: item.name ?? item.url ?? item['@id'],
      url: getUrl(item),
      version: item.version,
      description: item.description
    })),
    datePublished,
    version: dataset.version,
    keywords: asArray(dataset.keywords),
    authors, licenses, sources, parts,
    graph, dataset, rawMetadata: raw,
    icon: iconInfo
  };
}

async function filePreview(candidate, serviceDirectory, id, format, index) {
  try {
    const actualPath = await fs.realpath(candidate);
    if (!actualPath.startsWith(serviceDirectory + path.sep)) return null;
    const info = await fs.stat(actualPath);
    if (!info.isFile()) return null;
    const extension = path.extname(id).toLowerCase();
    const images = { '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpg', '.gif': 'gif', '.webp': 'webp' };
    if (images[extension]) {
      if (info.size > 5 * 1024 * 1024) return null;
      return { kind: 'image', url: `files/${index}.${images[extension]}`, bytes: await fs.readFile(actualPath) };
    }
    const textFile = /^text\//i.test(format ?? '') || /(?:json|yaml|xml)/i.test(format ?? '') ||
      /\.(?:ya?ml|sh|bash|zsh|json|md|txt|py|js|mjs|ts|toml|ini|cfg|conf|csv|ipynb|xml|html|css)$/i.test(id) ||
      /(?:^|\/)(?:Dockerfile(?:\.[^/]+)?|README|LICENSE|Makefile)$/i.test(id);
    if (!textFile || info.size > 256 * 1024) return null;
    const bytes = await fs.readFile(actualPath);
    const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) return null;
    const language = /\.(?:yaml|yml)$/i.test(id) || /yaml/i.test(format ?? '') ? 'yaml' :
      /\.(?:sh|bash|zsh)$/i.test(id) || /shellscript/i.test(format ?? '') || /^#![^\n]*\b(?:bash|sh|zsh|dash|ksh)\b/.test(content) ? 'bash' : '';
    return { kind: 'text', language, url: `files/${index}.txt`, bytes };
  } catch {
    return null;
  }
}

function resolveIcon(graph, dataset, cratePath, slug) {
  const hasPart = [dataset.logo, dataset.image, ...asArray(dataset.hasPart)].filter(Boolean);
  const iconRef = hasPart
    .map((entry) => (typeof entry === 'string' ? entry : entry?.['@id']))
    .find((id) => typeof id === 'string' && /\.(png|jpg|jpeg|svg)$/.test(id));
  if (!iconRef) return null;

  const iconNode = resolveReference(graph, { '@id': iconRef });
  const filename = cleanRelativePath(iconNode?.url ?? iconRef);
  const ext = path.extname(filename) || '.png';

  const serviceDir = path.dirname(cratePath);
  const iconPath = path.join(serviceDir, filename);
  const slugSafe = slug.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
  const distRelative = path.join('assets', 'icons', `${slugSafe}${ext}`).split(path.sep).join('/');

  return {
    sourcePath: iconPath,
    webRelative: distRelative
  };
}

function cleanRelativePath(value) {
  if (!value) return value;
  if (value.startsWith('http')) {
    return value.split('/').pop();
  }
  return value.replace(/^\.\/+/, '');
}

function resolveReference(graph, ref) {
  if (!ref) return null;
  if (typeof ref === 'string') {
    return graph.find((node) => node['@id'] === ref) ?? { '@id': ref, name: ref };
  }
  if (Array.isArray(ref)) {
    return resolveReference(graph, ref[0]);
  }
  if (typeof ref === 'object') {
    if (ref['@id']) {
      return graph.find((node) => node['@id'] === ref['@id']) ?? ref;
    }
    return ref;
  }
  return null;
}

function truncate(text, limit) {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

function getUrl(entity) {
  if (!entity) return null;
  return entity.url ?? entity.URL ?? entity['@id'] ?? null;
}

function asArray(value) {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1]) {
  const entryUrl = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryUrl) {
    buildSite().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
