/* ============================================================
   FlowTrack — Calendar
   Monthly and weekly planning views with per-day detail.
   ============================================================ */

const CalendarPage = (() => {
  const state = { view: 'month', anchor: Utils.todayKey(), selected: Utils.todayKey() };

  function focusDate(dateKey) {
    state.anchor = dateKey || Utils.todayKey();
    state.selected = state.anchor;
  }

  function shift(direction) {
    if (state.view === 'month') {
      state.anchor = Utils.addMonths(state.anchor, direction);
      state.selected = Utils.startOfMonth(state.anchor);
      if (state.anchor.slice(0, 7) === Utils.todayKey().slice(0, 7)) state.selected = Utils.todayKey();
    } else {
      state.anchor = Utils.addDays(state.anchor, direction * 7);
      state.selected = state.anchor;
    }
  }

  function isOverdueOpen(tasks) {
    return tasks.some((t) => t.status !== 'Completed' && t.assignedDate < Utils.todayKey());
  }

  function monthCell(key, anchor) {
    const summary = Analytics.getCalendarDaySummary(key);
    const outside = key.slice(0, 7) !== anchor.slice(0, 7);
    const weekend = Utils.weekdayIndex(key) === 0 || Utils.weekdayIndex(key) === 6;
    const today = key === Utils.todayKey();
    const selected = key === state.selected;
    const overdue = isOverdueOpen(summary.tasks);
    const completed = summary.completed;
    const shown = summary.tasks.slice(0, 2);
    return `<div class="cal-cell ${outside ? 'outside' : ''} ${weekend ? 'weekend' : ''} ${today ? 'today' : ''} ${selected ? 'selected' : ''}" data-cal-select="${key}" role="button" tabindex="0" aria-label="${Utils.escapeAttr(Utils.formatDate(key, 'long'))}">
      <div class="cal-cell-head">
        <span class="cal-daynum">${Utils.dayNumber(key)}</span>
        <span class="cal-hours">${summary.trackedMinutes ? Utils.formatDuration(summary.trackedMinutes) : ''}</span>
        <button type="button" class="cal-add-btn" data-cal-add="${key}" title="Add task on ${Utils.escapeAttr(Utils.formatDate(key, 'short'))}" aria-label="Add task on ${Utils.escapeAttr(Utils.formatDate(key, 'short'))}">${Utils.icon('plus')}</button>
      </div>
      ${summary.tasks.length ? `<div class="cal-dots" aria-hidden="true">${summary.tasks.slice(0, 4).map((task) => {
        const project = task.projectId ? Store.getProject(task.projectId) : null;
        return `<span class="cal-dot ${task.status === 'Completed' ? 'completed' : ''}" style="background:${project ? project.color : '#94a3b8'}"></span>`;
      }).join('')}${summary.tasks.length > 4 ? `<span class="cal-dot-more">+${summary.tasks.length - 4}</span>` : ''}</div>` : ''}
      ${shown.map((task) => {
        const project = task.projectId ? Store.getProject(task.projectId) : null;
        return `<button type="button" class="cal-task ${task.status === 'Completed' ? 'completed' : ''}" data-open-task="${task.id}" style="font-family:inherit" title="${Utils.escapeAttr(task.title)}">
          <span class="dot" style="background:${project ? project.color : '#94a3b8'}"></span><span>${Utils.escapeHtml(task.title)}</span>
        </button>`;
      }).join('')}
      ${summary.tasks.length > shown.length ? `<span class="cal-more">+${summary.tasks.length - shown.length} more</span>` : ''}
      <div class="cal-progress">
        ${summary.tasks.length ? `<div class="progress"><span style="width:${summary.completionRate}%"></span></div><span class="cal-completion">${overdue ? `<span class="cal-dot-late"></span>` : `<span class="cal-dot-done"></span>`}${completed}/${summary.tasks.length}</span>` : `<span class="cal-completion">${summary.activities.length ? `${summary.activities.length} activities` : 'No tasks'}</span>`}
      </div>
    </div>`;
  }

  function monthView() {
    const monthStart = Utils.startOfMonth(state.anchor);
    const gridStart = Utils.startOfWeek(monthStart, Store.getSettings().weekStartsOn);
    const gridEnd = Utils.endOfWeek(Utils.endOfMonth(state.anchor), Store.getSettings().weekStartsOn);
    const days = Utils.eachDay(gridStart, gridEnd);
    const weekStartsOn = Store.getSettings().weekStartsOn;
    const weekdays = weekStartsOn === 1
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `<div class="cal-grid" style="grid-template-columns:repeat(7,minmax(0,1fr))">
      ${weekdays.map((day) => `<div class="cal-weekday ${day === 'Sat' || day === 'Sun' ? 'weekend' : ''}">${day}</div>`).join('')}
    </div>
    <div class="cal-grid">
      ${days.map((day) => monthCell(day, state.anchor)).join('')}
    </div>`;
  }

  function weekView() {
    const start = Utils.startOfWeek(state.anchor, Store.getSettings().weekStartsOn);
    const days = Utils.eachDay(start, Utils.addDays(start, 6));
    return `<div class="cal-week-grid">
      ${days.map((key) => {
        const summary = Analytics.getCalendarDaySummary(key);
        const today = key === Utils.todayKey();
        return `<div class="cal-week-col ${today ? 'today' : ''}">
          <div class="cal-week-head">
            <div class="wd">${Utils.formatDate(key, 'weekday-short')}</div>
            <div class="wd-date">${Utils.dayNumber(key)}</div>
          </div>
          <div class="cal-week-body">
            <div class="cal-week-total">${summary.trackedMinutes ? `${Utils.formatDuration(summary.trackedMinutes)} · ` : ''}${summary.completed}/${summary.tasks.length} done</div>
            ${summary.tasks.slice(0, 5).map((task) => {
              const project = task.projectId ? Store.getProject(task.projectId) : null;
              return `<button type="button" class="cal-week-task ${task.status === 'Completed' ? 'completed' : ''}" data-open-task="${task.id}" style="font-family:inherit;text-align:left">
                <span class="t">${Utils.escapeHtml(task.title)}</span>
                <span class="m"><span class="dot" style="width:5px;height:5px;border-radius:50%;background:${project ? project.color : '#94a3b8'};display:inline-block"></span>${Utils.escapeHtml(task.priority)}${task.startTime ? ` · ${Utils.formatTime12(Utils.timeToMinutes(task.startTime))}` : ''}</span>
              </button>`;
            }).join('')}
            ${summary.tasks.length > 5 ? `<span class="cal-more">+${summary.tasks.length - 5} more tasks</span>` : ''}
            ${summary.activities.length && !summary.tasks.length ? `<div class="cal-week-empty">${summary.activities.length} activit${summary.activities.length === 1 ? 'y' : 'ies'} · ${Utils.formatDuration(summary.trackedMinutes)}</div>` : ''}
            ${!summary.tasks.length && !summary.activities.length ? `<div class="cal-week-empty">Nothing planned</div>` : ''}
            <button type="button" class="cal-week-add" data-cal-add="${key}" style="font-family:inherit">${Utils.icon('plus')} Add task</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function dayPanel() {
    const key = state.selected;
    const summary = Analytics.getCalendarDaySummary(key);
    const relative = Utils.relativeLabel(key);
    const overlapIds = Analytics.getOverlapIds(summary.activities);
    const settings = Store.getSettings();
    const idle = Analytics.getIdleGaps(key, settings.idleThresholdMinutes, key === Utils.todayKey());
    return `<aside class="day-panel card">
      <div class="day-panel-head">
        <div class="day-panel-date">${Utils.formatDate(key, 'day')} ${Utils.formatDate(key, 'month-short-year')}</div>
        <div class="day-panel-sub">${Utils.escapeHtml(Utils.formatDate(key, 'weekday'))} · ${Utils.escapeHtml(relative)}</div>
        <div class="day-panel-stats">
          <div class="day-panel-stat"><div class="l">Tasks</div><div class="v">${summary.tasks.length}</div></div>
          <div class="day-panel-stat"><div class="l">Done</div><div class="v">${summary.completed}</div></div>
          <div class="day-panel-stat"><div class="l">Tracked</div><div class="v">${summary.trackedMinutes ? Utils.formatDuration(summary.trackedMinutes) : '0m'}</div></div>
        </div>
      </div>
      <div class="day-panel-section">
        <div class="day-panel-section-head">
          <span class="day-panel-section-title">Tasks</span>
          <button class="mini-link" data-cal-add="${key}">+ Add task</button>
        </div>
        ${summary.tasks.length ? summary.tasks.map((task) => {
          const project = task.projectId ? Store.getProject(task.projectId) : null;
          return `<div class="day-panel-task" data-open-task="${task.id}">
            <span class="dpt-dot" style="background:${project ? project.color : (task.status === 'Completed' ? '#10b981' : '#cbd5e1')}"></span>
            <div class="dpt-copy">
              <div class="dpt-title">${Utils.escapeHtml(task.title)}</div>
              <div class="dpt-meta">${UI.priorityBadge(task.priority)} ${task.startTime && task.endTime ? `<span>${Utils.formatTimeRange(Utils.timeToMinutes(task.startTime), Utils.timeToMinutes(task.endTime))}</span>` : ''}</div>
            </div>
            <span class="badge badge-${Utils.statusClass(task.status)}" style="height:18px;font-size:8.5px">${Utils.escapeHtml(task.status === 'In Progress' ? 'Doing' : task.status === 'Not Started' ? 'Todo' : task.status)}</span>
          </div>`;
        }).join('') : `<p class="day-panel-empty" style="font-size:10.5px;color:var(--muted-2);padding:6px 0 8px">No tasks planned for this day.</p>`}
      </div>
      <div class="day-panel-section">
        <div class="day-panel-section-head">
          <span class="day-panel-section-title">Activities</span>
          <button class="mini-link" data-day-add-activity="${key}">+ Log activity</button>
        </div>
        ${summary.activities.length ? summary.activities.slice(0, 6).map((activity) => `<div class="day-panel-act">
          <span class="dpa-time">${Utils.formatTimeRange(activity.startMinutes, activity.endMinutes)}</span>
          <span class="dpa-title" title="${Utils.escapeAttr(activity.title)}">${overlapIds.has(activity.id) ? `${Utils.icon('alert-triangle')} ` : ''}${Utils.escapeHtml(activity.title)}</span>
          <span class="dpa-dur">${Utils.formatDuration(activity.durationMinutes)}</span>
        </div>`).join('') : `<p style="font-size:10.5px;color:var(--muted-2);padding:6px 0 8px">No time logged. ${idle.totalMinutes ? `${Utils.formatDuration(idle.totalMinutes)} unaccounted in the workday.` : ''}</p>`}
        ${summary.activities.length > 6 ? `<button class="mini-link mt-8" data-nav="activities">View all ${summary.activities.length} entries</button>` : ''}
      </div>
      <div class="day-panel-actions">
        <button class="btn btn-secondary" data-cal-add="${key}">${Utils.icon('plus')} Add task</button>
        <button class="btn btn-primary" data-day-add-activity="${key}">${Utils.icon('clock')} Log work</button>
      </div>
    </aside>`;
  }

  function bind(root) {
    root.querySelectorAll('[data-cal-select]').forEach((cell) => {
      const choose = (event) => {
        if (event.target.closest('[data-open-task],[data-cal-add]')) return;
        state.selected = cell.dataset.calSelect;
        App.refresh();
      };
      cell.addEventListener('click', choose);
      cell.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(event); }
      });
    });
    root.querySelectorAll('[data-cal-add]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        state.selected = btn.dataset.calAdd;
        TaskForm.open({ defaults: { assignedDate: btn.dataset.calAdd } });
      });
    });
    root.querySelectorAll('[data-day-add-activity]').forEach((btn) => {
      btn.addEventListener('click', () => ActivityForm.open({ defaults: { dateKey: btn.dataset.dayAddActivity } }));
    });
    root.querySelectorAll('[data-cal-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        shift(Number(btn.dataset.calNav));
        App.refresh();
      });
    });
    const todayBtn = root.querySelector('[data-cal-today]');
    if (todayBtn) todayBtn.addEventListener('click', () => {
      state.anchor = Utils.todayKey();
      state.selected = Utils.todayKey();
      App.refresh();
    });
    root.querySelectorAll('[data-cal-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.view = btn.dataset.calView;
        App.refresh();
      });
    });
    const viewTasks = root.querySelector('[data-day-view-tasks]');
    if (viewTasks) viewTasks.addEventListener('click', () => {
      TasksPage.filterByDate(state.selected);
      App.navigate('tasks');
    });
  }

  function render(root) {
    const settings = Store.getSettings();
    const monthMode = state.view === 'month';
    const rangeFrom = monthMode ? Utils.startOfMonth(state.anchor) : Utils.startOfWeek(state.anchor, settings.weekStartsOn);
    const rangeTo = monthMode ? Utils.endOfMonth(state.anchor) : Utils.addDays(rangeFrom, 6);
    const rangeStats = Analytics.getRangeStats(rangeFrom, rangeTo);
    const periodLabel = monthMode
      ? Utils.formatDate(state.anchor, 'month-year')
      : Utils.formatRange(rangeFrom, rangeTo);
    const periodSub = `${rangeStats.tasks.assigned} tasks · ${Utils.formatDuration(rangeStats.trackedMinutes)} planned window`;

    const actions = `
      <button class="btn btn-secondary" data-day-view-tasks>${Utils.icon('tasks')} View day tasks</button>
      <button class="btn btn-secondary" data-day-add-activity="${state.selected}">${Utils.icon('clock')} Log work</button>
      <button class="btn btn-primary" data-cal-add="${state.selected}">${Utils.icon('plus')} Add task</button>`;

    root.innerHTML = `
      ${PageHelpers.pageHeader({
        eyebrow: 'Plan',
        title: 'Calendar',
        subtitle: `See workloads, completion and tracked time by date. Select a day to review or plan it.`,
        actions
      })}
      <div class="calendar-layout">
        <section class="card calendar-card">
          <div class="calendar-toolbar">
            <div class="calendar-period">
              <button class="icon-btn sm bordered" data-cal-nav="-1" aria-label="Previous ${monthMode ? 'month' : 'week'}">${Utils.icon('chevron-left')}</button>
              <div class="calendar-period-label">${Utils.escapeHtml(periodLabel)}<small>${Utils.escapeHtml(periodSub)}</small></div>
              <button class="icon-btn sm bordered" data-cal-nav="1" aria-label="Next ${monthMode ? 'month' : 'week'}">${Utils.icon('chevron-right')}</button>
            </div>
            <div class="calendar-tools">
              <button class="btn btn-secondary btn-sm" data-cal-today>Today</button>
              <div class="segmented">
                <button class="${monthMode ? 'active' : ''}" data-cal-view="month">${Utils.icon('calendar')} Month</button>
                <button class="${!monthMode ? 'active' : ''}" data-cal-view="week">${Utils.icon('list')} Week</button>
              </div>
            </div>
          </div>
          ${monthMode ? monthView() : weekView()}
          <div class="cal-legend">
            <span class="legend-item"><span class="legend-dot" style="background:var(--primary)"></span>Selected day</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--success)"></span>Completed</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--warning)"></span>Overdue work</span>
            <span class="legend-item">${Utils.icon('clock')} Tracked time per day</span>
            <span class="footer-spacer"></span>
            <span class="legend-item">${rangeStats.activities.length} activities in view</span>
          </div>
        </section>
        ${dayPanel()}
      </div>`;

    bind(root);
  }

  return { render, focusDate, state };
})();

window.CalendarPage = CalendarPage;
