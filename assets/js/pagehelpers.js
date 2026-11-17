/* ============================================================
   FlowTrack — Page building blocks
   Small, dependency-free markup helpers shared by every page.
   ============================================================ */

const PageHelpers = (() => {
  const { icon, escapeHtml } = Utils;

  const TONES = {
    primary: { fg: '#4f46e5', bg: '#eef2ff', glow: 'rgba(79,70,229,.10)' },
    success: { fg: '#0f9f6e', bg: '#ecfdf5', glow: 'rgba(16,185,129,.10)' },
    warning: { fg: '#d97706', bg: '#fffbeb', glow: 'rgba(245,158,11,.10)' },
    danger: { fg: '#dc2626', bg: '#fef2f2', glow: 'rgba(239,68,68,.09)' },
    info: { fg: '#2563eb', bg: '#eff6ff', glow: 'rgba(59,130,246,.09)' },
    violet: { fg: '#7c3aed', bg: '#f5f3ff', glow: 'rgba(124,58,237,.09)' },
    slate: { fg: '#64748b', bg: '#f4f6fa', glow: 'rgba(100,116,139,.08)' }
  };

  function pageHeader({ eyebrow = '', title = '', subtitle = '', actions = '' } = {}) {
    return `<header class="page-header">
      <div class="page-header-copy">
        ${eyebrow ? `<div class="eyebrow"><span class="dot"></span>${escapeHtml(eyebrow)}</div>` : ''}
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="header-actions">${actions}</div>` : ''}
    </header>`;
  }

  function statCard({
    label, value, unit = '', iconName = 'activity', tone = 'primary',
    foot = '', footClass = '', progress = null, progressClass = '', className = ''
  }) {
    const palette = TONES[tone] || TONES.primary;
    const progressMarkup = progress == null ? '' : `<div class="stat-progress ${progressClass}"><span style="width:${Math.max(0, Math.min(100, progress))}%;background:${palette.fg}"></span></div>`;
    return `<article class="stat-card ${className}" style="--stat-fg:${palette.fg};--stat-bg:${palette.bg};--stat-glow:${palette.glow}">
      <div class="stat-top">
        <span class="stat-label">${escapeHtml(label)}</span>
        <span class="stat-icon">${icon(iconName)}</span>
      </div>
      <div class="stat-value">${value}${unit ? `<span class="unit">${unit}</span>` : ''}</div>
      <div class="stat-foot ${footClass}">${foot || '<span class="muted">&nbsp;</span>'}</div>
      ${progressMarkup}
    </article>`;
  }

  function chartCard({
    title, subtitle = '', iconName = '', actions = '', body = '',
    legend = '', className = '', headClass = '', bodyClass = ''
  } = {}) {
    return `<section class="card chart-card ${className}">
      <div class="card-header chart-head ${headClass}">
        <div>
          <h2 class="card-title">${iconName ? icon(iconName) : ''}${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ''}
        </div>
        ${actions ? `<div class="flex gap-6">${actions}</div>` : ''}
      </div>
      <div class="chart-body ${bodyClass}">
        ${body}
        ${legend ? `<div class="chart-legend mt-12">${legend}</div>` : ''}
      </div>
    </section>`;
  }

  function legend(items = []) {
    return items.map((item) => `<span class="legend-item"><span class="legend-dot" style="background:${item.color}"></span>${escapeHtml(item.label)}${item.value != null ? ` <strong>${item.value}</strong>` : ''}</span>`).join('');
  }

  function sectionHeader(title, subtitle = '', actions = '', iconName = '') {
    return `<div class="section-title-row">
      <div>
        <h2 class="section-title">${iconName ? icon(iconName) : ''}${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="section-subtitle">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="flex gap-6">${actions}</div>` : ''}
    </div>`;
  }

  function empty(iconName, title, message, action = '', compact = false) {
    return UI.emptyState(iconName, title, message, action, compact);
  }

  function projectStyle(projectId) {
    const project = projectId ? Store.getProject(projectId) : null;
    return project ? `--project-color:${project.color}` : '--project-color:#94a3b8';
  }

  function toastError(err, title = 'Something went wrong') {
    UI.toast(err && err.message ? err.message : 'Please try again.', 'error', title);
  }

  function pill(label, tone = 'neutral', iconName = '') {
    return `<span class="badge badge-${tone}">${iconName ? icon(iconName) : ''}${escapeHtml(label)}</span>`;
  }

  function compare(value, suffix = '%', invert = false) {
    return UI.comparisonDelta(value, suffix, invert);
  }

  return {
    TONES, pageHeader, statCard, chartCard, legend, sectionHeader,
    empty, projectStyle, toastError, pill, compare
  };
})();

window.PageHelpers = PageHelpers;
