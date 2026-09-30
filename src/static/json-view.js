const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const jsonToken = (type, value) => `<span class="json-${type}">${escape(value)}</span>`;

/** Keyboard-accessible, escaped JSON with native folding. */
export function renderJsonTree(value, { key, depth = 0, comma = false } = {}) {
  const prefix = key === undefined ? '' : `${jsonToken('key', JSON.stringify(key))}${jsonToken('punctuation', ':')} `;
  const suffix = comma ? jsonToken('punctuation', ',') : '';
  if (value === null || typeof value !== 'object') {
    const type = value === null ? 'null' : typeof value;
    return `<div class="json-line">${prefix}${jsonToken(type, JSON.stringify(value))}${suffix}</div>`;
  }

  const isArray = Array.isArray(value);
  const entries = Object.entries(value);
  const [start, end] = isArray ? ['[', ']'] : ['{', '}'];
  if (!entries.length) {
    return `<div class="json-line">${prefix}${jsonToken('punctuation', start + end)}${suffix}</div>`;
  }

  const count = `${entries.length} ${isArray ? (entries.length === 1 ? 'item' : 'items') : (entries.length === 1 ? 'property' : 'properties')}`;
  const identity = !isArray && typeof value['@id'] === 'string' ? ` · ${value['@id']}` : '';
  return `<details class="json-fold" data-json-depth="${depth}"${depth < 2 ? ' open' : ''}>
    <summary>${prefix}${jsonToken('punctuation', start)}<span class="json-collapsed"> … ${jsonToken('punctuation', end)}${suffix}</span><span class="json-count">${escape(count + identity)}</span></summary>
    <div class="json-children">${entries.map(([entryKey, entryValue], index) => renderJsonTree(entryValue, {
      key: isArray ? undefined : entryKey,
      depth: depth + 1,
      comma: index < entries.length - 1
    })).join('')}</div>
    <div class="json-line json-end">${jsonToken('punctuation', end)}${suffix}</div>
  </details>`;
}

const previews = new WeakMap();

/** Fetch once on opening; a failed request can be retried by reopening. */
export function loadMetadataPreview(details, { fetchFile = fetch } = {}) {
  if (!details.open) return;
  if (previews.has(details)) return previews.get(details);
  const status = details.querySelector('.preview-status');
  const viewer = details.querySelector('.json-viewer');
  const toolbar = details.querySelector('.json-toolbar');
  status.textContent = 'Loading content…';
  details.setAttribute('aria-busy', 'true');
  const loading = (async () => {
    // Defer the request until the promise is cached, even if fetch throws.
    await Promise.resolve();
    try {
      const response = await fetchFile(details.dataset.jsonSource);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      viewer.innerHTML = renderJsonTree(data);
      viewer.hidden = false;
      toolbar.hidden = false;
      status.textContent = '';
      toolbar.querySelectorAll('[data-json-action]').forEach(button => {
        button.addEventListener('click', () => {
          viewer.querySelectorAll('.json-fold').forEach(section => {
            section.open = button.dataset.jsonAction === 'expand' || section.dataset.jsonDepth === '0';
          });
        });
      });
    } catch {
      previews.delete(details);
      status.textContent = 'Unable to load content. Close and reopen to retry.';
    } finally {
      details.setAttribute('aria-busy', 'false');
    }
  })();
  previews.set(details, loading);
  return loading;
}
