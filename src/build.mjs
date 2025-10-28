#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'dist');
const assetsDir = path.join(outputDir, 'assets');
const iconsDir = path.join(assetsDir, 'icons');
const staticDir = path.join(__dirname, 'static');
const cratesDir = path.join(repoRoot, 'crates');

export async function buildSite() {
  const services = await collectServices();
  await prepareOutput();
  await copyStaticAssets();
  await copyServiceIcons(services);
  await Promise.all([writeIndexHtml(services), writeServicesJson(services), writeNoJekyll()]);
  console.log(`Generated landing page for ${services.length} services.`);
  return services;
}

async function prepareOutput() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });
}

async function copyStaticAssets() {
  try {
    await fs.access(staticDir);
  } catch {
    return;
  }
  await fs.cp(staticDir, assetsDir, { recursive: true });
}

async function writeIndexHtml(services) {
  const html = renderHtml(services);
  await fs.writeFile(path.join(outputDir, 'index.html'), html, 'utf8');
}

async function writeServicesJson(services) {
  const payload = services.map(({ icon, ...rest }) => ({
    ...rest,
    icon: icon?.webRelative ?? null
  }));
  await fs.writeFile(
    path.join(outputDir, 'services.json'),
    JSON.stringify(payload, null, 2),
    'utf8'
  );
}

async function writeNoJekyll() {
  await fs.writeFile(path.join(outputDir, '.nojekyll'), '', 'utf8');
}

