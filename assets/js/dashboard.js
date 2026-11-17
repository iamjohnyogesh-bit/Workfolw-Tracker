/* ============================================================
   FlowTrack — Dashboard
   Daily command centre: workload, time, focus and trends.
   ============================================================ */

const DashboardPage = (() => {
  const state = { focusTaskId: '' };

  function focusCard({ timer, timerTask, timerElapsed, target, openTasks, todayStats }) {
    const settings = Store.getSettings();
    if (timer && timerTask) {
      const running = timer.status === 'running';
      const project = timerTask.projectId ? Store.getProject(timerTask.projectId) : null;
      return `<section class="dash-focus">
        <div class="focus-label">${Utils.icon(running ? 'zap' : 'pause')} ${running ? 'Focus session running' : 'Focus session paused'}</div>
        <div class="timer-big-mini" data-live-timer>${Utils.formatClock(timerElapsed)}</div>
        <div class="focus-title">${Utils.escapeHtml(timerTask.title)}</div>
        <div class="focus-sub">${project ? `${Utils.escapeHtml(project.name)} · ` : ''}${running ? 'Timer is recording to your activity log.' : 'Paused. Resume when you are ready to continue.'}</div>
        <div class="focus-progress">
          ${UI.progressBar(target.percent, '', true, `Today's target · ${Utils.formatDuration(target.tracked)} of ${Utils.formatDuration(target.target)}`)}
        </div>
        <div class="focus-stats">
          <div><div class="focus-stat-label">This session</div><div class="focus-stat-value">${Utils.formatDuration(Math.round(timerElapsed / 60))}</div></div>
          <div><div class="focus-stat-label">Tracked today</div><div class="focus-stat-value">${Utils.formatDuration(todayStats.trackedMinutes)}</div></div>
          <div><div class="focus-stat-label">Productive</div><div class="focus-stat-value">${todayStats.productivity}%</div></div>
        </div>
        <div class="focus-actions">
          ${running
            ? `<button class="btn btn-light" data-timer-action="pause">${Utils.icon('pause')} Pause</button>`
            : `<button class="btn btn-light" data-timer-action="resume">${Utils.icon('play')} Resume</button>`}
          <button class="btn btn-ghost" data-timer-action="stop">${Utils.icon('stop')} Stop</button>
          <button class="btn btn-ghost" data-nav="tracker">Open tracker ${Utils.icon('arrow-right')}</button>
        </div>
      </section>`;
    }

    const selected = openTasks.some((t) => t.id === state.focusTaskId) ? state.focusTaskId : (openTasks[0] ? openTasks[0].id : '');
    const options = openTasks.map((task) => `<option value="${task.id}" ${task.id === selected ? 'selected' : ''}>${Utils.escapeHtml(task.title)}</option>`).join('');
    return `<section class="dash-focus">
      <div class="focus-label">${Utils.icon('target')} Today's focus</div>
      <div class="focus-title">${openTasks.length ? 'Ready for a focused session?' : 'Everything is wrapped up.'}</div>
      <div class="focus-sub">${openTasks.length ? 'Choose an open task. FlowTrack records the session straight to your activity log.' : 'No open tasks are waiting. Create the next thing you want to move forward.'}</div>
      ${openTasks.length ? `<div class="focus-form">
        <select class="focus-select" id="dashFocusTask" aria-label="Task to focus on">${options}</select>
        <button class="btn btn-light" data-dash-start>${Utils.icon('play')} Start</button>
      </div>` : `<div class="focus-form"><button class="btn btn-light" data-action="new-task">${Utils.icon('plus')} Create a task</button></div>`}
      <div class="focus-progress">
        ${UI.progressBar(target.percent, '', true, `Today's target · ${Utils.formatDuration(target.tracked)} of ${Utils.formatDuration(target.target)}`)}
      </div>
      <div class="focus-stats">
        <div><div class="focus-stat-label">Tracked today</div><div class="focus-stat-value">${Utils.formatDuration(todayStats.trackedMinutes)}</div></div>
        <div><div class="focus-stat-label">Remaining</div><div class="focus-stat-value">${Utils.formatDuration(target.remaining)}</div></div>
        <div><div class="focus-stat-label">Daily target</div><div class="focus-stat-value">${settings.dailyTargetHours}h</div></div>
      </div>
      <div class="focus-actions">
        <button class="btn btn-ghost" data-nav="tracker">${Utils.icon('timer')} Open time tracker</button>
        <button class="btn btn-ghost" data-action="quick-log">${Utils.icon('plus')} Log past work</button>
      </div>
    </section>`;
  }

  function activityCard(todayActivities) {
    const overlapIds = Analytics.getOverlapIds(todayActivities);
    const visible = todayActivities.slice(0, 6);
    return `<section class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">${Utils.icon('activity')} Today's activity</h2>
          <p class="card-subtitle">${todayActivities.length} entr${todayActivities.length === 1 ? 'y' : 'ies'} · ${Utils.formatDuration(Analytics.trackedMinutes(todayActivities))} logged</p>
        </div>
        <button class="btn btn-ghost btn-sm" data-nav="activities">View all ${Utils.icon('arrow-right')}</button>
      </div>
      <div class="card-body" style="padding-top:12px">
        ${todayActivities.length ? `<div class="quick-mini-list">
          ${visible.map((activity) => {
            const project = activity.projectId ? Store.getProject(activity.projectId) : null;
            return `<div class="quick-mini-row">
              <span class="quick-mini-time">${Utils.formatTime12(activity.startMinutes)}</span>
              <span class="quick-mini-dot" style="background:${project ? project.color : '#94a3b8'}"></span>
              <span class="quick-mini-title" title="${Utils.escapeAttr(activity.title)}">${Utils.escapeHtml(activity.title)}${overlapIds.has(activity.id) ? ' <span class="badge badge-warning" style="height:17px;font-size:8.5px">Overlap</span>' : ''}</span>
              <span class="quick-mini-dur">${Utils.formatDuration(activity.durationMinutes)}</span>
            </div>`;
          }).join('')}
        </div>` : UI.emptyState('clock', 'No time logged yet', 'Start the timer or log a past block to build today\'s timeline.', `<button class="btn btn-primary btn-sm" data-action="quick-log">${Utils.icon('plus')} Log activity</button>`, true)}
        ${todayActivities.length > visible.length ? `<div class="mt-12"><button class="mini-link" data-nav="activities">+ ${todayActivities.length - visible.length} more entries</button></div>` : ''}
      </div>
    </section>`;
  }

  function upcomingCard(upcoming) {
    return `<section class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">${Utils.icon('flag')} Upcoming &amp; overdue</h2>
          <p class="card-subtitle">Open tasks that need your attention next</p>
        </div>
        <button class="btn btn-ghost btn-sm" data-nav="tasks">All tasks ${Utils.icon('arrow-right')}</button>
      </div>
      <div class="card-body" style="padding-top:9px">
        ${upcoming.length ? upcoming.map((task) => {
          const due = Utils.dueLabel(task.assignedDate);
          return `<div class="upcoming-task">
            <button class="upcoming-check" data-toggle-task="${task.id}" aria-label="Mark ${Utils.escapeAttr(task.title)} complete" title="Mark complete"></button>
            <div class="upcoming-copy">
              <div class="upcoming-title" data-open-task="${task.id}">${Utils.escapeHtml(task.title)}</div>
              <div class="upcoming-meta">
                ${UI.priorityDot(task.priority)}
                <span>${Utils.escapeHtml(task.priority)}</span>
                <span>·</span>
                ${UI.projectChip(task.projectId)}
                <span class="${due.cls}">${Utils.escapeHtml(due.text)}</span>
              </div>
            </div>
            ${UI.statusBadge(task.status)}
          </div>`;
        }).join('') : UI.emptyState('check-circle', 'Nothing overdue', 'You are on top of your open work. New tasks will appear here.', `<button class="btn btn-secondary btn-sm" data-action="new-task">${Utils.icon('plus')} New task</button>`, true)}
      </div>
    </section>`;
  }

  function snapshotCard({ todayStats, weekStats, monthStats, streak, bestDay }) {
    const weekAvg = monthStats.workingDays ? Math.round(monthStats.trackedMinutes / monthStats.workingDays) : 0;
    return `<section class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">${Utils.icon('layers')} At a glance</h2>
          <p class="card-subtitle">Your daily, weekly and monthly totals</p>
        </div>
        <button class="btn btn-ghost btn-sm" data-nav="monthly">Monthly ${Utils.icon('arrow-right')}</button>
      </div>
      <div class="card-body" style="padding-top:14px">
        <div class="snapshot-grid">
          <div class="snapshot-col">
            <div class="snapshot-label">Today <span>${todayStats.productivity}%</span></div>
            <div class="snapshot-value">${Utils.formatHours(todayStats.trackedMinutes)}<span style="font-size:11px;color:var(--muted);font-weight:600">h</span></div>
            <div class="snapshot-sub">${Utils.formatDuration(todayStats.trackedMinutes)} working</div>
            <div class="snapshot-mini">${Utils.icon('check-circle')} <strong>${todayStats.tasks.completed}</strong> completed</div>
          </div>
          <div class="snapshot-col">
            <div class="snapshot-label">This week <span>${weekStats.productivity}%</span></div>
            <div class="snapshot-value">${Utils.formatHours(weekStats.trackedMinutes)}<span style="font-size:11px;color:var(--muted);font-weight:600">h</span></div>
            <div class="snapshot-sub">${Utils.formatDuration(weekStats.productiveMinutes)} productive</div>
            <div class="snapshot-mini">${Utils.icon('check-circle')} <strong>${weekStats.tasks.completed}</strong> completed</div>
          </div>
          <div class="snapshot-col">
            <div class="snapshot-label">This month <span>${monthStats.productivity}%</span></div>
            <div class="snapshot-value">${Utils.formatHours(monthStats.trackedMinutes)}<span style="font-size:11px;color:var(--muted);font-weight:600">h</span></div>
            <div class="snapshot-sub">${Utils.formatDuration(monthStats.trackedMinutes)} working</div>
            <div class="snapshot-mini">${Utils.icon('check-circle')} <strong>${monthStats.tasks.completed}</strong> completed</div>
          </div>
        </div>
        <div class="productivity-insight mt-12">
          <span class="insight-icon">${Utils.icon('sparkles')}</span>
          <div>
            <strong>${Analytics.getProductivityLabel(weekStats.productivity)}</strong>
            <p>${weekStats.trackedMinutes ? `${weekStats.productivity}% of this week's tracked time is linked to tasks. ${monthStats.trackedMinutes ? `Monthly average is ${monthStats.productivity}%.` : ''}` : 'Log or track time to see your focus pattern here.'}</p>
          </div>
        </div>
        <div class="dash-goal-row">
          <div class="dash-goal"><div class="goal-label">Active streak</div><div class="goal-value">${streak} day${streak === 1 ? '' : 's'}</div></div>
          <div class="dash-goal"><div class="goal-label">Avg day</div><div class="goal-value">${Utils.formatDuration(weekAvg)}</div></div>
          <div class="dash-goal"><div class="goal-label">Best day</div><div class="goal-value">${bestDay ? Utils.formatDate(bestDay.key, 'short') : '—'}</div></div>
        </div>
      </div>
    </section>`;
  }

  function projectMixCard(projects, week) {
    const visible = projects.slice(0, 5);
    return `<section class="card chart-card">
      <div class="card-header chart-head">
        <div>
          <h2 class="card-title">${Utils.icon('folder')} This week's project mix</h2>
          <p class="card-subtitle">Where your tracked hours went</p>
        </div>
        <button class="btn btn-ghost btn-sm" data-nav="projects">Projects ${Utils.icon('arrow-right')}</button>
      </div>
      <div class="chart-body" style="padding-top:12px">
        ${projects.length ? `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
          <div style="position:relative;height:168px;width:168px;flex:none">
            <canvas id="dashProjectChart" aria-label="Project time distribution"></canvas>
            <div class="donut-center"><strong>${Utils.formatHours(week.stats.trackedMinutes)}h</strong><span>this week</span></div>
          </div>
          <div class="distribution-list" style="flex:1;min-width:170px">
            ${visible.map((project) => `<div class="distribution-row">
              <div class="distribution-top">
                <span class="name"><span class="dot" style="background:${project.color}"></span>${Utils.escapeHtml(project.name)}</span>
                <span class="val">${Utils.formatDuration(project.minutes)}</span>
                <span class="pct">${project.percent}%</span>
              </div>
              <div class="distribution-bar"><span style="width:${project.percent}%;background:${project.color}"></span></div>
            </div>`).join('')}
          </div>
        </div>` : UI.emptyState('pie-chart', 'No project time this week', 'Track or log work against a task to see your project distribution.', '', true)}
      </div>
    </section>`;
  }

  function render(root) {
    const settings = Store.getSettings();
    const today = Utils.todayKey();
    const counts = Analytics.getTaskCounts();
    const todayStats = Analytics.getRangeStats(today, today);
    const week = Analytics.getWeekSummary(today);
    const month = Analytics.getMonthSummary(today);
    const target = Analytics.getDailyTargetProgress(today);
    const timer = Store.getTimer();
    const timerTask = timer ? Store.getTask(timer.taskId) : null;
    const timerElapsed = timer ? Store.getTimerElapsedSeconds(timer) : 0;
    const todayActivities = Analytics.getTodayActivities();
    const upcoming = Analytics.getUpcomingTasks(6);
    const openTasks = Store.getTasks().filter((t) => t.status !== 'Completed').sort(Utils.sortTasks);
    const streak = Analytics.getActiveStreak();
    const bestDay = Analytics.getMostProductiveDay(week.from, week.to);
    const statusBreakdown = Analytics.getStatusBreakdown();
    const projectMix = Analytics.getProjectBreakdown(week.from, week.to);
    const overdue = counts.overdue;

    const greeting = Utils.greeting(settings.name);
    const subtitle = `You've logged ${Utils.formatDuration(todayStats.trackedMinutes)} today across ${todayStats.activityCount} entr${todayStats.activityCount === 1 ? 'y' : 'ies'}. ${counts.open} task${counts.open === 1 ? '' : 's'} still open${overdue ? ` — ${overdue} overdue` : ''}.`;

    const actions = `
      <button class="btn btn-secondary" data-open-export="daily">${Utils.icon('download')} Export</button>
      <button class="btn btn-secondary" data-action="quick-log">${Utils.icon('clock')} Log activity</button>
      <button class="btn btn-primary" data-action="new-task">${Utils.icon('plus')} New task</button>`;

    const stats = `<div class="stat-grid">
      ${PageHelpers.statCard({
        label: 'Total tasks', value: counts.total, iconName: 'tasks', tone: 'primary',
        foot: `<span class="muted">${counts.open} open · ${overdue} overdue</span>`, progress: counts.completionRate
      })}
      ${PageHelpers.statCard({
        label: 'Completed', value: counts.completed, iconName: 'check-circle', tone: 'success',
        foot: `${Utils.icon('trending-up')} ${counts.completionRate}% completion rate`, footClass: 'positive', progress: counts.completionRate
      })}
      ${PageHelpers.statCard({
        label: 'In progress', value: counts.inProgress, iconName: 'zap', tone: 'info',
        foot: `<span class="muted">${counts.notStarted} not started</span>`
      })}
      ${PageHelpers.statCard({
        label: 'Pending', value: counts.pending, iconName: 'clock', tone: 'warning',
        foot: `<span class="muted">${counts.onHold} on hold · ${counts.notStarted} queued</span>`
      })}
      ${PageHelpers.statCard({
        label: 'Working hours today', value: Utils.formatHours(todayStats.trackedMinutes), unit: 'h', iconName: 'timer', tone: 'violet',
        foot: `<span class="muted">${todayStats.activityCount} activities logged</span>`, progress: target.percent
      })}
      ${PageHelpers.statCard({
        label: 'Productive hours today', value: Utils.formatHours(todayStats.productiveMinutes), unit: 'h', iconName: 'target', tone: 'success',
        foot: `<span class="muted">${todayStats.productivity}% of tracked time</span>`, progress: todayStats.productivity
      })}
    </div>`;

    const weeklyChart = PageHelpers.chartCard({
      title: "This week's hours",
      subtitle: `${week.label} · daily target ${settings.dailyTargetHours}h`,
      iconName: 'bar-chart',
      actions: `<button class="btn btn-ghost btn-sm" data-nav="weekly">Weekly report ${Utils.icon('arrow-right')}</button>`,
      body: `<div class="chart-box"><canvas id="dashHoursChart" aria-label="Working and productive hours by day"></canvas></div>`,
      legend: PageHelpers.legend([
        { color: '#4f46e5', label: 'Working hours' },
        { color: 'rgba(16,185,129,.75)', label: 'Productive hours' },
        { color: '#cbd5e1', label: 'Daily target' }
      ])
    });

    const statusCard = PageHelpers.chartCard({
      title: 'Task status',
      subtitle: `${counts.total} tasks across the workspace`,
      iconName: 'pie-chart',
      actions: `<button class="btn btn-ghost btn-sm" data-nav="tasks">Tasks ${Utils.icon('arrow-right')}</button>`,
      body: `<div class="chart-box sm" style="position:relative">
        <canvas id="dashStatusChart" aria-label="Task status distribution"></canvas>
        <div class="donut-center"><strong>${counts.total}</strong><span>total tasks</span></div>
      </div>`,
      legend: PageHelpers.legend(statusBreakdown.map((item) => ({ color: item.color, label: item.label, value: item.value })))
    });

    const productivityCard = PageHelpers.chartCard({
      title: 'Productivity trend',
      subtitle: 'Share of tracked time linked to tasks',
      iconName: 'trending-up',
      actions: `<button class="btn btn-ghost btn-sm" data-nav="weekly">Details ${Utils.icon('arrow-right')}</button>`,
      body: `<div class="chart-box sm"><canvas id="dashProductivityChart" aria-label="Daily productivity trend"></canvas></div>`,
      legend: PageHelpers.legend([{ color: '#4f46e5', label: 'Productivity %' }])
    });

    root.innerHTML = `
      ${PageHelpers.pageHeader({ eyebrow: Utils.todayLong(), title: greeting, subtitle, actions })}
      ${stats}
      <div class="page-section dashboard-grid">
        <div class="dash-col">
          ${weeklyChart}
          ${activityCard(todayActivities)}
          ${upcomingCard(upcoming)}
        </div>
        <div class="dash-col">
          ${focusCard({ timer, timerTask, timerElapsed, target, openTasks, todayStats })}
          ${statusCard}
          ${snapshotCard({
            todayStats,
            weekStats: week.stats, monthStats: month.stats, streak, bestDay
          })}
        </div>
      </div>
      <div class="page-section dashboard-grid equal">
        ${productivityCard}
        ${projectMixCard(projectMix, week)}
      </div>
      <div class="page-section">
        <div class="callout">
          ${Utils.icon('sparkles')}
          <div><strong>Small habit, compounding result.</strong> Link each tracked block to a task, keep estimates honest, and review the weekly report every Friday. ${counts.open ? `${counts.open} open task${counts.open === 1 ? ' is' : 's are'} waiting for a time slot.` : 'Your queue is clear — plan the next meaningful outcome.'}</div>
          <button class="mini-link" data-open-help>How metrics work</button>
        </div>
      </div>`;

    requestAnimationFrame(() => {
      Charts.hoursBar('dashHoursChart', week.daily);
      Charts.statusDonut('dashStatusChart', statusBreakdown);
      Charts.productivityLine('dashProductivityChart', week.daily);
      Charts.projectDonut('dashProjectChart', projectMix);
    });

    const startBtn = root.querySelector('[data-dash-start]');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const select = root.querySelector('#dashFocusTask');
        const taskId = select ? select.value : '';
        if (!taskId) {
          UI.toast('Create a task before starting a focus session.', 'warning');
          return;
        }
        try {
          const task = Store.getTask(taskId);
          Store.startTimer(taskId, 'Focus session started from the dashboard.');
          UI.toast(`Tracking ${task ? task.title : 'your task'}.`, 'success', 'Focus session started');
        } catch (err) {
          PageHelpers.toastError(err, 'Could not start the timer');
        }
      });
    }
    if (!state.focusTaskId && openTasks[0]) state.focusTaskId = openTasks[0].id;
  }

  return { render };
})();

window.DashboardPage = DashboardPage;
