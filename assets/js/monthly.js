/* ============================================================
   FlowTrack — Monthly Report
   A full-month review: trends, weekly rhythm, projects and focus.
   ============================================================ */

const MonthlyPage = (() => {
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
      weekly: Analytics.getWeekBuckets(from, to),
      projects: Analytics.getProjectBreakdown(from, to),
      taskTime: Analytics.getTaskTimeBreakdown(from, to)
    };
  }

  function summary() {
    if (state.custom && state.from && state.to) return customSummary(state.from, state.to);
    return Analytics.getMonthSummary(state.anchor);
  }

  function pctChange(current, previous) {
    if (!previous) return current ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(0));
  }

  function comparisonFoot(value, suffix = '%', note = 'vs previous period') {
    return `${UI.comparisonDelta(value, suffix)} <span class="muted">${note}</span>`;
  }

  function statsMarkup(data) {
    const { stats, previous } = data;
    return `<div class="stat-grid">
      ${PageHelpers.statCard({
        label: 'Working hours', value: Utils.formatHours(stats.trackedMinutes), unit: 'h', iconName: 'clock', tone: 'primary',
        foot: comparisonFoot(pctChange(stats.trackedMinutes, previous.trackedMinutes)),
        progress: Utils.pct(stats.trackedMinutes, Math.max(stats.targetMinutes * stats.workingDays, 1))
      })}
      ${PageHelpers.statCard({
        label: 'Productive hours', value: Utils.formatHours(stats.productiveMinutes), unit: 'h', iconName: 'target', tone: 'success',
        foot: comparisonFoot(pctChange(stats.productiveMinutes, previous.productiveMinutes)),
        progress: stats.productivity
      })}
      ${PageHelpers.statCard({
        label: 'Productivity', value: stats.productivity, unit: '%', iconName: 'trending-up', tone: 'violet',
        foot: `${UI.comparisonDelta(Number((stats.productivity - previous.productivity).toFixed(0)), ' pts')} <span class="muted">vs previous</span>`,
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
    const total = projects.reduce((sum, project) => sum + project.minutes, 0);
    return `<div class="chart-box sm" style="position:relative">
      <canvas id="monthlyProjectChart" aria-label="Monthly project time distribution"></canvas>
      <div class="donut-center"><strong>${Utils.formatHours(total)}h</strong><span>tracked</span></div>
    </div>
    <div class="distribution-list mt-12">
      ${projects.slice(0, 6).map((project) => `<div class="distribution-row">
        <div class="distribution-top">
          <span class="name"><span class="dot" style="background:${project.color}"></span>${Utils.escapeHtml(project.name)}</span>
          <span class="val">${Utils.formatDuration(project.minutes)}</span>
          <span class="pct">${project.percent}%</span>
        </div>
        <div class="distribution-bar"><span style="width:${project.percent}%;background:${project.color}"></span></div>
      </div>`).join('') || '<p class="muted tiny">No tracked project time in this period.</p>'}
    </div>`;
  }

  function heatmap(data) {
    const settings = Store.getSettings();
    const startsOn = settings.weekStartsOn;
    const days = Utils.eachDay(data.from, data.to);
    const dayMap = new Map(data.daily.map((day) => [day.key, day]));
    const offset = (Utils.weekdayIndex(data.from) - startsOn + 7) % 7;
    const weekdayLabels = [];
    for (let index = 0; index < 7; index++) {
      weekdayLabels.push(Utils.WEEKDAYS_SHORT[(startsOn + index) % 7]);
    }
    const target = Math.max(1, settings.dailyTargetHours * 60);
    const levelFor = (tracked) => {
      if (!tracked) return '';
      const ratio = tracked / target;
      if (ratio >= 1) return 'l5';
      if (ratio >= 0.75) return 'l4';
      if (ratio >= 0.5) return 'l3';
      if (ratio >= 0.25) return 'l2';
      return 'l1';
    };
    const cells = [];
    for (let index = 0; index < offset; index++) cells.push('<span class="heatmap-cell blank" aria-hidden="true"></span>');
    days.forEach((key) => {
      const day = dayMap.get(key) || { trackedMinutes: 0, completedCount: 0, activityCount: 0, productivity: 0 };
      const level = levelFor(day.trackedMinutes);
      const title = `${Utils.formatDate(key, 'long')} · ${Utils.formatDuration(day.trackedMinutes)} tracked · ${day.completedCount} task${day.completedCount === 1 ? '' : 's'} completed`;
      cells.push(`<button type="button" class="heatmap-cell ${level} ${key === Utils.todayKey() ? 'today' : ''}" data-heatmap-day="${key}" title="${Utils.escapeAttr(title)}" aria-label="${Utils.escapeAttr(title)}">${day.trackedMinutes ? Utils.dayNumber(key) : ''}</button>`);
    });
    return `<div class="heatmap" role="grid" aria-label="Daily tracking heatmap">
      ${weekdayLabels.map((label) => `<span class="heatmap-weekday">${label}</span>`).join('')}
      ${cells.join('')}
    </div>
    <div class="heatmap-legend">
      <span>Less</span>
      <span class="sq" style="background:#f1f4fa"></span>
      <span class="sq" style="background:#e0e7ff"></span>
      <span class="sq" style="background:#c7d2fe"></span>
      <span class="sq" style="background:#a5b4fc"></span>
      <span class="sq" style="background:#818cf8"></span>
      <span class="sq" style="background:#4f46e5"></span>
      <span>More</span>
    </div>
    <p class="settings-note">${Utils.icon('info')} Shade reflects tracked hours against your ${settings.dailyTargetHours}h daily target. Select a day to open it in the calendar.</p>`;
  }

  function weeklyTable(data) {
    const total = data.weekly.reduce((acc, week) => ({
      tracked: acc.tracked + week.stats.trackedMinutes,
      productive: acc.productive + week.stats.productiveMinutes,
      completed: acc.completed + week.stats.tasks.completed,
      activities: acc.activities + week.stats.activityCount
    }), { tracked: 0, productive: 0, completed: 0, activities: 0 });
    const best = data.weekly.slice().sort((a, b) => b.stats.productiveMinutes - a.stats.productiveMinutes)[0];
    return `<div class="card report-table-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('calendar')} Weekly breakdown</h2><p class="card-subtitle">${data.weekly.length} week${data.weekly.length === 1 ? '' : 's'} in this report</p></div>
        <button class="btn btn-ghost btn-sm" data-month-export>${Utils.icon('download')} Export</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Week</th><th>Working</th><th>Productive</th><th>Productivity</th><th>Tasks done</th><th>Entries</th></tr></thead>
          <tbody>
            ${data.weekly.map((week) => `<tr class="${best && best.from === week.from ? 'table-highlight-row' : ''}">
              <td><strong>${week.label}</strong><span class="muted-cell" style="display:block;font-size:10px;margin-top:1px">${Utils.escapeHtml(week.range)}</span>${best && best.from === week.from ? ' <span class="badge badge-purple" style="height:17px;font-size:8.5px">Peak</span>' : ''}</td>
              <td class="num">${week.stats.trackedMinutes ? Utils.formatDuration(week.stats.trackedMinutes) : '<span class="muted">—</span>'}</td>
              <td class="num">${week.stats.productiveMinutes ? Utils.formatDuration(week.stats.productiveMinutes) : '<span class="muted">—</span>'}</td>
              <td class="num">${week.stats.trackedMinutes ? `${week.stats.productivity}%` : '<span class="muted">—</span>'}</td>
              <td class="num">${week.stats.tasks.completed || '<span class="muted">0</span>'}</td>
              <td class="num">${week.stats.activityCount || '<span class="muted">0</span>'}</td>
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

  function insights(data) {
    const bestDay = Analytics.getMostProductiveDay(data.from, data.to);
    const bestWeek = data.weekly.slice().sort((a, b) => b.stats.productiveMinutes - a.stats.productiveMinutes)[0];
    const longest = Analytics.getLongestSession(data.from, data.to);
    const avgSession = Analytics.getAverageSession(data.from, data.to);
    const topProject = data.projects[0];
    const change = data.previous.productivity ? data.stats.productivity - data.previous.productivity : data.stats.productivity;
    const rows = [
      { icon: 'timer', label: 'Longest session', value: longest ? Utils.clampText(longest.title, 34) : '—', aside: longest ? Utils.formatDuration(longest.durationMinutes) : '' },
      { icon: 'activity', label: 'Average session', value: `${avgSession} minutes`, aside: `${data.stats.activityCount} entries` },
      { icon: 'calendar', label: 'Active days', value: `${data.stats.activeDays} of ${data.daily.length}`, aside: `${data.stats.tasks.assigned} tasks assigned` },
      { icon: 'bar-chart', label: 'Peak week', value: bestWeek ? `${bestWeek.label} · ${bestWeek.stats.productivity}%` : '—', aside: bestWeek ? Utils.formatDuration(bestWeek.stats.productiveMinutes) : '' },
      { icon: 'folder', label: 'Top project', value: topProject ? Utils.clampText(topProject.name, 32) : '—', aside: topProject ? Utils.formatDuration(topProject.minutes) : '' },
      { icon: 'alert-triangle', label: 'Overdue open tasks', value: `${data.stats.overdueTasks.length} task${data.stats.overdueTasks.length === 1 ? '' : 's'}`, aside: data.stats.overdueTasks.length ? 'Needs attention' : 'All clear' },
      { icon: 'trending-up', label: 'Productive trend', value: `${data.stats.productivity}% vs ${data.previous.productivity}%`, aside: `${change >= 0 ? '+' : ''}${change} pts` }
    ];
    return `<div class="card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('sparkles')} Monthly insights</h2><p class="card-subtitle">Signals behind the numbers</p></div>
      </div>
      <div class="card-body" style="padding-top:12px">
        <div class="best-day-card mb-16">
          <div class="label">${Utils.icon('zap')} Most productive day</div>
          ${bestDay ? `<div class="day">${Utils.formatDate(bestDay.key, 'day')} ${Utils.formatDate(bestDay.key, 'month-short-year')}</div>
            <div class="desc">${Utils.formatDuration(bestDay.productiveMinutes)} productive · ${bestDay.productivity}% focused</div>
            <div class="row">
              <div><div class="l">Tasks done</div><div class="v">${bestDay.completedCount}</div></div>
              <div><div class="l">Entries</div><div class="v">${bestDay.activityCount}</div></div>
            </div>` : `<div class="day">No data yet</div><div class="desc">Log work in this period to reveal your best day.</div>`}
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

  function topTasks(data) {
    const entries = data.taskTime.slice(0, 8);
    return `<div class="card report-table-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('tasks')} Time by task</h2><p class="card-subtitle">Where the month's focused effort landed</p></div>
        <button class="btn btn-ghost btn-sm" data-month-export>${Utils.icon('download')} Export</button>
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

  function completedTasksCard(data) {
    const completed = data.stats.completedTasks.slice(0, 6);
    return `<div class="card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('check-circle')} Completed this month</h2><p class="card-subtitle">${data.stats.tasks.completed} task${data.stats.tasks.completed === 1 ? '' : 's'} closed</p></div>
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

  function toolbar(data) {
    return `<div class="report-toolbar">
      ${state.custom ? `<div class="period-nav"><div class="period-label"><strong>${Utils.escapeHtml(data.label)}</strong><span>Custom range · ${data.daily.length} days</span></div></div>` : `
        <div class="period-nav">
          <button class="icon-btn sm bordered" data-month-nav="-1" aria-label="Previous month">${Utils.icon('chevron-left')}</button>
          <div class="period-label"><strong>${Utils.escapeHtml(data.label)}</strong><span>${data.stats.workingDays} working days · ${data.stats.tasks.assigned} tasks assigned</span></div>
          <button class="icon-btn sm bordered" data-month-nav="1" aria-label="Next month">${Utils.icon('chevron-right')}</button>
        </div>`}
      <button class="btn btn-secondary btn-sm" data-month-today>This month</button>
      <div class="spacer"></div>
      <button class="btn ${state.custom ? 'btn-light' : 'btn-secondary'} btn-sm" data-month-custom>${Utils.icon('calendar')} ${state.custom ? 'Ranges' : 'Custom range'}</button>
      <button class="btn btn-primary btn-sm" data-month-export>${Utils.icon('download')} Download</button>
      ${state.custom ? `<div class="custom-range-panel">
        <div class="field"><label class="field-label" for="monthFrom">From</label><input class="input" type="date" id="monthFrom" value="${data.from}" max="${Utils.todayKey()}" /></div>
        <div class="field"><label class="field-label" for="monthTo">To</label><input class="input" type="date" id="monthTo" value="${data.to}" max="${Utils.todayKey()}" /></div>
        <button class="btn btn-secondary btn-sm" data-month-today>Reset to this month</button>
      </div>` : ''}
    </div>`;
  }

  function bind(root, data) {
    root.querySelectorAll('[data-month-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.custom = false;
        state.anchor = Utils.addMonths(state.anchor, Number(btn.dataset.monthNav));
        App.refresh();
      });
    });
    root.querySelectorAll('[data-month-today]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.custom = false;
        state.anchor = Utils.todayKey();
        state.from = '';
        state.to = '';
        App.refresh();
      });
    });
    root.querySelectorAll('[data-month-custom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.custom = !state.custom;
        if (state.custom && (!state.from || !state.to)) {
          state.from = data.from;
          state.to = data.to;
        }
        App.refresh();
      });
    });
    root.querySelectorAll('[data-month-export]').forEach((btn) => {
      btn.addEventListener('click', () => Exports.open({ type: 'monthly', from: data.from, to: data.to }));
    });
    const from = root.querySelector('#monthFrom');
    const to = root.querySelector('#monthTo');
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
    root.querySelectorAll('[data-heatmap-day]').forEach((cell) => {
      cell.addEventListener('click', () => {
        CalendarPage.focusDate(cell.dataset.heatmapDay);
        App.navigate('calendar');
      });
    });
  }

  function render(root) {
    const data = summary();
    const empty = data.stats.trackedMinutes === 0 && data.stats.tasks.assigned === 0 && data.stats.tasks.completed === 0;

    const actions = `
      <button class="btn btn-secondary" data-nav="weekly">${Utils.icon('bar-chart')} Weekly view</button>
      <button class="btn btn-primary" data-month-export>${Utils.icon('download')} Export report</button>`;

    root.innerHTML = `
      ${PageHelpers.pageHeader({
        eyebrow: 'Insights',
        title: 'Monthly Report',
        subtitle: `The bigger picture on output, focus and project mix. ${data.stats.activeDays} active day${data.stats.activeDays === 1 ? '' : 's'}, ${Utils.formatDuration(data.stats.trackedMinutes)} tracked.`,
        actions
      })}
      ${toolbar(data)}
      ${empty ? `<div class="alert alert-info mb-16">${Utils.icon('info')}<div><strong>No data in this period.</strong> Choose another month, log an activity, or create a task to start building the report.</div></div>` : ''}
      ${statsMarkup(data)}
      <div class="report-chart-grid">
        ${PageHelpers.chartCard({
          title: 'Daily output & focus',
          subtitle: 'Working hours, productive hours and daily target across the month',
          iconName: 'bar-chart',
          body: `<div class="chart-box"><canvas id="monthlyDailyChart" aria-label="Monthly daily performance chart"></canvas></div>`,
          legend: PageHelpers.legend([
            { color: '#4f46e5', label: 'Working hours' },
            { color: 'rgba(16,185,129,.75)', label: 'Productive hours' },
            { color: '#cbd5e1', label: 'Daily target' }
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
      <div class="report-chart-grid">
        ${PageHelpers.chartCard({
          title: 'Weekly rhythm',
          subtitle: 'Productivity and tracked hours by week',
          iconName: 'calendar',
          body: `<div class="chart-box"><canvas id="monthlyWeeklyChart" aria-label="Weekly performance chart"></canvas></div>`,
          legend: PageHelpers.legend([
            { color: '#4f46e5', label: 'Productivity %' },
            { color: '#10b981', label: 'Hours tracked' }
          ])
        })}
        ${PageHelpers.chartCard({
          title: 'Tracking heatmap',
          subtitle: 'Daily intensity against your target',
          iconName: 'calendar-plus',
          body: heatmap(data),
          className: 'heatmap-card'
        })}
      </div>
      <div class="report-bottom-grid">
        ${weeklyTable(data)}
        ${insights(data)}
      </div>
      <div class="page-section grid grid-2">
        ${topTasks(data)}
        ${completedTasksCard(data)}
      </div>
      <div class="page-section">
        <div class="callout">
          ${Utils.icon('target')}
          <div><strong>Monthly target:</strong> ${data.stats.workingDays} working days at ${Utils.formatDuration(data.stats.targetMinutes)} per day is ${Utils.formatDuration(data.stats.workingDays * data.stats.targetMinutes)}. You tracked ${Utils.formatDuration(data.stats.trackedMinutes)} (${Utils.pct(data.stats.trackedMinutes, data.stats.workingDays * data.stats.targetMinutes)}%). ${data.stats.overdueTasks.length ? `${data.stats.overdueTasks.length} open tasks are overdue.` : 'No overdue tasks right now.'}</div>
          <button class="mini-link" data-open-help>How metrics work</button>
        </div>
      </div>`;

    requestAnimationFrame(() => {
      Charts.dailyArea('monthlyDailyChart', data.daily);
      Charts.projectDonut('monthlyProjectChart', data.projects);
      Charts.weeklyPerformance('monthlyWeeklyChart', data.weekly);
    });

    bind(root, data);
  }

  return { render, state };
})();

window.MonthlyPage = MonthlyPage;
