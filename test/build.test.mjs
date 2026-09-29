import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../src/build.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const unescape = text => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oscar-hub-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'docs', 'dist'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs', 'dist', 'index.html'), 'Contributor guide');
  return root;
}

async function addCrate(root, slug, overrides = {}) {
  const directory = path.join(root, 'crates', slug);
  await fs.mkdir(directory, { recursive: true });
  const metadata = {
    '@context': 'https://w3id.org/ro/crate/1.2/context',
    '@graph': [
      { '@id': './', '@type': 'Dataset', name: 'Example service', description: 'An example description', serviceType: 'synchronous', hasPart: [{ '@id': 'fdl.yml' }], ...overrides },
      { '@id': 'fdl.yml', '@type': 'File', name: 'Service definition' },
      { '@id': '#author', name: 'Example Author', url: 'https://example.org/author' },
      { '@id': '#software', name: 'Example Software', version: '2.0.0', url: 'https://example.org/software' }
    ]
  };
  await fs.writeFile(path.join(directory, 'ro-crate-metadata.json'), JSON.stringify(metadata, null, 2));
  await fs.writeFile(path.join(directory, 'fdl.yml'), 'functions: []');
  return metadata;
}

async function checkLocalLinks(directory, htmlPath) {
  const html = await fs.readFile(htmlPath, 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => unescape(match[1])));
  for (const match of html.matchAll(/\baria-labelledby="([^"]+)"/g)) {
    for (const id of unescape(match[1]).split(/\s+/)) {
      assert.ok(ids.has(id), `Accessible label exists: ${id} from ${htmlPath}`);
    }
  }
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = unescape(match[1]);
    if (/^(https?:|#)/.test(href)) continue;
    const relative = decodeURIComponent(href.split(/[?#]/)[0]);
    const file = path.resolve(path.dirname(htmlPath), relative);
    assert.ok(file.startsWith(directory), `Link stays inside output: ${href}`);
    const target = relative.endsWith('/') ? path.join(file, 'index.html') : file;
    await assert.doesNotReject(fs.access(target), `Local link exists: ${href} from ${htmlPath}`);
  }
}

test('adding a crate automatically generates its row, filter, detail, files and exact metadata', async t => {
  const root = await workspace(t);
  await addCrate(root, 'first');
  await buildSite({ root });
  const newCrate = await addCrate(root, 'new-crate', {
    name: 'New <service> & example',
    description: `${'Full description. '.repeat(30)}SEARCHABLE_TAIL`,
    serviceType: ['synchronous', 'new-execution-mode'],
    memoryRequirements: ['1 GiB', '6 kserve-GiB'],
    processorRequirements: '2 vCPU',
    url: 'https://example.org/service',
    author: [{ '@id': '#author' }, { name: 'Second author' }],
    softwareRequirements: { '@id': '#software' },
    keywords: ['newkeyword'], version: '1.2.3'
  });
  const services = await buildSite({ root });
  assert.equal(services.length, 2);
  const output = path.join(root, 'dist');
  const catalog = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  const detail = await fs.readFile(path.join(output, 'services/new-crate/index.html'), 'utf8');
  assert.match(catalog, /services\/new-crate\//);
  assert.equal((catalog.match(/class="service-card"/g) ?? []).length, 2);
  assert.match(catalog, /data-view="cards"/);
  assert.doesNotMatch(catalog, /Choose a service to explore its details|Defined with RO-Crate/);
  assert.match(catalog, /option value="new-execution-mode"/);
  assert.match(catalog, /New &lt;service&gt; &amp; example/);
  assert.match(catalog, /SEARCHABLE_TAIL/);
  assert.match(catalog, /newkeyword/);
  assert.ok(unescape(detail).includes(newCrate['@graph'][0].description));
  for (const content of ['Example Author', 'Second author', 'Example Software', '2.0.0', '1.2.3', '1 GiB', '6 kserve-GiB', 'https://example.org/service', '/blob/main/crates/new-crate/fdl.yml']) assert.ok(detail.includes(content), content);
  assert.match(detail, /https:\/\/github.com\/grycap\/oscar-hub\/blob\/main\/crates\/new-crate\/ro-crate-metadata.json/);
  assert.doesNotMatch(detail, /Download RO-Crate JSON| download[ >]/);

  assert.equal(await fs.readFile(path.join(output, 'services/new-crate/ro-crate-metadata.json'), 'utf8'), await fs.readFile(path.join(root, 'crates/new-crate/ro-crate-metadata.json'), 'utf8'));
  await checkLocalLinks(output, path.join(output, 'index.html'));
  // Fixture guide also provides its RO-Crate entry used by detail pages.
  await fs.mkdir(path.join(output, 'guide/ro-crate'), { recursive: true });
  await fs.writeFile(path.join(output, 'guide/ro-crate/index.html'), 'RO-Crate guide');
  await checkLocalLinks(output, path.join(output, 'services/new-crate/index.html'));
  assert.equal(await fs.readFile(path.join(output, 'guide/index.html'), 'utf8'), 'Contributor guide');
  await fs.access(path.join(output, '.nojekyll'));
  await fs.rm(path.join(root, 'crates/new-crate'), { recursive: true });
  await buildSite({ root });
  await assert.rejects(fs.access(path.join(output, 'services/new-crate')));
  assert.doesNotMatch(await fs.readFile(path.join(output, 'index.html'), 'utf8'), /new-execution-mode/);
});

test('all repository crates retain full descriptions, original metadata and resource values', async t => {
  const destination = await workspace(t);
  const services = await buildSite({ root: repository, destination });
  const folders = await fs.readdir(path.join(repository, 'crates'));
  let expectedCount = 0;
  for (const slug of folders) {
    let raw;
    try { raw = await fs.readFile(path.join(repository, 'crates', slug, 'ro-crate-metadata.json'), 'utf8'); } catch { continue; }
    expectedCount++;
    const dataset = JSON.parse(raw)['@graph'].find(node => node['@id'] === './');
    const detail = unescape(await fs.readFile(path.join(destination, 'services', slug, 'index.html'), 'utf8'));
    assert.ok(detail.includes(dataset.description), `Full description: ${slug}`);
    for (const value of [dataset.memoryRequirements, dataset.processorRequirements].flat(2).filter(Boolean)) assert.ok(detail.includes(value), `Resource retained: ${slug}: ${value}`);
    assert.equal(await fs.readFile(path.join(destination, 'services', slug, 'ro-crate-metadata.json'), 'utf8'), raw);
    const service = services.find(item => item.slug === slug);
    if (service.icon) await fs.access(path.join(destination, service.icon.webRelative));
  }
  assert.equal(services.length, expectedCount);
  const catalog = await fs.readFile(path.join(destination, 'index.html'), 'utf8');
  assert.equal((catalog.match(/class="service-row"/g) ?? []).length, expectedCount);
  assert.equal((catalog.match(/class="service-card"/g) ?? []).length, expectedCount);
  assert.match(catalog, /option value="kserve"/);
});

test('missing optional fields and malformed crates do not block a new valid service', async t => {
  const root = await workspace(t);
  await addCrate(root, 'minimal', { hasPart: [{ '@id': 'missing.txt' }, { '@id': '#expected-output' }], URL: 'https://example.org/legacy' });
  await fs.mkdir(path.join(root, 'crates/broken'), { recursive: true });
  await fs.writeFile(path.join(root, 'crates/broken/ro-crate-metadata.json'), '{invalid');
  const services = await buildSite({ root });
  assert.equal(services.length, 1);
  const html = await fs.readFile(path.join(root, 'dist/services/minimal/index.html'), 'utf8');
  assert.match(html, /Not specified/);
  assert.match(html, /service-icon--fallback/);
  assert.match(html, /https:\/\/example.org\/legacy/);
  assert.doesNotMatch(html, /href="[^"]*missing.txt/);
  assert.doesNotMatch(html, /href="[^"]*#expected-output/);
});
