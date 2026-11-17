/* ============================================================
   FlowTrack — Time Tracker
   Live timer, pause/resume, idle gaps and today's timeline.
   ============================================================ */

const TrackerPage = (() => {
  const state = { selectedTaskId: '', note: '' };

  function timerHero({ timer, timerTask, elapsed, target, openTasks, todayStats }) {
    const running = Boolean(timer && timer.status === 'running');
    const paused = Boolean(timer && timer.status === 'paused');
    const className = running ? '' : paused ? 'paused' : 'idle';
    const statusLabel = running ? 'Tracking now' : paused ? 'Timer paused' : 'Timer idle';
    const project = timerTask && timerTask.projectId ? Store.getProject(timerTask.projectId) : null;
    const selected = openTasks.some((t) => t.id === state.selectedTaskId) ? state.selectedTaskId : (openTasks[0] ? openTasks[0].id : '');
    const currentTask = timerTask || openTasks.find((t) => t.id === selected) || null;

    const topLabel = timer
      ? `<span class="timer-session-label">${Utils.icon('clock')} Session started ${Utils.formatTimestamp(timer.sessionStartedAt)}</span>`
      : `<span class="timer-session-label">${Utils.icon('target')} Daily target ${Utils.formatDuration(target.target)}</span>`;

    const taskPanel = timer ? `
      <div class="timer-task-panel">
        <div class="field">
          <span class="field-label">Current task</span>
          <div class="input" style="display:flex;align-items:center;gap:8px;cursor:default">${Utils.icon('tasks')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.escapeHtml(timerTask ? timerTask.title : 'Task unavailable')}</span></div>
        </div>
        <div class="timer-task-info">
          ${project ? `<span class="project-chip"><span class="dot" style="background:${project.color}"></span><span>${Utils.escapeHtml(project.name)}</span></span>` : '<span class="timer-task-text">No project</span>'}
          ${timerTask ? UI.statusBadge(timerTask.status) : ''}
          <span class="timer-task-text">${timer.note ? `“${Utils.escapeHtml(timer.note)}”` : 'No session note'}</span>
        </div>
      </div>` : `
      <div class="timer-task-panel">
        <div class="field">
          <label class="field-label" for="trackerTaskSelect">What are you working on?</label>
          <select class="select" id="trackerTaskSelect" ${openTasks.length ? '' : 'disabled'}>
            ${openTasks.length ? openTasks.map((task) => `<option value="${task.id}" ${task.id === selected ? 'selected' : ''}>${Utils.escapeHtml(task.title)}${task.projectId ? ` — ${Utils.escapeHtml(Analytics.getProjectName(task.projectId))}` : ''}</option>`).join('') : '<option>No open tasks — create one first</option>'}
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="trackerNote">Session note <span style="text-transform:none;letter-spacing:0;font-weight:500;color:#7d8bab">optional</span></label>
          <input class="input" id="trackerNote" placeholder="e.g. Finishing the monthly KPI commentary" value="${Utils.escapeAttr(state.note)}" maxlength="500" />
        </div>
        <div class="timer-task-info">
          ${currentTask ? UI.projectChip(currentTask.projectId) : ''}
          ${currentTask ? `<span class="timer-task-text">${Utils.formatDuration(currentTask.actualMinutes)} already tracked${currentTask.estimatedMinutes ? ` of ${Utils.formatDuration(currentTask.estimatedMinutes)} estimated` : ''}</span>` : `<span class="timer-task-text">Open the Tasks page to plan your next piece of work.</span>`}
        </div>
      </div>`;

    const controls = timer
      ? `<div class="timer-controls">
          ${running
            ? `<button class="btn timer-btn-pause" data-timer-action="pause">${Utils.icon('pause')} Pause timer</button>`
            : `<button class="btn timer-btn-main" data-timer-action="resume">${Utils.icon('play')} Resume timer</button>`}
          <button class="btn timer-btn-stop" data-timer-action="stop">${Utils.icon('stop')} Stop &amp; save</button>
          <div class="spacer"></div>
          <span class="timer-shortcut">${Utils.icon('info')} Pausing saves this segment to the activity log.</span>
        </div>`
      : `<div class="timer-controls">
          <button class="btn timer-btn-main" data-tracker-start ${openTasks.length ? '' : 'disabled'}>${Utils.icon('play')} Start timer</button>
          <button class="btn timer-btn-pause" data-action="quick-log">${Utils.icon('plus')} Log past work</button>
          <div class="spacer"></div>
          <span class="timer-shortcut">${Utils.icon('shield')} Only one timer can run at a time.</span>
        </div>`;

    return `<section class="timer-hero">
      <div class="timer-topline">
        <span class="timer-state ${className}"><span class="pulse"></span>${statusLabel}</span>
        ${topLabel}
      </div>
      <div class="timer-display-wrap">
        <div class="timer-display" data-live-timer>${Utils.formatClock(elapsed)}</div>
        <div class="timer-caption">
          ${timer ? (running ? 'Recording live — pause or stop to write it to your log.' : 'Paused — your tracked time is safe.') : 'Choose a task and start when you begin.'}
          <span class="sep"></span>
          <span>${todayStats.activityCount} entr${todayStats.activityCount === 1 ? 'y' : 'ies'} today</span>
          <span class="sep"></span>
          <span>${Utils.formatDuration(target.tracked)} of ${Utils.formatDuration(target.target)} target</span>
        </div>
      </div>
      ${taskPanel}
      ${controls}
      <div class="timer-footer-stats">
        <div class="timer-foot-stat"><div class="label">Tracked today</div><div class="value">${Utils.formatDuration(todayStats.trackedMinutes)}</div></div>
        <div class="timer-foot-stat"><div class="label">Productive today</div><div class="value">${Utils.formatDuration(todayStats.productiveMinutes)} <span class="sub">${todayStats.productivity}%</span></div></div>
        <div class="timer-foot-stat"><div class="label">Sessions</div><div class="value">${todayStats.activityCount}</div></div>
        <div class="timer-foot-stat"><div class="label">Target left</div><div class="value">${Utils.formatDuration(target.remaining)}</div></div>
      </div>
    </section>`;
  }

  function targetCard({ target }) {
    return `<section class="card timer-side-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('target')} Daily target</h2><p class="card-subtitle">${Utils.formatDuration(target.tracked)} of ${Utils.formatDuration(target.target)}</p></div>
      </div>
      <div class="timer-target-ring" style="--p:${Math.min(100, target.percent)}">
        <div class="inner"><div class="pct">${target.percent}%</div><div class="lbl">of daily target</div></div>
      </div>
      <p class="target-caption">${target.exceeded ? `<strong>Target exceeded</strong> — ${Utils.formatDuration(target.tracked - target.target)} over.` : `<strong>${Utils.formatDuration(target.remaining)}</strong> remaining to hit today's goal.`}</p>
      <div class="target-stat-row">
        <div class="target-stat"><div class="label">Productive</div><div class="value">${Utils.formatDuration(target.productive)}</div></div>
        <div class="target-stat"><div class="label">Working</div><div class="value">${Utils.formatDuration(target.tracked)}</div></div>
      </div>
    </section>`;
  }

  function idleCard({ idle, settings }) {
    return `<section class="card timer-side-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('alert-triangle')} Idle gaps</h2><p class="card-subtitle">Unaccounted blocks over ${settings.idleThresholdMinutes} min</p></div>
        ${idle.gaps.length ? `<span class="badge badge-warning">${Utils.formatDuration(idle.totalMinutes)}</span>` : ''}
      </div>
      ${idle.gaps.length ? `<div class="idle-list">
        ${idle.gaps.slice(0, 5).map((gap) => `<div class="idle-item">
          <span class="icon-wrap">${Utils.icon('clock')}</span>
          <div><div class="idle-time">${Utils.formatTimeRange(gap.startMinutes, gap.endMinutes)}</div><div class="idle-label">No activity recorded</div></div>
          <span class="idle-dur">${Utils.formatDuration(gap.durationMinutes)}</span>
        </div>`).join('')}
      </div>${idle.gaps.length > 5 ? `<p class="settings-note">${Utils.icon('info')} Showing the first 5 gaps of ${idle.gaps.length}.</p>` : ''}` : UI.emptyState('check-circle', 'No long idle gaps', 'Every block in your workday has been accounted for.', '', true)}
      <p class="settings-note">${Utils.icon('info')} Window ${Utils.formatTime12(idle.windowStart)} – ${Utils.formatTime12(idle.windowEnd)}. The running timer is saved when you pause or stop.</p>
    </section>`;
  }

  function quickStartCard({ openTasks, timer }) {
    return `<section class="card timer-side-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('zap')} Quick start</h2><p class="card-subtitle">Your next open tasks</p></div>
        <button class="btn btn-ghost btn-sm" data-nav="tasks">All ${Utils.icon('arrow-right')}</button>
      </div>
      ${openTasks.length ? `<div>
        ${openTasks.slice(0, 5).map((task) => `<div class="quick-start-row">
          <button class="quick-start-play" data-start-timer="${task.id}" ${timer ? 'disabled title="Stop the current timer first"' : `title="Start ${Utils.escapeAttr(task.title)}"`} aria-label="Start timer for ${Utils.escapeAttr(task.title)}">${Utils.icon('play')}</button>
          <div class="quick-start-copy">
            <div class="quick-start-title" data-open-task="${task.id}">${Utils.escapeHtml(task.title)}</div>
            <div class="quick-start-meta">${Utils.escapeHtml(Analytics.getProjectName(task.projectId))} · ${Utils.escapeHtml(task.priority)} priority</div>
          </div>
          <span class="quick-start-est">${task.estimatedMinutes ? Utils.formatDuration(task.estimatedMinutes) : 'No est.'}</span>
        </div>`).join('')}
      </div>${timer ? `<p class="settings-note">${Utils.icon('info')} Stop the current timer before switching tasks.</p>` : ''}` : UI.emptyState('check-circle', 'No open tasks', 'Create a task to start tracking focused work.', `<button class="btn btn-secondary btn-sm" data-action="new-task">${Utils.icon('plus')} New task</button>`, true)}
    </section>`;
  }

  function todayLogCard({ todayActivities, overlapIds }) {
    return `<section class="card tracker-log-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('activity')} Today's timeline</h2><p class="card-subtitle">${Utils.formatDuration(Analytics.trackedMinutes(todayActivities))} across ${todayActivities.length} entries</p></div>
        <button class="btn btn-ghost btn-sm" data-nav="activities">Full log ${Utils.icon('arrow-right')}</button>
      </div>
      <div class="card-body" style="padding-top:13px">
        ${todayActivities.length ? `<div class="timeline tracker-log-list">
          ${todayActivities.map((activity) => {
            const project = activity.projectId ? Store.getProject(activity.projectId) : null;
            const isOverlap = overlapIds.has(activity.id);
            return `<div class="timeline-item">
              <span class="timeline-time">${Utils.formatTime12(activity.startMinutes)}</span>
              <span class="timeline-axis"><span class="timeline-dot ${isOverlap ? 'warning' : activity.source === 'timer' ? 'success' : 'muted'}"></span><span class="timeline-line"></span></span>
              <div class="timeline-content">
                <div class="timeline-title">${Utils.escapeHtml(activity.title)}${isOverlap ? '<span class="overlap-flag">Overlap</span>' : ''}</div>
                <div class="timeline-meta">
                  <span>${Utils.formatTimeRange(activity.startMinutes, activity.endMinutes)}</span>
                  ${project ? UI.projectChip(project.id) : ''}
                  ${UI.sourceBadge(activity.source)}
                  ${activity.taskId ? `<button class="mini-link" data-open-task="${activity.taskId}">${Utils.escapeHtml(activity.taskTitle || 'Linked task')}</button>` : ''}
                </div>
              </div>
              <div class="timeline-side">
                <span class="timeline-duration">${Utils.formatDuration(activity.durationMinutes)}</span>
                <button class="icon-btn sm" data-edit-activity="${activity.id}" aria-label="Edit activity">${Utils.icon('edit')}</button>
              </div>
            </div>`;
          }).join('')}
        </div>` : UI.emptyState('timer', 'No time on the clock yet', 'Start the timer for a task above, or log a past block of work.', `<button class="btn btn-secondary btn-sm" data-action="quick-log">${Utils.icon('plus')} Log activity</button>`, true)}
      </div>
    </section>`;
  }

  function bind(root) {
    const startBtn = root.querySelector('[data-tracker-start]');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const select = root.querySelector('#trackerTaskSelect');
        const note = root.querySelector('#trackerNote');
        const taskId = select ? select.value : '';
        if (!taskId) {
          UI.toast('Create a task before starting the timer.', 'warning');
          return;
        }
        try {
          const task = Store.getTask(taskId);
          Store.startTimer(taskId, note ? note.value : '');
          state.note = '';
          UI.toast(`Tracking ${task ? task.title : 'your task'}.`, 'success', 'Timer started');
        } catch (err) {
          PageHelpers.toastError(err, 'Could not start the timer');
        }
      });
    }
    const select = root.querySelector('#trackerTaskSelect');
    if (select) select.addEventListener('change', () => { state.selectedTaskId = select.value; });
    const note = root.querySelector('#trackerNote');
    if (note) note.addEventListener('input', () => { state.note = note.value; });
  }

  function render(root) {
    const settings = Store.getSettings();
    const today = Utils.todayKey();
    const timer = Store.getTimer();
    const timerTask = timer ? Store.getTask(timer.taskId) : null;
    const elapsed = timer ? Store.getTimerElapsedSeconds(timer) : 0;
    const target = Analytics.getDailyTargetProgress(today);
    const todayActivities = Analytics.getTodayActivities();
    const overlapIds = Analytics.getOverlapIds(todayActivities);
    const openTasks = Store.getTasks().filter((t) => t.status !== 'Completed').sort(Utils.sortTasks);
    const todayStats = Analytics.getRangeStats(today, today);
    const idle = Analytics.getIdleGaps(today, settings.idleThresholdMinutes, true);

    const actions = `
      <button class="btn btn-secondary" data-open-export="time">${Utils.icon('download')} Export</button>
      <button class="btn btn-secondary" data-action="quick-log">${Utils.icon('clock')} Log activity</button>
      <button class="btn btn-primary" data-action="new-task">${Utils.icon('plus')} New task</button>`;

    root.innerHTML = `
      ${PageHelpers.pageHeader({
        eyebrow: 'Focus',
        title: 'Time Tracker',
        subtitle: `Track focused work in real time. ${timer ? `A session is ${timer.status === 'running' ? 'running' : 'paused'} — ${Utils.formatClock(elapsed)} this session.` : `${Utils.formatDuration(todayStats.trackedMinutes)} logged today; ${Utils.formatDuration(target.remaining)} left to hit target.`}`,
        actions
      })}
      <div class="tracker-grid">
        <div class="tracker-main">
          ${timerHero({ timer, timerTask, elapsed, target, openTasks, todayStats })}
          ${todayLogCard({ todayActivities, overlapIds })}
        </div>
        <aside class="tracker-side">
          ${targetCard({ target })}
          ${idleCard({ idle, settings })}
          ${quickStartCard({ openTasks, timer })}
        </aside>
      </div>`;

    bind(root);
  }

  return { render, state };
})();

window.TrackerPage = TrackerPage;
