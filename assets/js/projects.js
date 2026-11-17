/* ============================================================
   FlowTrack — Projects
   A portfolio view of project effort, task health and activity.
   ============================================================ */

const ProjectsPage = (() => {
  const state = { q: '', sort: 'time' };

  function taskMap() {
    const map = new Map();
    Store.getTasks().forEach((task) => {
      if (!task.projectId) return;
      if (!map.has(task.projectId)) map.set(task.projectId, []);
      map.get(task.projectId).push(task);
    });
    return map;
  }

  function isTrackedActivity(activity, projectIds) {
    if (activity.projectId && projectIds.has(activity.projectId)) return true;
    if (activity.taskId) {
      const task = Store.getTask(activity.taskId);
      return Boolean(task && task.projectId && projectIds.has(task.projectId));
    }
    return false;
  }

  function getPortfolio() {
    const projects = Store.getProjects();
    const projectIds = new Set(projects.map((project) => project.id));
    const allStats = Analytics.getProjectStats();
    const tasks = taskMap();
    const today = Utils.todayKey();
    const projectActivities = Store.getActivities().filter((activity) => isTrackedActivity(activity, projectIds));
    const unassigned = Store.getActivities().filter((activity) => !isTrackedActivity(activity, projectIds));
    const trackedMinutes = projectActivities.reduce((sum, activity) => sum + activity.durationMinutes, 0);
    const productiveMinutes = projectActivities.reduce((sum, activity) => sum + (activity.taskId ? activity.durationMinutes : 0), 0);
    const unassignedMinutes = unassigned.reduce((sum, activity) => sum + activity.durationMinutes, 0);
    const totalTasks = allStats.reduce((sum, project) => sum + project.tasks, 0);
    const completed = allStats.reduce((sum, project) => sum + project.completed, 0);
    const open = allStats.reduce((sum, project) => sum + project.open, 0);
    const overdue = allStats.reduce((sum, project) => {
      const list = tasks.get(project.id) || [];
      return sum + list.filter((task) => task.status !== 'Completed' && task.assignedDate < today).length;
    }, 0);
    return {
      projects, allStats, tasks, today, projectActivities, unassigned,
      trackedMinutes, productiveMinutes, unassignedMinutes,
      totalTasks, completed, open, overdue
    };
  }

  function filteredStats(portfolio) {
    const query = state.q.trim().toLowerCase();
    const list = portfolio.allStats.filter((project) => {
      if (!query) return true;
      return `${project.name} ${project.description}`.toLowerCase().includes(query);
    });
    switch (state.sort) {
      case 'tasks':
        return list.slice().sort((a, b) => b.tasks - a.tasks || b.minutes - a.minutes);
      case 'completion':
        return list.slice().sort((a, b) => b.completionRate - a.completionRate || b.tasks - a.tasks);
      case 'name':
        return list.slice().sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list.slice().sort((a, b) => b.minutes - a.minutes || b.tasks - a.tasks);
    }
  }

  function health(project, portfolio) {
    const list = portfolio.tasks.get(project.id) || [];
    const overdue = list.filter((task) => task.status !== 'Completed' && task.assignedDate < portfolio.today).length;
    if (overdue) return { label: `${overdue} overdue`, tone: 'danger', icon: 'alert-triangle' };
    if (!list.length) return { label: 'No tasks yet', tone: 'neutral', icon: 'circle' };
    if (project.completionRate >= 75) return { label: 'On track', tone: 'success', icon: 'check-circle' };
    if (project.minutes > 0) return { label: 'In motion', tone: 'info', icon: 'activity' };
    return { label: 'Planning', tone: 'neutral', icon: 'clock' };
  }

  function distribution(portfolio) {
    const allProjectMinutes = portfolio.allStats.reduce((sum, project) => sum + project.minutes, 0);
    const entries = portfolio.allStats
      .filter((project) => project.minutes > 0)
      .map((project) => ({ id: project.id, name: project.name, color: project.color, minutes: project.minutes }));
    if (portfolio.unassignedMinutes > 0) {
      entries.push({ id: null, name: 'Unassigned', color: '#94a3b8', minutes: portfolio.unassignedMinutes });
    }
    const total = allProjectMinutes + portfolio.unassignedMinutes;
    entries.forEach((entry) => { entry.percent = Utils.pct(entry.minutes, total); });
    entries.sort((a, b) => b.minutes - a.minutes);
    return {
      entries,
      total,
      markup: `<div class="chart-box sm" style="position:relative">
        <canvas id="projectsDonut" aria-label="Time distribution by project"></canvas>
        <div class="donut-center"><strong>${Utils.formatHours(total)}h</strong><span>tracked</span></div>
      </div>
      <div class="distribution-list mt-12">
        ${entries.slice(0, 6).map((entry) => `<div class="distribution-row">
          <div class="distribution-top">
            <span class="name"><span class="dot" style="background:${entry.color}"></span>${Utils.escapeHtml(entry.name)}</span>
            <span class="val">${Utils.formatDuration(entry.minutes)}</span>
            <span class="pct">${entry.percent}%</span>
          </div>
          <div class="distribution-bar"><span style="width:${entry.percent}%;background:${entry.color}"></span></div>
        </div>`).join('') || '<p class="muted tiny">No tracked time yet. Start a timer or log work against a task.</p>'}
      </div>`
    };
  }

  function signalsMarkup(portfolio) {
    const withTime = portfolio.allStats.filter((project) => project.minutes > 0);
    const top = withTime[0];
    const mostTasks = portfolio.allStats.slice().sort((a, b) => b.tasks - a.tasks)[0];
    const best = portfolio.allStats.filter((project) => project.tasks > 0).sort((a, b) => b.completionRate - a.completionRate)[0];
    const attention = portfolio.allStats.map((project) => ({
      project,
      overdue: (portfolio.tasks.get(project.id) || []).filter((task) => task.status !== 'Completed' && task.assignedDate < portfolio.today).length
    })).sort((a, b) => b.overdue - a.overdue)[0];
    const recent = Store.getActivities().slice().sort((a, b) => (a.dateKey === b.dateKey ? b.startMinutes - a.startMinutes : (a.dateKey < b.dateKey ? 1 : -1)))[0];
    const rows = [
      { icon: 'trending-up', label: 'Most tracked', value: top ? Utils.clampText(top.name, 34) : '—', aside: top ? Utils.formatDuration(top.minutes) : '' },
      { icon: 'tasks', label: 'Largest workload', value: mostTasks && mostTasks.tasks ? Utils.clampText(mostTasks.name, 34) : '—', aside: mostTasks ? `${mostTasks.tasks} tasks` : '' },
      { icon: 'check-circle', label: 'Best completion', value: best ? Utils.clampText(best.name, 34) : '—', aside: best ? `${best.completionRate}%` : '' },
      { icon: 'alert-triangle', label: 'Needs attention', value: attention && attention.overdue ? Utils.clampText(attention.project.name, 34) : 'All clear', aside: attention && attention.overdue ? `${attention.overdue} overdue` : '' },
      { icon: 'clock', label: 'Unassigned time', value: portfolio.unassignedMinutes ? Utils.formatDuration(portfolio.unassignedMinutes) : 'None', aside: `${portfolio.unassigned.length} entries` },
      { icon: 'calendar', label: 'Last activity', value: recent ? Utils.formatDate(recent.dateKey, 'medium-year') : 'No activity yet', aside: recent ? Utils.formatDuration(recent.durationMinutes) : '' }
    ];
    return `<div class="card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('sparkles')} Portfolio signals</h2><p class="card-subtitle">What stands out across your projects</p></div>
      </div>
      <div class="card-body" style="padding-top:12px">
        <div class="best-day-card mb-16">
          <div class="label">${Utils.icon('folder')} Portfolio at a glance</div>
          <div class="day">${portfolio.projects.length} project${portfolio.projects.length === 1 ? '' : 's'}</div>
          <div class="desc">${Utils.formatDuration(portfolio.trackedMinutes)} tracked · ${portfolio.open} open task${portfolio.open === 1 ? '' : 's'}</div>
          <div class="row">
            <div><div class="l">Completed</div><div class="v">${portfolio.completed}</div></div>
            <div><div class="l">Completion</div><div class="v">${Utils.pct(portfolio.completed, portfolio.totalTasks)}%</div></div>
            <div><div class="l">Overdue</div><div class="v">${portfolio.overdue}</div></div>
          </div>
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

  function statsMarkup(portfolio) {
    const activeProjects = portfolio.allStats.filter((project) => project.minutes > 0).length;
    return `<div class="stat-grid">
      ${PageHelpers.statCard({
        label: 'Projects', value: portfolio.projects.length, iconName: 'folder', tone: 'primary',
        foot: `<span class="muted">${activeProjects} with tracked time</span>`,
        progress: Utils.pct(activeProjects, portfolio.projects.length)
      })}
      ${PageHelpers.statCard({
        label: 'Project hours', value: Utils.formatHours(portfolio.trackedMinutes), unit: 'h', iconName: 'timer', tone: 'violet',
        foot: `<span class="muted">${portfolio.projectActivities.length} project activities</span>`
      })}
      ${PageHelpers.statCard({
        label: 'Productive hours', value: Utils.formatHours(portfolio.productiveMinutes), unit: 'h', iconName: 'target', tone: 'success',
        foot: `<span class="muted">${Utils.pct(portfolio.productiveMinutes, portfolio.trackedMinutes)}% task-linked</span>`,
        progress: Utils.pct(portfolio.productiveMinutes, portfolio.trackedMinutes)
      })}
      ${PageHelpers.statCard({
        label: 'Open tasks', value: portfolio.open, iconName: 'tasks', tone: 'info',
        foot: `<span class="muted">${portfolio.overdue} overdue project task${portfolio.overdue === 1 ? '' : 's'}</span>`,
        progress: Utils.pct(portfolio.completed, portfolio.totalTasks)
      })}
      ${PageHelpers.statCard({
        label: 'Completed tasks', value: portfolio.completed, iconName: 'check-circle', tone: 'success',
        foot: `<span class="muted">${Utils.pct(portfolio.completed, portfolio.totalTasks)}% completion rate</span>`,
        progress: Utils.pct(portfolio.completed, portfolio.totalTasks)
      })}
      ${PageHelpers.statCard({
        label: 'Avg per project', value: Utils.formatHours(portfolio.projects.length ? portfolio.trackedMinutes / portfolio.projects.length : 0), unit: 'h', iconName: 'bar-chart', tone: 'warning',
        foot: `<span class="muted">${portfolio.unassignedMinutes ? `${Utils.formatDuration(portfolio.unassignedMinutes)} unassigned` : 'Everything assigned'}</span>`
      })}
    </div>`;
  }

  function projectCard(project, portfolio) {
    const status = health(project, portfolio);
    const last = project.lastActivity;
    return `<article class="project-card" style="--project-color:${project.color}">
      <div class="project-accent"></div>
      <div class="project-body">
        <div class="project-top">
          <span class="project-icon">${Utils.icon('folder')}</span>
          <div style="flex:1;min-width:0">
            <div class="project-name">${Utils.escapeHtml(project.name)}</div>
            <div class="project-desc">${project.description ? Utils.escapeHtml(project.description) : '<span class="muted">No description yet.</span>'}</div>
          </div>
          <button class="icon-btn sm project-menu" data-project-menu="${project.id}" aria-label="Project actions for ${Utils.escapeAttr(project.name)}">${Utils.icon('more')}</button>
        </div>
        <div class="project-stats">
          <div class="project-stat"><div class="l">Tasks</div><div class="v">${project.tasks}</div></div>
          <div class="project-stat"><div class="l">Done</div><div class="v">${project.completed}</div></div>
          <div class="project-stat"><div class="l">Tracked</div><div class="v">${Utils.formatDuration(project.minutes)}</div></div>
        </div>
        <div class="project-progress">
          ${UI.progressBar(project.completionRate, '', true, `${project.completed} of ${project.tasks} task${project.tasks === 1 ? '' : 's'} complete`)}
        </div>
        <div class="flex" style="justify-content:space-between;gap:8px;margin-top:11px">
          <span class="badge badge-${status.tone}">${Utils.icon(status.icon)}${Utils.escapeHtml(status.label)}</span>
          <span class="muted tiny">${last ? `Last: ${Utils.escapeHtml(Utils.formatDate(last.dateKey, 'short'))}` : 'No tracked time'}</span>
        </div>
      </div>
      <div class="project-footer">
        <span class="members">${UI.avatar(Store.getSettings().name, 'avatar-sm')}<span>${project.activities} entr${project.activities === 1 ? 'y' : 'ies'}</span></span>
        <div class="flex gap-6">
          <button class="btn btn-ghost btn-sm" data-project-log="${project.id}" title="Log activity to ${Utils.escapeAttr(project.name)}">${Utils.icon('clock')} Log</button>
          <button class="btn btn-secondary btn-sm" data-project-tasks="${project.id}">View tasks ${Utils.icon('arrow-right')}</button>
        </div>
      </div>
    </article>`;
  }

  function healthTable(portfolio, list) {
    return `<div class="card report-table-card">
      <div class="card-header">
        <div><h2 class="card-title">${Utils.icon('activity')} Project health</h2><p class="card-subtitle">Workload, completion and tracked effort in one table</p></div>
        <button class="btn btn-ghost btn-sm" data-project-export>${Utils.icon('download')} Export</button>
      </div>
      ${list.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Project</th><th>Tasks</th><th>Completed</th><th>Completion</th><th>Tracked</th><th>Entries</th><th>Last activity</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${list.map((project) => {
            const status = health(project, portfolio);
            return `<tr>
              <td><span class="title-line" style="display:flex;align-items:center;gap:7px"><span class="dot" style="width:7px;height:7px;border-radius:2px;background:${project.color};flex:none"></span><strong style="font-size:12px">${Utils.escapeHtml(project.name)}</strong></span></td>
              <td class="num">${project.tasks}</td>
              <td class="num">${project.completed}</td>
              <td>
                <div class="time-track" style="min-width:85px">
                  <div class="progress"><span style="width:${project.completionRate}%"></span></div>
                  <span class="time-text">${project.completionRate}%</span>
                </div>
              </td>
              <td class="num">${Utils.formatDuration(project.minutes)}</td>
              <td class="num">${project.activities}</td>
              <td class="muted-cell">${project.lastActivity ? Utils.escapeHtml(Utils.formatDate(project.lastActivity.dateKey, 'medium-year')) : '—'}</td>
              <td><span class="badge badge-${status.tone}">${Utils.escapeHtml(status.label)}</span></td>
              <td>
                <div class="cell-actions">
                  <button class="icon-btn sm" data-project-edit="${project.id}" title="Edit project" aria-label="Edit ${Utils.escapeAttr(project.name)}">${Utils.icon('edit')}</button>
                  <button class="icon-btn sm" data-project-tasks="${project.id}" title="View tasks" aria-label="View tasks in ${Utils.escapeAttr(project.name)}">${Utils.icon('arrow-right')}</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>` : UI.emptyState('folder', 'No projects match this search', 'Try a different search or clear the filter to see the full portfolio.', `<button class="btn btn-secondary btn-sm" data-clear-project-filters>${Utils.icon('refresh')} Clear filter</button>`, true)}
      <div class="table-footer">
        <span class="muted">${portfolio.projects.length} project${portfolio.projects.length === 1 ? '' : 's'} · ${portfolio.totalTasks} task${portfolio.totalTasks === 1 ? '' : 's'} · ${portfolio.unassignedMinutes ? `${Utils.formatDuration(portfolio.unassignedMinutes)} unassigned time` : 'all activity assigned'}</span>
        <button class="mini-link" data-project-export>Download portfolio report</button>
      </div>
    </div>`;
  }

  async function deleteProject(project) {
    const ok = await UI.confirm({
      title: 'Delete this project?',
      message: `“${project.name}” will be removed. Its ${project.tasks} task${project.tasks === 1 ? '' : 's'} and linked activities are kept, but they will become unassigned.`,
      confirmLabel: 'Delete project',
      danger: true
    });
    if (!ok) return;
    try {
      Store.deleteProject(project.id);
      UI.toast('Project deleted. Tasks and activities were preserved.', 'success');
    } catch (err) {
      PageHelpers.toastError(err, 'Could not delete project');
    }
  }

  function openMenu(anchor, project) {
    UI.openMenu(anchor, [
      { label: 'Edit project', icon: 'edit', onClick: () => ProjectForm.open({ projectId: project.id }) },
      { label: 'Log activity', icon: 'clock', onClick: () => ActivityForm.open({ defaults: { projectId: project.id } }) },
      { label: 'View tasks', icon: 'tasks', onClick: () => { TasksPage.setProjectFilter(project.id); App.navigate('tasks'); } },
      { separator: true },
      { label: 'Delete project', icon: 'trash', danger: true, onClick: () => deleteProject(project) }
    ]);
  }

  function bind(root, portfolio) {
    const search = root.querySelector('#projectSearch');
    if (search) search.addEventListener('input', () => { state.q = search.value; App.refresh(); });
    const sort = root.querySelector('#projectSort');
    if (sort) sort.addEventListener('change', () => { state.sort = sort.value; App.refresh(); });
    const clear = root.querySelector('[data-clear-project-filters]');
    if (clear) clear.addEventListener('click', () => { state.q = ''; state.sort = 'time'; App.refresh(); });
    root.querySelectorAll('[data-new-project]').forEach((btn) => btn.addEventListener('click', () => ProjectForm.open()));
    root.querySelectorAll('[data-project-export]').forEach((btn) => btn.addEventListener('click', () => Exports.open({ type: 'projects' })));
    root.querySelectorAll('[data-project-tasks]').forEach((btn) => btn.addEventListener('click', () => {
      TasksPage.setProjectFilter(btn.dataset.projectTasks);
      App.navigate('tasks');
    }));
    root.querySelectorAll('[data-project-log]').forEach((btn) => btn.addEventListener('click', () => {
      ActivityForm.open({ defaults: { projectId: btn.dataset.projectLog } });
    }));
    root.querySelectorAll('[data-project-edit]').forEach((btn) => btn.addEventListener('click', () => {
      ProjectForm.open({ projectId: btn.dataset.projectEdit });
    }));
    root.querySelectorAll('[data-project-menu]').forEach((btn) => btn.addEventListener('click', () => {
      const project = portfolio.allStats.find((item) => item.id === btn.dataset.projectMenu);
      if (project) openMenu(btn, project);
    }));
  }

  function render(root) {
    const portfolio = getPortfolio();
    const list = filteredStats(portfolio);
    const distributionData = distribution(portfolio);
    const filtersActive = Boolean(state.q) || state.sort !== 'time';

    const actions = `
      <button class="btn btn-secondary" data-project-export>${Utils.icon('download')} Export</button>
      <button class="btn btn-primary" data-new-project>${Utils.icon('plus')} New project</button>`;

    root.innerHTML = `
      ${PageHelpers.pageHeader({
        eyebrow: 'Portfolio',
        title: 'Projects',
        subtitle: `${portfolio.projects.length} project${portfolio.projects.length === 1 ? '' : 's'}, ${portfolio.open} open task${portfolio.open === 1 ? '' : 's'} and ${Utils.formatDuration(portfolio.trackedMinutes)} tracked across the portfolio.`,
        actions
      })}
      ${statsMarkup(portfolio)}
      <div class="page-section">
        <div class="filter-bar">
          <div class="filter-bar-inner">
            <div class="input-icon-wrap toolbar-search">
              ${Utils.icon('search')}
              <input class="input ${state.q ? 'has-clear' : ''}" id="projectSearch" placeholder="Search projects or descriptions…" value="${Utils.escapeAttr(state.q)}" autocomplete="off" aria-label="Search projects" />
              ${state.q ? `<button class="input-clear" data-clear-project-filters aria-label="Clear search">${Utils.icon('x')}</button>` : ''}
            </div>
            <span class="filter-divider"></span>
            <select class="select" id="projectSort" aria-label="Sort projects">
              <option value="time" ${state.sort === 'time' ? 'selected' : ''}>Sort: most tracked</option>
              <option value="tasks" ${state.sort === 'tasks' ? 'selected' : ''}>Sort: most tasks</option>
              <option value="completion" ${state.sort === 'completion' ? 'selected' : ''}>Sort: completion</option>
              <option value="name" ${state.sort === 'name' ? 'selected' : ''}>Sort: name A–Z</option>
            </select>
            ${filtersActive ? `<div class="filter-actions"><button class="btn btn-ghost btn-sm" data-clear-project-filters>${Utils.icon('refresh')} Reset</button></div>` : ''}
          </div>
        </div>

        ${list.length ? `<div class="project-grid">${list.map((project) => projectCard(project, portfolio)).join('')}</div>` : UI.emptyState(
          'folder',
          portfolio.projects.length ? 'No projects match this search' : 'Create your first project',
          portfolio.projects.length ? 'Try a different search term or reset the filters.' : 'Projects group tasks and activities so reports can show where your time goes.',
          portfolio.projects.length ? `<button class="btn btn-secondary btn-sm" data-clear-project-filters>${Utils.icon('refresh')} Clear filter</button>` : `<button class="btn btn-primary btn-sm" data-new-project>${Utils.icon('plus')} New project</button>`
        )}
      </div>
      <div class="report-chart-grid">
        ${PageHelpers.chartCard({
          title: 'Portfolio time split',
          subtitle: `${Utils.formatDuration(distributionData.total)} tracked across all projects`,
          iconName: 'pie-chart',
          actions: `<button class="btn btn-ghost btn-sm" data-project-export>Export ${Utils.icon('arrow-right')}</button>`,
          body: distributionData.markup
        })}
        ${signalsMarkup(portfolio)}
      </div>
      <div class="page-section">
        ${healthTable(portfolio, list)}
      </div>
      <div class="page-section">
        <div class="callout">
          ${Utils.icon('info')}
          <div><strong>How project totals work:</strong> an activity counts toward a project when it is linked directly to the project or through a task in that project. Deleting a project keeps its tasks and activity history, and moves them to unassigned.</div>
          <button class="mini-link" data-open-help>Read the guide</button>
        </div>
      </div>`;

    requestAnimationFrame(() => {
      Charts.projectDonut('projectsDonut', distributionData.entries);
    });

    bind(root, portfolio);
  }

  return { render, state };
})();

window.ProjectsPage = ProjectsPage;
