import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFilePreview } from '../src/static/file-view.js';
import { highlightCode } from '../src/highlight.mjs';

const decode = text => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function preview(language = '', kind = 'text') {
  const code = { textContent: '', innerHTML: '' };
  const viewer = { hidden: true, querySelector: () => code };
  const image = { hidden: true };
  const status = { textContent: '' };
  const details = {
    open: false, dataset: { fileSource: 'files/0.txt', fileLanguage: language, fileKind: kind }, attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    querySelector: selector => ({ '.preview-status': status, '.file-code-viewer': viewer, '.file-image': image })[selector]
  };
  return { details, status, viewer, code, image };
}

test('YAML and shell highlighting preserves exact source and escapes executable HTML', () => {
  for (const [language, content, token] of [
    ['yaml', 'functions:\n  enabled: true\n  count: 2\n  name: "<script>alert(1)</script>"\n# note\n', 'hljs-attr'],
    ['bash', '#!/bin/sh\n# note\nif [ -n "$INPUT_FILE_PATH" ]; then\n  echo "<img onerror=alert(1)>"\nfi\n', 'hljs-keyword']
  ]) {
    const html = highlightCode(content, language);
    assert.ok(html.includes(token));
    assert.match(html, /hljs-comment/);
    assert.doesNotMatch(html, /<script|<img/);
    assert.equal(decode(html.replace(/<[^>]+>/g, '')), content);
  }
});

test('files and highlighting load only for an opened preview and are cached independently', async () => {
  const first = preview('yaml');
  const second = preview('bash');
  const plain = preview();
  let requests = 0;
  let highlighted = 0;
  const options = {
    fetchFile: async () => { requests++; return { ok: true, text: async () => 'name: "<script>"\n' }; },
    highlightCode: async (...args) => { highlighted++; return highlightCode(...args); }
  };
  await loadFilePreview(first.details, options);
  assert.equal(requests, 0);
  assert.equal(highlighted, 0);
  first.details.open = true;
  const a = loadFilePreview(first.details, options);
  assert.equal(a, loadFilePreview(first.details, options));
  await a;
  assert.equal(requests, 1);
  assert.equal(highlighted, 1);
  assert.equal(first.viewer.hidden, false);
  assert.equal(second.viewer.hidden, true);
  assert.equal(first.details.attributes['aria-busy'], 'false');
  first.details.open = false;
  await loadFilePreview(first.details, options);
  first.details.open = true;
  await loadFilePreview(first.details, options);
  assert.equal(requests, 1);
  second.details.open = true;
  await loadFilePreview(second.details, options);
  plain.details.open = true;
  await loadFilePreview(plain.details, options);
  assert.equal(requests, 3);
  assert.equal(highlighted, 2);
  assert.equal(plain.code.textContent, 'name: "<script>"\n');
  assert.equal(plain.code.innerHTML, '');
});

test('failed highlighting falls back to plain text and failed requests can be retried', async () => {
  const { details, status, viewer, code } = preview('yaml');
  details.open = true;
  await loadFilePreview(details, { fetchFile: async () => ({ ok: false, status: 404 }) });
  assert.match(status.textContent, /Unable to load/);
  assert.equal(viewer.hidden, true);
  await loadFilePreview(details, {
    fetchFile: async () => ({ ok: true, text: async () => '<svg onload=alert(1)>' }),
    highlightCode: async () => { throw new Error('Offline'); }
  });
  assert.equal(status.textContent, '');
  assert.equal(viewer.hidden, false);
  assert.equal(code.textContent, '<svg onload=alert(1)>');
  assert.equal(code.innerHTML, '');
});

test('image source is assigned only on opening and image failures can be retried', async () => {
  const { details, image, status } = preview('', 'image');
  let requests = 0;
  const options = { showImage: async (target, url) => { requests++; target.src = url; } };
  await loadFilePreview(details, options);
  assert.equal(requests, 0);
  assert.equal(image.src, undefined);
  details.open = true;
  await loadFilePreview(details, { showImage: async () => { throw new Error('Broken image'); } });
  assert.equal(image.hidden, true);
  assert.match(status.textContent, /Unable to load/);
  await loadFilePreview(details, options);
  assert.equal(requests, 1);
  assert.equal(image.hidden, false);
  await loadFilePreview(details, options);
  assert.equal(requests, 1);
});
