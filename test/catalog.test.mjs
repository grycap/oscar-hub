import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../src/static/main.js', import.meta.url), 'utf8');
function element(properties = {}) {
  return { hidden: false, value: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, focus() { this.focused = true; }, ...properties };
}
function catalog(url) {
  const rows = [
    element({ dataset: { search: 'Document converter full description tailterm Example Software', types: '["synchronous","asynchronous"]' } }),
    element({ dataset: { search: 'Image detector', types: '["asynchronous","kserve"]' } }),
    element({ dataset: { search: 'Language model', types: '["exposed","kserve"]' } })
  ];
  const cards = rows.map(row => element({ dataset: { ...row.dataset } }));
  const viewButtons = ['table', 'cards'].map(view => element({ dataset: { view } }));
  const elements = {
    '#serviceTable': element(),
    '#serviceCards': element({ querySelectorAll() { return cards; } }),
    '#viewSwitcher': element({ hidden: true, querySelectorAll() { return viewButtons; } }),
    '#search': element(),
    '#serviceTypeFilter': element({ options: ['', 'synchronous', 'asynchronous', 'exposed', 'kserve'].map(value => ({ value })) }),
    '#serviceRows': element({ querySelectorAll() { return rows; } }),
    '#emptyState': element(), '#resultCount': element(), '#clearFilters': element(), '#resetSearch': element(), '.catalog-controls': element()
  };
  const window = element({ location: new URL(url), history: { state: null, replaceState(state, _, next) { this.state = state; if (next) window.location = new URL(next); } } });
  const document = element({ querySelectorAll: () => [], querySelector: selector => elements[selector] ?? null });
  const storage = new Map();
  vm.runInNewContext(script, { document, window, URL, URLSearchParams, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, requestAnimationFrame: fn => fn() });
  return { elements, rows, cards, viewButtons, window, document };
}

test('a shared filter URL includes services supporting multiple execution types', () => {
  const { rows, elements } = catalog('https://hub.example/?type=kserve');
  assert.deepEqual(rows.map(row => row.hidden), [true, false, false]);
  assert.equal(elements['#resultCount'].textContent, '2 services of 3');
  assert.equal(elements['#clearFilters'].hidden, false);
});

test('search combines with type, finds full metadata, and clear restores all services', () => {
  const { rows, elements, window } = catalog('https://hub.example/?type=synchronous&q=tailterm');
  assert.deepEqual(rows.map(row => row.hidden), [false, true, true]);
  elements['#search'].value = 'missing';
  elements['#search'].listeners.input();
  assert.equal(elements['#emptyState'].hidden, false);
  assert.equal(elements['#resultCount'].textContent, '0 services of 3');
  assert.equal(window.location.searchParams.get('q'), 'missing');
  elements['#resetSearch'].listeners.click();
  assert.deepEqual(rows.map(row => row.hidden), [false, false, false]);
  assert.equal(window.location.search, '');
  assert.equal(elements['#resultCount'].textContent, '3 services');
  assert.equal(elements['#emptyState'].hidden, true);
  assert.equal(elements['#search'].focused, true);
});

test('an obsolete filter does not hide every service, and browser navigation restores the URL state', () => {
  const { rows, elements, window } = catalog('https://hub.example/?type=removed-type');
  assert.deepEqual(rows.map(row => row.hidden), [false, false, false]);
  window.location = new URL('https://hub.example/?q=detector&type=kserve');
  window.listeners.popstate();
  assert.deepEqual(rows.map(row => row.hidden), [true, false, true]);
  assert.equal(elements['#search'].value, 'detector');
});

