/* ============================================================
   FlowTrack — Shared forms
   Task, activity and project dialogs used across the app.
   ============================================================ */

const FormHelpers = (() => {
  function field(form, name) {
    return form.querySelector(`[name="${name}"]`);
  }
  function value(form, name) {
    const el = field(form, name);
    if (!el) return '';
    return typeof el.value === 'string' ? el.value.trim() : el.value;
  }
  function minutesFromHours(raw) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
  }
  function hoursValue(minutes) {
    if (!minutes) return '';
    return Number((minutes / 60).toFixed(2));
  }
  function setError(api, err) {
    if (api) api.setError(err && err.message ? err.message : 'Please check the form and try again.');
  }
  return { field, value, minutesFromHours, hoursValue, setError };
})();

const TaskForm = (() => {
  const { field, value, minutesFromHours, hoursValue } = FormHelpers;

  function open(options = {}) {
    const existing = options.taskId ? Store.getTask(options.taskId) : null;
    if (options.taskId && !existing) {
      UI.toast('That task could not be found.', 'error');
      return;
    }
    const settings = Store.getSettings();
    const projects = Store.getProjects();
    const defaults = options.defaults || {};
    const task = existing || {
      title: '', description: '', projectId: defaults.projectId || settings.defaultProjectId || (projects[0] ? projects[0].id : null),
      priority: defaults.priority || 'Medium', status: 'Not Started', assignedDate: defaults.assignedDate || Utils.todayKey(),
      startTime: defaults.startTime || '', endTime: defaults.endTime || '', estimatedMinutes: defaults.estimatedMinutes || 0,
      actualMinutes: 0, notes: ''
    };
    const trackedActivities = existing ? Store.getActivities().filter((a) => a.taskId === existing.id) : [];
    const trackedMinutes = trackedActivities.reduce((sum, a) => sum + a.durationMinutes, 0);
    const isEdit = Boolean(existing);

    const projectOptions = projects.map((p) => `<option value="${p.id}" ${p.id === task.projectId ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('');
    const statusOptions = Utils.STATUSES.map((s) => `<option value="${s}" ${s === task.status ? 'selected' : ''}>${s}</option>`).join('');
    const priorityOptions = Utils.PRIORITIES.map((p) => `<option value="${p}" ${p === task.priority ? 'selected' : ''}>${p}</option>`).join('');

    const body = `
      <div class="form-grid">
        <div class="field span-2">
          <label class="field-label" for="taskTitle">Task title <span class="req">*</span></label>
          <input class="input" id="taskTitle" name="title" value="${Utils.escapeAttr(task.title)}" placeholder="e.g. Compile weekly operations report" required autofocus maxlength="160" />
        </div>
        <div class="field span-2">
          <label class="field-label" for="taskDescription">Description</label>
          <textarea class="textarea" id="taskDescription" name="description" rows="3" placeholder="What needs to be done? Add the context, scope or success criteria." maxlength="4000">${Utils.escapeHtml(task.description || '')}</textarea>
        </div>
        <div class="form-section-label">Organisation</div>
        <div class="field">
          <label class="field-label" for="taskProject">Project / category</label>
          <select class="select" id="taskProject" name="projectId">
            <option value="">No project</option>
            ${projectOptions}
          </select>
          ${projects.length === 0 ? `<p class="field-hint">No projects yet — create one from the Projects page.</p>` : ''}
        </div>
        <div class="field">
          <label class="field-label" for="taskPriority">Priority</label>
          <select class="select" id="taskPriority" name="priority">${priorityOptions}</select>
        </div>
        <div class="field">
          <label class="field-label" for="taskStatus">Status</label>
          <select class="select" id="taskStatus" name="status">${statusOptions}</select>
        </div>
        <div class="field">
          <label class="field-label" for="taskAssigned">Assigned date <span class="req">*</span></label>
          <input class="input" type="date" id="taskAssigned" name="assignedDate" value="${task.assignedDate}" required />
        </div>
        <div class="form-section-label">Schedule</div>
        <div class="field">
          <label class="field-label" for="taskStart">Start time <span class="optional">optional</span></label>
          <input class="input" type="time" id="taskStart" name="startTime" value="${task.startTime || ''}" />
        </div>
        <div class="field">
          <label class="field-label" for="taskEnd">End time <span class="optional">optional</span></label>
          <input class="input" type="time" id="taskEnd" name="endTime" value="${task.endTime || ''}" />
        </div>
        <div class="field">
          <label class="field-label" for="taskEstimate">Estimated duration <span class="optional">hours</span></label>
          <input class="input" type="number" id="taskEstimate" name="estimatedHours" value="${hoursValue(task.estimatedMinutes) || ''}" min="0" max="720" step="0.25" placeholder="e.g. 1.5" />
          <p class="field-hint">Use decimals, e.g. 0.75 = 45 minutes.</p>
        </div>
        <div class="field">
          <label class="field-label" for="taskActual">Actual time spent <span class="optional">hours</span></label>
          <input class="input" type="number" id="taskActual" name="actualHours" value="${hoursValue(task.actualMinutes) || ''}" min="0" max="1000" step="0.05" placeholder="Updated by tracked work" />
          <p class="field-hint">${isEdit && trackedActivities.length ? `${Utils.formatDuration(trackedMinutes)} tracked across ${trackedActivities.length} activit${trackedActivities.length === 1 ? 'y' : 'ies'}. You can add untracked effort.` : 'Timer and linked activities update this automatically.'}</p>
        </div>
        <div class="field span-2">
          <label class="field-label" for="taskNotes">Notes &amp; remarks</label>
          <textarea class="textarea" id="taskNotes" name="notes" rows="2" placeholder="Blockers, decisions, links or follow-up notes…" maxlength="4000">${Utils.escapeHtml(task.notes || '')}</textarea>
        </div>
      </div>`;
    const footer = `
      ${isEdit ? `<button type="button" class="btn btn-danger-soft btn-sm" data-delete-task>${Utils.icon('trash')} Delete</button>` : ''}
      <div class="spacer"></div>
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Create task'}</button>`;

    UI.openModal({
      title: isEdit ? 'Edit task' : 'Create a new task',
      subtitle: isEdit ? 'Update the details, schedule or status of this task.' : 'Capture the work you need to do and when you plan to do it.',
      size: 'modal-lg',
      body,
      footer,
      onMount: (backdrop, api) => {
        const form = backdrop.querySelector('form');
        const deleteBtn = backdrop.querySelector('[data-delete-task]');
        if (deleteBtn && existing) {
          deleteBtn.addEventListener('click', async () => {
            const ok = await UI.confirm({
              title: 'Delete this task?',
              message: `“${task.title}” will be removed. Its activity history is kept, but the task link will be cleared.`,
              confirmLabel: 'Delete task',
              danger: true
            });
            if (!ok) return;
            try {
              Store.deleteTask(existing.id);
              api.close();
              UI.toast('Task deleted. Activity history was preserved.', 'success');
              if (options.onSaved) options.onSaved('delete');
            } catch (err) {
              UI.toast(err.message, 'error', 'Could not delete task');
            }
          });
        }
        const start = form.querySelector('[name="startTime"]');
        const end = form.querySelector('[name="endTime"]');
        const syncHint = () => {
          if (start.value && !end.value) end.focus();
        };
        start.addEventListener('blur', syncHint);
        [start, end].forEach((el) => el.addEventListener('change', () => {
          el.classList.remove('invalid');
          if (start.value && end.value && end.value <= start.value) {
            end.classList.add('invalid');
            api.setError('End time must be after the start time.', 'warning');
          } else {
            api.setError('');
          }
        }));
      },
      onSubmit: async (form, api) => {
        const startTime = value(form, 'startTime');
        const endTime = value(form, 'endTime');
        if ((startTime && !endTime) || (!startTime && endTime)) {
          throw new Error('Add both a start time and an end time, or leave both blank.');
        }
        if (startTime && endTime && endTime <= startTime) throw new Error('End time must be after the start time.');
        const assignedDate = value(form, 'assignedDate');
        if (!assignedDate) throw new Error('Choose an assigned date.');
        const payload = {
          title: value(form, 'title'),
          description: value(form, 'description'),
          projectId: value(form, 'projectId') || null,
          priority: value(form, 'priority'),
          status: value(form, 'status'),
          assignedDate,
          startTime,
          endTime,
          estimatedMinutes: minutesFromHours(value(form, 'estimatedHours')),
          actualMinutes: minutesFromHours(value(form, 'actualHours')),
          notes: value(form, 'notes')
        };
        if (!payload.title) throw new Error('Task title is required.');
        if (existing) {
          Store.updateTask(existing.id, payload);
          UI.toast('Task updated.', 'success');
        } else {
          Store.createTask(payload);
          UI.toast('Task created.', 'success');
        }
        if (options.onSaved) options.onSaved();
      }
    });
  }

  return { open };
})();

const ActivityForm = (() => {
  const { field, value } = FormHelpers;

  function defaultTimes(dateKey, defaults) {
    if (defaults.startTime && defaults.endTime) return { startTime: defaults.startTime, endTime: defaults.endTime };
    const settings = Store.getSettings();
    if (dateKey === Utils.todayKey()) {
      const now = Utils.nowMinutes();
      let endMin = Math.max(10, Math.min(1435, Math.floor(now / 5) * 5));
      let startMin = Math.max(0, Math.floor((endMin - 30) / 5) * 5);
      if (endMin - startMin < 10) { startMin = Math.max(0, endMin - 15); }
      return { startTime: Utils.minutesToTime(startMin), endTime: Utils.minutesToTime(endMin) };
    }
    const start = Utils.timeToMinutes(settings.workdayStart) || 540;
    return { startTime: Utils.minutesToTime(start), endTime: Utils.minutesToTime(Math.min(1435, start + 60)) };
  }

  function open(options = {}) {
    const existing = options.activityId ? Store.getActivity(options.activityId) : null;
    if (options.activityId && !existing) { UI.toast('That activity could not be found.', 'error'); return; }
    const defaults = options.defaults || {};
    const dateKey = existing ? existing.dateKey : (defaults.dateKey || Utils.todayKey());
    const times = existing
      ? { startTime: Utils.minutesToTime(existing.startMinutes), endTime: Utils.minutesToTime(existing.endMinutes) }
      : defaultTimes(dateKey, defaults);
    const activity = existing || {
      title: defaults.title || '', remarks: defaults.remarks || '', taskId: defaults.taskId || null,
      projectId: defaults.projectId || Store.getSettings().defaultProjectId || null, source: 'manual'
    };
    const projects = Store.getProjects();
    const tasks = Store.getTasks().slice().sort(Utils.sortTasks).filter((t) => t.status !== 'Completed' || t.id === activity.taskId);
    const isEdit = Boolean(existing);

    const projectOptions = projects.map((p) => `<option value="${p.id}" ${p.id === activity.projectId ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('');
    const taskOptions = tasks.map((t) => `<option value="${t.id}" data-project="${t.projectId || ''}" ${t.id === activity.taskId ? 'selected' : ''}>${Utils.escapeHtml(t.title)}</option>`).join('');

    const body = `
      <div class="form-grid">
        <div class="field span-2">
          <label class="field-label" for="activityTitle">What did you work on? <span class="req">*</span></label>
          <input class="input" id="activityTitle" name="title" value="${Utils.escapeAttr(activity.title || '')}" placeholder="e.g. Completed KPI dashboard analysis" required autofocus maxlength="200" />
        </div>
        <div class="field">
          <label class="field-label" for="activityDate">Date <span class="req">*</span></label>
          <input class="input" type="date" id="activityDate" name="dateKey" value="${dateKey}" max="${Utils.todayKey()}" required />
        </div>
        <div class="field">
          <label class="field-label" for="activityTask">Linked task <span class="optional">optional</span></label>
          <select class="select" id="activityTask" name="taskId">
            <option value="">No linked task</option>
            ${taskOptions}
          </select>
          <p class="field-hint">Linked work counts toward productive hours.</p>
        </div>
        <div class="field">
          <label class="field-label" for="activityStart">Start time <span class="req">*</span></label>
          <input class="input" type="time" id="activityStart" name="startTime" value="${times.startTime}" required />
        </div>
        <div class="field">
          <label class="field-label" for="activityEnd">End time <span class="req">*</span></label>
          <input class="input" type="time" id="activityEnd" name="endTime" value="${times.endTime}" required />
        </div>
        <div class="field">
          <label class="field-label" for="activityProject">Project</label>
          <select class="select" id="activityProject" name="projectId">
            <option value="">No project</option>
            ${projectOptions}
          </select>
          <p class="field-hint" id="projectHint">Inherited when a task is linked.</p>
        </div>
        <div class="field">
          <label class="field-label">Duration</label>
          <div class="input duration-preview" id="activityDuration" style="display:flex;align-items:center;gap:7px;background:var(--surface-soft);color:var(--muted);font-variant-numeric:tabular-nums;">
            ${Utils.icon('clock')}<span>—</span>
          </div>
        </div>
        <div class="field span-2">
          <label class="field-label" for="activityRemarks">Detailed remarks</label>
          <textarea class="textarea" id="activityRemarks" name="remarks" rows="3" placeholder="Add the outcome, decisions or anything worth remembering…" maxlength="2000">${Utils.escapeHtml(activity.remarks || '')}</textarea>
        </div>
      </div>
      <div class="alert alert-info mt-16" style="margin-top:16px">${Utils.icon('info')}<div>Manual entries can overlap existing activities. FlowTrack will warn you before saving and highlight overlaps in the log.</div></div>`;
    const footer = `
      ${isEdit ? `<button type="button" class="btn btn-danger-soft btn-sm" data-delete-activity>${Utils.icon('trash')} Delete</button>` : ''}
      <div class="spacer"></div>
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="submit" class="btn btn-primary">${isEdit ? 'Save activity' : 'Log activity'}</button>`;

    UI.openModal({
      title: isEdit ? 'Edit activity' : 'Log an activity',
      subtitle: isEdit ? 'Adjust this entry — linked task totals update automatically.' : 'Record a work update with an exact time range.',
      size: 'modal-lg',
      body,
      footer,
      onMount: (backdrop, api) => {
        const form = backdrop.querySelector('form');
        const start = field(form, 'startTime');
        const end = field(form, 'endTime');
        const project = field(form, 'projectId');
        const task = field(form, 'taskId');
        const durationEl = backdrop.querySelector('#activityDuration span');
        const hint = backdrop.querySelector('#projectHint');

        const updateDuration = () => {
          const startMin = Utils.timeToMinutes(start.value);
          const endMin = Utils.timeToMinutes(end.value);
          if (Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) {
            durationEl.textContent = Utils.formatDuration(endMin - startMin);
            durationEl.parentElement.style.color = 'var(--ink-2)';
            start.classList.remove('invalid'); end.classList.remove('invalid');
          } else {
            durationEl.textContent = '—';
            durationEl.parentElement.style.color = 'var(--muted)';
          }
        };
        const syncTask = () => {
          const selected = task.options[task.selectedIndex];
          if (task.value && selected) {
            project.value = selected.dataset.project || '';
            project.disabled = true;
            hint.textContent = 'Project is inherited from the linked task.';
          } else {
            project.disabled = false;
            hint.textContent = 'Inherited when a task is linked.';
          }
        };
        [start, end].forEach((el) => el.addEventListener('input', updateDuration));
        task.addEventListener('change', syncTask);
        updateDuration();
        syncTask();

        const deleteBtn = backdrop.querySelector('[data-delete-activity]');
        if (deleteBtn && existing) {
          deleteBtn.addEventListener('click', async () => {
            const ok = await UI.confirm({
              title: 'Delete this activity?',
              message: `“${existing.title}” (${Utils.formatDuration(existing.durationMinutes)}) will be removed. Linked task time will be reduced by the same amount.`,
              confirmLabel: 'Delete entry',
              danger: true
            });
            if (!ok) return;
            try {
              Store.deleteActivity(existing.id);
              api.close();
              UI.toast('Activity deleted.', 'success');
              if (options.onSaved) options.onSaved('delete');
            } catch (err) {
              UI.toast(err.message, 'error');
            }
          });
        }
      },
      onSubmit: async (form) => {
        const startMin = Utils.timeToMinutes(value(form, 'startTime'));
        const endMin = Utils.timeToMinutes(value(form, 'endTime'));
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) throw new Error('Enter a valid start and end time.');
        if (endMin <= startMin) throw new Error('End time must be after the start time.');
        const dateKey = value(form, 'dateKey');
        if (!dateKey) throw new Error('Choose a date.');
        if (dateKey > Utils.todayKey()) throw new Error('You cannot log work for a future date.');
        if (dateKey === Utils.todayKey() && endMin > Utils.nowMinutes()) {
          throw new Error('The end time cannot be in the future.');
        }
        const payload = {
          title: value(form, 'title'),
          dateKey,
          startMinutes: startMin,
          endMinutes: endMin,
          taskId: value(form, 'taskId') || null,
          projectId: value(form, 'projectId') || null,
          remarks: value(form, 'remarks'),
          source: existing ? existing.source : 'manual'
        };
        if (!payload.title) throw new Error('Add a short description of the work.');
        const conflicts = Analytics.getConflictingActivities(payload, existing ? existing.id : null);
        if (conflicts.length) {
          const names = conflicts.slice(0, 3).map((a) => `“${a.title}” (${Utils.formatTimeRange(a.startMinutes, a.endMinutes)})`).join(', ');
          const proceed = await UI.confirm({
            title: 'This overlaps another activity',
            message: `It overlaps ${names}${conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : ''}. You can save it, but both entries will be flagged in the activity log.`,
            confirmLabel: 'Save anyway',
            iconName: 'alert-triangle'
          });
          if (!proceed) return false;
        }
        if (existing) {
          Store.updateActivity(existing.id, payload);
          UI.toast('Activity updated.', 'success');
        } else {
          Store.createActivity(payload);
          UI.toast('Activity logged.', 'success');
        }
        if (options.onSaved) options.onSaved();
      }
    });
  }

  return { open };
})();

const ProjectForm = (() => {
  const { value } = FormHelpers;

  function open(options = {}) {
    const existing = options.projectId ? Store.getProject(options.projectId) : null;
    if (options.projectId && !existing) { UI.toast('Project not found.', 'error'); return; }
    const colors = Utils.PROJECT_COLORS;
    const currentColor = existing ? existing.color : (options.color || colors[0]);
    const body = `
      <div class="form-grid">
        <div class="field span-2">
          <label class="field-label" for="projectName">Project name <span class="req">*</span></label>
          <input class="input" id="projectName" name="name" value="${Utils.escapeAttr(existing ? existing.name : '')}" placeholder="e.g. Client Reporting" maxlength="60" required autofocus />
        </div>
        <div class="field span-2">
          <label class="field-label" for="projectDescription">Description</label>
          <textarea class="textarea" id="projectDescription" name="description" rows="3" placeholder="What kind of work belongs here?" maxlength="300">${Utils.escapeHtml(existing ? existing.description : '')}</textarea>
        </div>
        <div class="field span-2">
          <label class="field-label">Colour</label>
          <div class="color-swatches" id="colorSwatches">
            ${colors.map((c) => `<button type="button" class="color-swatch ${c === currentColor ? 'selected' : ''}" style="background:${c}" data-color="${c}" aria-label="Choose colour ${c}"></button>`).join('')}
            <label class="color-swatch" style="background:conic-gradient(#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f87171);display:grid;place-items:center;overflow:hidden" title="Custom colour">
              <input type="color" id="customColor" value="${currentColor}" style="opacity:0;position:absolute;width:100%;height:100%;cursor:pointer" aria-label="Custom colour" />
            </label>
          </div>
          <input type="hidden" name="color" id="projectColor" value="${currentColor}" />
        </div>
      </div>`;
    UI.openModal({
      title: existing ? 'Edit project' : 'Create a project',
      subtitle: 'Group tasks and activities so reports show where your time goes.',
      body,
      submitLabel: existing ? 'Save changes' : 'Create project',
      onMount: (backdrop) => {
        const hidden = backdrop.querySelector('#projectColor');
        const swatches = [...backdrop.querySelectorAll('[data-color]')];
        swatches.forEach((swatch) => {
          swatch.addEventListener('click', () => {
            swatches.forEach((s) => s.classList.remove('selected'));
            swatch.classList.add('selected');
            hidden.value = swatch.dataset.color;
          });
        });
        const custom = backdrop.querySelector('#customColor');
        custom.addEventListener('input', () => {
          hidden.value = custom.value;
          swatches.forEach((s) => s.classList.remove('selected'));
        });
      },
      onSubmit: (form) => {
        const payload = {
          name: value(form, 'name'),
          description: value(form, 'description'),
          color: value(form, 'color') || currentColor
        };
        if (!payload.name) throw new Error('Project name is required.');
        if (existing) {
          Store.updateProject(existing.id, payload);
          UI.toast('Project updated.', 'success');
        } else {
          Store.createProject(payload);
          UI.toast('Project created.', 'success');
        }
        if (options.onSaved) options.onSaved();
      }
    });
  }

  return { open };
})();

window.TaskForm = TaskForm;
window.ActivityForm = ActivityForm;
window.ProjectForm = ProjectForm;
