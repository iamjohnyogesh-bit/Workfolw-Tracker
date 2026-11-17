/* ============================================================
   FlowTrack — Application shell
   Hash routing, global actions, search, timer chrome and safety.
   ============================================================ */

const App = (() => {
  const PAGES = {
    dashboard: { title: 'Dashboard', label: 'Dashboard', render: (root) => DashboardPage.render(root) },
    tasks: { title: 'My Tasks', label: 'My Tasks', render: (root) => TasksPage.render(root) },
    tracker: { title: 'Time Tracker', label: 'Time Tracker', render: (root) => TrackerPage.render(root) },
    activities: { title: 'Activity Log', label: 'Activity Log', render: (root) => ActivitiesPage.render(root) },
    calendar: { title: 'Calendar', label: 'Calendar', render: (root) => CalendarPage.render(root) },
    weekly: { title: 'Weekly Report', label: 'Weekly Report', render: (root) => WeeklyPage.render(root) },
    monthly: { title: 'Monthly Report', label: 'Monthly Report', render: (root) => MonthlyPage.render(root) },
    projects: { title: 'Projects', label: 'Projects', render: (root) => ProjectsPage.render(root) },
    settings: { title: 'Settings', label: 'Settings', render: (root) => SettingsPage.render(root) }
  };

  const state = { page: 'dashboard', initialized: false };
  let tickHandle = null;
  let lastStorageError = 0;

  function pageRoot() { return document.getElementById('pageRoot'); }

  function normalizePage(value) {
    const key = String(value || '').replace(/^#/, '').trim();
    return PAGES[key] ? key : 'dashboard';
  }

  function pageFromLocation() {
    return normalizePage(window.location.hash);
  }

  function navigate(page, options = {}) {
    if (UI.modalOpen && options.keepModal !== true) UI.closeAllModals('navigate');
    const next = normalizePage(page);
    const targetHash = `#${next}`;
    if (targetHash !== window.location.hash) {
      try { window.history.pushState(null, '', targetHash); } catch (_) { window.location.hash = next; }
    }
    const changed = state.page !== next;
    state.page = next;
    closeSidebar();
    closeMenus();
    if (changed || options.force) renderPage({ preserveScroll: false, announce: true });
  }

  function refresh() {
    if (!state.initialized) return;
    renderPage({ preserveScroll: true, preserveFocus: true });
  }

  function closeMenus() {
    if (UI && typeof UI.closeMenu === 'function') UI.closeMenu();
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }

  function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
  }

  function captureFocus(root) {
    const active = document.activeElement;
    if (!active || !root.contains(active) || !active.id) return null;
    const focus = { id: active.id, selectionStart: null, selectionEnd: null };
    if (typeof active.selectionStart === 'number' && /^(INPUT|TEXTAREA)$/.test(active.tagName)) {
      focus.selectionStart = active.selectionStart;
      focus.selectionEnd = active.selectionEnd;
    }
    return focus;
  }

  function restoreFocus(focus) {
    if (!focus) return;
    const target = document.getElementById(focus.id);
    if (!target) return;
    try { target.focus({ preventScroll: true }); } catch (_) {}
    if (target.setSelectionRange && focus.selectionStart != null) {
      try { target.setSelectionRange(focus.selectionStart, focus.selectionEnd); } catch (_) {}
    }
  }

  function renderError(root, err) {
    console.error('FlowTrack page render failed', err);
    root.innerHTML = `<div class="page-section">
      <div class="card card-pad" style="max-width:620px;margin:40px auto;text-align:center">
        <div class="empty-icon" style="margin:0 auto 12px">${Utils.icon('alert-triangle')}</div>
        <h2 class="page-title" style="font-size:22px">This page hit a snag</h2>
        <p class="page-subtitle" style="margin-top:6px">Your saved data is safe. Reload the workspace to try again, or open Settings to download a backup.</p>
        <div class="flex gap-8" style="justify-content:center;margin-top:18px">
          <button class="btn btn-secondary" data-error-reload>${Utils.icon('refresh')} Reload FlowTrack</button>
          <button class="btn btn-primary" data-nav="settings">Open settings</button>
        </div>
      </div>
    </div>`;
    const reload = root.querySelector('[data-error-reload]');
    if (reload) reload.addEventListener('click', () => window.location.reload());
  }

  function renderPage({ preserveScroll = false, preserveFocus = false, announce = false } = {}) {
    const root = pageRoot();
    if (!root) return;
    const scrollY = window.scrollY;
    const focus = preserveFocus ? captureFocus(root) : null;
    Charts.destroyAll();
    try {
      PAGES[state.page].render(root);
    } catch (err) {
      renderError(root, err);
    }
    syncChrome();
    if (preserveScroll) window.scrollTo({ top: scrollY, behavior: 'auto' });
    else window.scrollTo({ top: 0, behavior: 'auto' });
    restoreFocus(focus);
    if (announce) {
      try { root.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  function syncChrome() {
    const page = PAGES[state.page] || PAGES.dashboard;
    document.title = `${page.title} · FlowTrack`;
    const crumb = document.getElementById('crumbPage');
    if (crumb) crumb.textContent = page.title;
    document.body.dataset.page = state.page;

    document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
      const active = item.dataset.page === state.page;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });

    const settings = Store.getSettings();
    const initials = Utils.initials(settings.name);
    const counts = Analytics.getTaskCounts();
    const navOpenTasks = document.getElementById('navOpenTasks');
    if (navOpenTasks) navOpenTasks.textContent = counts.open;
    const sidebarName = document.getElementById('sidebarName');
    if (sidebarName) sidebarName.textContent = settings.name;
    ['topbarAvatar', 'sidebarAvatar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = initials;
    });
    const workspaceAvatar = document.querySelector('.workspace-avatar');
    if (workspaceAvatar) workspaceAvatar.textContent = initials;
    const topbarAvatar = document.getElementById('topbarAvatar');
    if (topbarAvatar) topbarAvatar.setAttribute('aria-label', `Open settings for ${settings.name}`);
    updateTimerChrome();
  }

  function updateTimerChrome() {
    const timer = Store.getTimer();
    const pill = document.getElementById('topbarTimer');
    const dot = document.getElementById('navTimerDot');
    const text = document.getElementById('topbarTimerText');
    const taskLabel = document.getElementById('topbarTimerTask');
    if (!timer) {
      if (pill) pill.hidden = true;
      if (dot) dot.hidden = true;
      return;
    }
    const task = Store.getTask(timer.taskId);
    const elapsed = Store.getTimerElapsedSeconds(timer);
    if (pill) {
      pill.hidden = false;
      pill.classList.toggle('paused', timer.status === 'paused');
      pill.title = `${task ? task.title : 'Tracked task'} · ${timer.status === 'running' ? 'running' : 'paused'} · ${Utils.formatClock(elapsed)}`;
    }
    if (dot) dot.hidden = false;
    if (text) text.textContent = Utils.formatClock(elapsed);
    if (taskLabel) taskLabel.textContent = timer.status === 'paused' ? `Paused · ${task ? task.title : 'Tracked task'}` : (task ? task.title : 'Tracked task');
  }

  function tickTimer() {
    const timer = Store.getTimer();
    if (!timer) return;
    const elapsed = Store.getTimerElapsedSeconds(timer);
    document.querySelectorAll('[data-live-timer]').forEach((el) => {
      el.textContent = Utils.formatClock(elapsed);
    });
    const text = document.getElementById('topbarTimerText');
    if (text) text.textContent = Utils.formatClock(elapsed);
  }

  function startTimerTicker() {
    if (tickHandle) return;
    tickHandle = window.setInterval(tickTimer, 1000);
  }

  function openSearch() {
    if (typeof UI.openModal !== 'function') return;
    UI.openModal({
      title: 'Search anything',
      subtitle: 'Tasks, activities and projects — all from one place.',
      size: 'modal-lg',
      bodyClass: 'search-body-wrap',
      body: `
        <div class="search-dialog-body">
          <div class="search-input-row">
            ${Utils.icon('search')}
            <input class="search-input-lg" id="globalSearchInput" type="search" placeholder="Type a task, activity, project or note…" autocomplete="off" autofocus aria-label="Search tasks, activities and projects" />
            <span class="search-hint">ESC</span>
          </div>
          <div class="search-results" id="globalSearchResults"></div>
        </div>`,
      footer: `<span class="modal-footer-note">↑ ↓ to navigate · ↵ to open · esc to close</span><button type="button" class="btn btn-secondary btn-sm" data-modal-close>Close</button>`,
      onMount: (backdrop, api) => {
        const input = backdrop.querySelector('#globalSearchInput');
        const results = backdrop.querySelector('#globalSearchResults');
        const projectStats = Analytics.getProjectStats();
        let flat = [];
        let selected = 0;

        const projectName = (projectId) => {
          const project = projectId ? Store.getProject(projectId) : null;
          return project ? project.name : 'No project';
        };

        const collect = (rawQuery) => {
          const query = rawQuery.trim().toLowerCase();
          const tasks = Store.getTasks();
          const activities = Store.getActivities();
          const projects = Store.getProjects();
          const recentTaskSort = (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt));

          let matchedTasks;
          let matchedActivities;
          let matchedProjects;
          if (!query) {
            matchedTasks = tasks.slice().sort(recentTaskSort).slice(0, 5);
            matchedActivities = activities.slice()
              .sort((a, b) => (a.dateKey === b.dateKey ? b.startMinutes - a.startMinutes : (a.dateKey < b.dateKey ? 1 : -1)))
              .slice(0, 3);
            matchedProjects = projects.slice(0, 2);
          } else {
            matchedTasks = tasks.filter((task) => {
              const project = task.projectId ? Store.getProject(task.projectId) : null;
              return [task.title, task.description, task.notes, task.status, task.priority, project ? project.name : '']
                .join(' ').toLowerCase().includes(query);
            }).sort(recentTaskSort).slice(0, 5);
            matchedActivities = activities.filter((activity) => {
              const project = activity.projectId ? Store.getProject(activity.projectId) : null;
              return [activity.title, activity.remarks, activity.taskTitle, project ? project.name : '']
                .join(' ').toLowerCase().includes(query);
            }).sort((a, b) => (a.dateKey === b.dateKey ? b.startMinutes - a.startMinutes : (a.dateKey < b.dateKey ? 1 : -1))).slice(0, 4);
            matchedProjects = projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(query)).slice(0, 3);
          }

          const groups = [
            {
              label: query ? 'Tasks' : 'Recently updated tasks',
              type: 'task',
              items: matchedTasks.map((task) => ({
                type: 'task',
                id: task.id,
                title: task.title,
                meta: [
                  task.status,
                  task.priority,
                  projectName(task.projectId),
                  Utils.formatDate(task.assignedDate, 'short')
                ].join(' · ')
              }))
            },
            {
              label: query ? 'Activities' : 'Recent activities',
              type: 'activity',
              items: matchedActivities.map((activity) => ({
                type: 'activity',
                id: activity.id,
                title: activity.title,
                meta: `${Utils.formatDate(activity.dateKey, 'short')} · ${Utils.formatTimeRange(activity.startMinutes, activity.endMinutes)} · ${projectName(activity.projectId)}`
              }))
            },
            {
              label: 'Projects',
              type: 'project',
              items: matchedProjects.map((project) => {
                const stats = projectStats.find((item) => item.id === project.id);
                return {
                  type: 'project',
                  id: project.id,
                  title: project.name,
                  meta: `${stats ? stats.tasks : 0} tasks · ${Utils.formatDuration(stats ? stats.minutes : 0)} tracked`
                };
              })
            }
          ];

          flat = [];
          groups.forEach((group) => {
            group.items.forEach((item) => { item.index = flat.length; flat.push(item); });
          });
          return { groups, query };
        };

        const paintSelection = () => {
          results.querySelectorAll('[data-result-index]').forEach((el) => {
            el.classList.toggle('selected', Number(el.dataset.resultIndex) === selected);
          });
          const active = results.querySelector(`[data-result-index="${selected}"]`);
          if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
        };

        const renderResults = (rawQuery) => {
          const { groups, query } = collect(rawQuery);
          selected = 0;
          const iconFor = { task: 'tasks', activity: 'activity', project: 'folder' };
          let index = 0;
          const markup = groups.map((group) => {
            if (!group.items.length) return '';
            const rows = group.items.map((item) => {
              const itemIndex = index++;
              return `<button type="button" class="search-result" data-result-index="${itemIndex}">
                <span class="search-result-icon ${item.type === 'activity' ? 'activity' : ''}">${Utils.icon(iconFor[item.type])}</span>
                <span class="search-result-copy">
                  <span class="search-result-title">${Utils.highlight(item.title, query)}</span>
                  <span class="search-result-meta">${Utils.escapeHtml(item.meta)}</span>
                </span>
                <span class="search-result-arrow">${Utils.icon('arrow-right')}</span>
              </button>`;
            }).join('');
            return `<div class="search-group-label">${Utils.escapeHtml(group.label)}</div>${rows}`;
          }).join('');
          results.innerHTML = markup || `<div class="search-empty">${query ? `No matches for “${Utils.escapeHtml(rawQuery.trim())}”. Try a different word or check another workspace page.` : 'Your workspace is quiet. Create a task or log activity to get started.'}</div>`;
          paintSelection();
        };

        const openItem = (item) => {
          if (!item) return;
          api.close();
          window.setTimeout(() => {
            if (item.type === 'task') TaskForm.open({ taskId: item.id });
            else if (item.type === 'activity') ActivityForm.open({ activityId: item.id });
            else if (item.type === 'project') {
              ProjectsPage.state.q = item.title;
              navigate('projects');
            }
          }, 70);
        };

        renderResults('');
        input.addEventListener('input', () => renderResults(input.value));
        results.addEventListener('click', (event) => {
          const row = event.target.closest('[data-result-index]');
          if (!row) return;
          openItem(flat[Number(row.dataset.resultIndex)]);
        });
        input.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!flat.length) return;
            selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length;
            paintSelection();
          } else if (event.key === 'Enter') {
            event.preventDefault();
            openItem(flat[selected]);
          }
        });
      }
    });
  }

  async function toggleTask(taskId) {
    const task = Store.getTask(taskId);
    if (!task) { UI.toast('That task could not be found.', 'error'); return; }
    const timer = Store.getTimer();
    if (task.status !== 'Completed' && timer && timer.taskId === task.id) {
      UI.toast('Stop the running timer before completing this task.', 'warning');
      return;
    }
    const nextStatus = task.status === 'Completed' ? 'Not Started' : 'Completed';
    try {
      Store.updateTaskStatus(task.id, nextStatus);
      UI.toast(nextStatus === 'Completed' ? 'Task marked complete.' : 'Task reopened.', 'success', 'Task updated');
    } catch (err) {
      PageHelpers.toastError(err, 'Could not update the task');
    }
  }

  function startTimer(taskId) {
    const task = Store.getTask(taskId);
    if (!task) { UI.toast('That task could not be found.', 'error'); return; }
    try {
      Store.startTimer(task.id, '');
      UI.toast(`Tracking ${task.title}.`, 'success', 'Timer started');
    } catch (err) {
      if (err.code === 'TIMER_ACTIVE') {
        const active = Store.getTimerTask();
        UI.toast(`A timer is already running${active ? ` for “${active.title}”` : ''}. Stop it before starting another.`, 'warning', 'One timer at a time');
      } else {
        PageHelpers.toastError(err, 'Could not start the timer');
      }
    }
  }

  function timerAction(action) {
    try {
      if (action === 'pause') {
        const result = Store.pauseTimer();
        UI.toast(result.minutes ? `Timer paused — ${Utils.formatDuration(result.minutes)} added to your activity log.` : 'Timer paused.', 'info', 'Timer paused');
      } else if (action === 'resume') {
        Store.resumeTimer();
        UI.toast('The timer is running again.', 'success', 'Timer resumed');
      } else if (action === 'stop') {
        const result = Store.stopTimer();
        const total = Utils.formatDuration(Math.round(result.totalSeconds / 60));
        UI.toast(result.minutes ? `${total} session saved — ${Utils.formatDuration(result.minutes)} added to your log.` : `${total} session saved.`, 'success', 'Session stopped');
      }
    } catch (err) {
      PageHelpers.toastError(err, 'Timer action failed');
    }
  }

  function bindGlobalEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const nav = target.closest('[data-nav]');
      if (nav) {
        event.preventDefault();
        navigate(nav.dataset.nav);
        return;
      }

      const action = target.closest('[data-action]');
      if (action) {
        const name = action.dataset.action;
        if (name === 'new-task') TaskForm.open();
        else if (name === 'quick-log') ActivityForm.open();
        return;
      }

      const openTask = target.closest('[data-open-task]');
      if (openTask) {
        event.preventDefault();
        const taskId = openTask.dataset.openTask;
        if (taskId) TaskForm.open({ taskId });
        return;
      }

      const toggle = target.closest('[data-toggle-task]');
      if (toggle) {
        event.preventDefault();
        toggleTask(toggle.dataset.toggleTask);
        return;
      }

      const start = target.closest('[data-start-timer]');
      if (start) {
        event.preventDefault();
        startTimer(start.dataset.startTimer);
        return;
      }

      const timer = target.closest('[data-timer-action]');
      if (timer) {
        event.preventDefault();
        timerAction(timer.dataset.timerAction);
        return;
      }

      const activity = target.closest('[data-edit-activity]');
      if (activity) {
        event.preventDefault();
        ActivityForm.open({ activityId: activity.dataset.editActivity });
        return;
      }

      const exportBtn = target.closest('[data-open-export]');
      if (exportBtn) {
        event.preventDefault();
        Exports.open({ type: exportBtn.dataset.openExport });
        return;
      }

      if (target.closest('[data-open-help]')) {
        event.preventDefault();
        UI.openHelpGuide();
      }
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const select = target.closest('[data-status-task]');
      if (!select) return;
      const task = Store.getTask(select.dataset.statusTask);
      if (!task) return;
      const timer = Store.getTimer();
      if (select.value === 'Completed' && timer && timer.taskId === task.id) {
        UI.toast('Stop the running timer before completing this task.', 'warning');
        refresh();
        return;
      }
      try {
        Store.updateTaskStatus(task.id, select.value);
        UI.toast(`“${Utils.clampText(task.title, 46)}” moved to ${select.value}.`, 'success', 'Task updated');
      } catch (err) {
        PageHelpers.toastError(err, 'Could not update the task');
        refresh();
      }
    });

    document.addEventListener('keydown', (event) => {
      const key = String(event.key || '').toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === 'Escape' && !UI.modalOpen) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
          event.preventDefault();
          closeSidebar();
        }
      }
    });

    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', openSidebar);
    const sidebarClose = document.getElementById('sidebarClose');
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.addEventListener('click', closeSidebar);
    document.querySelectorAll('.nav-item[data-page]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigate(link.dataset.page);
      });
    });
    const searchBtn = document.getElementById('globalSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', openSearch);
    const topbarAvatar = document.getElementById('topbarAvatar');
    if (topbarAvatar) topbarAvatar.addEventListener('click', () => navigate('settings'));

    window.addEventListener('hashchange', () => {
      const next = pageFromLocation();
      if (next !== state.page) {
        if (UI.modalOpen) UI.closeAllModals('history');
        state.page = next;
        closeSidebar();
        renderPage({ preserveScroll: false, announce: true });
      }
    });
    window.addEventListener('popstate', () => {
      const next = pageFromLocation();
      if (next !== state.page) {
        if (UI.modalOpen) UI.closeAllModals('history');
        state.page = next;
        closeSidebar();
        renderPage({ preserveScroll: false, announce: true });
      }
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== Store.STORAGE_KEY || !event.newValue) return;
      Store.reloadFromStorage();
      UI.toast('Workspace updated from another tab.', 'info');
    });
    window.addEventListener('flowtrack:storageerror', () => {
      const now = Date.now();
      if (now - lastStorageError < 8000) return;
      lastStorageError = now;
      UI.toast('This browser could not save your latest change. Download a backup from Settings.', 'error', 'Storage problem');
    });
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason) console.error('FlowTrack unhandled rejection', event.reason);
    });
  }

  function init() {
    if (state.initialized) return;
    if (window.Auth && !Auth.isAuthenticated()) { Auth.showLogin(); return; }
    Store.init();
    const initial = pageFromLocation();
    state.page = initial;
    if (window.location.hash !== `#${initial}`) {
      try { window.history.replaceState(null, '', `#${initial}`); } catch (_) { window.location.hash = initial; }
    }
    document.body.dataset.page = initial;
    bindGlobalEvents();
    renderPage({ preserveScroll: false });
    state.initialized = true;
    Store.subscribe(() => refresh());
    startTimerTicker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, navigate, refresh, openSearch, state, pages: PAGES };
})();

window.App = App;
