const previews = new WeakMap();
const highlight = async (content, language) => {
  const { highlightCode } = await import('./highlight.js');
  return highlightCode(content, language);
};

function loadImage(image, url) {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to load image'));
    image.src = url;
  }).finally(() => { image.onload = image.onerror = null; });
}

/** Load only the opened file and cache successful previews for this page. */
export function loadFilePreview(details, { fetchFile = fetch, highlightCode = highlight, showImage = loadImage } = {}) {
  if (!details.open) return;
  if (previews.has(details)) return previews.get(details);
  const status = details.querySelector('.preview-status');
  status.textContent = 'Loading content…';
  details.setAttribute('aria-busy', 'true');
  const loading = (async () => {
    await Promise.resolve();
    try {
      const { fileSource, fileKind, fileLanguage } = details.dataset;
      if (fileKind === 'image') {
        const image = details.querySelector('.file-image');
        await showImage(image, fileSource);
        image.hidden = false;
      } else {
        const response = await fetchFile(fileSource);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text();
        const viewer = details.querySelector('.file-code-viewer');
        const code = viewer.querySelector('code');
        code.textContent = content;
        if (fileLanguage) {
          try { code.innerHTML = await highlightCode(content, fileLanguage); }
          catch { /* Plain text remains readable if the optional highlighter fails. */ }
        }
        viewer.hidden = false;
      }
      status.textContent = '';
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
