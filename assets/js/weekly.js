/* ============================================================
   FlowTrack — Weekly Report
   A complete period review: time, tasks, projects and trends.
   ============================================================ */

const WeeklyPage = (() => {
  const state = { anchor: Utils.todayKey(), custom: false, from: '', to: '' };

  function customSummary(from, to) {
    const length = Math.max(1, Utils.daysBetween(from, to) + 1);
    const prevTo = Utils.addDays(from, -1);
    const prevFrom = Utils.addDays(prevTo, -(length - 1));
    return {
      from, to, prevFrom, prevTo,
      label: Utils.formatRange(from, to),
      stats: Analytics.getRangeStats(from, to),
      previous: Analytics.getRangeStats(prevFrom, prevTo),
      daily: Analytics.dailySeries(from, to),
      projects: Analytics.getProjectBreakdown(from, to),
      taskTime: Analytics.getTaskTimeBreakdown(from, to)
    };
  }

  function summary() {
    if (state.custom && state.from && state.to) return customSummary(state.from, state.to);
    return Analytics.getWeekSummary(state.anchor);
  }

  function pctChange(current, previous) {
    if (!previous) return current ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(0));
  }

  function comparisonFoot(value, suffix = '%', note = 'vs previous period') {
    return `${UI.comparisonDelta(value, suffix)} <span class="muted">${note}</span>`;
  }

  function statsMarkup(summaryData) {
    const { stats, previous } = summaryData;
    const productiveChange = pctChange(stats.productiveMinutes, previous.productiveMinutes);
    return `<div class="stat-grid">
      ${PageHelpers.statCard({
        label: 'Working hours', value: Utils.formatHours(stats.trackedMinutes), unit: 'h', iconName: 'clock', tone: 'primary',
        foot: comparisonFoot(pctChange(stats.trackedMinutes, previous.trackedMinutes)),
        progress: Utils.pct(stats.trackedMinutes, Math.max(stats.targetMinutes * stats.workingDays, 1))
      })}
      ${PageHelpers.statCard({
        label: 'Productive hours', value: Utils.formatHours(stats.productiveMinutes), unit: 'h', iconName: 'target', tone: 'success',
        foot: comparisonFoot(productiveChange),
        progress: stats.productivity
      })}
      ${PageHelpers.statCard({
        label: 'Productivity', value: stats.productivity, unit: '%', iconName: 'trending-up', tone: 'violet',
        foot: `${UI.comparisonDelta(previous ? Number((stats.productivity - previous.productivity).toFixed(0)) : 0, ' pts')} <span class="muted">vs previous</span>`,
        progress: stats.productivity
      })}
      ${PageHelpers.statCard({
        label: 'Tasks completed', value: stats.tasks.completed, iconName: 'check-circle', tone: 'success',
        foot: comparisonFoot(pctChange(stats.tasks.completed, previous.tasks.completed)),
        progress: stats.tasks.completionRate
      })}
      ${PageHelpers.statCard({
        label: 'Completion rate', value: stats.tasks.completionRate, unit: '%', iconName: 'layers', tone: 'info',
        foot: `${UI.comparisonDelta(Number((stats.tasks.completionRate - previous.tasks.completionRate).toFixed(0)), ' pts')} <span class="muted">vs previous</span>`,
        progress: stats.tasks.completionRate
      })}
      ${PageHelpers.statCard({
        label: 'Avg daily hours', value: Utils.formatHours(stats.averageDailyMinutes), unit: 'h', iconName: 'bar-chart', tone: 'warning',
        foot: `<span class="muted">${stats.workingDays} working day${stats.workingDays === 1 ? '' : 's'} in range</span>`,
        progress: Utils.pct(stats.averageDailyMinutes, stats.targetMinutes)
      })}
    </div>`;
  }

  function distribution(projects) {
    const total = projects.reduce((sum, p) => sum + p.minutes, 0);
    return `<div class="chart-box sm" style="position:relative">
      <canvas id="weeklyProjectChart" aria-label="Project time distribution"></canvas>
      <div class="donut-center"><strong>${Utils.formatHours(total)}h</strong><span>tracked</span></div>
    </div>
    <div class="distribution-list mt-12">
      ${projects.slice(0, 5).map((project) => `<div class="distribution-row">
        <div class="distribution-top">
          <span class="name"><span class="dot" style="background:${project.color}"></span>${Utils.escapeHtml(project.name)}</span>
          <span class="val">${Utils.formatDuration(project.minutes)}</span>
          <span class="pct">${project.percent}%</span>
        </div>
        <div class="distribution-bar"><span style="width:${project.percent}%;background:${project.color}"></span></div>
      </div>`).join('') || '<p class="muted tiny">No tracked project time in this period.</p>'}
    </div>`;
  }

  function dailyTable(summaryData) {
    const best = Analytics.getMostProductiveDay(summaryData.from, summaryData.to);
    const total = summaryData.daily.reduce((acc, day) => ({
      tracked: acc.tracked + day.trackedMinutes,
      productive: acc.productive + day.productiveMinutes,
      completed: acc.completed + day.completedCount,
      activities: acc.activities + day.activityCount
    }), { tracked: 0, productive: 0, completed: 0, activities: 0 });
    return `<div class="card report-table-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('calendar')} Daily performance</h2><p class="card-subtitle">${summaryData.daily.length} days in this report</p></div>
        <button class="btn btn-ghost btn-sm" data-week-export>${Utils.icon('download')} Export</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Day</th><th>Working</th><th>Productive</th><th>Productivity</th><th>Tasks done</th><th>Entries</th></tr></thead>
          <tbody>
            ${summaryData.daily.map((day) => `<tr class="${best && best.key === day.key ? 'table-highlight-row' : ''}">
              <td><strong>${Utils.escapeHtml(Utils.formatDate(day.key, 'medium'))}</strong>${best && best.key === day.key ? ' <span class="badge badge-purple" style="height:17px;font-size:8.5px">Best</span>' : ''}</td>
              <td class="num">${day.trackedMinutes ? Utils.formatDuration(day.trackedMinutes) : '<span class="muted">—</span>'}</td>
              <td class="num">${day.productiveMinutes ? Utils.formatDuration(day.productiveMinutes) : '<span class="muted">—</span>'}</td>
              <td class="num">${day.trackedMinutes ? `${day.productivity}%` : '<span class="muted">—</span>'}</td>
              <td class="num">${day.completedCount || '<span class="muted">0</span>'}</td>
              <td class="num">${day.activityCount || '<span class="muted">0</span>'}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr class="table-highlight-row">
            <td><strong>Total</strong></td>
            <td><strong>${Utils.formatDuration(total.tracked)}</strong></td>
            <td><strong>${Utils.formatDuration(total.productive)}</strong></td>
            <td><strong>${Utils.pct(total.productive, total.tracked)}%</strong></td>
            <td><strong>${total.completed}</strong></td>
            <td><strong>${total.activities}</strong></td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
  }

  function bestDayCard(summaryData) {
    const best = Analytics.getMostProductiveDay(summaryData.from, summaryData.to);
    return `<div class="best-day-card">
      <div class="label">${Utils.icon('zap')} Most productive day</div>
      ${best ? `<div class="day">${Utils.formatDate(best.key, 'medium-year')}</div>
        <div class="desc">${Utils.formatDuration(best.productiveMinutes)} productive of ${Utils.formatDuration(best.trackedMinutes)} tracked</div>
        <div class="row">
          <div><div class="l">Productivity</div><div class="v">${best.productivity}%</div></div>
          <div><div class="l">Tasks done</div><div class="v">${best.completedCount}</div></div>
          <div><div class="l">Entries</div><div class="v">${best.activityCount}</div></div>
        </div>` : `<div class="day">No data yet</div><div class="desc">Track or log work in this period to reveal your best day.</div>`}
    </div>`;
  }

  function insights(summaryData) {
    const { stats, previous } = summaryData;
    const longest = Analytics.getLongestSession(summaryData.from, summaryData.to);
    const avgSession = Analytics.getAverageSession(summaryData.from, summaryData.to);
    const topTask = summaryData.taskTime[0];
    const rows = [
      { icon: 'timer', label: 'Longest session', value: longest ? Utils.clampText(longest.title, 34) : '—', aside: longest ? Utils.formatDuration(longest.durationMinutes) : '' },
      { icon: 'activity', label: 'Average session', value: `${avgSession} minutes`, aside: `${stats.activityCount} entries` },
      { icon: 'calendar', label: 'Active days', value: `${stats.activeDays} of ${stats.workingDays}`, aside: `${stats.tasks.assigned} tasks assigned` },
      { icon: 'flag', label: 'Top tracked task', value: topTask ? Utils.clampText(topTask.title, 34) : '—', aside: topTask ? Utils.formatDuration(topTask.minutes) : '' },
      { icon: 'alert-triangle', label: 'Overdue open tasks', value: `${stats.overdueTasks.length} task${stats.overdueTasks.length === 1 ? '' : 's'}`, aside: stats.overdueTasks.length ? 'Needs attention' : 'All clear' },
      { icon: 'trending-up', label: 'Productive trend', value: `${stats.productivity}% vs ${previous.productivity}%`, aside: `${stats.productivity >= previous.productivity ? '+' : ''}${stats.productivity - previous.productivity} pts` }
    ];
    return `<div class="card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('sparkles')} Period insights</h2><p class="card-subtitle">Signals behind the numbers</p></div>
      </div>
      <div class="card-body" style="padding-top:12px">
        <div class="best-day-card mb-16">
          <div class="label">${Utils.icon('zap')} Most productive day</div>
          ${Analytics.getMostProductiveDay(summaryData.from, summaryData.to) ? (() => {
            const best = Analytics.getMostProductiveDay(summaryData.from, summaryData.to);
            return `<div class="day">${Utils.formatDate(best.key, 'medium-year')}</div>
              <div class="desc">${Utils.formatDuration(best.productiveMinutes)} productive · ${best.productivity}% focused</div>
              <div class="row"><div><div class="l">Tasks done</div><div class="v">${best.completedCount}</div></div><div><div class="l">Entries</div><div class="v">${best.activityCount}</div></div></div>`;
          })() : `<div class="day">No data yet</div><div class="desc">Log work to reveal your best day.</div>`}
        </div>
        <div class="insight-list">
          ${rows.map((row) => `<div class="insight-row">
            <span class="insight-symbol">${Utils.icon(row.icon)}</span>
            <div class="copy"><div class="l">${row.label}</div><div class="v">${Utils.escapeHtml(row.value)}</div></div>
            <span class="aside">${Utils.escapeHtml(row.aside)}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  }

  function topTasks(summaryData) {
    const entries = summaryData.taskTime.slice(0, 8);
    return `<div class="card report-table-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('tasks')} Time by task</h2><p class="card-subtitle">Where focused effort landed</p></div>
        <button class="btn btn-ghost btn-sm" data-week-export>${Utils.icon('download')} Export</button>
      </div>
      ${entries.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Task</th><th>Project</th><th>Sessions</th><th>Tracked</th><th>Share</th></tr></thead>
        <tbody>${entries.map((entry) => `<tr>
          <td><span class="title-line"><button class="task-title-link" data-open-task="${entry.taskId || ''}" ${entry.taskId ? '' : 'disabled'} style="border:0;background:none;padding:0;font:inherit;font-weight:600;color:var(--ink-2);cursor:${entry.taskId ? 'pointer' : 'default'};text-align:left">${Utils.escapeHtml(entry.title)}</button></span></td>
          <td class="muted-cell">${Utils.escapeHtml(Analytics.getProjectName(entry.projectId))}</td>
          <td class="num">${entry.sessions}</td>
          <td class="num">${Utils.formatDuration(entry.minutes)}</td>
          <td class="num">${entry.percent}%</td>
        </tr>`).join('')}</tbody>
      </table></div>` : UI.emptyState('tasks', 'No task-linked time', 'Link activities to tasks to unlock task-level reporting.', '', true)}
    </div>`;
  }

  function completedTasksCard(summaryData) {
    const completed = summaryData.stats.completedTasks.slice(0, 6);
    return `<div class="card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('check-circle')} Completed this period</h2><p class="card-subtitle">${summaryData.stats.tasks.completed} task${summaryData.stats.tasks.completed === 1 ? '' : 's'} closed</p></div>
        <button class="btn btn-ghost btn-sm" data-nav="tasks">All tasks ${Utils.icon('arrow-right')}</button>
      </div>
      <div class="card-body" style="padding-top:10px">
        ${completed.length ? `<div class="list">
          ${completed.map((task) => `<div class="list-row">
            <span class="list-icon" style="background:var(--success-bg);color:var(--success)">${Utils.icon('check')}</span>
            <div class="list-copy">
              <div class="list-title"><span>${Utils.escapeHtml(task.title)}</span></div>
              <div class="list-meta">${UI.projectChip(task.projectId)} <span>${Utils.escapeHtml(Utils.formatTimestamp(task.completedAt))}</span></div>
            </div>
            ${UI.priorityBadge(task.priority)}
          </div>`).join('')}
        </div>` : UI.emptyState('check-circle', 'No completed tasks', 'Tasks completed in this period will be listed here.', '', true)}
      </div>
    </div>`;
  }

  function toolbar(summaryData) {
    return `<div class="report-toolbar">
      ${state.custom ? `<div class="period-nav"><div class="period-label"><strong>${Utils.escapeHtml(summaryData.label)}</strong><span>Custom range · ${summaryData.daily.length} days</span></div></div>` : `
        <div class="period-nav">
          <button class="icon-btn sm bordered" data-week-nav="-1" aria-label="Previous week">${Utils.icon('chevron-left')}</button>
          <div class="period-label"><strong>${Utils.escapeHtml(summaryData.label)}</strong><span>${summaryData.stats.workingDays} working days · ${summaryData.stats.tasks.assigned} tasks assigned</span></div>
          <button class="icon-btn sm bordered" data-week-nav="1" aria-label="Next week">${Utils.icon('chevron-right')}</button>
        </div>`}
      <button class="btn btn-secondary btn-sm" data-week-today>This week</button>
      <div class="spacer"></div>
      <button class="btn ${state.custom ? 'btn-light' : 'btn-secondary'} btn-sm" data-week-custom>${Utils.icon('calendar')} ${state.custom ? 'Ranges' : 'Custom range'}</button>
      <button class="btn btn-primary btn-sm" data-week-export>${Utils.icon('download')} Download</button>
      ${state.custom ? `<div class="custom-range-panel">
        <div class="field"><label class="field-label" for="weekFrom">From</label><input class="input" type="date" id="weekFrom" value="${summaryData.from}" max="${Utils.todayKey()}" /></div>
        <div class="field"><label class="field-label" for="weekTo">To</label><input class="input" type="date" id="weekTo" value="${summaryData.to}" max="${Utils.todayKey()}" /></div>
        <button class="btn btn-secondary btn-sm" data-week-today>Reset to this week</button>
      </div>` : ''}
    </div>`;
  }

  function bind(root, summaryData) {
    root.querySelectorAll('[data-week-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.custom = false;
        state.anchor = Utils.addDays(state.anchor, Number(btn.dataset.weekNav) * 7);
        App.refresh();
      });
    });
    root.querySelectorAll('[data-week-today]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.custom = false;
        state.anchor = Utils.todayKey();
        state.from = '';
        state.to = '';
        App.refresh();
      });
    });
    root.querySelectorAll('[data-week-custom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.custom = !state.custom;
        if (state.custom && (!state.from || !state.to)) {
          state.from = summaryData.from;
          state.to = summaryData.to;
        }
        App.refresh();
      });
    });
    root.querySelectorAll('[data-week-export]').forEach((btn) => {
      btn.addEventListener('click', () => Exports.open({ type: 'weekly', from: summaryData.from, to: summaryData.to }));
    });
    const from = root.querySelector('#weekFrom');
    const to = root.querySelector('#weekTo');
    [from, to].forEach((input) => {
      if (!input) return;
      input.addEventListener('change', () => {
        const nextFrom = from.value;
        const nextTo = to.value;
        if (!nextFrom || !nextTo) return;
        if (nextFrom > nextTo) { UI.toast('The end date must be on or after the start date.', 'warning'); return; }
        state.from = nextFrom;
        state.to = nextTo;
        App.refresh();
      });
    });
  }

  function render(root) {
    const data = summary();
    const empty = data.stats.trackedMinutes === 0 && data.stats.tasks.assigned === 0 && data.stats.tasks.completed === 0;

    const actions = `
      <button class="btn btn-secondary" data-nav="monthly">${Utils.icon('pie-chart')} Monthly view</button>
      <button class="btn btn-primary" data-week-export>${Utils.icon('download')} Export report</button>`;

    root.innerHTML = `
      ${PageHelpers.pageHeader({
        eyebrow: 'Insights',
        title: 'Weekly Report',
        subtitle: `A clear read on output, focus and where the week went. ${data.stats.activeDays} active day${data.stats.activeDays === 1 ? '' : 's'}, ${Utils.formatDuration(data.stats.trackedMinutes)} tracked.`,
        actions
      })}
      ${toolbar(data)}
      ${empty ? `<div class="alert alert-info mb-16">${Utils.icon('info')}<div><strong>No data in this period.</strong> Choose another week, log an activity, or create a task to start building the report.</div></div>` : ''}
      ${statsMarkup(data)}
      <div class="report-chart-grid">
        ${PageHelpers.chartCard({
          title: 'Daily output & focus',
          subtitle: 'Working hours, productive hours and tasks completed',
          iconName: 'bar-chart',
          body: `<div class="chart-box"><canvas id="weeklyPerfChart" aria-label="Daily performance chart"></canvas></div>`,
          legend: PageHelpers.legend([
            { color: '#4f46e5', label: 'Working hours' },
            { color: 'rgba(16,185,129,.75)', label: 'Productive hours' },
            { color: '#f59e0b', label: 'Tasks completed' }
          ])
        })}
        ${PageHelpers.chartCard({
          title: 'Project distribution',
          subtitle: 'Share of tracked time',
          iconName: 'pie-chart',
          actions: `<button class="btn btn-ghost btn-sm" data-nav="projects">Projects ${Utils.icon('arrow-right')}</button>`,
          body: distribution(data.projects)
        })}
      </div>
      <div class="report-bottom-grid">
        ${dailyTable(data)}
        ${insights(data)}
      </div>
      <div class="page-section grid grid-2">
        ${topTasks(data)}
        ${completedTasksCard(data)}
      </div>
      <div class="page-section">
        <div class="callout">
          ${Utils.icon('target')}
          <div><strong>Weekly target:</strong> ${data.stats.workingDays} working days at ${Utils.formatDuration(data.stats.targetMinutes)} per day is ${Utils.formatDuration(data.stats.workingDays * data.stats.targetMinutes)}. You tracked ${Utils.formatDuration(data.stats.trackedMinutes)} (${Utils.pct(data.stats.trackedMinutes, data.stats.workingDays * data.stats.targetMinutes)}%). ${data.stats.overdueTasks.length ? `${data.stats.overdueTasks.length} open tasks are overdue.` : 'No overdue tasks right now.'}</div>
          <button class="mini-link" data-open-help>How metrics work</button>
        </div>
      </div>`;

    requestAnimationFrame(() => {
      Charts.dailyPerformance('weeklyPerfChart', data.daily);
      Charts.projectDonut('weeklyProjectChart', data.projects);
    });

    bind(root, data);
  }

  return { render, state };
})();

window.WeeklyPage = WeeklyPage;