async function copyServiceIcons(services) {
  const iconsToCopy = services.filter((service) => service.icon?.sourcePath);
  if (iconsToCopy.length === 0) return;
  await fs.mkdir(iconsDir, { recursive: true });
  await Promise.all(
    iconsToCopy.map(async (service) => {
      const destination = path.join(outputDir, service.icon.webRelative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(service.icon.sourcePath, destination);
    })
  );
}

async function collectServices() {
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
  const serviceType = dataset.serviceType ?? 'unknown';
  const url = dataset.URL ?? null;
  const license = resolveReference(graph, dataset.license);
  const author = resolveReference(graph, dataset.author);
  const memory = dataset.memoryRequirements ?? null;
  const processors = dataset.processorRequirements ?? [];
  const software = (dataset.softwareRequirements ?? [])
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

  return {
    slug,
    repoPath: repoPath.split(path.sep).join('/'),
    name,
    description: safeDescription,
    fullDescription: description,
    serviceType,
    url,
    license: license?.name ?? null,
    licenseUrl: getUrl(license),
    author: author?.name ?? author?.url ?? null,
    authorUrl: getUrl(author),
    memory,
    processors: processors.filter(Boolean),
    software: software.map((item) => ({
      name: item.name ?? item.url ?? item['@id'],
      url: getUrl(item)
    })),
    datePublished,
    icon: iconInfo
  };
}

function resolveIcon(graph, dataset, cratePath, slug) {
  const hasPart = Array.isArray(dataset.hasPart) ? dataset.hasPart : [];
  const iconRef = hasPart
    .map((entry) => (typeof entry === 'string' ? entry : entry?.['@id']))
    .find((id) => typeof id === 'string' && /\.(png|jpg|jpeg|svg)$/.test(id));
  if (!iconRef) return null;

  const iconNode = resolveReference(graph, { '@id': iconRef });
  const filename = cleanRelativePath(iconNode?.url ?? iconRef);
  const ext = path.extname(filename) || '.png';

  const serviceDir = path.dirname(cratePath);
  const iconPath = path.join(serviceDir, filename);
  const repoRelative = path
    .relative(repoRoot, iconPath)
    .split(path.sep)
    .join('/');

  const slugSafe = slug.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
  const distRelative = path.join('assets', 'icons', `${slugSafe}${ext}`).split(path.sep).join('/');

  return {
    sourcePath: iconPath,
    extension: ext,
    repoRelative,
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
    return graph.find((node) => node['@id'] === ref) ?? null;
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

function renderHtml(services) {
  const serviceCards = services.map(renderServiceCard).join('\n');
  const servicesCount = services.length === 1 ? '1 service' : `${services.length} services`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OSCAR Hub | Service Catalog</title>
  <meta name="description" content="Discover OSCAR services ready for deployment.">
  <link rel="stylesheet" href="assets/style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
</head>
<body>
  <header class="hero">
    <div class="hero__content">
      <img class="hero__logo" src="assets/oscar3-logo-trans.png" alt="OSCAR logo" width="220" height="72" loading="lazy">
      <h1 class="hero__title">Services Catalog</h1>
      <p class="hero__subtitle">Ready to be deployed on <a href="https://oscar.grycap.net">OSCAR</a>.</p>
      <div class="hero__actions">
        <a class="btn btn--primary" href="https://github.com/grycap/oscar-hub" target="_blank" rel="noreferrer">GitHub Repository</a>
      </div>
    </div>
    <div class="hero__meta">
      <span class="meta-pill">${servicesCount}</span>
      <span class="meta-pill">Generated ${new Date().toISOString().split('T')[0]}</span>
    </div>
  </header>

  <main>
    <section class="catalog">
      <div class="catalog__header">
        <h2>Available</h2>
        <div class="catalog__controls">
          <input id="search" type="search" placeholder="Search services" aria-label="Search services">
          <select id="serviceTypeFilter" aria-label="Filter by service type">
            <option value="">All types</option>
            <option value="synchronous">Synchronous</option>
            <option value="asynchronous">Asynchronous</option>            
          </select>
        </div>
      </div>
      <div id="serviceGrid" class="service-grid">
        ${serviceCards}
      </div>
      <p id="emptyState" class="empty-state" hidden>No services matched your filters. Try a different search term.</p>
    </section>
  </main>

  <footer class="site-footer">
    <p>Developed by the <a href="https://grycap.upv.es" target="_blank" rel="noreferrer">GRyCAP</a> research group at <a href="https://www.upv.es">Universitat Politècnica de València (UPV)</a>.</p>
  </footer>

  <script src="assets/main.js" type="module"></script>
</body>
</html>`;
}

function renderServiceCard(service) {
  const iconSrc = service.icon?.webRelative ?? null;
  const icon = iconSrc
    ? `<img src="${iconSrc}" alt="" class="service-card__icon" loading="lazy">`
    : `<div class="service-card__icon service-card__icon--fallback" aria-hidden="true">${initials(
        service.name
      )}</div>`;

  const serviceType = service.serviceType
    ? `<span class="tag">${escapeHtml(capitalize(service.serviceType))}</span>`
    : '';

  const memory = service.memory ? `<span class="meta-item">${escapeHtml(service.memory)}</span>` : '';

  const processors =
    service.processors.length > 0
      ? `<span class="meta-item">${escapeHtml(service.processors.join(' · '))}</span>`
      : '';

  const softwareLinks =
    service.software.length > 0
      ? `<div class="service-card__software">${service.software
          .map(
            (item) =>
              `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(
                item.name
              )}</a>`
          )
          .join('')}</div>`
      : '';

  const author = service.author
    ? `<p class="service-card__author">By ${
        service.authorUrl
          ? `<a href="${escapeAttribute(service.authorUrl)}" target="_blank" rel="noreferrer">${escapeHtml(
              service.author
            )}</a>`
          : escapeHtml(service.author)
      }</p>`
    : '';

  const license = service.license
    ? `<p class="service-card__license">License: ${
        service.licenseUrl
          ? `<a href="${escapeAttribute(service.licenseUrl)}" target="_blank" rel="noreferrer">${escapeHtml(
              service.license
            )}</a>`
          : escapeHtml(service.license)
      }</p>`
    : '';

  const date = service.datePublished
    ? `<span class="meta-item">${escapeHtml(formatDate(service.datePublished))}</span>`
    : '';

  const repoPath = service.repoPath ?? `crates/${service.slug}`;
  const rawRepoUrl = `https://github.com/grycap/oscar-hub/tree/main/${repoPath}`;
  const rawDefinitionUrl = service.url ?? rawRepoUrl;
  const actionButtons = [
    `<a class="btn btn--secondary" href="${escapeAttribute(
      rawDefinitionUrl
    )}" target="_blank" rel="noreferrer">View definition</a>`
  ];
  if (rawDefinitionUrl !== rawRepoUrl) {
    actionButtons.push(
      `<a class="btn btn--ghost" href="${escapeAttribute(
        rawRepoUrl
      )}" target="_blank" rel="noreferrer">Browse files</a>`
    );
  }

  return `<article class="service-card" data-service-name="${escapeAttribute(
    service.name
  )}" data-service-type="${escapeAttribute(service.serviceType)}">
    ${icon}
    <div class="service-card__content">
      <h3>${escapeHtml(service.name)}</h3>
      <p class="service-card__description">${escapeHtml(service.description)}</p>
      <div class="service-card__tags">
        ${serviceType}
      </div>
      <div class="service-card__meta">
        ${memory}
        ${processors}
        ${date}
      </div>
      ${softwareLinks}
      ${author}
      ${license}
    </div>
    <div class="service-card__actions">
      ${actionButtons.join('\n      ')}
    </div>
  </article>`;
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  if (!value) return '';
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function capitalize(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initials(text) {
  if (!text) return 'OS';
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
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
