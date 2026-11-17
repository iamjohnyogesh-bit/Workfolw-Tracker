/* ============================================================
   FlowTrack — Tasks
   Searchable, filterable task table with inline status updates.
   ============================================================ */

const TasksPage = (() => {
  const state = {
    q: '',
    status: 'all',
    project: 'all',
    priority: 'all',
    range: 'all',
    dateKey: '',
    sort: 'assigned',
    page: 1,
    pageSize: 10
  };

  function setProjectFilter(projectId) {
    state.project = projectId || 'all';
    state.status = 'all';
    state.range = 'all';
    state.priority = 'all';
    state.q = '';
    state.page = 1;
  }

  function setStatusFilter(status) {
    state.status = Utils.STATUSES.includes(status) ? status : 'all';
    state.page = 1;
  }

  function filterByDate(dateKey) {
    state.range = dateKey ? 'date' : 'all';
    state.dateKey = dateKey || '';
    state.status = 'all';
    state.project = 'all';
    state.priority = 'all';
    state.q = '';
    state.page = 1;
  }

  function resetFilters() {
    Object.assign(state, { q: '', status: 'all', project: 'all', priority: 'all', range: 'all', dateKey: '', sort: 'assigned', page: 1 });
  }

  function taskScope() {
    const today = Utils.todayKey();
    const weekStart = Analytics.getWeekStart(today);
    const weekEnd = Analytics.getWeekEnd(today);
    const monthStart = Utils.startOfMonth(today);
    const monthEnd = Utils.endOfMonth(today);
    const projects = new Map(Store.getProjects().map((p) => [p.id, p.name.toLowerCase()]));
    const q = state.q.trim().toLowerCase();

    return Store.getTasks().filter((task) => {
      if (state.project !== 'all' && task.projectId !== state.project) return false;
      if (state.priority !== 'all' && task.priority !== state.priority) return false;
      if (state.range === 'today' && task.assignedDate !== today) return false;
      if (state.range === 'week' && (task.assignedDate < weekStart || task.assignedDate > weekEnd)) return false;
      if (state.range === 'month' && (task.assignedDate < monthStart || task.assignedDate > monthEnd)) return false;
      if (state.range === 'upcoming' && task.assignedDate < today) return false;
      if (state.range === 'overdue' && !(task.status !== 'Completed' && task.assignedDate < today)) return false;
      if (state.range === 'date' && task.assignedDate !== state.dateKey) return false;
      if (q) {
        const haystack = [
          task.title, task.description, task.notes, task.priority, task.status,
          projects.get(task.projectId) || ''
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function matchesStatus(task, status) {
    if (status === 'all') return true;
    if (status === 'overdue') return task.status !== 'Completed' && task.assignedDate < Utils.todayKey();
    return task.status === status;
  }

  function sortTasks(tasks) {
    const list = tasks.slice();
    const priorityRank = { High: 0, Medium: 1, Low: 2 };
    switch (state.sort) {
      case 'priority':
        return list.sort((a, b) => {
          if ((a.status === 'Completed') !== (b.status === 'Completed')) return a.status === 'Completed' ? 1 : -1;
          const p = priorityRank[a.priority] - priorityRank[b.priority];
          if (p !== 0) return p;
          return String(a.assignedDate).localeCompare(String(b.assignedDate));
        });
      case 'updated':
        return list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      case 'created':
        return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      case 'title':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return list.sort(Utils.sortTasks);
    }
  }

  function tabsMarkup(scope) {
    const counts = Analytics.getTaskCounts(scope);
    const today = Utils.todayKey();
    const overdue = scope.filter((t) => t.status !== 'Completed' && t.assignedDate < today).length;
    const tabs = [
      { id: 'all', label: 'All tasks', count: counts.total },
      { id: 'In Progress', label: 'In progress', count: counts.inProgress },
      { id: 'Not Started', label: 'Not started', count: counts.notStarted },
      { id: 'Completed', label: 'Completed', count: counts.completed },
      { id: 'On Hold', label: 'On hold', count: counts.onHold },
      { id: 'overdue', label: 'Overdue', count: overdue, danger: overdue > 0 }
    ];
    return `<div class="page-stats-inline" role="tablist" aria-label="Task status filters">
      ${tabs.map((tab) => `<button class="page-stat-tab ${state.status === tab.id ? 'active' : ''}" data-task-status-tab="${tab.id}" role="tab" aria-selected="${state.status === tab.id}">
        <span class="dot" ${tab.danger ? 'style="background:var(--danger);opacity:1"' : ''}></span>${tab.label} <span class="count">${tab.count}</span>
      </button>`).join('')}
    </div>`;
  }

  function rowMarkup(task) {
    const project = task.projectId ? Store.getProject(task.projectId) : null;
    const timer = Store.getTimer();
    const active = timer && timer.taskId === task.id;
    const progress = task.estimatedMinutes ? Math.min(100, Math.round((task.actualMinutes / task.estimatedMinutes) * 100)) : 0;
    const timeRange = task.startTime && task.endTime
      ? Utils.formatTimeRange(Utils.timeToMinutes(task.startTime), Utils.timeToMinutes(task.endTime))
      : task.startTime ? `From ${Utils.formatTime12(Utils.timeToMinutes(task.startTime))}` : 'No time set';
    const due = Utils.dueLabel(task.assignedDate);
    const isOverdue = task.status !== 'Completed' && task.assignedDate < Utils.todayKey();
    return `<tr class="${task.status === 'Completed' ? 'done' : ''} ${isOverdue ? 'is-overdue' : ''}">
      <td>
        <div class="cell-title">
          <div class="title-line">
            <span class="title"><button type="button" data-open-task="${task.id}">${Utils.escapeHtml(task.title)}</button></span>
            ${task.status === 'Completed' ? `<span class="badge badge-completed" style="height:18px;font-size:9px">Done</span>` : ''}
            ${active ? `<span class="badge badge-inprogress" style="height:18px;font-size:9px">${Utils.icon('timer')}Tracking</span>` : ''}
          </div>
          ${task.description ? `<span class="desc" title="${Utils.escapeAttr(task.description)}">${Utils.escapeHtml(task.description)}</span>` : ''}
          ${isOverdue ? `<span class="desc" style="color:var(--danger)">${Utils.escapeHtml(due.text)}</span>` : ''}
        </div>
      </td>
      <td>${project ? UI.projectChip(task.projectId) : `<span class="project-chip"><span class="dot" style="background:#cbd5e1"></span><span>No project</span></span>`}</td>
      <td>${UI.priorityBadge(task.priority)}</td>
      <td>${UI.statusSelect(task.id, task.status)}</td>
      <td>
        <div class="schedule-lines">
          <span class="schedule-date">${Utils.escapeHtml(Utils.formatDate(task.assignedDate, 'medium'))}</span>
          <span class="schedule-time">${Utils.escapeHtml(timeRange)}</span>
        </div>
      </td>
      <td>
        <div class="time-track" title="${task.estimatedMinutes ? `${Utils.formatDuration(task.actualMinutes)} of an estimated ${Utils.formatDuration(task.estimatedMinutes)}` : `${Utils.formatDuration(task.actualMinutes)} tracked`}">
          <div class="progress ${progress > 100 ? 'danger' : progress >= 80 ? 'success' : ''}"><span style="width:${Math.min(100, progress)}%"></span></div>
          <span class="time-text">${task.estimatedMinutes ? `${Utils.formatDuration(task.actualMinutes)} / ${Utils.formatDuration(task.estimatedMinutes)}` : Utils.formatDuration(task.actualMinutes)}</span>
        </div>
      </td>
      <td>
        <div class="cell-actions">
          ${task.status !== 'Completed' && !timer ? `<button class="icon-btn sm row-play" data-start-timer="${task.id}" title="Start timer" aria-label="Start timer for ${Utils.escapeAttr(task.title)}">${Utils.icon('play')}</button>` : ''}
          ${active ? `<button class="icon-btn sm row-play" data-timer-action="stop" title="Stop timer" aria-label="Stop timer">${Utils.icon('stop')}</button>` : ''}
          <button class="icon-btn sm" data-open-task="${task.id}" title="Edit task" aria-label="Edit ${Utils.escapeAttr(task.title)}">${Utils.icon('edit')}</button>
          <button class="icon-btn sm danger" data-delete-task-row="${task.id}" title="Delete task" aria-label="Delete ${Utils.escapeAttr(task.title)}">${Utils.icon('trash')}</button>
        </div>
      </td>
    </tr>`;
  }

  function pagerMarkup(page, totalPages) {
    if (totalPages <= 1) return '';
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const buttons = [];
    for (let i = start; i <= end; i++) {
      buttons.push(`<button data-task-page="${i}" class="${i === page ? 'active' : ''}" aria-label="Page ${i}">${i}</button>`);
    }
    return `<div class="pager">
      <button data-task-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">${Utils.icon('chevron-left')}</button>
      ${buttons.join('')}
      <button data-task-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">${Utils.icon('chevron-right')}</button>
    </div>`;
  }

  function bind(root) {
    const search = root.querySelector('#taskSearch');
    if (search) {
      search.addEventListener('input', () => {
        state.q = search.value;
        state.page = 1;
        App.refresh();
      });
    }
    const bindSelect = (id, key, map = (v) => v) => {
      const el = root.querySelector(id);
      if (!el) return;
      el.addEventListener('change', () => {
        state[key] = map(el.value);
        state.page = 1;
        App.refresh();
      });
    };
    bindSelect('#taskProjectFilter', 'project');
    bindSelect('#taskPriorityFilter', 'priority');
    bindSelect('#taskRangeFilter', 'range');
    bindSelect('#taskSortFilter', 'sort');

    root.querySelectorAll('[data-task-status-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.status = btn.dataset.taskStatusTab;
        state.page = 1;
        App.refresh();
      });
    });
    root.querySelectorAll('[data-task-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = Number(btn.dataset.taskPage);
        if (!Number.isFinite(page)) return;
        state.page = page;
        App.refresh();
      });
    });
    const clear = root.querySelector('[data-clear-task-filters]');
    if (clear) clear.addEventListener('click', () => { resetFilters(); App.refresh(); });
    const clearSearch = root.querySelector('[data-clear-task-search]');
    if (clearSearch) clearSearch.addEventListener('click', () => { state.q = ''; state.page = 1; App.refresh(); });

    root.querySelectorAll('[data-delete-task-row]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const task = Store.getTask(btn.dataset.deleteTaskRow);
        if (!task) return;
        const ok = await UI.confirm({
          title: 'Delete this task?',
          message: `“${task.title}” will be removed. Its activity history is kept, but the task link will be cleared.`,
          confirmLabel: 'Delete task',
          danger: true
        });
        if (!ok) return;
        try {
          Store.deleteTask(task.id);
          UI.toast('Task deleted. Activity history was preserved.', 'success');
        } catch (err) {
          PageHelpers.toastError(err, 'Could not delete task');
        }
      });
    });
  }

  function render(root) {
    const scope = taskScope();
    const tasks = sortTasks(scope.filter((task) => matchesStatus(task, state.status)));
    const counts = Analytics.getTaskCounts(scope);
    const total = tasks.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * state.pageSize;
    const pageTasks = tasks.slice(start, start + state.pageSize);
    const projects = Store.getProjects();
    const activeTimer = Store.getTimer();
    const filtersActive = Boolean(state.q) || state.status !== 'all' || state.project !== 'all' || state.priority !== 'all' || state.range !== 'all' || state.sort !== 'assigned';
    const dateOption = state.range === 'date'
      ? `<option value="date" selected>${Utils.escapeHtml(Utils.formatDate(state.dateKey, 'medium-year'))}</option>`
      : '';

    const actions = `
      <button class="btn btn-secondary" data-open-export="history">${Utils.icon('download')} Export</button>
      <button class="btn btn-primary" data-action="new-task">${Utils.icon('plus')} New task</button>`;

    root.innerHTML = `
      ${PageHelpers.pageHeader({
        eyebrow: 'Workload',
        title: 'My Tasks',
        subtitle: `Plan, prioritise and complete your work. ${counts.open} open task${counts.open === 1 ? '' : 's'}${counts.overdue ? `, ${counts.overdue} overdue` : ''}${activeTimer ? ' · a timer is running' : ''}.`,
        actions
      })}
      ${tabsMarkup(scope)}
      <div class="page-section">
        <div class="filter-bar">
          <div class="filter-bar-inner">
            <div class="input-icon-wrap toolbar-search">
              ${Utils.icon('search')}
              <input class="input ${state.q ? 'has-clear' : ''}" id="taskSearch" placeholder="Search tasks, notes or projects…" value="${Utils.escapeAttr(state.q)}" autocomplete="off" aria-label="Search tasks" />
              ${state.q ? `<button class="input-clear" data-clear-task-search aria-label="Clear search">${Utils.icon('x')}</button>` : ''}
            </div>
            <span class="filter-divider"></span>
            <select class="select" id="taskProjectFilter" aria-label="Filter by project">
              <option value="all">All projects</option>
              ${projects.map((p) => `<option value="${p.id}" ${state.project === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
            </select>
            <select class="select" id="taskPriorityFilter" aria-label="Filter by priority">
              <option value="all">All priorities</option>
              ${Utils.PRIORITIES.map((p) => `<option value="${p}" ${state.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
            <select class="select" id="taskRangeFilter" aria-label="Filter by date">
              <option value="all" ${state.range === 'all' ? 'selected' : ''}>Any date</option>
              ${dateOption}
              <option value="today" ${state.range === 'today' ? 'selected' : ''}>Today</option>
              <option value="week" ${state.range === 'week' ? 'selected' : ''}>This week</option>
              <option value="month" ${state.range === 'month' ? 'selected' : ''}>This month</option>
              <option value="upcoming" ${state.range === 'upcoming' ? 'selected' : ''}>Upcoming</option>
              <option value="overdue" ${state.range === 'overdue' ? 'selected' : ''}>Overdue only</option>
            </select>
            <select class="select" id="taskSortFilter" aria-label="Sort tasks">
              <option value="assigned" ${state.sort === 'assigned' ? 'selected' : ''}>Sort: due date</option>
              <option value="priority" ${state.sort === 'priority' ? 'selected' : ''}>Sort: priority</option>
              <option value="updated" ${state.sort === 'updated' ? 'selected' : ''}>Sort: recently updated</option>
              <option value="created" ${state.sort === 'created' ? 'selected' : ''}>Sort: newest</option>
              <option value="title" ${state.sort === 'title' ? 'selected' : ''}>Sort: title A–Z</option>
            </select>
            ${filtersActive ? `<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-clear-task-filters>${Utils.icon('refresh')} Reset</button></div>` : ''}
          </div>
        </div>

        <div class="card task-table">
          ${pageTasks.length ? `<div class="table-wrap">
            <table class="table">
              <thead><tr>
                <th>Task</th><th>Project</th><th>Priority</th><th>Status</th><th>Schedule</th><th>Effort</th><th style="text-align:right">Actions</th>
              </tr></thead>
              <tbody>${pageTasks.map(rowMarkup).join('')}</tbody>
            </table>
          </div>
          <div class="table-footer">
            <span class="muted">Showing <strong>${start + 1}–${Math.min(start + state.pageSize, total)}</strong> of <strong>${total}</strong> task${total === 1 ? '' : 's'}</span>
            ${pagerMarkup(state.page, totalPages)}
          </div>` : `<div class="table-wrap">${UI.emptyState(
            'search',
            total === 0 && filtersActive ? 'No tasks match those filters' : 'No tasks yet',
            total === 0 && filtersActive ? 'Try widening the date range, changing the status tab or clearing the search.' : 'Create your first task to start planning and tracking your work.',
            total === 0 && filtersActive ? `<button class="btn btn-secondary btn-sm" data-clear-task-filters>${Utils.icon('refresh')} Clear filters</button>` : `<button class="btn btn-primary btn-sm" data-action="new-task">${Utils.icon('plus')} Create a task</button>`
          )}</div>`}
        </div>
      </div>
      <div class="page-section">
        <div class="callout">
          ${Utils.icon('info')}
          <div><strong>Tip:</strong> use the play button in a row to start tracking that task immediately. Changing status here updates reports and the dashboard everywhere.</div>
          ${counts.overdue ? `<button class="mini-link" data-task-status-tab="overdue">Review ${counts.overdue} overdue</button>` : ''}
        </div>
      </div>`;

    bind(root);
  }

  return { render, setProjectFilter, setStatusFilter, filterByDate, resetFilters, state };
})();

window.TasksPage = TasksPage;
