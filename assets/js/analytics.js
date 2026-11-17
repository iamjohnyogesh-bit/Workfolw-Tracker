/* ============================================================
   FlowTrack — Analytics
   All reporting metrics are derived from saved tasks and
   activities. Nothing here is hard-coded.
   ============================================================ */

const Analytics = (() => {

  function getWeekStart(key = Utils.todayKey()) {
    return Utils.startOfWeek(key, Store.getSettings().weekStartsOn);
  }

  function getWeekEnd(key = Utils.todayKey()) {
    return Utils.endOfWeek(key, Store.getSettings().weekStartsOn);
  }

  function inRange(dateKey, from, to) {
    return Boolean(dateKey) && dateKey >= from && dateKey <= to;
  }

  function activitiesInRange(from, to) {
    return Store.getActivities().filter((a) => inRange(a.dateKey, from, to));
  }

  function tasksAssignedInRange(from, to) {
    return Store.getTasks().filter((t) => inRange(t.assignedDate, from, to));
  }

  function completedDateKey(task) {
    return task.completedAt ? Utils.isoToKey(task.completedAt) : '';
  }

  function tasksCompletedInRange(from, to) {
    return Store.getTasks().filter((t) => {
      const key = completedDateKey(t);
      return key && inRange(key, from, to);
    });
  }

  function isOpen(task) { return task.status !== 'Completed'; }

  function overdueTasks(asOf = Utils.todayKey()) {
    return Store.getTasks()
      .filter((t) => isOpen(t) && t.assignedDate < asOf)
      .sort(Utils.sortTasks);
  }

  function getTaskCounts(scopeTasks = Store.getTasks()) {
    const counts = { total: scopeTasks.length, completed: 0, inProgress: 0, notStarted: 0, onHold: 0, open: 0, overdue: 0 };
    const today = Utils.todayKey();
    scopeTasks.forEach((t) => {
      if (t.status === 'Completed') counts.completed++;
      else {
        counts.open++;
        if (t.status === 'In Progress') counts.inProgress++;
        if (t.status === 'Not Started') counts.notStarted++;
        if (t.status === 'On Hold') counts.onHold++;
        if (t.assignedDate < today) counts.overdue++;
      }
    });
    counts.pending = counts.notStarted + counts.onHold;
    counts.completionRate = Utils.pct(counts.completed, counts.total);
    return counts;
  }

  function productiveMinutes(activities) {
    return activities.reduce((sum, a) => sum + (a.taskId ? a.durationMinutes : 0), 0);
  }

  function trackedMinutes(activities) {
    return activities.reduce((sum, a) => sum + a.durationMinutes, 0);
  }

  function workingDaysBetween(from, to) {
    return Utils.eachDay(from, to).filter((key) => {
      const day = Utils.weekdayIndex(key);
      return day !== 0 && day !== 6;
    }).length;
  }

  function getRangeStats(from, to) {
    const activities = activitiesInRange(from, to);
    const tracked = trackedMinutes(activities);
    const productive = productiveMinutes(activities);
    const assigned = tasksAssignedInRange(from, to);
    const completed = tasksCompletedInRange(from, to);
    const assignedCompleted = assigned.filter((t) => t.status === 'Completed');
    const openAssigned = assigned.filter(isOpen);
    const open = Store.getTasks().filter(isOpen);
    const overdue = open.filter((t) => t.assignedDate < Utils.todayKey());
    const days = Utils.eachDay(from, to);
    const workingDays = workingDaysBetween(from, to) || 1;
    const activeDays = days.filter((d) => activities.some((a) => a.dateKey === d)).length;
    return {
      from, to,
      activities,
      trackedMinutes: tracked,
      productiveMinutes: productive,
      unproductiveMinutes: Math.max(0, tracked - productive),
      productivity: Utils.pct(productive, tracked),
      targetMinutes: Store.getSettings().dailyTargetHours * 60,
      tasks: {
        assigned: assigned.length,
        completed: completed.length,
        assignedCompleted: assignedCompleted.length,
        openAssigned: openAssigned.length,
        completionRate: Utils.pct(assignedCompleted.length, assigned.length),
        averagePerDay: days.length ? assigned.length / days.length : 0
      },
      completedTasks: completed,
      assignedTasks: assigned,
      openAssignedTasks: openAssigned,
      openTasks: open,
      overdueTasks: overdue,
      activityCount: activities.length,
      activeDays,
      workingDays,
      averageDailyMinutes: tracked / workingDays,
      averageActiveDayMinutes: activeDays ? tracked / activeDays : 0,
      taskCounts: getTaskCounts(),
      firstStart: activities.length ? Math.min(...activities.map((a) => a.startMinutes)) : null,
      lastEnd: activities.length ? Math.max(...activities.map((a) => a.endMinutes)) : null
    };
  }

  function dailySeries(from, to) {
    const all = activitiesInRange(from, to);
    const tasks = Store.getTasks();
    return Utils.eachDay(from, to).map((key) => {
      const acts = all.filter((a) => a.dateKey === key);
      const tracked = trackedMinutes(acts);
      const productive = productiveMinutes(acts);
      const completed = tasks.filter((t) => completedDateKey(t) === key);
      return {
        key,
        trackedMinutes: tracked,
        productiveMinutes: productive,
        unproductiveMinutes: Math.max(0, tracked - productive),
        productivity: Utils.pct(productive, tracked),
        completedCount: completed.length,
        activityCount: acts.length,
        isWeekend: Utils.weekdayIndex(key) === 0 || Utils.weekdayIndex(key) === 6
      };
    });
  }

  function getProjectBreakdown(from, to) {
    const activities = activitiesInRange(from, to);
    const tasks = Store.getTasks();
    const projects = Store.getProjects();
    const map = new Map();
    const ensure = (projectId) => {
      const key = projectId || '__none__';
      if (!map.has(key)) {
        const project = projects.find((p) => p.id === projectId) || null;
        map.set(key, {
          id: projectId || null,
          name: project ? project.name : 'Unassigned',
          color: project ? project.color : '#94a3b8',
          minutes: 0,
          productiveMinutes: 0,
          sessions: 0,
          tasks: new Set(),
          taskIds: new Set()
        });
      }
      return map.get(key);
    };
    activities.forEach((a) => {
      const task = a.taskId ? tasks.find((t) => t.id === a.taskId) : null;
      const entry = ensure(a.projectId || (task ? task.projectId : null));
      entry.minutes += a.durationMinutes;
      if (a.taskId) entry.productiveMinutes += a.durationMinutes;
      entry.sessions++;
      if (a.taskId) entry.taskIds.add(a.taskId);
    });
    const total = activities.reduce((sum, a) => sum + a.durationMinutes, 0);
    return [...map.values()]
      .map((entry) => ({
        ...entry,
        percent: Utils.pct(entry.minutes, total),
        taskCount: entry.taskIds.size,
        tasks: undefined,
        taskIds: undefined
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  function getTaskTimeBreakdown(from, to) {
    const activities = activitiesInRange(from, to).filter((a) => a.taskId || a.taskTitle);
    const tasks = Store.getTasks();
    const map = new Map();
    activities.forEach((a) => {
      const key = a.taskId || `snapshot:${a.taskTitle}`;
      if (!map.has(key)) {
        const task = tasks.find((t) => t.id === a.taskId);
        map.set(key, {
          taskId: a.taskId,
          title: task ? task.title : (a.taskTitle || 'Untitled task'),
          projectId: a.projectId || (task ? task.projectId : null),
          minutes: 0,
          sessions: 0
        });
      }
      const entry = map.get(key);
      entry.minutes += a.durationMinutes;
      entry.sessions++;
    });
    const total = [...map.values()].reduce((sum, entry) => sum + entry.minutes, 0);
    return [...map.values()].map((entry) => ({ ...entry, percent: Utils.pct(entry.minutes, total) })).sort((a, b) => b.minutes - a.minutes);
  }

  function getProjectStats() {
    const tasks = Store.getTasks();
    const activities = Store.getActivities();
    return Store.getProjects().map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const projectActivities = activities.filter((a) => a.projectId === project.id || projectTasks.some((t) => t.id === a.taskId));
      const completed = projectTasks.filter((t) => t.status === 'Completed').length;
      return {
        ...project,
        tasks: projectTasks.length,
        completed,
        open: projectTasks.length - completed,
        completionRate: Utils.pct(completed, projectTasks.length),
        minutes: trackedMinutes(projectActivities),
        activities: projectActivities.length,
        lastActivity: projectActivities.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))[0] || null
      };
    }).sort((a, b) => b.minutes - a.minutes);
  }

  function getUpcomingTasks(limit = 6) {
    const today = Utils.todayKey();
    const open = Store.getTasks().filter(isOpen);
    const sorted = open.sort((a, b) => {
      const aLate = a.assignedDate < today ? 0 : 1;
      const bLate = b.assignedDate < today ? 0 : 1;
      if (aLate !== bLate) return aLate - bLate;
      if (a.assignedDate !== b.assignedDate) return a.assignedDate < b.assignedDate ? -1 : 1;
      const priority = { High: 0, Medium: 1, Low: 2 };
      return priority[a.priority] - priority[b.priority];
    });
    return sorted.slice(0, limit);
  }

  function getTodayTasks() {
    const today = Utils.todayKey();
    return Store.getTasks().filter((t) => t.assignedDate === today).sort(Utils.sortTasks);
  }

  function getTodayActivities() {
    const today = Utils.todayKey();
    return Store.getActivities().filter((a) => a.dateKey === today).sort((a, b) => a.startMinutes - b.startMinutes);
  }

  function getOverlapIds(activities = Store.getActivities()) {
    const byDate = new Map();
    activities.forEach((a) => {
      if (!byDate.has(a.dateKey)) byDate.set(a.dateKey, []);
      byDate.get(a.dateKey).push(a);
    });
    const overlap = new Set();
    byDate.forEach((list) => {
      const sorted = list.slice().sort((a, b) => a.startMinutes - b.startMinutes);
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].startMinutes >= sorted[i].endMinutes) break;
          if (sorted[i].startMinutes < sorted[j].endMinutes && sorted[j].startMinutes < sorted[i].endMinutes) {
            overlap.add(sorted[i].id);
            overlap.add(sorted[j].id);
          }
        }
      }
    });
    return overlap;
  }

  function getConflictingActivities(candidate, ignoreId = null) {
    if (!candidate || !candidate.dateKey) return [];
    const start = candidate.startMinutes;
    const end = candidate.endMinutes;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    return Store.getActivities().filter((a) => {
      if (a.id === ignoreId) return false;
      if (a.dateKey !== candidate.dateKey) return false;
      return start < a.endMinutes && a.startMinutes < end;
    });
  }

  function getIdleGaps(dateKey, thresholdMinutes = null, asOfNow = true) {
    const settings = Store.getSettings();
    const threshold = thresholdMinutes == null ? settings.idleThresholdMinutes : thresholdMinutes;
    const winStart = Utils.timeToMinutes(settings.workdayStart);
    const winEndFull = Utils.timeToMinutes(settings.workdayEnd);
    let winEnd = winEndFull;
    if (dateKey === Utils.todayKey() && asOfNow) {
      const now = Utils.nowMinutes();
      if (now < winStart) return { gaps: [], totalMinutes: 0, windowStart: winStart, windowEnd: winStart, threshold };
      winEnd = Math.min(winEndFull, now);
    }
    const acts = Store.getActivities()
      .filter((a) => a.dateKey === dateKey)
      .map((a) => ({
        start: Math.max(winStart, Math.min(1440, a.startMinutes)),
        end: Math.min(winEnd, Math.max(winStart, a.endMinutes))
      }))
      .filter((interval) => interval.end > interval.start)
      .sort((a, b) => a.start - b.start);
    const merged = [];
    acts.forEach((interval) => {
      const last = merged[merged.length - 1];
      if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
      else merged.push({ ...interval });
    });
    const gaps = [];
    let cursor = winStart;
    merged.forEach((interval) => {
      if (interval.start > cursor) gaps.push({ startMinutes: cursor, endMinutes: interval.start, durationMinutes: interval.start - cursor });
      cursor = Math.max(cursor, interval.end);
    });
    if (winEnd > cursor) gaps.push({ startMinutes: cursor, endMinutes: winEnd, durationMinutes: winEnd - cursor });
    const qualifying = gaps.filter((gap) => gap.durationMinutes >= threshold);
    return {
      gaps: qualifying,
      allGaps: gaps,
      totalMinutes: qualifying.reduce((sum, gap) => sum + gap.durationMinutes, 0),
      windowStart: winStart,
      windowEnd: winEnd,
      threshold
    };
  }

  function getWeekSummary(anchor = Utils.todayKey()) {
    const from = getWeekStart(anchor);
    const to = getWeekEnd(anchor);
    const prevFrom = Utils.addDays(from, -7);
    const prevTo = Utils.addDays(to, -7);
    return {
      from, to, prevFrom, prevTo,
      label: Utils.formatRange(from, to),
      stats: getRangeStats(from, to),
      previous: getRangeStats(prevFrom, prevTo),
      daily: dailySeries(from, to),
      projects: getProjectBreakdown(from, to),
      taskTime: getTaskTimeBreakdown(from, to)
    };
  }

  function getMonthSummary(anchor = Utils.todayKey()) {
    const from = Utils.startOfMonth(anchor);
    const to = Utils.endOfMonth(anchor);
    const prevFrom = Utils.startOfMonth(Utils.addMonths(anchor, -1));
    const prevTo = Utils.endOfMonth(Utils.addMonths(anchor, -1));
    return {
      from, to, prevFrom, prevTo,
      label: Utils.formatDate(from, 'month-year'),
      stats: getRangeStats(from, to),
      previous: getRangeStats(prevFrom, prevTo),
      daily: dailySeries(from, to),
      weekly: getWeekBuckets(from, to),
      projects: getProjectBreakdown(from, to),
      taskTime: getTaskTimeBreakdown(from, to)
    };
  }

  function getWeekBuckets(from, to, weekStartsOn = null) {
    const startsOn = weekStartsOn == null ? Store.getSettings().weekStartsOn : weekStartsOn;
    const buckets = [];
    let cursor = Utils.startOfWeek(from, startsOn);
    let guard = 0;
    while (cursor <= to && guard < 10) {
      const weekEnd = Utils.addDays(cursor, 6);
      const clippedStart = cursor < from ? from : cursor;
      const clippedEnd = weekEnd > to ? to : weekEnd;
      const stats = getRangeStats(clippedStart, clippedEnd);
      buckets.push({
        index: buckets.length + 1,
        from: clippedStart,
        to: clippedEnd,
        fullFrom: cursor,
        fullTo: weekEnd,
        label: `Week ${buckets.length + 1}`,
        range: Utils.formatRange(clippedStart, clippedEnd, 'short'),
        stats,
        daily: dailySeries(clippedStart, clippedEnd).filter((d) => !d.isWeekend || d.trackedMinutes > 0 || d.completedCount > 0)
      });
      cursor = Utils.addDays(cursor, 7);
      guard++;
    }
    return buckets;
  }

  function getMostProductiveDay(from, to) {
    const days = dailySeries(from, to);
    const candidates = days.filter((d) => d.trackedMinutes > 0 || d.completedCount > 0);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
      if (b.productiveMinutes !== a.productiveMinutes) return b.productiveMinutes - a.productiveMinutes;
      if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
      return b.trackedMinutes - a.trackedMinutes;
    })[0];
  }

  function getProductivityTone(value) {
    if (value >= 70) return 'good';
    if (value >= 45) return 'medium';
    return 'low';
  }

  function getProductivityLabel(value) {
    if (value >= 80) return 'Excellent focus';
    if (value >= 65) return 'Strong focus';
    if (value >= 45) return 'Balanced focus';
    if (value > 0) return 'Fragmented focus';
    return 'No tracked time';
  }

  function getDailyTargetProgress(dateKey = Utils.todayKey()) {
    const settings = Store.getSettings();
    const target = Math.max(1, settings.dailyTargetHours) * 60;
    const acts = Store.getActivities().filter((a) => a.dateKey === dateKey);
    const tracked = trackedMinutes(acts);
    const productive = productiveMinutes(acts);
    return {
      target,
      tracked,
      productive,
      percent: Math.min(100, Utils.pct(tracked, target)),
      rawPercent: Utils.pct(tracked, target),
      remaining: Math.max(0, target - tracked),
      exceeded: tracked > target
    };
  }

  function getLongestSession(from, to) {
    const acts = activitiesInRange(from, to);
    if (!acts.length) return null;
    return acts.slice().sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
  }

  function getAverageSession(from, to) {
    const acts = activitiesInRange(from, to);
    if (!acts.length) return 0;
    return Math.round(trackedMinutes(acts) / acts.length);
  }

  function getActiveStreak() {
    let streak = 0;
    let cursor = Utils.todayKey();
    const activityDays = new Set(Store.getActivities().map((a) => a.dateKey));
    if (!activityDays.has(cursor)) cursor = Utils.addDays(cursor, -1);
    let guard = 0;
    while (activityDays.has(cursor) && guard < 366) {
      const day = Utils.weekdayIndex(cursor);
      if (day !== 0 && day !== 6) streak++;
      cursor = Utils.addDays(cursor, -1);
      guard++;
    }
    return streak;
  }

  function getTasksDueWithin(daysAhead = 7) {
    const today = Utils.todayKey();
    const end = Utils.addDays(today, daysAhead);
    return Store.getTasks().filter((t) => isOpen(t) && t.assignedDate >= today && t.assignedDate <= end);
  }

  function getProjectName(projectId) {
    if (!projectId) return 'No project';
    const project = Store.getProject(projectId);
    return project ? project.name : 'No project';
  }

  function getTaskCompletionSeries(from, to) {
    return dailySeries(from, to).map((day) => ({ key: day.key, completed: day.completedCount }));
  }

  function getComparison(current, previous) {
    const pctChange = (a, b) => {
      if (!b) return a ? 100 : 0;
      return Number((((a - b) / b) * 100).toFixed(0));
    };
    return {
      tracked: pctChange(current.trackedMinutes, previous.trackedMinutes),
      completed: pctChange(current.tasks.completed, previous.tasks.completed),
      productivity: Number((current.productivity - previous.productivity).toFixed(0)),
      activityCount: pctChange(current.activityCount, previous.activityCount),
      completionRate: Number((current.tasks.completionRate - previous.tasks.completionRate).toFixed(0))
    };
  }

  function getActivitiesGroupedByDate(activities) {
    const groups = new Map();
    activities.forEach((activity) => {
      if (!groups.has(activity.dateKey)) groups.set(activity.dateKey, []);
      groups.get(activity.dateKey).push(activity);
    });
    return [...groups.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([dateKey, entries]) => ({
        dateKey,
        entries: entries.slice().sort((a, b) => b.startMinutes - a.startMinutes),
        totalMinutes: trackedMinutes(entries),
        productiveMinutes: productiveMinutes(entries)
      }));
  }

  function getCalendarDaySummary(dateKey) {
    const tasks = Store.getTasks().filter((t) => t.assignedDate === dateKey);
    const activities = Store.getActivities().filter((a) => a.dateKey === dateKey).sort((a, b) => a.startMinutes - b.startMinutes);
    const completed = tasks.filter((t) => t.status === 'Completed').length;
    return {
      dateKey,
      tasks,
      activities,
      completed,
      open: tasks.length - completed,
      completionRate: Utils.pct(completed, tasks.length),
      trackedMinutes: trackedMinutes(activities),
      productiveMinutes: productiveMinutes(activities)
    };
  }

  function getStatusBreakdown() {
    const counts = getTaskCounts();
    return [
      { label: 'Completed', value: counts.completed, color: '#10b981' },
      { label: 'In Progress', value: counts.inProgress, color: '#3b82f6' },
      { label: 'Not Started', value: counts.notStarted, color: '#94a3b8' },
      { label: 'On Hold', value: counts.onHold, color: '#f59e0b' }
    ];
  }

  function getPriorityBreakdown() {
    const tasks = Store.getTasks();
    return Utils.PRIORITIES.map((priority) => ({
      label: priority,
      value: tasks.filter((t) => t.priority === priority).length,
      open: tasks.filter((t) => t.priority === priority && isOpen(t)).length
    }));
  }

  return {
    inRange, getWeekStart, getWeekEnd, activitiesInRange, tasksAssignedInRange,
    tasksCompletedInRange, completedDateKey, isOpen, overdueTasks, getTaskCounts,
    trackedMinutes, productiveMinutes, workingDaysBetween, getRangeStats, dailySeries,
    getProjectBreakdown, getTaskTimeBreakdown, getProjectStats, getUpcomingTasks,
    getTodayTasks, getTodayActivities, getOverlapIds, getConflictingActivities,
    getIdleGaps, getWeekSummary, getMonthSummary, getWeekBuckets, getMostProductiveDay,
    getProductivityTone, getProductivityLabel, getDailyTargetProgress, getLongestSession,
    getAverageSession, getActiveStreak, getTasksDueWithin, getProjectName,
    getTaskCompletionSeries, getComparison, getActivitiesGroupedByDate,
    getCalendarDaySummary, getStatusBreakdown, getPriorityBreakdown
  };
})();

window.Analytics = Analytics;
