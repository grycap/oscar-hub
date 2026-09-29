const searchInput = document.querySelector('#search');
const typeSelect = document.querySelector('#serviceTypeFilter');
const serviceRows = document.querySelector('#serviceRows');
const rows = Array.from(serviceRows?.querySelectorAll('.service-row') ?? []);
const serviceTable = document.querySelector('#serviceTable');
const serviceCards = document.querySelector('#serviceCards');
const cards = Array.from(serviceCards?.querySelectorAll('.service-card') ?? []);
const filterEntries = [...rows, ...cards].map(element => ({
  element,
  search: element.dataset.search.toLowerCase(),
  types: JSON.parse(element.dataset.types)
}));
const viewSwitcher = document.querySelector('#viewSwitcher');
const viewButtons = Array.from(viewSwitcher?.querySelectorAll('[data-view]') ?? []);
let currentView = 'table';

const emptyState = document.querySelector('#emptyState');
const resultCount = document.querySelector('#resultCount');
const clearFilters = document.querySelector('#clearFilters');

function applyFilters(updateUrl = true) {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeSelect.value;
  filterEntries.forEach(({ element, search, types }) => {
    element.hidden = !(search.includes(query) && (!type || types.includes(type)));
  });
  const count = rows.filter(row => !row.hidden).length;
  if (serviceTable) serviceTable.hidden = currentView !== 'table' || count === 0;
  if (serviceCards) serviceCards.hidden = currentView !== 'cards' || count === 0;
  emptyState.hidden = count !== 0;
  resultCount.textContent = `${count} ${count === 1 ? 'service' : 'services'}${query || type ? ` of ${rows.length}` : ''}`;
  clearFilters.hidden = !query && !type;
  if (updateUrl) {
    const url = new URL(window.location.href);
    searchInput.value.trim() ? url.searchParams.set('q', searchInput.value.trim()) : url.searchParams.delete('q');
    type ? url.searchParams.set('type', type) : url.searchParams.delete('type');
    currentView === 'cards' ? url.searchParams.set('view', 'cards') : url.searchParams.delete('view');
    window.history.replaceState(window.history.state, '', url);
  }
}

function readFilters() {
  const params = new URLSearchParams(window.location.search);
  currentView = params.get('view') === 'cards' ? 'cards' : 'table';
  updateViewButtons();
  searchInput.value = params.get('q') ?? '';
  const type = params.get('type') ?? '';
  typeSelect.value = Array.from(typeSelect.options).some(option => option.value === type) ? type : '';
  applyFilters(false);
}

function updateViewButtons() {
  viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === currentView)));
}

if (serviceRows) {
  readFilters();
  if (viewSwitcher) viewSwitcher.hidden = false;
  viewButtons.forEach(button => button.addEventListener('click', () => {
    currentView = button.dataset.view;
    updateViewButtons();
    applyFilters();
  }));
  searchInput.addEventListener('input', () => applyFilters());
  typeSelect.addEventListener('change', () => applyFilters());
  document.querySelector('.catalog-controls').addEventListener('submit', event => event.preventDefault());
  const reset = () => {
    searchInput.value = '';
    typeSelect.value = '';
    applyFilters();
    searchInput.focus();
  };
  clearFilters.addEventListener('click', reset);
  document.querySelector('#resetSearch').addEventListener('click', reset);
  window.addEventListener('popstate', readFilters);
  // A history entry keeps each catalog visit's filters and scroll position separate.
  const stateKey = `oscar-hub:${window.location.pathname}`;
  const visitId = window.history.state?.catalogVisit ?? `${Date.now()}-${Math.random()}`;
  window.history.replaceState({ ...window.history.state, catalogVisit: visitId }, '');
  window.addEventListener('pagehide', () => {
    try { sessionStorage.setItem(`${stateKey}:${visitId}`, JSON.stringify({ url: window.location.href, scroll: window.scrollY })); } catch { /* Browsing works when storage is unavailable. */ }
  });
  window.addEventListener('pageshow', event => {
    readFilters();
    if (event.persisted) return; // The browser restores its own back/forward cache.
    try {
      const saved = JSON.parse(sessionStorage.getItem(`${stateKey}:${visitId}`));
      if (saved?.url === window.location.href) requestAnimationFrame(() => window.scrollTo(0, saved.scroll));
    } catch { /* No saved position. */ }
  });
  document.addEventListener('keydown', event => {
    const target = document.activeElement;
    const editing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
    if (event.key === '/' && !event.defaultPrevented && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      searchInput.focus();
    }
  });
}

// On a detail page, the explicit back link also preserves the catalog context.
const backLink = document.querySelector('[data-back-catalog]');
if (backLink) {
  backLink.addEventListener('click', event => {
    const origin = document.referrer ? new URL(document.referrer) : null;
    const catalog = new URL(backLink.href);
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && window.history.length > 1 && origin?.origin === catalog.origin && origin.pathname === catalog.pathname) {
      event.preventDefault();
      window.history.back();
    }
  });
}

function watchPreview(preview, load) {
  preview.addEventListener('toggle', async () => {
    if (!preview.open) return;
    try {
      await load(preview);
    } catch {
      preview.querySelector('.preview-status').textContent = 'Unable to load content. Close and reopen to retry.';
    }
  });
}

const metadataPreview = document.querySelector('[data-json-source]');
if (metadataPreview) {
  watchPreview(metadataPreview, async preview => {
    const { loadMetadataPreview } = await import('./json-view.js');
    await loadMetadataPreview(preview);
  });
}

const DEV_HOSTS = new Set(['localhost', '127.0.0.1']);
if (DEV_HOSTS.has(window.location.hostname) && 'EventSource' in window) {
  const source = new EventSource('/__dev_reload');
  source.addEventListener('message', event => { if (event.data === 'reload') window.location.reload(); });
  source.addEventListener('error', () => source.close());
}
