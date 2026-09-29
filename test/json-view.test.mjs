import test from 'node:test';
import assert from 'node:assert/strict';
import { renderJsonTree, loadMetadataPreview } from '../src/static/json-view.js';

const decode = text => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('highlighted metadata preserves every key and scalar, including escaped strings and empty collections', () => {
  const data = {
    '@context': ['https://w3id.org/ro/crate/1.2/context'],
    '@graph': [{ '@id': './', description: 'Quotes: "example"\nBackslash: \\ and Unicode: València', values: [12, -3.5, true, false, null, {}, []] }]
  };
  const expected = [];
  function visit(value) {
    if (value === null || typeof value !== 'object') { expected.push(JSON.stringify(value)); return; }
    for (const [key, child] of Object.entries(value)) {
      if (!Array.isArray(value)) expected.push(JSON.stringify(key));
      visit(child);
    }
  }
  visit(data);
  const html = renderJsonTree(data);
  const tokens = [...html.matchAll(/<span class="json-(?:key|string|number|boolean|null)">([\s\S]*?)<\/span>/g)].map(match => decode(match[1]));
  assert.deepEqual(tokens, expected);
  assert.match(html, /json-punctuation">\{\}/);
  assert.match(html, /json-punctuation">\[\]/);
  assert.match(html, /data-json-depth="0" open/);
  assert.match(html, /data-json-depth="2">/);
  assert.match(html, /properties · .\//);
});

test('metadata is escaped before rendering and cannot inject HTML through keys or values', () => {
  const html = renderJsonTree({ '</summary><script>alert(1)</script>': '<img src=x onerror=alert(1)>', '@id': '</span><svg onload=alert(1)>' });
  assert.doesNotMatch(html, /<script|<img|<svg/);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;\/summary&gt;&lt;script&gt;'));
});

function preview() {
  const sections = [{ dataset: { jsonDepth: '0' }, open: true }, { dataset: { jsonDepth: '2' }, open: false }];
  const buttons = ['expand', 'collapse'].map(action => ({ dataset: { jsonAction: action }, addEventListener(_, fn) { this.click = fn; } }));
  const viewer = { hidden: true, innerHTML: '', querySelectorAll: () => sections };
  const toolbar = { hidden: true, querySelectorAll: () => buttons };
  const status = { textContent: '' };
  const details = {
    open: false, dataset: { jsonSource: 'ro-crate-metadata.json' }, attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    querySelector: selector => ({ '.preview-status': status, '.json-viewer': viewer, '.json-toolbar': toolbar })[selector]
  };
  return { details, viewer, toolbar, status, buttons, sections };
}

test('metadata is fetched only on opening, deduplicated while loading, and reused on reopening', async () => {
  const { details, viewer, toolbar, status, buttons, sections } = preview();
  let requests = 0;
  let finish;
  const fetchFile = url => {
    requests++;
    assert.equal(url, 'ro-crate-metadata.json');
    return new Promise(resolve => { finish = resolve; });
  };
  await loadMetadataPreview(details, { fetchFile });
  assert.equal(requests, 0);
  assert.equal(viewer.hidden, true);
  details.open = true;
  const first = loadMetadataPreview(details, { fetchFile });
  const second = loadMetadataPreview(details, { fetchFile });
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(requests, 1);
  assert.equal(details.attributes['aria-busy'], 'true');
  finish({ ok: true, json: async () => ({ '@id': './', description: '<script>alert(1)</script>' }) });
  await first;
  assert.equal(viewer.hidden, false);
  assert.equal(toolbar.hidden, false);
  assert.equal(status.textContent, '');
  assert.equal(details.attributes['aria-busy'], 'false');
  assert.doesNotMatch(viewer.innerHTML, /<script/);
  assert.match(viewer.innerHTML, /&lt;script&gt;/);
  buttons[0].click();
  assert.deepEqual(sections.map(section => section.open), [true, true]);
  buttons[1].click();
  assert.deepEqual(sections.map(section => section.open), [true, false]);
  details.open = false;
  await loadMetadataPreview(details, { fetchFile });
  details.open = true;
  await loadMetadataPreview(details, { fetchFile });
  assert.equal(requests, 1);
});

test('HTTP, network and invalid JSON failures leave a usable preview that can be retried', async () => {
  for (const failure of [
    async () => ({ ok: false, status: 404 }),
    async () => { throw new Error('Offline'); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } })
  ]) {
    const { details, status, viewer, toolbar } = preview();
    details.open = true;
    await loadMetadataPreview(details, { fetchFile: failure });
    assert.match(status.textContent, /Unable to load content/);
    assert.equal(viewer.hidden, true);
    assert.equal(toolbar.hidden, true);
    assert.equal(details.attributes['aria-busy'], 'false');
    details.open = false;
    details.open = true;
    await loadMetadataPreview(details, { fetchFile: async () => ({ ok: true, json: async () => ({ retry: true }) }) });
    assert.equal(status.textContent, '');
    assert.equal(viewer.hidden, false);
  }
});
