/* ============================================================
   FlowTrack — Persistent store
   Single source of truth for tasks, activities, projects, timers.
   Storage: localStorage. All writes are synchronous and atomic.
   ============================================================ */

const Store = (() => {
  const STORAGE_KEY = 'flowtrack.state.v1';
  function activeStorageKey() { return `${STORAGE_KEY}.${(window.Auth && Auth.username ? Auth.username.toLowerCase() : 'guest')}`; }
  const listeners = new Set();
  let state = null;
  let persistent = true;
  let lastSaveError = null;

  function fail(code, message, extra = {}) {
    const err = new Error(message);
    err.code = code;
    Object.assign(err, extra);
    return err;
  }

  function nowIso() { return new Date().toISOString(); }

  function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function numberOr(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeSettings(raw = {}) {
    const base = {
      name: 'Yogesh',
      workdayStart: '09:00',
      workdayEnd: '18:00',
      dailyTargetHours: 8,
      idleThresholdMinutes: 15,
      weekStartsOn: 1,
      defaultProjectId: ''
    };
    const s = { ...base, ...(isPlainObject(raw) ? raw : {}) };
    s.name = String(s.name || 'Yogesh').trim().slice(0, 60) || 'Yogesh';
    if (!/^\d{2}:\d{2}$/.test(s.workdayStart)) s.workdayStart = '09:00';
    if (!/^\d{2}:\d{2}$/.test(s.workdayEnd)) s.workdayEnd = '18:00';
    if (s.workdayStart >= s.workdayEnd) { s.workdayStart = '09:00'; s.workdayEnd = '18:00'; }
    s.dailyTargetHours = Utils.clamp(numberOr(s.dailyTargetHours, 8), 1, 16);
    s.idleThresholdMinutes = Utils.clamp(Math.round(numberOr(s.idleThresholdMinutes, 15)), 5, 240);
    s.weekStartsOn = Number(s.weekStartsOn) === 0 ? 0 : 1;
    s.defaultProjectId = typeof s.defaultProjectId === 'string' ? s.defaultProjectId : '';
    return s;
  }

  function normalizeProject(raw) {
    if (!isPlainObject(raw) || !raw.name) return null;
    return {
      id: raw.id || Utils.uid('prj'),
      name: String(raw.name).trim().slice(0, 60) || 'Untitled project',
      description: String(raw.description || '').trim().slice(0, 300),
      color: /^#[0-9a-f]{6}$/i.test(String(raw.color || '')) ? raw.color : '#4f46e5',
      createdAt: raw.createdAt || nowIso()
    };
  }

  function normalizeTask(raw) {
    if (!isPlainObject(raw) || !raw.title) return null;
    const status = Utils.STATUSES.includes(raw.status) ? raw.status : 'Not Started';
    const priority = Utils.PRIORITIES.includes(raw.priority) ? raw.priority : 'Medium';
    const assignedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.assignedDate || '')) && !isNaN(Utils.fromKey(raw.assignedDate).getTime())
      ? raw.assignedDate : Utils.todayKey();
    const startTime = /^\d{2}:\d{2}$/.test(String(raw.startTime || '')) ? raw.startTime : '';
    const endTime = /^\d{2}:\d{2}$/.test(String(raw.endTime || '')) ? raw.endTime : '';
    const task = {
      id: raw.id || Utils.uid('tsk'),
      title: String(raw.title).trim().slice(0, 160),
      description: String(raw.description || '').trim().slice(0, 4000),
      projectId: raw.projectId ? String(raw.projectId) : null,
      priority,
      status,
      assignedDate,
      startTime,
      endTime,
      estimatedMinutes: Math.max(0, Math.round(numberOr(raw.estimatedMinutes, 0))),
      actualMinutes: Math.max(0, Math.round(numberOr(raw.actualMinutes, 0))),
      notes: String(raw.notes || '').trim().slice(0, 4000),
      createdAt: raw.createdAt || nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
      completedAt: raw.completedAt || null
    };
    if (task.status === 'Completed' && !task.completedAt) task.completedAt = task.updatedAt;
    if (task.status !== 'Completed') task.completedAt = null;
    return task;
  }

  function normalizeActivity(raw) {
    if (!isPlainObject(raw) || !raw.title) return null;
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.dateKey || '')) && !isNaN(Utils.fromKey(raw.dateKey).getTime())
      ? raw.dateKey : null;
    if (!dateKey) return null;
    const startMinutes = Math.round(numberOr(raw.startMinutes, -1));
    let endMinutes = Math.round(numberOr(raw.endMinutes, -1));
    if (startMinutes < 0 || endMinutes <= startMinutes) return null;
    endMinutes = Math.min(endMinutes, 1440);
    if (endMinutes <= startMinutes) return null;
    return {
      id: raw.id || Utils.uid('act'),
      dateKey,
      startMinutes,
      endMinutes,
      durationMinutes: Math.min(1440, Math.max(1, endMinutes - startMinutes)),
      title: String(raw.title).trim().slice(0, 200),
      remarks: String(raw.remarks || '').trim().slice(0, 2000),
      taskId: raw.taskId ? String(raw.taskId) : null,
      taskTitle: String(raw.taskTitle || '').trim().slice(0, 200),
      projectId: raw.projectId ? String(raw.projectId) : null,
      source: raw.source === 'timer' ? 'timer' : 'manual',
      createdAt: raw.createdAt || nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || nowIso()
    };
  }

  function normalizeTimer(raw, tasks) {
    if (!isPlainObject(raw) || !raw.taskId) return null;
    const taskExists = tasks.some((t) => t.id === raw.taskId);
    if (!taskExists) return null;
    const sessionSeconds = Math.max(0, numberOr(raw.sessionSeconds, 0));
    let status = raw.status === 'paused' ? 'paused' : 'running';
    let segmentStartedAt = numberOr(raw.segmentStartedAt, 0) || null;
    if (status === 'running' && !segmentStartedAt) status = 'paused';
    if (status === 'paused') segmentStartedAt = null;
    return {
      taskId: raw.taskId,
      status,
      startedAt: status === 'running' ? (raw.startedAt || nowIso()) : null,
      segmentStartedAt,
      sessionSeconds,
      sessionStartedAt: raw.sessionStartedAt || raw.startedAt || nowIso(),
      note: String(raw.note || '').slice(0, 500)
    };
  }

  function normalizeState(raw, { strict = false } = {}) {
    if (!isPlainObject(raw)) throw fail('INVALID_BACKUP', 'The data file is not valid FlowTrack data.');
    if (strict && (!Array.isArray(raw.tasks) || !Array.isArray(raw.projects) || !Array.isArray(raw.activities))) {
      throw fail('INVALID_BACKUP', 'The backup is missing tasks, projects or activities. Nothing was restored.');
    }
    const empty = SeedData.empty();
    const projects = Array.isArray(raw.projects) ? raw.projects.map(normalizeProject).filter(Boolean) : [];
    const tasks = Array.isArray(raw.tasks) ? raw.tasks.map(normalizeTask).filter(Boolean) : [];
    const validTaskIds = new Set(tasks.map((t) => t.id));
    const activities = Array.isArray(raw.activities)
      ? raw.activities.map(normalizeActivity).filter(Boolean).map((a) => {
        if (a.taskId && !validTaskIds.has(a.taskId)) { a.taskId = null; }
        return a;
      })
      : [];
    const normalized = {
      version: 1,
      createdAt: raw.createdAt || nowIso(),
      updatedAt: raw.updatedAt || nowIso(),
      meta: {
        isDemo: Boolean(raw.meta && raw.meta.isDemo),
        seededAt: raw.meta ? raw.meta.seededAt || null : null,
        seedVersion: 1,
        app: 'FlowTrack'
      },
      settings: normalizeSettings(raw.settings),
      projects: projects.length ? projects : empty.projects,
      tasks,
      activities,
      timer: normalizeTimer(raw.timer, tasks)
    };
    if (normalized.settings.defaultProjectId && !normalized.projects.some((p) => p.id === normalized.settings.defaultProjectId)) {
      normalized.settings.defaultProjectId = normalized.projects[0] ? normalized.projects[0].id : '';
    }
    return normalized;
  }

  function persist() {
    try {
      localStorage.setItem(activeStorageKey(), JSON.stringify(state));
      if (window.Auth && Auth.isAuthenticated()) Auth.saveFolderBackup(state);
      if (window.Cloud && Cloud.enabled && Cloud.user) Cloud.queue(state);
      lastSaveError = null;
      persistent = true;
      return true;
    } catch (err) {
      lastSaveError = err;
      persistent = false;
      window.dispatchEvent(new CustomEvent('flowtrack:storageerror', { detail: { message: err.message } }));
      return false;
    }
  }

  function notify() {
    listeners.forEach((fn) => {
      try { fn(state); } catch (err) { console.error('FlowTrack listener error', err); }
    });
    window.dispatchEvent(new CustomEvent('flowtrack:changed', { detail: { state } }));
  }

  function loadFromDisk() {
    let raw = null;
    try {
      raw = localStorage.getItem(activeStorageKey());
    } catch (err) {
      persistent = false;
      raw = null;
    }
    if (!raw) {
      state = SeedData.generate();
      persist();
      return state;
    }
    try {
      const parsed = JSON.parse(raw);
      state = normalizeState(parsed);
    } catch (err) {
      console.error('FlowTrack could not read saved data; loading sample data.', err);
      try { localStorage.setItem(`${activeStorageKey()}.corrupt.${Date.now()}`, raw); } catch (_) {}
      state = SeedData.generate();
      persist();
    }
    return state;
  }

  function init() {
    if (!state) loadFromDisk();
    return state;
  }

  function commit(mutator, { silent = false } = {}) {
    init();
    const result = mutator(state);
    state.updatedAt = nowIso();
    persist();
    if (!silent) notify();
    return result;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getState() { init(); return state; }
  function getSettings() { return init().settings; }
  function getProjects() { return init().projects; }
  function getTasks() { return init().tasks; }
  function getActivities() { return init().activities; }
  function getTimer() { return init().timer; }
  function getProject(id) { return init().projects.find((p) => p.id === id) || null; }
  function getTask(id) { return init().tasks.find((t) => t.id === id) || null; }
  function getActivity(id) { return init().activities.find((a) => a.id === id) || null; }
  function getTimerTask() {
    const timer = init().timer;
    return timer ? getTask(timer.taskId) : null;
  }

  function isStoragePersistent() { return persistent; }
  function getLastSaveError() { return lastSaveError; }

  /* ----------------------------- Tasks ----------------------------- */
  function normalizeTaskInput(payload, existing = null) {
    const base = existing || {
      title: '', description: '', projectId: null, priority: 'Medium', status: 'Not Started',
      assignedDate: Utils.todayKey(), startTime: '', endTime: '', estimatedMinutes: 0,
      actualMinutes: 0, notes: ''
    };
    const merged = { ...base, ...payload };
    if (!String(merged.title || '').trim()) throw fail('VALIDATION', 'Task title is required.');
    if (!Utils.STATUSES.includes(merged.status)) throw fail('VALIDATION', 'Choose a valid task status.');
    if (!Utils.PRIORITIES.includes(merged.priority)) throw fail('VALIDATION', 'Choose a valid priority.');
    if (!merged.assignedDate || isNaN(Utils.fromKey(merged.assignedDate).getTime())) throw fail('VALIDATION', 'Choose a valid assigned date.');
    const start = merged.startTime || '';
    const end = merged.endTime || '';
    if (start && !/^\d{2}:\d{2}$/.test(start)) throw fail('VALIDATION', 'Start time must be a valid time.');
    if (end && !/^\d{2}:\d{2}$/.test(end)) throw fail('VALIDATION', 'End time must be a valid time.');
    if (start && end && end <= start) throw fail('VALIDATION', 'End time must be after the start time.');
    const estimated = Math.round(numberOr(merged.estimatedMinutes, 0));
    const actual = Math.round(numberOr(merged.actualMinutes, 0));
    if (estimated < 0) throw fail('VALIDATION', 'Estimated duration cannot be negative.');
    if (actual < 0) throw fail('VALIDATION', 'Actual time cannot be negative.');
    if (estimated > 60 * 24 * 30) throw fail('VALIDATION', 'Estimated duration is too large.');
    const projectId = merged.projectId && getProject(merged.projectId) ? merged.projectId : null;
    return {
      title: String(merged.title).trim().slice(0, 160),
      description: String(merged.description || '').trim().slice(0, 4000),
      projectId,
      priority: merged.priority,
      status: merged.status,
      assignedDate: merged.assignedDate,
      startTime: start,
      endTime: end,
      estimatedMinutes: estimated,
      actualMinutes: actual,
      notes: String(merged.notes || '').trim().slice(0, 4000)
    };
  }

  function createTask(payload) {
    const fields = normalizeTaskInput(payload);
    if (!fields.projectId && getSettings().defaultProjectId) {
      if (getProject(getSettings().defaultProjectId)) fields.projectId = getSettings().defaultProjectId;
    }
    const timestamp = nowIso();
    const task = {
      id: Utils.uid('tsk'),
      ...fields,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: fields.status === 'Completed' ? timestamp : null
    };
    commit((s) => {
      s.tasks.unshift(task);
    });
    return task;
  }

  function updateTask(id, patch) {
    const existing = getTask(id);
    if (!existing) throw fail('NOT_FOUND', 'This task no longer exists.');
    const fields = normalizeTaskInput(patch, existing);
    const statusChanged = existing.status !== fields.status;
    const activeTimer = getTimer();
    if (fields.status === 'Completed' && activeTimer && activeTimer.taskId === id) {
      throw fail('TIMER_ACTIVE_TASK', 'Stop the running timer before completing this task.');
    }
    let completedAt = existing.completedAt;
    if (fields.status === 'Completed') {
      if (!completedAt || existing.status !== 'Completed') completedAt = patch.completedAt || nowIso();
    } else {
      completedAt = null;
    }
    const updated = {
      ...existing,
      ...fields,
      completedAt,
      updatedAt: nowIso()
    };
    commit((s) => {
      const index = s.tasks.findIndex((t) => t.id === id);
      if (index >= 0) s.tasks[index] = updated;
    });
    return updated;
  }

  function updateTaskStatus(id, status) {
    if (!Utils.STATUSES.includes(status)) throw fail('VALIDATION', 'Choose a valid task status.');
    return updateTask(id, { status });
  }

  function deleteTask(id) {
    const task = getTask(id);
    if (!task) throw fail('NOT_FOUND', 'This task no longer exists.');
    const timer = getTimer();
    if (timer && timer.taskId === id) throw fail('TIMER_ACTIVE_TASK', 'Stop the running timer before deleting this task.');
    commit((s) => {
      s.tasks = s.tasks.filter((t) => t.id !== id);
      s.activities.forEach((a) => {
        if (a.taskId === id) {
          a.taskId = null;
          if (!a.taskTitle) a.taskTitle = task.title;
        }
      });
    });
    return task;
  }

  /* ----------------------------- Projects ----------------------------- */
  function normalizeProjectInput(payload, existing = null) {
    const merged = { ...(existing || {}), ...payload };
    const name = String(merged.name || '').trim();
    if (!name) throw fail('VALIDATION', 'Project name is required.');
    return {
      name: name.slice(0, 60),
      description: String(merged.description || '').trim().slice(0, 300),
      color: /^#[0-9a-f]{6}$/i.test(String(merged.color || '')) ? merged.color : '#4f46e5'
    };
  }

  function createProject(payload) {
    const fields = normalizeProjectInput(payload);
    const project = { id: Utils.uid('prj'), ...fields, createdAt: nowIso() };
    commit((s) => { s.projects.push(project); });
    return project;
  }

  function updateProject(id, patch) {
    const existing = getProject(id);
    if (!existing) throw fail('NOT_FOUND', 'This project no longer exists.');
    const fields = normalizeProjectInput(patch, existing);
    const updated = { ...existing, ...fields };
    commit((s) => {
      const index = s.projects.findIndex((p) => p.id === id);
      if (index >= 0) s.projects[index] = updated;
    });
    return updated;
  }

  function deleteProject(id) {
    const project = getProject(id);
    if (!project) throw fail('NOT_FOUND', 'This project no longer exists.');
    commit((s) => {
      s.projects = s.projects.filter((p) => p.id !== id);
      s.tasks.forEach((t) => { if (t.projectId === id) t.projectId = null; });
      s.activities.forEach((a) => { if (a.projectId === id) a.projectId = null; });
      if (s.settings.defaultProjectId === id) {
        s.settings.defaultProjectId = s.projects[0] ? s.projects[0].id : '';
      }
    });
    return project;
  }

  /* ----------------------------- Activities ----------------------------- */
  function normalizeActivityInput(payload, existing = null) {
    const base = existing || {
      title: '', remarks: '', dateKey: Utils.todayKey(), startMinutes: 0, endMinutes: 0,
      taskId: null, projectId: null, source: 'manual'
    };
    const merged = { ...base, ...payload };
    const title = String(merged.title || '').trim();
    if (!title) throw fail('VALIDATION', 'Activity title is required.');
    const dateKey = merged.dateKey;
    if (!dateKey || isNaN(Utils.fromKey(dateKey).getTime())) throw fail('VALIDATION', 'Choose a valid activity date.');
    let start = merged.startMinutes;
    let end = merged.endMinutes;
    if (typeof merged.startTime === 'string' && merged.startTime) start = Utils.timeToMinutes(merged.startTime);
    if (typeof merged.endTime === 'string' && merged.endTime) end = Utils.timeToMinutes(merged.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw fail('VALIDATION', 'Enter a valid start and end time.');
    if (start < 0 || end > 1440) throw fail('VALIDATION', 'Activity time must fall within the selected day.');
    if (end <= start) throw fail('VALIDATION', 'End time must be after the start time.');
    if (dateKey > Utils.todayKey()) throw fail('VALIDATION', 'You cannot log work for a future date.');
    const task = merged.taskId ? getTask(merged.taskId) : null;
    const projectId = task ? task.projectId : (merged.projectId && getProject(merged.projectId) ? merged.projectId : null);
    return {
      dateKey,
      startMinutes: Math.round(start),
      endMinutes: Math.round(end),
      durationMinutes: Math.max(1, Math.round(end - start)),
      title: title.slice(0, 200),
      remarks: String(merged.remarks || '').trim().slice(0, 2000),
      taskId: task ? task.id : null,
      taskTitle: task ? task.title : String(merged.taskTitle || '').trim().slice(0, 200),
      projectId,
      source: merged.source === 'timer' ? 'timer' : 'manual'
    };
  }

  function adjustTaskActual(taskId, delta) {
    if (!taskId) return;
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.actualMinutes = Math.max(0, Math.round(task.actualMinutes + delta));
    task.updatedAt = nowIso();
  }

  function createActivity(payload) {
    const fields = normalizeActivityInput(payload);
    const timestamp = nowIso();
    const activity = {
      id: Utils.uid('act'),
      ...fields,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    commit((s) => {
      s.activities.push(activity);
      adjustTaskActual(fields.taskId, fields.durationMinutes);
    });
    return activity;
  }

  function updateActivity(id, patch) {
    const existing = getActivity(id);
    if (!existing) throw fail('NOT_FOUND', 'This activity no longer exists.');
    const fields = normalizeActivityInput(patch, existing);
    const updated = { ...existing, ...fields, updatedAt: nowIso() };
    commit((s) => {
      const index = s.activities.findIndex((a) => a.id === id);
      if (index < 0) return;
      adjustTaskActual(existing.taskId, -existing.durationMinutes);
      adjustTaskActual(updated.taskId, updated.durationMinutes);
      s.activities[index] = updated;
    });
    return updated;
  }

  function deleteActivity(id) {
    const existing = getActivity(id);
    if (!existing) throw fail('NOT_FOUND', 'This activity no longer exists.');
    commit((s) => {
      s.activities = s.activities.filter((a) => a.id !== id);
      adjustTaskActual(existing.taskId, -existing.durationMinutes);
    });
    return existing;
  }

  /* ----------------------------- Timer ----------------------------- */
  function getTimerElapsedSeconds(timer = getTimer()) {
    if (!timer) return 0;
    let seconds = Math.max(0, numberOr(timer.sessionSeconds, 0));
    if (timer.status === 'running' && timer.segmentStartedAt) {
      seconds += Math.max(0, (Date.now() - timer.segmentStartedAt) / 1000);
    }
    return Math.max(0, seconds);
  }

  function finalizeTimerSegment(task, startMs, endMs, note) {
    const taskId = task.id;
    const activitiesCreated = [];
    let cursor = startMs;
    let guard = 0;
    const endTime = Math.max(startMs, endMs);
    while (cursor < endTime && guard < 20) {
      const startDate = new Date(cursor);
      const dayKey = Utils.toKey(startDate);
      const nextDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1, 0, 0, 0, 0).getTime();
      const pieceEnd = Math.min(endTime, nextDay);
      const startMinutes = Math.round(startDate.getHours() * 60 + startDate.getMinutes() + startDate.getSeconds() / 60);
      let durationMinutes = Math.max(1, Math.round((pieceEnd - cursor) / 60000));
      let endMinutes = Math.min(1440, startMinutes + durationMinutes);
      if (endMinutes <= startMinutes) { cursor = pieceEnd; guard++; continue; }
      durationMinutes = endMinutes - startMinutes;
      const timestamp = new Date(cursor).toISOString();
      const activity = {
        id: Utils.uid('act'),
        dateKey: dayKey,
        startMinutes,
        endMinutes,
        durationMinutes,
        title: `Worked on ${task.title}`,
        remarks: String(note || '').trim() || 'Tracked with the FlowTrack timer.',
        taskId,
        taskTitle: task.title,
        projectId: task.projectId,
        source: 'timer',
        createdAt: timestamp,
        updatedAt: nowIso()
      };
      state.activities.push(activity);
      activitiesCreated.push(activity);
      adjustTaskActual(taskId, durationMinutes);
      cursor = pieceEnd;
      guard++;
    }
    return activitiesCreated;
  }

  function startTimer(taskId, note = '') {
    const task = getTask(taskId);
    if (!task) throw fail('NOT_FOUND', 'Choose a task before starting the timer.');
    if (task.status === 'Completed') throw fail('TASK_COMPLETED', 'Completed tasks cannot be tracked. Reopen the task first.');
    if (getTimer()) throw fail('TIMER_ACTIVE', 'A timer is already active. Stop it before starting another one.', { timer: getTimer() });
    commit((s) => {
      const t = s.tasks.find((x) => x.id === taskId);
      if (t.status !== 'In Progress') {
        t.status = 'In Progress';
        t.completedAt = null;
        t.updatedAt = nowIso();
      }
      const timestamp = nowIso();
      s.timer = {
        taskId,
        status: 'running',
        startedAt: timestamp,
        segmentStartedAt: Date.now(),
        sessionSeconds: 0,
        sessionStartedAt: timestamp,
        note: String(note || '').trim().slice(0, 500)
      };
    });
    return getTimer();
  }

  function pauseTimer() {
    const timer = getTimer();
    if (!timer) throw fail('NO_TIMER', 'There is no active timer to pause.');
    if (timer.status === 'paused') return { minutes: 0, sessionSeconds: getTimerElapsedSeconds(timer), activities: [] };
    const task = getTask(timer.taskId);
    if (!task) throw fail('NOT_FOUND', 'The task for this timer no longer exists.');
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, (nowMs - timer.segmentStartedAt) / 1000);
    let created = [];
    if (elapsedSeconds >= 3) {
      created = finalizeTimerSegment(task, timer.segmentStartedAt, nowMs, timer.note);
    }
    commit((s) => {
      s.timer.sessionSeconds = Math.max(0, numberOr(s.timer.sessionSeconds, 0)) + elapsedSeconds;
      s.timer.status = 'paused';
      s.timer.segmentStartedAt = null;
      s.timer.startedAt = null;
    });
    const minutes = created.reduce((sum, a) => sum + a.durationMinutes, 0);
    return { minutes, sessionSeconds: getTimerElapsedSeconds(), activities: created };
  }

  function resumeTimer() {
    const timer = getTimer();
    if (!timer) throw fail('NO_TIMER', 'There is no timer to resume.');
    if (timer.status === 'running') return timer;
    commit((s) => {
      s.timer.status = 'running';
      s.timer.startedAt = nowIso();
      s.timer.segmentStartedAt = Date.now();
    });
    return getTimer();
  }

  function stopTimer() {
    const timer = getTimer();
    if (!timer) throw fail('NO_TIMER', 'There is no active timer.');
    const task = getTask(timer.taskId);
    let created = [];
    let elapsed = 0;
    if (timer.status === 'running' && task) {
      const nowMs = Date.now();
      elapsed = Math.max(0, (nowMs - timer.segmentStartedAt) / 1000);
      if (elapsed >= 3) {
        created = finalizeTimerSegment(task, timer.segmentStartedAt, nowMs, timer.note);
      }
    }
    const totalSeconds = Math.max(0, numberOr(timer.sessionSeconds, 0) + elapsed);
    const minutes = created.reduce((sum, a) => sum + a.durationMinutes, 0);
    commit((s) => {
      s.timer = null;
    });
    return {
      taskId: timer.taskId,
      taskTitle: task ? task.title : '',
      minutes,
      totalSeconds,
      activities: created
    };
  }

  function updateTimerNote(note) {
    if (!getTimer()) return;
    commit((s) => {
      s.timer.note = String(note || '').slice(0, 500);
    }, { silent: true });
  }

  /* ----------------------------- Settings & data ----------------------------- */
  function updateSettings(patch) {
    const current = getSettings();
    let next = normalizeSettings({ ...current, ...patch });
    if (next.defaultProjectId && !getProject(next.defaultProjectId)) next.defaultProjectId = '';
    commit((s) => {
      s.settings = next;
      s.meta.isDemo = false;
    });
    return next;
  }

  function exportData() {
    init();
    return JSON.stringify({
      app: 'FlowTrack',
      backupVersion: 1,
      exportedAt: nowIso(),
      state
    }, null, 2);
  }

  function importData(text) {
    if (!text || !String(text).trim()) throw fail('INVALID_BACKUP', 'The selected file is empty.');
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { throw fail('INVALID_BACKUP', 'The file is not valid JSON.'); }
    const candidate = parsed && parsed.state ? parsed.state : parsed;
    const normalized = normalizeState(candidate, { strict: true });
    normalized.meta.isDemo = false;
    normalized.updatedAt = nowIso();
    state = normalized;
    persist();
    notify();
    return state;
  }

  function loadSampleData() {
    state = SeedData.generate();
    persist();
    notify();
    return state;
  }

  function clearAllData() {
    state = SeedData.empty();
    persist();
    notify();
    return state;
  }

  function getStorageInfo() {
    init();
    let raw = '';
    try { raw = localStorage.getItem(activeStorageKey()) || ''; } catch (_) {}
    const bytes = new Blob([raw]).size;
    const quota = 5 * 1024 * 1024;
    return {
      bytes,
      percent: Math.min(100, (bytes / quota) * 100),
      tasks: state.tasks.length,
      activities: state.activities.length,
      projects: state.projects.length,
      persistent
    };
  }

  function reloadFromStorage() {
    const previous = state;
    try {
      const raw = localStorage.getItem(activeStorageKey());
      if (!raw) return previous;
      state = normalizeState(JSON.parse(raw));
      notify();
      return state;
    } catch (err) {
      console.error('FlowTrack reload failed', err);
      return previous;
    }
  }

  return {
    get STORAGE_KEY() { return activeStorageKey(); },
    init, subscribe, getState, getSettings, getProjects, getTasks, getActivities, getTimer,
    getProject, getTask, getActivity, getTimerTask, isStoragePersistent, getLastSaveError,
    createTask, updateTask, updateTaskStatus, deleteTask,
    createProject, updateProject, deleteProject,
    createActivity, updateActivity, deleteActivity,
    startTimer, pauseTimer, resumeTimer, stopTimer, updateTimerNote, getTimerElapsedSeconds,
    updateSettings, exportData, importData, loadSampleData, clearAllData,
    getStorageInfo, reloadFromStorage, persist
  };
})();

window.Store = Store;
