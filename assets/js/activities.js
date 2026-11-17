/* ============================================================
   FlowTrack — Activity Log
   Chronological, filterable log with overlap and idle awareness.
   ============================================================ */

const ActivitiesPage = (() => {
  const state = {
    q: '',
    project: 'all',
    source: 'all',
    range: '14',
    customFrom: '',
    customTo: '',
    overlapOnly: false
  };

  function resolveRange() {
    const today = Utils.todayKey();
    if (state.range === 'today') return { from: today, to: today };
    if (state.range === '7') return { from: Utils.addDays(today, -6), to: today };
    if (state.range === '14') return { from: Utils.addDays(today, -13), to: today };
    if (state.range === '30') return { from: Utils.addDays(today, -29), to: today };
    if (state.range === 'month') return { from: Utils.startOfMonth(today), to: today };
    if (state.range === 'all') {
      const dates = Store.getActivities().map((a) => a.dateKey).sort();
      return { from: dates[0] || Utils.addDays(today, -90), to: today };
    }
    const from = state.customFrom || Utils.addDays(today, -30);
    const to = state.customTo || today;
    return from <= to ? { from, to } : { from: to, to: from };
  }

  function filteredActivities(from, to) {
    const projects = new Map(Store.getProjects().map((p) => [p.id, p.name.toLowerCase()]));
    const q = state.q.trim().toLowerCase();
    return Store.getActivities()
      .filter((activity) => activity.dateKey >= from && activity.dateKey <= to)
      .filter((activity) => state.project === 'all' || activity.projectId === state.project)
      .filter((activity) => state.source === 'all' || activity.source === state.source)
      .filter((activity) => {
        if (!q) return true;
        const haystack = [
          activity.title, activity.remarks, activity.taskTitle,
          projects.get(activity.projectId) || ''
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => (a.dateKey === b.dateKey ? a.startMinutes - b.startMinutes : (a.dateKey < b.dateKey ? 1 : -1)));
  }

  function summaryMarkup(activities, overlapCount, projectsTouched) {
    return `<div class="activity-summary-strip">
      <div class="activity-summary-item">
        <span class="activity-summary-icon" style="background:var(--primary-050);color:var(--primary)">${Utils.icon('list')}</span>
        <div><div class="activity-summary-label">Time entries</div><div class="activity-summary-value">${activities.length}</div></div>
      </div>
      <div class="activity-summary-item">
        <span class="activity-summary-icon" style="background:var(--violet-bg);color:var(--violet)">${Utils.icon('clock')}</span>
        <div><div class="activity-summary-label">Working time</div><div class="activity-summary-value">${Utils.formatDuration(Analytics.trackedMinutes(activities))}</div></div>
      </div>
      <div class="activity-summary-item">
        <span class="activity-summary-icon" style="background:var(--success-bg);color:var(--success)">${Utils.icon('target')}</span>
        <div><div class="activity-summary-label">Productive time</div><div class="activity-summary-value">${Utils.formatDuration(Analytics.productiveMinutes(activities))}</div></div>
      </div>
      <div class="activity-summary-item">
        <span class="activity-summary-icon" style="background:var(--warning-bg);color:var(--warning)">${Utils.icon('folder')}</span>
        <div><div class="activity-summary-label">Projects · overlaps</div><div class="activity-summary-value">${projectsTouched} · ${overlapCount}</div></div>
      </div>
    </div>`;
  }

  function dayMarkup(group, { overlapIds, threshold }) {
    const today = Utils.todayKey();
    const relative = Utils.relativeLabel(group.dateKey);
    const badge = group.dateKey === today ? 'Today' : relative === 'Yesterday' ? 'Yesterday' : '';
    const idle = Analytics.getIdleGaps(group.dateKey, threshold, group.dateKey === today);
    return `<div class="activity-day">
      <div class="activity-day-head">
        <span class="activity-day-date">${Utils.escapeHtml(Utils.formatDate(group.dateKey, 'long'))}</span>
        ${badge ? `<span class="activity-day-badge">${badge}</span>` : ''}
        <span class="activity-day-line"></span>
        <span class="activity-day-total">${Utils.formatDuration(group.totalMinutes)} · ${group.entries.length} entr${group.entries.length === 1 ? 'y' : 'ies'}${group.totalMinutes ? ` · ${Utils.pct(group.productiveMinutes, group.totalMinutes)}% productive` : ''}${idle.totalMinutes ? ` · ${Utils.formatDuration(idle.totalMinutes)} idle` : ''}</span>
      </div>
      ${group.entries.map((activity) => {
        const project = activity.projectId ? Store.getProject(activity.projectId) : null;
        const overlap = overlapIds.has(activity.id);
        return `<article class="activity-entry ${overlap ? 'overlap' : ''}">
          <div class="activity-time">
            <span class="activity-time-range">${Utils.formatTimeRange(activity.startMinutes, activity.endMinutes)}</span>
            <span class="activity-time-duration">${Utils.icon('clock')} ${Utils.formatDuration(activity.durationMinutes)}</span>
          </div>
          <div class="activity-body">
            <div class="activity-title">
              ${Utils.highlight(activity.title, state.q)}
              ${overlap ? `<span class="badge overlap-badge">${Utils.icon('alert-triangle')} Overlap</span>` : ''}
              ${activity.taskId ? `<span class="badge badge-outline" style="height:18px;font-size:9px">Task-linked</span>` : ''}
            </div>
            <div class="activity-meta">
              ${project ? UI.projectChip(project.id) : '<span class="project-chip"><span class="dot" style="background:#cbd5e1"></span><span>No project</span></span>'}
              ${activity.taskId
                ? `<button class="mini-link task-link" data-open-task="${activity.taskId}">${Utils.escapeHtml(activity.taskTitle || 'Linked task')}</button>`
                : ''}
              ${UI.sourceBadge(activity.source)}
            </div>
            ${activity.remarks ? `<div class="activity-remarks">${Utils.highlight(activity.remarks, state.q)}</div>` : ''}
          </div>
          <div class="activity-actions">
            <button class="icon-btn sm" data-edit-activity="${activity.id}" title="Edit activity" aria-label="Edit activity">${Utils.icon('edit')}</button>
            <button class="icon-btn sm danger" data-delete-activity-row="${activity.id}" title="Delete activity" aria-label="Delete activity">${Utils.icon('trash')}</button>
          </div>
        </article>`;
      }).join('')}
    </div>`;
  }

  function bind(root, { from, to }) {
    const search = root.querySelector('#activitySearch');
    if (search) search.addEventListener('input', () => { state.q = search.value; App.refresh(); });
    const clearSearch = root.querySelector('[data-clear-activity-search]');
    if (clearSearch) clearSearch.addEventListener('click', () => { state.q = ''; App.refresh(); });
    const bindSelect = (id, key) => {
      const el = root.querySelector(id);
      if (!el) return;
      el.addEventListener('change', () => {
        state[key] = el.value;
        if (key === 'range' && el.value === 'custom' && (!state.customFrom || !state.customTo)) {
          state.customFrom = Utils.addDays(Utils.todayKey(), -30);
          state.customTo = Utils.todayKey();
        }
        App.refresh();
      });
    };
    bindSelect('#activityProjectFilter', 'project');
    bindSelect('#activitySourceFilter', 'source');
    bindSelect('#activityRangeFilter', 'range');
    ['#activityFrom', '#activityTo'].forEach((id, index) => {
      const el = root.querySelector(id);
      if (!el) return;
      el.addEventListener('change', () => {
        if (index === 0) state.customFrom = el.value; else state.customTo = el.value;
        App.refresh();
      });
    });
    const overlapToggle = root.querySelector('[data-activity-overlap-toggle]');
    if (overlapToggle) overlapToggle.addEventListener('click', () => { state.overlapOnly = !state.overlapOnly; App.refresh(); });
    const clear = root.querySelector('[data-clear-activity-filters]');
    if (clear) clear.addEventListener('click', () => {
      Object.assign(state, { q: '', project: 'all', source: 'all', range: '14', customFrom: '', customTo: '', overlapOnly: false });
      App.refresh();
    });
    const exportBtn = root.querySelector('[data-activity-export]');
    if (exportBtn) exportBtn.addEventListener('click', () => Exports.open({ type: 'daily', from, to, projectId: state.project }));
    root.querySelectorAll('[data-delete-activity-row]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const activity = Store.getActivity(btn.dataset.deleteActivityRow);
        if (!activity) return;
        const ok = await UI.confirm({
          title: 'Delete this activity?',
          message: `“${activity.title}” (${Utils.formatDuration(activity.durationMinutes)}) will be removed. Linked task time will be reduced by the same amount.`,
          confirmLabel: 'Delete entry',
          danger: true
        });
        if (!ok) return;
        try {
          Store.deleteActivity(activity.id);
          UI.toast('Activity deleted.', 'success');
        } catch (err) {
          PageHelpers.toastError(err, 'Could not delete activity');
        }
      });
    });
  }

  function render(root) {
    const { from, to } = resolveRange();
    const allOverlapIds = Analytics.getOverlapIds(Store.getActivities());
    let activities = filteredActivities(from, to);
    const overlapCount = activities.filter((a) => allOverlapIds.has(a.id)).length;
    if (state.overlapOnly) activities = activities.filter((a) => allOverlapIds.has(a.id));
    const groups = Analytics.getActivitiesGroupedByDate(activities);
    const projectsTouched = new Set(activities.map((a) => a.projectId || '__none__')).size;
    const projects = Store.getProjects();
    const filtersActive = Boolean(state.q) || state.project !== 'all' || state.source !== 'all' || state.range !== '14' || state.overlapOnly;
    const settings = Store.getSettings();

    const actions = `
      <button class="btn btn-secondary" data-activity-export>${Utils.icon('download')} Export</button>
      <button class="btn btn-primary" data-action="quick-log">${Utils.icon('plus')} Log activity</button>`;

    root.innerHTML = `
      ${PageHelpers.pageHeader({
        eyebrow: 'Journal',
        title: 'Activity Log',
        subtitle: `Every tracked and manually logged block, newest first. Showing ${Utils.formatRange(from, to)}.`,
        actions
      })}
      ${summaryMarkup(activities, overlapCount, projectsTouched)}
      <div class="page-section">
        <div class="filter-bar">
          <div class="filter-bar-inner">
            <div class="input-icon-wrap toolbar-search">
              ${Utils.icon('search')}
              <input class="input ${state.q ? 'has-clear' : ''}" id="activitySearch" placeholder="Search activities, remarks or tasks…" value="${Utils.escapeAttr(state.q)}" autocomplete="off" aria-label="Search activities" />
              ${state.q ? `<button class="input-clear" data-clear-activity-search aria-label="Clear search">${Utils.icon('x')}</button>` : ''}
            </div>
            <span class="filter-divider"></span>
            <select class="select" id="activityProjectFilter" aria-label="Filter by project">
              <option value="all">All projects</option>
              ${projects.map((p) => `<option value="${p.id}" ${state.project === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
            </select>
            <select class="select" id="activitySourceFilter" aria-label="Filter by entry source">
              <option value="all" ${state.source === 'all' ? 'selected' : ''}>Any source</option>
              <option value="timer" ${state.source === 'timer' ? 'selected' : ''}>Timer entries</option>
              <option value="manual" ${state.source === 'manual' ? 'selected' : ''}>Manual entries</option>
            </select>
            <select class="select" id="activityRangeFilter" aria-label="Filter by date range">
              <option value="today" ${state.range === 'today' ? 'selected' : ''}>Today</option>
              <option value="7" ${state.range === '7' ? 'selected' : ''}>Last 7 days</option>
              <option value="14" ${state.range === '14' ? 'selected' : ''}>Last 14 days</option>
              <option value="30" ${state.range === '30' ? 'selected' : ''}>Last 30 days</option>
              <option value="month" ${state.range === 'month' ? 'selected' : ''}>This month</option>
              <option value="all" ${state.range === 'all' ? 'selected' : ''}>All time</option>
              <option value="custom" ${state.range === 'custom' ? 'selected' : ''}>Custom range</option>
            </select>
            ${state.range === 'custom' ? `
              <input class="input" type="date" id="activityFrom" value="${state.customFrom || from}" max="${Utils.todayKey()}" aria-label="From date" style="width:135px" />
              <span class="muted tiny">to</span>
              <input class="input" type="date" id="activityTo" value="${state.customTo || to}" max="${Utils.todayKey()}" aria-label="To date" style="width:135px" />` : ''}
            <button class="chip ${state.overlapOnly ? 'active' : ''}" data-activity-overlap-toggle title="Show only overlapping entries">${Utils.icon('alert-triangle')} Overlaps${overlapCount ? ` (${overlapCount})` : ''}</button>
            ${filtersActive ? `<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-clear-activity-filters>${Utils.icon('refresh')} Reset</button></div>` : ''}
          </div>
        </div>

        ${groups.length ? groups.map((group) => dayMarkup(group, { overlapIds: allOverlapIds, threshold: settings.idleThresholdMinutes })).join('') : UI.emptyState(
          'list',
          'No activities found',
          filtersActive ? 'No entries match the current search and filters. Try a wider date range or reset the filters.' : 'Start the timer or log a past block to begin building your activity history.',
          filtersActive ? `<button class="btn btn-secondary btn-sm" data-clear-activity-filters>${Utils.icon('refresh')} Clear filters</button>` : `<button class="btn btn-primary btn-sm" data-action="quick-log">${Utils.icon('plus')} Log activity</button>`
        )}
      </div>`;

    bind(root, { from, to });
  }

  return { render, state, resolveRange };
})();

window.ActivitiesPage = ActivitiesPage;
