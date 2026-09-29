const REPOSITORY = 'https://github.com/grycap/oscar-hub';
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const capitalize = value => value === 'kserve' ? 'KServe' : String(value).charAt(0).toUpperCase() + String(value).slice(1);
const encodePath = value => String(value).split('/').map(encodeURIComponent).join('/');
const detailPath = service => `services/${encodeURIComponent(service.slug)}/`;
const repositoryPath = service => `${REPOSITORY}/tree/main/${encodePath(service.repoPath)}`;
const safeUrl = value => /^https?:\/\//i.test(value ?? '') ? value : null;
function link(name, url, className = '') {
  const href = safeUrl(url);
  return href ? `<a class="${className}" href="${escape(href)}" target="_blank" rel="noreferrer">${escape(name)}<span class="sr-only"> (opens in a new tab)</span></a>` : escape(name);
}

function entityLink(entity) {
  return link(entity.name ?? entity['@id'], entity.url ?? entity.URL ?? entity['@id']);
}

function icon(service, prefix = '') {
  return service.icon
    ? `<img class="service-icon" src="${prefix}${escape(service.icon.webRelative)}" alt="" width="40" height="40" loading="lazy">`
    : `<span class="service-icon service-icon--fallback" aria-hidden="true">${escape(service.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase())}</span>`;
}

function badges(service) {
  return service.serviceType.map(type => `<span class="badge">${escape(capitalize(type))}</span>`).join('');
}

function resources(value) {
  const values = array(value);
  if (!values.length) return '<span class="muted">Not specified</span>';
  return values.map(item => `<span class="resource">${escape(item)}${String(item).includes('kserve-') ? '<small>KServe</small>' : values.some(v => String(v).includes('kserve-')) ? '<small>OSCAR</small>' : ''}</span>`).join('');
}

function formatDate(value) {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function uiIcon(name, prefix = '', className = '') {
  return `<svg class="ui-icon ${className}" aria-hidden="true" focusable="false"><use href="${prefix}assets/icons/ui.svg#${name}"></use></svg>`;
}

function shell(title, content, prefix = '', description = 'Discover OSCAR services ready for deployment.') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} | OSCAR Hub</title>
  <meta name="description" content="${escape(description)}">
  <link rel="stylesheet" href="${prefix}assets/style.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="${prefix || './'}" aria-label="OSCAR Hub catalog"><img src="${prefix}assets/oscar3-logo-trans.png" alt="OSCAR" width="128" height="44"><span>Hub</span></a>
      <nav aria-label="Main navigation">
        <div class="header-actions">
          <a class="guide-link icon-button" href="${prefix}guide/" aria-label="Contribution Guide">${uiIcon('book-open', prefix)}<span class="nav-tooltip" role="tooltip"><span>Contribution Guide</span></span></a>
          <a class="github-link icon-button" href="${REPOSITORY}" target="_blank" rel="noreferrer" aria-label="GitHub Repository (opens in a new tab)" title="GitHub Repository">${uiIcon('github', prefix)}<span class="sr-only">GitHub Repository (opens in a new tab)</span></a>
        </div>
      </nav>
    </div>
  </header>
  <main id="main" class="page">${content}</main>
  <footer class="site-footer"><div class="footer-inner"><p>Developed by the ${link('GRyCAP', 'https://grycap.upv.es')} research group at ${link('Universitat Politècnica de València (UPV)', 'https://www.upv.es')}.</p><p>Generated ${new Date().toISOString().split('T')[0]}</p></div></footer>
  <script src="${prefix}assets/main.js" type="module"></script>
