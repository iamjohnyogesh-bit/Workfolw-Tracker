/* ============================================================
   FlowTrack — UI primitives
   Reusable markup helpers, accessible modals, toasts and menus.
   ============================================================ */

const UI = (() => {
  const modalRoot = () => document.getElementById('modalRoot');
  const toastStack = () => document.getElementById('toastStack');
  const modalStack = [];
  let modalCounter = 0;
  let toastCounter = 0;

  const { escapeHtml, icon, formatDuration, formatDate, pct } = Utils;

  /* ----------------------------- Toasts ----------------------------- */
  function toast(message, type = 'success', title = '') {
    const stack = toastStack();
    if (!stack) return;
    const icons = { success: 'check', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    const id = `toast-${++toastCounter}`;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.id = id;
    el.innerHTML = `
      <span class="toast-icon">${icon(icons[type] || 'info')}</span>
      <div class="toast-copy">${title ? `<strong>${escapeHtml(title)}</strong>` : ''}<span>${escapeHtml(message)}</span></div>
      <button class="toast-close" aria-label="Dismiss">${icon('x')}</button>`;
    stack.appendChild(el);
    while (stack.children.length > 3) stack.firstElementChild.remove();
    const remove = () => {
      if (!el.isConnected) return;
      el.classList.add('out');
      setTimeout(() => el.remove(), 190);
    };
    const timer = setTimeout(remove, 4600);
    el.querySelector('.toast-close').addEventListener('click', () => { clearTimeout(timer); remove(); });
  }

  /* ----------------------------- Modals ----------------------------- */
  function ensureBodyLock() {
    document.body.classList.toggle('modal-open', modalStack.length > 0);
  }

  function openModal(options = {}) {
    const {
      title = '', subtitle = '', body = '', footer = null, size = '', bodyClass = '',
      onSubmit = null, submitLabel = 'Save', submitClass = 'btn-primary',
      cancelLabel = 'Cancel', showCancel = true, dismissible = true,
      onMount = null, onClose = null, submitIcon = '', footerNote = ''
    } = options;

    const root = modalRoot();
    if (!root) return null;
    const id = `modal-${++modalCounter}`;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.modalId = id;
    backdrop.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
        <div class="modal-header">
          <div class="modal-header-copy">
            <h2 class="modal-title" id="${id}-title">${escapeHtml(title)}</h2>
            ${subtitle ? `<p class="modal-subtitle">${subtitle}</p>` : ''}
          </div>
          <button type="button" class="icon-btn modal-close" data-modal-close aria-label="Close dialog">${icon('x')}</button>
        </div>
        <form class="modal-form" novalidate>
          <div class="modal-body ${bodyClass}">${body}</div>
          <div class="modal-footer">
            ${footer !== null ? footer : `
              ${footerNote ? `<span class="modal-footer-note">${footerNote}</span>` : ''}
              ${showCancel ? `<button type="button" class="btn btn-secondary" data-modal-close>${escapeHtml(cancelLabel)}</button>` : ''}
              ${onSubmit ? `<button type="submit" class="btn ${submitClass}">${submitIcon ? icon(submitIcon) : ''}<span>${escapeHtml(submitLabel)}</span></button>` : `<button type="button" class="btn btn-primary" data-modal-close>Close</button>`}
            `}
          </div>
        </form>
      </div>`;
    root.appendChild(backdrop);

    const form = backdrop.querySelector('form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const bodyEl = backdrop.querySelector('.modal-body');
    const previousFocus = document.activeElement;
    let closed = false;
    let busy = false;

    const api = {
      id,
      element: backdrop,
      form,
      close() { closeModal(api, 'manual'); },
      setError(message, type = 'danger') {
        const existing = bodyEl.querySelector('.modal-alert');
        if (existing) existing.remove();
        if (!message) return;
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} modal-alert mb-16`;
        alert.innerHTML = `${icon(type === 'danger' ? 'alert-circle' : 'info')}<div>${escapeHtml(message)}</div>`;
        bodyEl.prepend(alert);
        bodyEl.closest('.modal').querySelector('.modal-body').scrollTop = 0;
      },
      setBusy(value) {
        busy = Boolean(value);
        if (!submitBtn) return;
        const label = submitBtn.querySelector('span');
        const iconEl = submitBtn.querySelector('svg');
        if (busy) {
          submitBtn.disabled = true;
          if (iconEl) iconEl.style.display = 'none';
          submitBtn.dataset.original = label ? label.textContent : '';
          submitBtn.insertAdjacentHTML('afterbegin', '<span class="spinner white"></span>');
          if (label) label.textContent = 'Working…';
        } else {
          submitBtn.disabled = false;
          const spinner = submitBtn.querySelector('.spinner');
          if (spinner) spinner.remove();
          if (iconEl) iconEl.style.display = '';
          if (label && submitBtn.dataset.original) label.textContent = submitBtn.dataset.original;
        }
      },
      isBusy() { return busy; },
      setTitle(value) { const el = backdrop.querySelector('.modal-title'); if (el) el.textContent = value; }
    };

    const record = { api, backdrop, previousFocus, onClose, dismissible, closed: false };
    modalStack.push(record);
    ensureBodyLock();

    function tryClose(reason) {
      closeModal(api, reason);
    }

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop && dismissible && !busy) tryClose('backdrop');
    });
    backdrop.querySelectorAll('[data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', () => tryClose('cancel'));
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!onSubmit || busy) return;
      api.setError('');
      api.setBusy(true);
      try {
        const result = await onSubmit(form, api);
        if (result !== false && !closed) closeModal(api, 'submit');
      } catch (err) {
        console.error('FlowTrack modal error', err);
        api.setError(err && err.message ? err.message : 'Something went wrong. Please try again.');
      } finally {
        if (!closed) api.setBusy(false);
      }
    });

    requestAnimationFrame(() => {
      if (closed) return;
      const preferred = backdrop.querySelector('[autofocus]');
      const firstField = backdrop.querySelector('.modal-body input:not([type=hidden]):not([disabled]), .modal-body select:not([disabled]), .modal-body textarea:not([disabled])');
      const firstButton = backdrop.querySelector('.modal-footer button, .modal-header button');
      (preferred || firstField || firstButton || backdrop.querySelector('button'))?.focus();
    });

    if (typeof onMount === 'function') {
      try { onMount(backdrop, api); } catch (err) {
        console.error('Modal mount error', err);
        api.setError(err.message || 'Could not open this dialog.');
      }
    }

    return api;
  }

  function closeModal(api = null, reason = 'manual') {
    const index = api ? modalStack.findIndex((record) => record.api === api) : modalStack.length - 1;
    if (index < 0) return;
    const record = modalStack[index];
    if (record.closed) return;
    record.closed = true;
    modalStack.splice(index, 1);
    record.backdrop.remove();
    ensureBodyLock();
    if (typeof record.onClose === 'function') {
      try { record.onClose(reason); } catch (err) { console.error(err); }
    }
    if (modalStack.length === 0 && record.previousFocus && record.previousFocus.focus) {
      try { record.previousFocus.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  function closeTopModal(reason = 'escape') {
    if (!modalStack.length) return;
    const record = modalStack[modalStack.length - 1];
    if (record.busy || !record.dismissible) return;
    closeModal(record.api, reason);
  }

  function closeAllModals(reason = 'manual') {
    while (modalStack.length) {
      const record = modalStack[modalStack.length - 1];
      record.closed = true;
      modalStack.pop();
      record.backdrop.remove();
      if (typeof record.onClose === 'function') {
        try { record.onClose(reason); } catch (_) {}
      }
    }
    ensureBodyLock();
  }

  document.addEventListener('keydown', (event) => {
    if (!modalStack.length) return;
    const record = modalStack[modalStack.length - 1];
    if (event.key === 'Escape') {
      if (record.dismissible) {
        event.preventDefault();
        closeModal(record.api, 'escape');
      }
      return;
    }
    if (event.key === 'Tab') {
      const focusables = [...record.backdrop.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  function confirm(options = {}) {
    const {
      title = 'Are you sure?',
      message = '',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      danger = false,
      iconName = danger ? 'alert-triangle' : 'help'
    } = options;
    return new Promise((resolve) => {
      let settled = false;
      openModal({
        title,
        size: 'modal-sm',
        body: `
          <div class="confirm-content">
            <div class="confirm-symbol ${danger ? 'danger' : ''}">${icon(iconName)}</div>
            <p class="confirm-message">${escapeHtml(message)}</p>
          </div>`,
        submitLabel: confirmLabel,
        submitClass: danger ? 'btn-danger' : 'btn-primary',
        cancelLabel,
        onSubmit: () => {
          settled = true;
          resolve(true);
        },
        onClose: () => {
          if (!settled) resolve(false);
        }
      });
    });
  }

  /* ----------------------------- Markup helpers ----------------------------- */
  function statusBadge(status, extraClass = '') {
    return `<span class="badge badge-${Utils.statusClass(status)} ${extraClass}"><span class="dot"></span>${escapeHtml(status)}</span>`;
  }

  function priorityBadge(priority, extraClass = '') {
    return `<span class="badge badge-${Utils.priorityClass(priority)} ${extraClass}"><span class="dot"></span>${escapeHtml(priority)}</span>`;
  }

  function sourceBadge(source) {
    return source === 'timer'
      ? `<span class="activity-source timer">${icon('timer')}Timer</span>`
      : `<span class="activity-source manual">${icon('edit')}Manual</span>`;
  }

  function statusSelect(taskId, status, className = '') {
    const options = Utils.STATUSES.map((s) => `<option value="${escapeHtml(s)}" ${s === status ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
    return `<select class="status-select badge-${Utils.statusClass(status)} ${className}" data-status-task="${escapeHtml(taskId)}" aria-label="Task status">${options}</select>`;
  }

  function projectChip(projectId, options = {}) {
    const project = projectId ? Store.getProject(projectId) : null;
    const color = project ? project.color : '#94a3b8';
    const name = project ? project.name : (options.fallback || 'Unassigned');
    return `<span class="project-chip" title="${escapeHtml(name)}"><span class="dot" style="background:${color}"></span><span>${escapeHtml(name)}</span></span>`;
  }

  function dueBadge(dateKey) {
    if (!dateKey) return '';
    const due = Utils.dueLabel(dateKey);
    return `<span class="badge ${due.cls === 'due-overdue' ? 'badge-danger' : due.cls === 'due-today' ? 'badge-warning' : 'badge-outline'}">${escapeHtml(due.text)}</span>`;
  }

  function priorityDot(priority, size = 6) {
    const colors = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
    return `<span class="badge-dot-only" style="width:${size}px;height:${size}px;background:${colors[priority] || '#94a3b8'}"></span>`;
  }

  function emptyState(iconName, title, message, action = '', compact = false) {
    return `<div class="empty-state ${compact ? 'empty-compact' : ''}">
      <div class="empty-icon">${icon(iconName)}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      ${action || ''}
    </div>`;
  }

  function progressBar(value, cls = '', showLabels = false, label = '') {
    const safe = Utils.clamp(Number(value) || 0, 0, 100);
    return `${showLabels ? `<div class="progress-label"><span>${escapeHtml(label)}</span><strong>${Math.round(safe)}%</strong></div>` : ''}<div class="progress ${cls}"><span style="width:${safe}%"></span></div>`;
  }

  function delta(value, suffix = '%', invert = false) {
    if (!Number.isFinite(Number(value))) return `<span class="score neutral">—</span>`;
    const n = Number(value);
    if (n === 0) return `<span class="score neutral">${icon('minus')}No change</span>`;
    const positive = invert ? n < 0 : n > 0;
    return `<span class="score ${positive ? 'positive' : 'negative'}">${icon(n > 0 ? 'trending-up' : 'trending-down')}${Math.abs(n)}${suffix}</span>`;
  }

  function comparisonDelta(value, suffix = '%', invert = false) {
    if (!Number.isFinite(Number(value))) return `<span class="comparison-neutral">—</span>`;
    const n = Number(value);
    if (n === 0) return `<span class="comparison-neutral">0${suffix}</span>`;
    const positive = invert ? n < 0 : n > 0;
    return `<span class="${positive ? 'comparison-positive' : 'comparison-negative'}">${icon(n > 0 ? 'trending-up' : 'trending-down')}${Math.abs(n)}${suffix}</span>`;
  }

  function avatar(name, sizeClass = 'avatar-md') {
    return `<span class="avatar ${sizeClass}">${escapeHtml(Utils.initials(name))}</span>`;
  }

  function confirmMarkupAdded() {}

  /* ----------------------------- Popup menus ----------------------------- */
  let openMenuEl = null;
  let menuCleanup = null;

  function closeMenu() {
    if (openMenuEl) openMenuEl.remove();
    openMenuEl = null;
    if (menuCleanup) menuCleanup();
    menuCleanup = null;
  }

  function openMenu(anchor, items) {
    closeMenu();
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'menu-pop';
    el.innerHTML = items.map((item, index) => {
      if (item.separator) return '<div class="menu-sep"></div>';
      return `<button type="button" data-menu-index="${index}" class="${item.danger ? 'danger' : ''}">${item.icon ? icon(item.icon) : ''}<span>${escapeHtml(item.label)}</span></button>`;
    }).join('');
    document.body.appendChild(el);
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    let left = Math.min(window.innerWidth - width - 10, rect.right - width);
    left = Math.max(10, left);
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 10) top = Math.max(10, rect.top - height - 6);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    openMenuEl = el;
    const onDocClick = (event) => {
      if (!el.contains(event.target) && !anchor.contains(event.target)) closeMenu();
    };
    const onScroll = () => closeMenu();
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    menuCleanup = () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
    el.querySelectorAll('[data-menu-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = items[Number(btn.dataset.menuIndex)];
        closeMenu();
        if (item && typeof item.onClick === 'function') item.onClick();
      });
    });
  }

  /* ----------------------------- Help guide ----------------------------- */
  function openHelpGuide() {
    openModal({
      title: 'How FlowTrack calculates your productivity',
      subtitle: 'A quick guide to the numbers across the workspace.',
      size: 'modal-lg',
      body: `
        <div class="help-content">
          <h3>Working hours vs. productive hours</h3>
          <p><strong>Working hours</strong> are the total time in your activity log. <strong>Productive hours</strong> only count activities linked to a task. Meetings, email triage and admin stay in working hours, but not in productive hours — so you can see how much of your day went to focused delivery.</p>
          <p><strong>Productivity %</strong> = productive time ÷ working time × 100. It is different from the <strong>task completion rate</strong>, which is completed tasks ÷ tasks assigned in the selected period.</p>

          <h3>Time tracking</h3>
          <ul>
            <li>Only one timer can run at a time. Starting a second timer requires finishing the first.</li>
            <li>Pausing saves the current segment to your activity log and pauses the clock. Resume starts a fresh segment.</li>
            <li>Timers are saved in this browser — refreshing or closing the page does not lose a running session.</li>
            <li>Running sessions survive a refresh and continue from the original start time.</li>
          </ul>

          <h3>Idle time &amp; overlaps</h3>
          <p>Idle gaps are the unaccounted periods between activities inside your workday (${escapeHtml(Store.getSettings().workdayStart)}–${escapeHtml(Store.getSettings().workdayEnd)}), excluding gaps shorter than ${Store.getSettings().idleThresholdMinutes} minutes. Overlapping activities are highlighted in the log and flagged with a warning badge; the timer itself never overlaps.</p>

          <h3>Reports &amp; exports</h3>
          <p>Weekly and monthly reports use the date range shown at the top of each page. Custom ranges are supported. Excel exports include the filtered data plus a summary sheet, durations, and auto-filters — generated from your saved data, entirely offline.</p>

          <h3>Your data</h3>
          <p>Everything lives in this browser's localStorage. Nothing is uploaded. Use <strong>Settings → Backup data</strong> to download a JSON copy, and <strong>Restore</strong> to bring it back. Download an Excel report any time for an external archive.</p>

          <div class="alert alert-info help-callout">${icon('info')}<div>Tip: link activities to a task whenever possible. That's what powers productive hours, project distribution and task-level time totals.</div></div>
        </div>`,
      footer: `<button type="button" class="btn btn-primary" data-modal-close>Got it</button>`
    });
  }

  /* ----------------------------- Misc ----------------------------- */
  function scoreRing(value, size = 92, stroke = 8, color = '#4f46e5') {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Utils.clamp(value, 0, 100) / 100);
    return `<div class="ring-wrap" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#eef1f8" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="ring-label"><strong style="font-size:18px;color:var(--ink);letter-spacing:-.03em">${Math.round(value)}%</strong></div>
    </div>`;
  }

  return {
    toast, openModal, closeModal, closeTopModal, closeAllModals, confirm,
    statusBadge, priorityBadge, sourceBadge, statusSelect, projectChip, dueBadge,
    priorityDot, emptyState, progressBar, delta, comparisonDelta, avatar,
    openMenu, closeMenu, openHelpGuide, scoreRing, icon, escapeHtml, formatDuration, formatDate,
    get modalOpen() { return modalStack.length > 0; }
  };
})();

window.UI = UI;
