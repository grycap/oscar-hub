const tbody = document.getElementById('downloads');
const note = document.getElementById('activity-note');
const defaultNote = note.textContent;

function emptyRow(message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 5;
  cell.className = 'empty';
  cell.textContent = message;
  row.append(cell);
  tbody.replaceChildren(row);
}

function sizeLabel(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 ** 2 ? 'KiB' : bytes < 1024 ** 3 ? 'MiB' : 'GiB';
  const divisor = 1024 ** (['KiB', 'MiB', 'GiB'].indexOf(unit) + 1);
  return `${(bytes / divisor).toFixed(1)} ${unit}`;
}

function addCell(row, value, className) {
  const cell = document.createElement('td');
  cell.textContent = value;
  if (className) cell.className = className;
  row.append(cell);
  return cell;
}

function renderDownloads(downloads) {
  if (!downloads.length) {
    emptyRow('No downloads yet. Enter a DOI to get started.');
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const item of downloads) {
    const row = document.createElement('tr');
    addCell(row, item.doi || '—', 'doi');
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    const state = ['running', 'completed', 'failed'].includes(item.state) ? item.state : 'unknown';
    badge.className = `badge badge-${state}`;
    badge.textContent = state.charAt(0).toUpperCase() + state.slice(1);
    statusCell.append(badge);
    if (item.error) {
      const error = document.createElement('span');
      error.className = 'error-note';
      error.textContent = item.error;
      statusCell.append(error);
    }
    row.append(statusCell);
    addCell(row, Number.isInteger(item.files) ? String(item.files) : '—');
    addCell(row, sizeLabel(item.bytes));
    addCell(row, item.directory || '—', 'folder-name');
    fragment.append(row);
  }
  tbody.replaceChildren(fragment);
}

async function refresh() {
  try {
    const response = await fetch('status', {cache: 'no-store', credentials: 'same-origin'});
    if (!response.ok) throw new Error('Status unavailable');
    const snapshot = await response.json();
    renderDownloads(Array.isArray(snapshot.downloads) ? snapshot.downloads : []);
    note.textContent = defaultNote;
  } catch {
    emptyRow('Unable to load downloads. Retrying automatically…');
    note.textContent = 'Check your connection or sign in again if your session has expired.';
  }
}

refresh();
setInterval(refresh, 3000);