</body>
</html>`;
}

export function renderCatalog(services) {
  const types = [...new Set(services.flatMap(service => service.serviceType.map(type => String(type).toLowerCase())))].sort();
  return shell('Service Catalog', `
    <section class="intro" aria-labelledby="catalog-title">
      <h1 id="catalog-title">Services Catalog</h1>
      <p class="intro-description">Ready to be deployed on ${link('OSCAR', 'https://oscar.grycap.net')}.</p>
    </section>
    <section class="catalog" aria-labelledby="catalog-title">
      <div class="section-heading"><div id="viewSwitcher" class="view-switcher" role="group" aria-label="Catalog view" hidden>
        <button type="button" data-view="table" aria-pressed="true" aria-controls="serviceTable"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 8h14M3 12h14M9 3v14"/></svg>Table</button>
        <button type="button" data-view="cards" aria-pressed="false" aria-controls="serviceCards"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/></svg>Cards</button>
      </div></div>
      <form class="catalog-controls" role="search">
        <div class="search-field"><label for="search">Search services</label><input id="search" type="search" placeholder="Name, description, or software…" autocomplete="off"><span class="search-hint" aria-hidden="true">/</span></div>
        <div class="type-field"><label class="sr-only" for="serviceTypeFilter">Service type</label><select id="serviceTypeFilter"><option value="">All types</option>${types.map(type => `<option value="${escape(type)}">${escape(capitalize(type))}</option>`).join('')}</select></div>
        <button id="clearFilters" class="button button--quiet" type="button" hidden>Clear filters</button>
      </form>
      <div class="result-bar"><p id="resultCount" role="status" aria-live="polite">${services.length} ${services.length === 1 ? 'service' : 'services'}</p></div>
      <table id="serviceTable" class="service-table" role="table">
        <caption class="sr-only">Available OSCAR services and their deployment requirements</caption>
        <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Service</th><th role="columnheader" scope="col">Service type</th><th role="columnheader" scope="col">Memory</th><th role="columnheader" scope="col">Processors</th><th role="columnheader" scope="col"><span class="sr-only">Details</span></th></tr></thead>
        <tbody id="serviceRows" role="rowgroup">${services.map(renderRow).join('\n')}</tbody>
      </table>
      <div id="serviceCards" class="summary-grid" hidden>${services.map(renderCard).join('\n')}</div>
      <div id="emptyState" class="empty-state" hidden><h3>No services found</h3><p>Try another search term or clear your filters to see all services.</p><button class="button" id="resetSearch" type="button">Clear filters</button></div>
      <noscript><p class="notice">All services are listed below. Enable JavaScript to search and filter the catalog.</p></noscript>
    </section>`);
}

function filterAttributes(service) {
  const searchText = [service.slug, service.name, service.fullDescription, ...service.keywords, ...service.software.map(item => item.name), ...service.sources.map(item => item.name)].join(' ');
  return `data-search="${escape(searchText)}" data-types="${escape(JSON.stringify(service.serviceType.map(type => String(type).toLowerCase())))}"`;
}

function renderRow(service) {
  return `<tr role="row" class="service-row" ${filterAttributes(service)}>
    <td role="cell" class="service-cell"><div class="service-identity">${icon(service)}<div><a class="service-name" href="${detailPath(service)}">${escape(service.name)}</a><p class="service-summary">${escape(service.description)}</p></div></div></td>
    <td role="cell" data-label="Service type"><div class="badges">${badges(service)}</div></td>
    <td role="cell" data-label="Memory"><div class="resources">${resources(service.memory)}</div></td>
    <td role="cell" data-label="Processors"><div class="resources">${resources(service.processors)}</div></td>
    <td role="cell" class="row-action"><a href="${detailPath(service)}" class="details-link" aria-label="View details of ${escape(service.name)}">View details <span aria-hidden="true">→</span></a></td>
  </tr>`;
}

function renderCard(service) {
  return `<article class="service-card" ${filterAttributes(service)} aria-labelledby="card-${escape(service.slug)}">
    <div class="card-heading">${icon(service)}<h3 id="card-${escape(service.slug)}"><a class="service-name" href="${detailPath(service)}">${escape(service.name)}</a></h3></div>
    <div class="badges">${badges(service)}</div>
    <p class="card-description">${escape(service.description)}</p>
    <dl class="card-resources"><div><dt>Memory</dt><dd>${resources(service.memory)}</dd></div><div><dt>Processors</dt><dd>${resources(service.processors)}</dd></div></dl>
    <div class="card-footer"><a href="${detailPath(service)}" class="details-link" aria-label="View details of ${escape(service.name)}">View details <span aria-hidden="true">→</span></a>${service.version ? `<span class="version">v${escape(service.version)}</span>` : ''}</div>
  </article>`;
}

export function renderService(service) {
  const repoUrl = repositoryPath(service);
  const definition = service.parts.find(part => part.id === 'fdl.yml' && part.exists);
  const metadata = [
    ['Version', escape(service.version ?? 'Not specified')],
    ['Published', escape(formatDate(service.datePublished))],
    ['Author', service.authors.map(entityLink).join('<br>') || 'Not specified'],
    ['License', service.licenses.map(entityLink).join('<br>') || 'Not specified'],
    ['Keywords', service.keywords.map(escape).join(', ') || null],
    ['Based on', service.sources.map(entityLink).join('<br>') || null]
  ].filter(([, value]) => value);
  return shell(service.name, `
    <a class="back-link" data-back-catalog href="../../">← Back to catalog</a>
    <header class="detail-header"><div class="detail-identity">${icon(service, '../../')}<div><p class="eyebrow">SERVICE DETAILS</p><h1>${escape(service.name)}</h1><div class="badges">${badges(service)}</div></div></div>
      <div class="detail-actions">${link('View on GitHub ↗', repoUrl, 'button')}${definition ? link('View FDL definition ↗', `${REPOSITORY}/blob/main/${encodePath(service.repoPath)}/fdl.yml`, 'button button--secondary') : ''}${safeUrl(service.url) && service.url !== repoUrl ? link('Service website ↗', service.url, 'button button--secondary') : ''}</div>
    </header>
    <div class="detail-layout">
      <div class="detail-main">
        <section class="detail-section" aria-labelledby="overview"><h2 id="overview">Overview</h2><p class="full-description">${escape(service.fullDescription)}</p></section>
        <section class="detail-section" aria-labelledby="requirements"><h2 id="requirements">Deployment requirements</h2><dl class="requirement-grid"><div><dt>Memory</dt><dd>${resources(service.memory)}</dd></div><div><dt>Processors</dt><dd>${resources(service.processors)}</dd></div></dl>
          ${service.software.length ? `<h3>Software</h3><ul class="software-list">${service.software.map(item => `<li><div>${link(item.name, item.url)}${item.version ? `<span class="version">${escape(item.version)}</span>` : ''}</div>${item.description ? `<p>${escape(item.description)}</p>` : ''}</li>`).join('')}</ul>` : ''}
        </section>
        ${renderParts(service)}
        ${renderProcedures(service)}
        ${renderMetadataFile(service)}
      </div>
      <aside class="metadata-panel" aria-labelledby="metadata-title"><h2 id="metadata-title">About this service</h2><dl>${metadata.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl><a class="text-link" href="../../guide/ro-crate/">About RO-Crate →</a></aside>
    </div>`, '../../', service.fullDescription);
}

function renderFileEntry(title, description, format, preview = '') {
  return `<li class="file-entry"><div class="file-heading"><div>${title}${description ? `<p>${escape(description)}</p>` : ''}</div>${format ? `<small>${escape(format)}</small>` : ''}</div>${preview}</li>`;
}

function renderMetadataFile(service) {
  const title = link('ro-crate-metadata.json', `${REPOSITORY}/blob/main/${encodePath(service.repoPath)}/ro-crate-metadata.json`);
  return `<section class="detail-section" aria-labelledby="ro-crate"><h2 id="ro-crate">RO-Crate metadata</h2><ul class="file-list">${renderFileEntry(title, '', 'application/json')}</ul></section>`;
}

function renderParts(service) {
  if (!service.parts.length) return '';
  return `<section class="detail-section" aria-labelledby="files"><h2 id="files">Files &amp; artifacts</h2><ul class="file-list">${service.parts.map(part => {
    const title = part.exists ? link(part.id, `${REPOSITORY}/${part.id.endsWith('/') ? 'tree' : 'blob'}/main/${encodePath(service.repoPath)}/${encodePath(part.id)}`) : `<span>${escape(part.name ?? part.id)}</span><span class="artifact-label">${part.id?.startsWith('#') ? 'Expected artifact' : 'Referenced artifact'}</span>`;
    const description = `${part.name !== part.id ? part.name ?? '' : ''}${part.description ? ` — ${part.description}` : ''}`;
    return renderFileEntry(title, description, part.encodingFormat);
  }).join('')}</ul></section>`;
}

function renderProcedures(service) {
  const resolve = ref => typeof ref === 'object' ? service.graph.find(node => node['@id'] === ref['@id']) ?? ref : service.graph.find(node => node['@id'] === ref);
  const procedures = array(service.dataset.subjectOf).map(resolve).filter(node => node && array(node['@type']).includes('HowTo'));
  if (!procedures.length) return '';
  return `<section class="detail-section" aria-labelledby="usage"><h2 id="usage">Usage &amp; acceptance tests</h2>${procedures.map(procedure => `<details class="procedure"><summary>${escape(procedure.name ?? procedure['@id'])}</summary><div class="procedure-content"><p>${escape(procedure.description)}</p><ol>${array(procedure.step).map(resolve).filter(Boolean).map(step => {
    const actions = array(step.potentialAction).map(resolve).filter(Boolean);
    const commands = actions.flatMap(action => array(action.additionalProperty).map(resolve)).filter(property => property?.propertyID === 'commandTemplate');
    return `<li><p>${escape(step.text ?? step.name)}</p>${step.timeRequired ? `<small>Time required: ${escape(step.timeRequired)}</small>` : ''}${commands.map(command => `<pre><code>${escape(command.value)}</code></pre>`).join('')}</li>`;
  }).join('')}</ol></div></details>`).join('')}</section>`;
}
