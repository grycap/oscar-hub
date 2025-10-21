const searchInput = document.querySelector('#search');
const typeSelect = document.querySelector('#serviceTypeFilter');
const serviceGrid = document.querySelector('#serviceGrid');
const cards = Array.from(serviceGrid?.querySelectorAll('.service-card') ?? []);
const emptyState = document.querySelector('#emptyState');

function applyFilters() {
  const query = searchInput?.value.trim().toLowerCase() ?? '';
  const type = typeSelect?.value.trim().toLowerCase() ?? '';
  let visibleCount = 0;

  cards.forEach((card) => {
    const serviceType = (card.dataset.serviceType ?? '').toLowerCase();
    const name = (card.dataset.serviceName ?? '').toLowerCase();
    const description = card
      .querySelector('.service-card__description')
      ?.textContent.toLowerCase() ?? '';
    const haystack = `${name} ${description}`;

    const matchesQuery = !query || haystack.includes(query);
    const matchesType = !type || serviceType === type;
    const isVisible = matchesQuery && matchesType;

    card.style.display = isVisible ? '' : 'none';
    if (isVisible) visibleCount += 1;
  });

  if (emptyState) {
    emptyState.hidden = visibleCount !== 0;
  }
}

if (searchInput) {
  searchInput.addEventListener('input', applyFilters);
}

if (typeSelect) {
  typeSelect.addEventListener('change', applyFilters);
}

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !event.defaultPrevented) {
    const isInputFocused = document.activeElement && ['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase());
    if (!isInputFocused && searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  }
});

const DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

if (typeof window !== 'undefined' && DEV_HOSTS.has(window.location.hostname) && 'EventSource' in window) {
  try {
    const source = new EventSource('/__dev_reload');
    source.addEventListener('message', (event) => {
      if (event.data === 'reload') {
        window.location.reload();
      }
    });
    source.addEventListener('error', () => {
      source.close();
    });
  } catch (err) {
    console.warn('Live reload unavailable:', err);
  }
}
