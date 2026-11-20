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

const doiInput = document.getElementById('doi');
const filterInput = document.getElementById('filter');
const csrfInput = document.querySelector('input[name="csrf"]');
const downloadForm = document.getElementById('download-form');
const startDownload = document.getElementById('start-download');
const browse = document.getElementById('browse');
const picker = document.getElementById('file-picker');
const fileList = document.getElementById('file-list');
const selectAll = document.getElementById('select-all');
const summary = document.getElementById('picker-summary');
const pickerError = document.getElementById('picker-error');

downloadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!downloadForm.reportValidity()) return;
  startDownload.disabled = true;
  startDownload.textContent = 'Downloading ...';
  showPickerError('');
  try {
    const response = await fetch(downloadForm.action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams(new FormData(downloadForm)),
    });
    if (!response.ok) throw new Error((await response.text()) || 'Unable to start download');
    await refresh();
  } catch (error) {
    showPickerError(error.message || 'Unable to start download');
  } finally {
    startDownload.disabled = false;
    startDownload.replaceChildren(document.createTextNode('Start download '));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    startDownload.append(arrow);
  }
});

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const checkboxes = () => [...fileList.querySelectorAll('input[type="checkbox"]')];

function showPickerError(message) {
  pickerError.textContent = message;
  pickerError.hidden = !message;
}

// The worker matches names with re.match, so anchor each selected path exactly.
function syncFilter() {
  const boxes = checkboxes();
  const selected = boxes.filter((box) => box.checked).map((box) => box.value);
  selectAll.checked = boxes.length > 0 && selected.length === boxes.length;
  selectAll.indeterminate = selected.length > 0 && selected.length < boxes.length;
  summary.textContent = `${selected.length} of ${boxes.length} selected`;
  showPickerError('');
  if (selected.length === boxes.length) {
    filterInput.value = '';
  } else if (!selected.length) {
    filterInput.value = '^$';
  } else {
    const pattern = `^(?:${selected.map(escapeRegex).join('|')})$`;
    if (pattern.length > filterInput.maxLength) {
      showPickerError('Too many files selected for the filter. Select fewer files.');
      return;
    }
    filterInput.value = pattern;
  }
}

function renderFiles(data) {
  const fragment = document.createDocumentFragment();
  for (const file of data.files) {
    const item = document.createElement('li');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = file.name;
    box.checked = true;
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;
    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = sizeLabel(file.size);
    label.append(box, name, size);
    item.append(label);
    fragment.append(item);
  }
  fileList.replaceChildren(fragment);
  picker.hidden = false;
  syncFilter();
  if (data.truncated) showPickerError('Only the first files are shown. Use the filter field for the rest.');
}

browse.addEventListener('click', async () => {
  if (!doiInput.value.trim()) {
    doiInput.focus();
    showPickerError('Enter a DOI first.');
    return;
  }
  browse.disabled = true;
  browse.textContent = 'Loading…';
  showPickerError('');
  try {
    const response = await fetch('files', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({doi: doiInput.value, csrf: csrfInput.value}),
    });
    if (!response.ok) throw new Error((await response.text()) || 'Unable to list files');
    const data = await response.json();
    if (!Array.isArray(data.files) || !data.files.length) throw new Error('The dataset has no files.');
    renderFiles(data);
  } catch (error) {
    picker.hidden = true;
    showPickerError(error.message || 'Unable to list files');
  } finally {
    browse.disabled = false;
    browse.textContent = 'Browse files';
  }
});

fileList.addEventListener('change', syncFilter);
selectAll.addEventListener('change', () => {
  checkboxes().forEach((box) => { box.checked = selectAll.checked; });
  syncFilter();
});