test('the search shortcut respects editable controls and modifier keys', () => {
  const { elements, document } = catalog('https://hub.example/');
  let prevented = false;
  document.activeElement = { tagName: 'SELECT' };
  document.listeners.keydown({ key: '/', preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
  document.activeElement = { tagName: 'BODY' };
  document.listeners.keydown({ key: '/', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(elements['#search'].focused, true);
});

test('a directly opened detail page keeps its usable catalog link', () => {
  const back = element({ href: 'https://hub.example/' });
  let wentBack = false;
  vm.runInNewContext(script, {
    document: { referrer: 'https://hub.example/', querySelectorAll: () => [], querySelector: selector => selector === '[data-back-catalog]' ? back : null },
    window: { location: new URL('https://hub.example/services/demo/'), history: { length: 1, back() { wentBack = true; } } }, URL
  });
  back.listeners.click({ preventDefault() { throw new Error('Should use native catalog link'); } });
  assert.equal(wentBack, false);
});

test('preview toggles load only opened content and allow retry after a loader failure', async () => {
  const status = element();
  const preview = element({ open: false, querySelector: () => status });
  let attempts = 0;
  vm.runInNewContext(`${script}\nwatchPreview(preview, loader);`, {
    document: { querySelector: () => null, querySelectorAll: () => [] },
    window: { location: new URL('https://hub.example/services/demo/') },
    preview,
    loader: async details => {
      assert.equal(details, preview);
      if (++attempts === 1) throw new Error('Unavailable module');
      status.textContent = '';
    }
  });
  await preview.listeners.toggle();
  assert.equal(attempts, 0);
  preview.open = true;
  await preview.listeners.toggle();
  assert.match(status.textContent, /Unable to load content/);
  preview.open = false;
  await preview.listeners.toggle();
  assert.equal(attempts, 1);
  preview.open = true;
  await preview.listeners.toggle();
  assert.equal(attempts, 2);
  assert.equal(status.textContent, '');
});


test('switching to cards preserves active filters, counts and shareable URL state', () => {
  const { elements, rows, cards, viewButtons, window } = catalog('https://hub.example/?type=kserve&q=detector');
  assert.equal(elements['#serviceTable'].hidden, false);
  assert.equal(elements['#serviceCards'].hidden, true);
  assert.equal(elements['#viewSwitcher'].hidden, false);
  viewButtons[1].listeners.click();
  assert.equal(elements['#serviceTable'].hidden, true);
  assert.equal(elements['#serviceCards'].hidden, false);
  assert.deepEqual(cards.map(card => card.hidden), rows.map(row => row.hidden));
  assert.equal(elements['#resultCount'].textContent, '1 service of 3');
  assert.equal(window.location.searchParams.get('view'), 'cards');
  assert.equal(window.location.searchParams.get('q'), 'detector');
  assert.equal(window.location.searchParams.get('type'), 'kserve');
  assert.equal(viewButtons[1].attributes['aria-pressed'], 'true');
  assert.equal(viewButtons[0].attributes['aria-pressed'], 'false');
  viewButtons[0].listeners.click();
  assert.equal(elements['#serviceTable'].hidden, false);
  assert.equal(elements['#serviceCards'].hidden, true);
  assert.equal(window.location.searchParams.has('view'), false);
  assert.equal(elements['#search'].value, 'detector');
});

test('a cards URL restores the selected view and clearing filters keeps it selected', () => {
  const { elements, cards, viewButtons, window } = catalog('https://hub.example/?view=cards&type=kserve');
  assert.equal(elements['#serviceTable'].hidden, true);
  assert.equal(elements['#serviceCards'].hidden, false);
  assert.deepEqual(cards.map(card => card.hidden), [true, false, false]);
  assert.equal(viewButtons[1].attributes['aria-pressed'], 'true');
  elements['#resetSearch'].listeners.click();
  assert.deepEqual(cards.map(card => card.hidden), [false, false, false]);
  assert.equal(window.location.search, '?view=cards');
  window.location = new URL('https://hub.example/?q=detector');
  window.listeners.popstate();
  assert.equal(elements['#serviceCards'].hidden, true);
  assert.equal(elements['#serviceTable'].hidden, false);
  assert.equal(viewButtons[0].attributes['aria-pressed'], 'true');
});
