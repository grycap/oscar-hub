import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../src/static/theme.js', import.meta.url), 'utf8');
function theme({ stored = null, systemLight = false, blockedStorage = false, head = false } = {}) {
  const attributes = new Map();
  const root = { setAttribute: (name, value) => attributes.set(name, value), getAttribute: name => attributes.get(name) };
  const button = { hidden: true, attributes: {}, classes: new Set(), listeners: {}, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, fn) { this.listeners[name] = fn; } };
  button.classList = { toggle(name, enabled) { enabled ? button.classes.add(name) : button.classes.delete(name); } };
  const storage = new Map(stored ? [['oscar-theme', stored]] : []);
  const document = { documentElement: root, readyState: head ? 'loading' : 'complete', getElementById: () => head ? null : button, addEventListener(name, fn) { this[name] = fn; } };
  vm.runInNewContext(script, {
    document,
    window: { matchMedia: () => ({ matches: systemLight }) },
    localStorage: { getItem(key) { if (blockedStorage) throw new Error('Blocked'); return storage.get(key); }, setItem(key, value) { if (blockedStorage) throw new Error('Blocked'); storage.set(key, value); } }
  });
  return { root, button, storage, document, mount() { head = false; document.DOMContentLoaded(); } };
}

test('theme follows system preference and keeps the landing icon state and accessible label', () => {
  const light = theme({ systemLight: true });
  assert.equal(light.root.getAttribute('data-theme'), 'light');
  assert.equal(light.button.attributes['aria-label'], 'Switch to dark mode');
  assert.equal(light.button.attributes['aria-pressed'], 'true');
  assert.equal(light.button.classes.has('is-light'), true);
  const dark = theme();
  assert.equal(dark.root.getAttribute('data-theme'), 'dark');
  assert.equal(dark.button.attributes['aria-label'], 'Switch to light mode');
});

test('saved choice overrides the system and toggling persists the choice for other pages', () => {
  const page = theme({ stored: 'dark', systemLight: true });
  assert.equal(page.root.getAttribute('data-theme'), 'dark');
  page.button.listeners.click({ preventDefault() {} });
  assert.equal(page.root.getAttribute('data-theme'), 'light');
  assert.equal(page.storage.get('oscar-theme'), 'light');
  assert.equal(page.button.attributes['aria-label'], 'Switch to dark mode');
  assert.equal(theme({ stored: page.storage.get('oscar-theme') }).root.getAttribute('data-theme'), 'light');
});

test('theme applies before the body renders, then initializes the button when the DOM is ready', () => {
  const page = theme({ head: true, stored: 'light' });
  assert.equal(page.root.getAttribute('data-theme'), 'light');
  assert.equal(page.button.hidden, true);
  page.mount();
  assert.equal(page.button.hidden, false);
  assert.equal(page.button.classes.has('is-light'), true);
  assert.equal(typeof page.button.listeners.click, 'function');
});

test('theme switching still works when browser storage is blocked', () => {
  const page = theme({ blockedStorage: true, systemLight: true });
  assert.doesNotThrow(() => page.button.listeners.click({ preventDefault() {} }));
  assert.equal(page.root.getAttribute('data-theme'), 'dark');
});
