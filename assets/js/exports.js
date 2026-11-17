/* ============================================================
   FlowTrack — Excel exports (ExcelJS)
   Six real reports with summary sheets, formatted columns,
   filters, duration calculations and styled data tables.
   ============================================================ */

const Exports = (() => {
  const REPORT_TYPES = [
    { id: 'daily', label: 'Daily Activity Report', desc: 'Activity log, idle gaps and project time', icon: 'clock' },
    { id: 'weekly', label: 'Weekly Task Report', desc: 'Tasks, completion and daily performance', icon: 'tasks' },
    { id: 'monthly', label: 'Monthly Productivity', desc: 'Daily & weekly trends, project mix', icon: 'pie-chart' },
    { id: 'history', label: 'Complete Task History', desc: 'Every task with effort & status', icon: 'file-text' },
    { id: 'time', label: 'Time Tracking Report', desc: 'Entries, per-task and per-day totals', icon: 'timer' },
    { id: 'projects', label: 'Project-wise Activity', desc: 'Project hours, tasks and activities', icon: 'folder' }
  ];

  const ARGB = {
    primary: 'FF4F46E5',
    primaryDark: 'FF3730A3',
    primaryLight: 'FFEEF2FF',
    surface: 'FFFFFFFF',
    soft: 'FFF8FAFF',
    border: 'FFE8ECF4',
    ink: 'FF0F172A',
    ink3: 'FF334155',
    muted: 'FF64748B',
    muted2: 'FF94A3B8',
    success: 'FFDCFCE7', successText: 'FF166534',
    info: 'FFDBEAFE', infoText: 'FF1D4ED8',
    warning: 'FFFEF3C7', warningText: 'FF92400E',
    neutral: 'FFF1F5F9', neutralText: 'FF475569',
    danger: 'FFFEE2E2', dangerText: 'FFB91C1C'
  };

  const STATUS_STYLE = {
    Completed: { fill: ARGB.success, font: ARGB.successText },
    'In Progress': { fill: ARGB.info, font: ARGB.infoText },
    'On Hold': { fill: ARGB.warning, font: ARGB.warningText },
    'Not Started': { fill: ARGB.neutral, font: ARGB.neutralText }
  };

  const PRIORITY_STYLE = {
    High: { fill: ARGB.danger, font: ARGB.dangerText },
    Medium: { fill: ARGB.warning, font: ARGB.warningText },
    Low: { fill: ARGB.success, font: ARGB.successText }
  };

  const border = { style: 'thin', color: { argb: ARGB.border } };
  const allBorders = { top: border, left: border, bottom: border, right: border };

  function reportMeta(type) {
    return REPORT_TYPES.find((r) => r.id === type) || REPORT_TYPES[0];
  }

  function defaultRange(type) {
    const settings = Store.getSettings();
    const today = Utils.todayKey();
    if (type === 'weekly') {
      return { from: Utils.startOfWeek(today, settings.weekStartsOn), to: Utils.endOfWeek(today, settings.weekStartsOn) };
    }
    if (type === 'monthly' || type === 'projects') {
      return { from: Utils.startOfMonth(today), to: Utils.endOfMonth(today) };
    }
    if (type === 'history') {
      const dates = Store.getTasks().map((t) => t.assignedDate).filter(Boolean).sort();
      return { from: dates[0] || Utils.addDays(today, -180), to: today };
    }
    if (type === 'time') {
      return { from: Utils.startOfWeek(today, settings.weekStartsOn), to: Utils.endOfWeek(today, settings.weekStartsOn) };
    }
    return { from: today, to: today };
  }

  function fmtDate(key) { return Utils.formatDate(key, 'short-year'); }
  function fmtDay(key) { return Utils.formatDate(key, 'weekday'); }
  function fmtTime(min) { return Utils.formatTime12(min); }
  function hours(min) { return Number((Math.max(0, min) / 60).toFixed(2)); }
  function pctValue(part, total) { return Utils.pct(part, total); }

  function projectLabel(projectId) {
    const project = projectId ? Store.getProject(projectId) : null;
    return project ? project.name : 'Unassigned';
  }

  function collect(opts) {
    const { from, to, projectId = 'all', status = 'all', priority = 'all' } = opts;
    const allTasks = Store.getTasks();
    const taskMap = new Map(allTasks.map((t) => [t.id, t]));
    const activities = Store.getActivities().filter((a) => {
      if (a.dateKey < from || a.dateKey > to) return false;
      if (projectId !== 'all') {
        const task = a.taskId ? taskMap.get(a.taskId) : null;
        if (a.projectId !== projectId && (!task || task.projectId !== projectId)) return false;
      }
      return true;
    });
    let tasks = allTasks.filter((t) => projectId === 'all' || t.projectId === projectId);
    if (status !== 'all') tasks = tasks.filter((t) => t.status === status);
    if (priority !== 'all') tasks = tasks.filter((t) => t.priority === priority);
    const projectActivitiesMap = new Map();
    activities.forEach((a) => {
      const task = a.taskId ? taskMap.get(a.taskId) : null;
      const pid = a.projectId || (task ? task.projectId : null) || '__none__';
      if (!projectActivitiesMap.has(pid)) projectActivitiesMap.set(pid, []);
      projectActivitiesMap.get(pid).push(a);
    });
    return {
      from, to, projectId, status, priority,
      projectName: projectId === 'all' ? 'All projects' : projectLabel(projectId),
      statusName: status === 'all' ? 'All statuses' : status,
      priorityName: priority === 'all' ? 'All priorities' : priority,
      activities,
      allTasks,
      tasks,
      taskMap,
      projectActivitiesMap,
      overlapIds: Analytics.getOverlapIds(activities)
    };
  }

  function filterLine(ctx) {
    return `Period: ${fmtDate(ctx.from)} – ${fmtDate(ctx.to)}   |   Project: ${ctx.projectName}   |   Status: ${ctx.statusName}   |   Priority: ${ctx.priorityName}`;
  }

  function applyStyle(cell, style = {}) {
    if (style.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
    if (style.font) cell.font = { ...(cell.font || {}), ...style.font };
  }

  function styleTitleRows(ws, title, subtitle, columnCount) {
    ws.mergeCells(1, 1, 1, columnCount);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = title;
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.primary } };
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 30;

    ws.mergeCells(2, 1, 2, columnCount);
    const subtitleCell = ws.getCell(2, 1);
    subtitleCell.value = subtitle;
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.primaryLight } };
    subtitleCell.font = { name: 'Calibri', size: 10, color: { argb: ARGB.primaryDark } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    ws.getRow(2).height = 22;
    ws.getRow(3).height = 7;
  }

  function addDataSheet(wb, name, title, subtitle, headers, rows, options = {}) {
    const safeName = name.slice(0, 31);
    const ws = wb.addWorksheet(safeName, {
      views: [{ state: 'frozen', ySplit: 4, xSplit: 0, showGridLines: true }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5 } }
    });
    if (options.widths) ws.columns = options.widths.map((width) => ({ width }));
    styleTitleRows(ws, title, subtitle, headers.length);

    const headerRow = 4;
    headers.forEach((header, index) => {
      const cell = ws.getCell(headerRow, index + 1);
      cell.value = header;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.primaryLight } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: ARGB.primaryDark } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.border = allBorders;
    });
    ws.getRow(headerRow).height = 26;

    if (rows.length) {
      rows.forEach((row, rowIndex) => {
        const excelRow = headerRow + 1 + rowIndex;
        row.forEach((value, colIndex) => {
          const cell = ws.getCell(excelRow, colIndex + 1);
          cell.value = value == null ? '' : value;
          cell.font = { name: 'Calibri', size: 9.5, color: { argb: ARGB.ink3 } };
          cell.alignment = { vertical: 'top', horizontal: options.align && options.align[colIndex] ? options.align[colIndex] : 'left', wrapText: Boolean(options.wrap && options.wrap.includes(colIndex)) };
          cell.border = { bottom: border };
          if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.soft } };
        });
        if (options.colorMaps) {
          Object.entries(options.colorMaps).forEach(([col, map]) => {
            const value = row[Number(col)];
            const style = map[value];
            if (style) {
              const cell = ws.getCell(excelRow, Number(col) + 1);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
              cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: style.font } };
            }
          });
        }
        if (options.numFmt) {
          Object.entries(options.numFmt).forEach(([col, fmt]) => {
            ws.getCell(excelRow, Number(col) + 1).numFmt = fmt;
          });
        }
        ws.getRow(excelRow).height = options.rowHeight || 18;
      });
      ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: headers.length } };
    } else {
      ws.mergeCells(headerRow + 1, 1, headerRow + 1, headers.length);
      const empty = ws.getCell(headerRow + 1, 1);
      empty.value = 'No records match the selected period and filters.';
      empty.font = { name: 'Calibri', size: 10, italic: true, color: { argb: ARGB.muted2 } };
      empty.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(headerRow + 1).height = 30;
    }

    ws.headerFooter = { oddFooter: 'FlowTrack · Generated &P of &N', oddHeader: '' };
    ws.sheetProperties = { tabColor: { argb: ARGB.primary } };
    return ws;
  }

  function addSummarySheet(wb, cfg) {
    const ws = wb.addWorksheet('Summary', {
      views: [{ showGridLines: false }],
      pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    ws.columns = [{ width: 29 }, { width: 23 }, { width: 3 }, { width: 29 }, { width: 23 }, { width: 18 }, { width: 15 }];
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = cfg.title;
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.primary } };
    titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 34;

    ws.mergeCells('A2:G2');
    const subtitle = ws.getCell('A2');
    subtitle.value = cfg.subtitle;
    subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.primaryLight } };
    subtitle.font = { name: 'Calibri', size: 10, color: { argb: ARGB.primaryDark } };
    subtitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    ws.getRow(2).height = 22;

    ws.mergeCells('A3:G3');
    const filters = ws.getCell('A3');
    filters.value = cfg.filters;
    filters.font = { name: 'Calibri', size: 9, color: { argb: ARGB.muted } };
    filters.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    ws.getRow(3).height = 22;

    ws.mergeCells('A5:G5');
    const metricsHeader = ws.getCell('A5');
    metricsHeader.value = 'KEY METRICS';
    metricsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.soft } };
    metricsHeader.font = { name: 'Calibri', size: 9, bold: true, color: { argb: ARGB.muted } };
    metricsHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(5).height = 20;

    cfg.kpis.forEach((kpi, index) => {
      const row = 6 + Math.floor(index / 2);
      const pair = index % 2;
      const labelCol = pair === 0 ? 1 : 4;
      const valueCol = pair === 0 ? 2 : 5;
      const labelCell = ws.getCell(row, labelCol);
      labelCell.value = kpi.label;
      labelCell.font = { name: 'Calibri', size: 9, color: { argb: ARGB.muted } };
      labelCell.alignment = { vertical: 'middle', indent: 1, wrapText: true };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.soft } };
      labelCell.border = allBorders;
      const valueCell = ws.getCell(row, valueCol);
      valueCell.value = kpi.value;
      valueCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB.ink } };
      valueCell.alignment = { vertical: 'middle', indent: 1, wrapText: true };
      valueCell.border = allBorders;
      ws.getRow(row).height = 22;
    });

    let cursor = 6 + Math.ceil(cfg.kpis.length / 2) + 1;
    if (cfg.breakdownRows && cfg.breakdownRows.length) {
      ws.mergeCells(cursor, 1, cursor, 7);
      const breakdownTitle = ws.getCell(cursor, 1);
      breakdownTitle.value = cfg.breakdownTitle || 'BREAKDOWN';
      breakdownTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.soft } };
      breakdownTitle.font = { name: 'Calibri', size: 9, bold: true, color: { argb: ARGB.muted } };
      breakdownTitle.alignment = { vertical: 'middle', indent: 1 };
      ws.getRow(cursor).height = 20;
      cursor += 1;
      const headers = cfg.breakdownHeaders || ['Project', 'Sessions', 'Working hours', 'Share'];
      headers.forEach((header, i) => {
        const cell = ws.getCell(cursor, i + 1);
        cell.value = header;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.primaryLight } };
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: ARGB.primaryDark } };
        cell.border = allBorders;
        cell.alignment = { vertical: 'middle', indent: 1 };
      });
      ws.getRow(cursor).height = 20;
      cursor += 1;
      cfg.breakdownRows.forEach((row) => {
        row.forEach((value, i) => {
          const cell = ws.getCell(cursor, i + 1);
          cell.value = value;
          cell.font = { name: 'Calibri', size: 9.5, color: { argb: ARGB.ink3 } };
          cell.border = allBorders;
          cell.alignment = { vertical: 'middle', indent: i === 0 ? 1 : 0, horizontal: i === 0 ? 'left' : 'right' };
          if (i > 0) cell.numFmt = i === headers.length - 1 && headers[i].includes('%') ? '0%' : undefined;
        });
        if (cfg.breakdownColor && cfg.breakdownColor.get(cursor)) {
          ws.getCell(cursor, 1).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: cfg.breakdownColor.get(cursor) } };
        }
        ws.getRow(cursor).height = 19;
        cursor += 1;
      });
      cursor += 1;
    }

    if (cfg.notes) {
      ws.mergeCells(cursor, 1, cursor + 2, 7);
      const notes = ws.getCell(cursor, 1);
      notes.value = cfg.notes;
      notes.font = { name: 'Calibri', size: 9, italic: true, color: { argb: ARGB.muted } };
      notes.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
      ws.getRow(cursor).height = 18;
    }

    ws.mergeCells(cursor + 4, 1, cursor + 4, 7);
    const footer = ws.getCell(cursor + 4, 1);
    footer.value = `FlowTrack · Personal work & productivity tracker · Exported ${Utils.formatTimestamp(new Date().toISOString())}`;
    footer.font = { name: 'Calibri', size: 8, color: { argb: ARGB.muted2 } };
    footer.alignment = { horizontal: 'left', indent: 1 };

    ws.sheetProperties = { tabColor: { argb: ARGB.primary } };
    return ws;
  }

  function projectRows(ctx) {
    const map = new Map();
    ctx.activities.forEach((a) => {
      const task = a.taskId ? ctx.taskMap.get(a.taskId) : null;
      const pid = a.projectId || (task ? task.projectId : null) || '__none__';
      if (!map.has(pid)) map.set(pid, { minutes: 0, sessions: 0, productive: 0, tasks: new Set() });
      const entry = map.get(pid);
      entry.minutes += a.durationMinutes;
      entry.sessions++;
      if (a.taskId) { entry.productive += a.durationMinutes; entry.tasks.add(a.taskId); }
    });
    const total = [...map.values()].reduce((sum, x) => sum + x.minutes, 0);
    return [...map.entries()].map(([pid, entry]) => ({
      id: pid === '__none__' ? null : pid,
      name: pid === '__none__' ? 'Unassigned' : projectLabel(pid),
      color: pid === '__none__' ? '#94a3b8' : (Store.getProject(pid)?.color || '#4f46e5'),
      ...entry,
      tasks: entry.tasks.size,
      percent: pctValue(entry.minutes, total)
    })).sort((a, b) => b.minutes - a.minutes);
  }

  function buildActivityRows(ctx) {
    return ctx.activities.slice().sort((a, b) => a.dateKey === b.dateKey ? (b.startMinutes - a.startMinutes) : (a.dateKey < b.dateKey ? 1 : -1)).map((a) => {
      const task = a.taskId ? ctx.taskMap.get(a.taskId) : null;
      const pid = a.projectId || (task ? task.projectId : null);
      return [
        fmtDate(a.dateKey), fmtDay(a.dateKey), fmtTime(a.startMinutes), fmtTime(a.endMinutes),
        a.durationMinutes, hours(a.durationMinutes), projectLabel(pid),
        task ? task.title : (a.taskTitle || '—'), a.title, a.remarks || '',
        a.source === 'timer' ? 'Timer' : 'Manual', ctx.overlapIds.has(a.id) ? 'Yes' : 'No'
      ];
    });
  }

  function buildTaskRows(ctx, tasks) {
    return tasks.map((task) => {
      const tracked = Store.getActivities().filter((a) => a.taskId === task.id).reduce((sum, a) => sum + a.durationMinutes, 0);
      return [
        task.title,
        task.description || '',
        projectLabel(task.projectId),
        task.priority,
        task.status,
        fmtDate(task.assignedDate),
        task.startTime ? fmtTime(Utils.timeToMinutes(task.startTime)) : '—',
        task.endTime ? fmtTime(Utils.timeToMinutes(task.endTime)) : '—',
        task.estimatedMinutes,
        task.actualMinutes,
        task.actualMinutes - task.estimatedMinutes,
        hours(task.actualMinutes),
        task.completedAt ? Utils.formatTimestamp(task.completedAt) : '—',
        task.notes || '',
        tracked
      ];
    });
  }

  function dailyBreakdownRows(ctx) {
    return Utils.eachDay(ctx.from, ctx.to).map((key) => {
      const acts = ctx.activities.filter((a) => a.dateKey === key);
      const tracked = acts.reduce((sum, a) => sum + a.durationMinutes, 0);
      const productive = acts.reduce((sum, a) => sum + (a.taskId ? a.durationMinutes : 0), 0);
      const completed = ctx.tasks.filter((t) => t.completedAt && Utils.isoToKey(t.completedAt) === key).length;
      return [
        fmtDate(key), fmtDay(key), acts.length, tracked, hours(tracked), productive, hours(productive),
        pctValue(productive, tracked), completed,
        acts.length ? fmtTime(Math.min(...acts.map((a) => a.startMinutes))) : '—',
        acts.length ? fmtTime(Math.max(...acts.map((a) => a.endMinutes))) : '—'
      ];
    });
  }

  async function generate(opts) {
    if (typeof window.ExcelJS === 'undefined') {
      throw new Error('The Excel library could not be loaded. Reload the page and try again.');
    }
    if (!opts.from || !opts.to) throw new Error('Choose a valid export period.');
    if (isNaN(Utils.fromKey(opts.from).getTime()) || isNaN(Utils.fromKey(opts.to).getTime())) throw new Error('Choose valid dates.');
    if (opts.from > opts.to) throw new Error('The start date must be before the end date.');
    if (Utils.daysBetween(opts.from, opts.to) > 730) throw new Error('Please export a range shorter than two years.');

    const type = reportMeta(opts.type).id;
    const ctx = collect({ ...opts, type });
    const wb = new window.ExcelJS.Workbook();
    wb.creator = 'FlowTrack';
    wb.lastModifiedBy = 'FlowTrack';
    wb.created = new Date();
    wb.modified = new Date();
    wb.company = 'FlowTrack';
    wb.subject = `${reportMeta(type).label} · ${ctx.from} to ${ctx.to}`;
    wb.title = `${reportMeta(type).label} · FlowTrack`;

    const meta = reportMeta(type);
    const subtitle = `${Utils.formatRange(ctx.from, ctx.to, 'medium-year')} · Generated ${Utils.formatTimestamp(new Date().toISOString())}`;
    const productive = ctx.activities.reduce((sum, a) => sum + (a.taskId ? a.durationMinutes : 0), 0);
    const tracked = ctx.activities.reduce((sum, a) => sum + a.durationMinutes, 0);
    const projects = projectRows(ctx);
    let filename = '';

    if (type === 'daily') {
      const daysWithActivity = [...new Set(ctx.activities.map((a) => a.dateKey))];
      let idle = 0;
      const idleRows = [];
      daysWithActivity.forEach((day) => {
        const gaps = Analytics.getIdleGaps(day);
        gaps.gaps.forEach((gap) => {
          idle += gap.durationMinutes;
          idleRows.push([fmtDate(day), fmtDay(day), fmtTime(gap.startMinutes), fmtTime(gap.endMinutes), gap.durationMinutes, hours(gap.durationMinutes)]);
        });
      });
      const timerCount = ctx.activities.filter((a) => a.source === 'timer').length;
      addSummarySheet(wb, {
        title: 'Daily Activity Report',
        subtitle,
        filters: filterLine(ctx),
        kpis: [
          { label: 'Activities logged', value: ctx.activities.length },
          { label: 'Working hours', value: Utils.formatDuration(tracked) },
          { label: 'Productive hours', value: Utils.formatDuration(productive) },
          { label: 'Productivity', value: `${pctValue(productive, tracked)}%` },
          { label: 'Task-linked sessions', value: ctx.activities.filter((a) => a.taskId).length },
          { label: 'Timer entries', value: timerCount },
          { label: 'Manual entries', value: ctx.activities.length - timerCount },
          { label: 'Active days', value: daysWithActivity.length },
          { label: 'Overlapping entries', value: ctx.activities.filter((a) => ctx.overlapIds.has(a.id)).length },
          { label: 'Idle time (workday gaps)', value: Utils.formatDuration(idle) }
        ],
        breakdownTitle: 'TIME BY PROJECT',
        breakdownHeaders: ['Project', 'Sessions', 'Working hours', 'Share'],
        breakdownRows: projects.map((p) => [p.name, p.sessions, hours(p.minutes), `${p.percent}%`]),
        notes: 'Working hours are the sum of all logged activities. Productive hours only include activities linked to a task. Idle time counts gaps of at least the configured threshold inside the workday window. Overlapping entries are marked in the activity sheet.'
      });
      addDataSheet(wb, 'Activities', 'Activity Details', subtitle, ['Date', 'Day', 'Start time', 'End time', 'Duration (min)', 'Duration (h)', 'Project', 'Task', 'Activity', 'Remarks', 'Source', 'Overlap'], buildActivityRows(ctx), {
        widths: [13, 10, 11, 11, 12, 10, 24, 34, 36, 44, 10, 9],
        wrap: [7, 8, 9],
        align: { 4: 'right', 5: 'right', 11: 'center' },
        numFmt: { 4: '0', 5: '0.00' }
      });
      addDataSheet(wb, 'Idle Gaps', 'Idle Gaps', subtitle, ['Date', 'Day', 'From', 'To', 'Duration (min)', 'Duration (h)'], idleRows, {
        widths: [14, 12, 12, 12, 14, 12],
        align: { 4: 'right', 5: 'right' },
        numFmt: { 4: '0', 5: '0.00' }
      });
      filename = `FlowTrack_Daily_Activity_${ctx.from}${ctx.from !== ctx.to ? `_to_${ctx.to}` : ''}.xlsx`;
    } else if (type === 'weekly') {
      const assigned = ctx.tasks.filter((t) => t.assignedDate >= ctx.from && t.assignedDate <= ctx.to);
      const completed = ctx.tasks.filter((t) => t.completedAt && Utils.isoToKey(t.completedAt) >= ctx.from && Utils.isoToKey(t.completedAt) <= ctx.to);
      const pending = assigned.filter((t) => t.status !== 'Completed');
      const completedAssigned = assigned.filter((t) => t.status === 'Completed');
      const dailyRows = dailyBreakdownRows(ctx);
      addSummarySheet(wb, {
        title: 'Weekly Task Report',
        subtitle,
        filters: filterLine(ctx),
        kpis: [
          { label: 'Working hours', value: Utils.formatDuration(tracked) },
          { label: 'Productive hours', value: Utils.formatDuration(productive) },
          { label: 'Productivity', value: `${pctValue(productive, tracked)}%` },
          { label: 'Tasks completed', value: completed.length },
          { label: 'Tasks pending', value: pending.length },
          { label: 'Task completion rate', value: `${pctValue(completedAssigned.length, assigned.length)}%` },
          { label: 'Activities logged', value: ctx.activities.length },
          { label: 'Average daily hours', value: Utils.formatDuration(Math.round(tracked / Math.max(1, Analytics.workingDaysBetween(ctx.from, ctx.to)))) },
          { label: 'Overdue open tasks', value: ctx.tasks.filter((t) => t.status !== 'Completed' && t.assignedDate < Utils.todayKey()).length },
          { label: 'Projects touched', value: projects.length }
        ],
        breakdownTitle: 'DAILY PERFORMANCE',
        breakdownHeaders: ['Day', 'Activities', 'Working hours', 'Productivity'],
        breakdownRows: dailyRows.map((row) => [row[1], row[2], row[4], `${row[7]}%`]),
        notes: 'Task completion rate is completed tasks ÷ tasks assigned in the selected period. "Tasks pending" counts tasks assigned in the period that are not completed. Working hours are derived from the activity log.'
      });
      const taskRows = buildTaskRows(ctx, ctx.tasks.filter((t) => {
        const c = t.completedAt ? Utils.isoToKey(t.completedAt) : '';
        return (t.assignedDate >= ctx.from && t.assignedDate <= ctx.to) || (c >= ctx.from && c <= ctx.to);
      }).sort((a, b) => (a.assignedDate === b.assignedDate ? 0 : (a.assignedDate < b.assignedDate ? -1 : 1))));
      addDataSheet(wb, 'Tasks', 'Task Report', subtitle, ['Task', 'Description', 'Project', 'Priority', 'Status', 'Assigned date', 'Scheduled start', 'Scheduled end', 'Estimated (min)', 'Actual (min)', 'Variance (min)', 'Actual (h)', 'Completed on', 'Notes', 'Tracked (min)'], taskRows, {
        widths: [32, 44, 22, 10, 14, 13, 12, 12, 12, 11, 12, 10, 22, 38, 12],
        wrap: [1, 13],
        align: { 8: 'right', 9: 'right', 10: 'right', 11: 'right', 14: 'right' },
        numFmt: { 8: '0', 9: '0', 10: '0', 11: '0.00', 14: '0' },
        colorMaps: { 3: PRIORITY_STYLE, 4: STATUS_STYLE }
      });
      addDataSheet(wb, 'Daily Breakdown', 'Daily Breakdown', subtitle, ['Date', 'Day', 'Activities', 'Working (min)', 'Working (h)', 'Productive (min)', 'Productive (h)', 'Productivity', 'Tasks completed', 'First start', 'Last end'], dailyRows, {
        widths: [14, 11, 11, 13, 11, 13, 12, 12, 13, 12, 11],
        align: { 2: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right', 7: 'right', 8: 'right' },
        numFmt: { 2: '0', 3: '0', 4: '0.00', 5: '0', 6: '0.00', 7: '0', 8: '0' }
      });
      filename = ctx.from === ctx.to ? `FlowTrack_Weekly_Task_${ctx.from}.xlsx` : `FlowTrack_Weekly_Task_${ctx.from}_${ctx.to}.xlsx`;
    } else if (type === 'monthly') {
      const completed = ctx.tasks.filter((t) => t.completedAt && Utils.isoToKey(t.completedAt) >= ctx.from && Utils.isoToKey(t.completedAt) <= ctx.to);
      const assigned = ctx.tasks.filter((t) => t.assignedDate >= ctx.from && t.assignedDate <= ctx.to);
      const bestDay = Analytics.getMostProductiveDay(ctx.from, ctx.to);
      const dailyRows = dailyBreakdownRows(ctx);
      const weekBuckets = Analytics.getWeekBuckets(ctx.from, ctx.to).map((bucket) => {
        const acts = ctx.activities.filter((a) => a.dateKey >= bucket.from && a.dateKey <= bucket.to);
        const t = acts.reduce((sum, a) => sum + a.durationMinutes, 0);
        const p = acts.reduce((sum, a) => sum + (a.taskId ? a.durationMinutes : 0), 0);
        const c = ctx.tasks.filter((task) => task.completedAt && Utils.isoToKey(task.completedAt) >= bucket.from && Utils.isoToKey(task.completedAt) <= bucket.to).length;
        return [bucket.label, bucket.range, acts.length, t, hours(t), p, hours(p), pctValue(p, t), c];
      });
      const workingDays = Analytics.workingDaysBetween(ctx.from, ctx.to) || 1;
      addSummarySheet(wb, {
        title: 'Monthly Productivity Report',
        subtitle,
        filters: filterLine(ctx),
        kpis: [
          { label: 'Tasks completed', value: completed.length },
          { label: 'Total hours worked', value: Utils.formatDuration(tracked) },
          { label: 'Average daily hours', value: Utils.formatDuration(Math.round(tracked / workingDays)) },
          { label: 'Productivity', value: `${pctValue(productive, tracked)}%` },
          { label: 'Completion rate', value: `${pctValue(assigned.filter((t) => t.status === 'Completed').length, assigned.length)}%` },
          { label: 'Working days tracked', value: new Set(ctx.activities.map((a) => a.dateKey)).size },
          { label: 'Most productive day', value: bestDay ? Utils.formatDate(bestDay.key, 'medium') : '—' },
          { label: 'Pending tasks', value: ctx.tasks.filter((t) => t.status !== 'Completed').length },
          { label: 'Overdue tasks', value: ctx.tasks.filter((t) => t.status !== 'Completed' && t.assignedDate < Utils.todayKey()).length },
          { label: 'Projects active', value: projects.length }
        ],
        breakdownTitle: 'PROJECT TIME DISTRIBUTION',
        breakdownHeaders: ['Project', 'Sessions', 'Working hours', 'Share'],
        breakdownRows: projects.map((p) => [p.name, p.sessions, hours(p.minutes), `${p.percent}%`]),
        notes: 'Productivity = task-linked time ÷ total working time. Completion rate = completed tasks ÷ tasks assigned in the period. Weekly trends are grouped using the configured week start. The daily sheet includes every day in the selected period.'
      });
      addDataSheet(wb, 'Daily Breakdown', 'Daily Breakdown', subtitle, ['Date', 'Day', 'Activities', 'Working (min)', 'Working (h)', 'Productive (min)', 'Productive (h)', 'Productivity', 'Tasks completed', 'First start', 'Last end'], dailyRows, {
        widths: [14, 11, 11, 13, 11, 13, 12, 12, 13, 12, 11],
        align: { 2: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right', 7: 'right', 8: 'right' },
        numFmt: { 2: '0', 3: '0', 4: '0.00', 5: '0', 6: '0.00', 7: '0', 8: '0' }
      });
      addDataSheet(wb, 'Weekly Breakdown', 'Weekly Breakdown', subtitle, ['Week', 'Period', 'Activities', 'Working (min)', 'Working (h)', 'Productive (min)', 'Productive (h)', 'Productivity', 'Tasks completed'], weekBuckets, {
        widths: [10, 20, 11, 13, 11, 13, 12, 12, 13],
        align: { 2: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right', 7: 'right', 8: 'right' },
        numFmt: { 2: '0', 3: '0', 4: '0.00', 5: '0', 6: '0.00', 7: '0', 8: '0' }
      });
      addDataSheet(wb, 'Completed Tasks', 'Completed Tasks', subtitle, ['Task', 'Project', 'Priority', 'Assigned', 'Completed on', 'Estimated (min)', 'Actual (min)', 'Notes'], completed.map((t) => [
        t.title, projectLabel(t.projectId), t.priority, fmtDate(t.assignedDate), Utils.formatTimestamp(t.completedAt), t.estimatedMinutes, t.actualMinutes, t.notes || ''
      ]), {
        widths: [34, 22, 10, 13, 22, 12, 11, 38],
        wrap: [7],
        align: { 4: 'right', 5: 'right', 6: 'right' },
        numFmt: { 4: '0', 5: '0', 6: '0' },
        colorMaps: { 2: PRIORITY_STYLE }
      });
      addDataSheet(wb, 'Project Distribution', 'Project Distribution', subtitle, ['Project', 'Sessions', 'Task count', 'Working (min)', 'Working (h)', 'Productive (min)', 'Share'], projects.map((p) => [
        p.name, p.sessions, p.tasks, p.minutes, hours(p.minutes), p.productive, `${p.percent}%`
      ]), {
        widths: [28, 11, 11, 14, 12, 14, 10],
        align: { 1: 'right', 2: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right' },
        numFmt: { 1: '0', 2: '0', 3: '0', 4: '0.00', 5: '0', 6: '0' }
      });
      filename = `FlowTrack_Monthly_Productivity_${ctx.from.slice(0, 7)}.xlsx`;
    } else if (type === 'history') {
      const scoped = ctx.tasks.filter((t) => {
        const c = t.completedAt ? Utils.isoToKey(t.completedAt) : '';
        return (t.assignedDate >= ctx.from && t.assignedDate <= ctx.to) || (c >= ctx.from && c <= ctx.to);
      }).sort((a, b) => (a.assignedDate === b.assignedDate ? 0 : (a.assignedDate < b.assignedDate ? 1 : -1)));
      const totalEstimated = scoped.reduce((sum, t) => sum + t.estimatedMinutes, 0);
      const totalActual = scoped.reduce((sum, t) => sum + t.actualMinutes, 0);
      const trackedScoped = Store.getActivities().filter((a) => a.taskId && scoped.some((t) => t.id === a.taskId) && a.dateKey >= ctx.from && a.dateKey <= ctx.to).reduce((sum, a) => sum + a.durationMinutes, 0);
      addSummarySheet(wb, {
        title: 'Complete Task History',
        subtitle,
        filters: filterLine(ctx),
        kpis: [
          { label: 'Tasks in report', value: scoped.length },
          { label: 'Completed', value: scoped.filter((t) => t.status === 'Completed').length },
          { label: 'In progress', value: scoped.filter((t) => t.status === 'In Progress').length },
          { label: 'Open tasks', value: scoped.filter((t) => t.status !== 'Completed').length },
          { label: 'Overdue open', value: scoped.filter((t) => t.status !== 'Completed' && t.assignedDate < Utils.todayKey()).length },
          { label: 'Total estimated', value: Utils.formatDuration(totalEstimated) },
          { label: 'Total actual effort', value: Utils.formatDuration(totalActual) },
          { label: 'Tracked in period', value: Utils.formatDuration(trackedScoped) },
          { label: 'Completion rate', value: `${pctValue(scoped.filter((t) => t.status === 'Completed').length, scoped.length)}%` },
          { label: 'Projects covered', value: new Set(scoped.map((t) => t.projectId || '__none__')).size }
        ],
        breakdownTitle: 'TASKS BY STATUS',
        breakdownHeaders: ['Status', 'Tasks', 'Estimated (h)', 'Actual (h)'],
        breakdownRows: Utils.STATUSES.map((status) => {
          const list = scoped.filter((t) => t.status === status);
          return [status, list.length, hours(list.reduce((sum, t) => sum + t.estimatedMinutes, 0)), hours(list.reduce((sum, t) => sum + t.actualMinutes, 0))];
        }),
        notes: 'This sheet lists every task matching the selected period and filters. "Actual effort" is the time saved on the task, including manual adjustments. "Tracked in period" is the sum of linked activity entries within the date range.'
      });
      addDataSheet(wb, 'Task History', 'Task History', subtitle, ['Task', 'Description', 'Project', 'Priority', 'Status', 'Assigned date', 'Scheduled start', 'Scheduled end', 'Estimated (min)', 'Actual (min)', 'Variance (min)', 'Actual (h)', 'Completed on', 'Notes', 'Tracked (min)'], buildTaskRows(ctx, scoped), {
        widths: [32, 44, 22, 10, 14, 13, 12, 12, 12, 11, 12, 10, 22, 38, 12],
        wrap: [1, 13],
        align: { 8: 'right', 9: 'right', 10: 'right', 11: 'right', 14: 'right' },
        numFmt: { 8: '0', 9: '0', 10: '0', 11: '0.00', 14: '0' },
        colorMaps: { 3: PRIORITY_STYLE, 4: STATUS_STYLE }
      });
      filename = `FlowTrack_Task_History_${ctx.from}_to_${ctx.to}.xlsx`;
    } else if (type === 'time') {
      const byTaskMap = new Map();
      const byDayMap = new Map();
      ctx.activities.forEach((a) => {
        const task = a.taskId ? ctx.taskMap.get(a.taskId) : null;
        const taskKey = a.taskId || `snapshot:${a.taskTitle || a.title}`;
        if (!byTaskMap.has(taskKey)) byTaskMap.set(taskKey, { title: task ? task.title : (a.taskTitle || 'Quick activity'), project: projectLabel(a.projectId || (task ? task.projectId : null)), minutes: 0, sessions: 0 });
        const t = byTaskMap.get(taskKey);
        t.minutes += a.durationMinutes; t.sessions++;
        if (!byDayMap.has(a.dateKey)) byDayMap.set(a.dateKey, { minutes: 0, productive: 0, sessions: 0, starts: [], ends: [] });
        const d = byDayMap.get(a.dateKey);
        d.minutes += a.durationMinutes; d.sessions++; d.starts.push(a.startMinutes); d.ends.push(a.endMinutes);
        if (a.taskId) d.productive += a.durationMinutes;
      });
      const byTaskRows = [...byTaskMap.values()].sort((a, b) => b.minutes - a.minutes).map((t) => [t.title, t.project, t.sessions, t.minutes, hours(t.minutes), `${pctValue(t.minutes, tracked)}%`]);
      const byDayRows = [...byDayMap.entries()].sort((a, b) => a[0] < b[0] ? 1 : -1).map(([day, d]) => [fmtDate(day), fmtDay(day), d.sessions, fmtTime(Math.min(...d.starts)), fmtTime(Math.max(...d.ends)), d.minutes, hours(d.minutes), d.productive, pctValue(d.productive, d.minutes)]);
      const avgSession = ctx.activities.length ? Math.round(tracked / ctx.activities.length) : 0;
      const longest = ctx.activities.slice().sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
      addSummarySheet(wb, {
        title: 'Time Tracking Report',
        subtitle,
        filters: filterLine(ctx),
        kpis: [
          { label: 'Time entries', value: ctx.activities.length },
          { label: 'Total working hours', value: Utils.formatDuration(tracked) },
          { label: 'Productive hours', value: Utils.formatDuration(productive) },
          { label: 'Productivity', value: `${pctValue(productive, tracked)}%` },
          { label: 'Average entry', value: Utils.formatDuration(avgSession) },
          { label: 'Longest entry', value: longest ? Utils.formatDuration(longest.durationMinutes) : '—' },
          { label: 'Timer entries', value: ctx.activities.filter((a) => a.source === 'timer').length },
          { label: 'Manual entries', value: ctx.activities.filter((a) => a.source === 'manual').length },
          { label: 'Days with activity', value: byDayMap.size },
          { label: 'Projects tracked', value: projects.length }
        ],
        breakdownTitle: 'TIME BY PROJECT',
        breakdownHeaders: ['Project', 'Sessions', 'Working hours', 'Share'],
        breakdownRows: projects.map((p) => [p.name, p.sessions, hours(p.minutes), `${p.percent}%`]),
        notes: 'Entry durations come directly from the saved activity log. Timer entries are recorded automatically; manual entries are captured through quick logging. Overlapping manual entries are included and marked in the entries sheet.'
      });
      addDataSheet(wb, 'Time Entries', 'Time Entries', subtitle, ['Date', 'Day', 'Start time', 'End time', 'Duration (min)', 'Duration (h)', 'Project', 'Task', 'Activity', 'Source', 'Remarks', 'Overlap'], buildActivityRows(ctx), {
        widths: [13, 10, 11, 11, 12, 10, 24, 34, 36, 10, 44, 9],
        wrap: [7, 8, 10], align: { 4: 'right', 5: 'right', 11: 'center' },
        numFmt: { 4: '0', 5: '0.00' }
      });
      addDataSheet(wb, 'By Task', 'Time by Task', subtitle, ['Task', 'Project', 'Sessions', 'Tracked (min)', 'Tracked (h)', 'Share'], byTaskRows, {
        widths: [40, 24, 11, 13, 12, 10],
        align: { 2: 'right', 3: 'right', 4: 'right', 5: 'right' },
        numFmt: { 2: '0', 3: '0', 4: '0.00' }
      });
      addDataSheet(wb, 'By Day', 'Time by Day', subtitle, ['Date', 'Day', 'Entries', 'First start', 'Last end', 'Tracked (min)', 'Tracked (h)', 'Productive (min)', 'Productivity'], byDayRows, {
        widths: [14, 11, 9, 11, 11, 13, 12, 13, 12],
        align: { 2: 'right', 5: 'right', 6: 'right', 7: 'right', 8: 'right' },
        numFmt: { 2: '0', 5: '0', 6: '0.00', 7: '0', 8: '0' }
      });
      filename = `FlowTrack_Time_Tracking_${ctx.from}_to_${ctx.to}.xlsx`;
    } else {
      /* Project-wise activity */
      const projectTaskSets = new Map();
      ctx.tasks.forEach((t) => {
        const pid = t.projectId || '__none__';
        if (!projectTaskSets.has(pid)) projectTaskSets.set(pid, []);
        projectTaskSets.get(pid).push(t);
      });
      const projectRowsData = projects.map((p) => {
        const projectTasks = ctx.tasks.filter((t) => (t.projectId || '__none__') === (p.id || '__none__'));
        return [
          p.name, p.sessions, p.tasks, projectTasks.length, projectTasks.filter((t) => t.status === 'Completed').length,
          p.minutes, hours(p.minutes), p.productive, hours(p.productive), `${p.percent}%`
        ];
      });
      const projectTaskRows = ctx.tasks.slice().sort((a, b) => (a.projectId || '').localeCompare(b.projectId || '')).map((t) => {
        const pid = t.projectId || '__none__';
        const trackedForTask = ctx.activities.filter((a) => a.taskId === t.id).reduce((sum, a) => sum + a.durationMinutes, 0);
        return [projectLabel(t.projectId), t.title, t.status, t.priority, fmtDate(t.assignedDate), t.estimatedMinutes, t.actualMinutes, trackedForTask, t.actualMinutes - t.estimatedMinutes];
      });
      const topProject = projects[0];
      addSummarySheet(wb, {
        title: 'Project-wise Activity Report',
        subtitle,
        filters: filterLine(ctx),
        kpis: [
          { label: 'Projects in report', value: projects.length },
          { label: 'Working hours', value: Utils.formatDuration(tracked) },
          { label: 'Productive hours', value: Utils.formatDuration(productive) },
          { label: 'Productivity', value: `${pctValue(productive, tracked)}%` },
          { label: 'Activities logged', value: ctx.activities.length },
          { label: 'Tasks in report', value: ctx.tasks.length },
          { label: 'Tasks completed', value: ctx.tasks.filter((t) => t.status === 'Completed').length },
          { label: 'Top project', value: topProject ? topProject.name : '—' },
          { label: 'Average hours per project', value: Utils.formatDuration(projects.length ? Math.round(tracked / projects.length) : 0) },
          { label: 'Overdue open tasks', value: ctx.tasks.filter((t) => t.status !== 'Completed' && t.assignedDate < Utils.todayKey()).length }
        ],
        breakdownTitle: 'PROJECT SUMMARY',
        breakdownHeaders: ['Project', 'Activities', 'Working hours', 'Share'],
        breakdownRows: projects.map((p) => [p.name, p.sessions, hours(p.minutes), `${p.percent}%`]),
        notes: 'Project totals include activities linked directly to a project and activities linked through a task in that project. Task counts respect the selected project, status and priority filters.'
      });
      addDataSheet(wb, 'Projects', 'Project Summary', subtitle, ['Project', 'Activities', 'Task-linked activities', 'Tasks', 'Completed tasks', 'Working (min)', 'Working (h)', 'Productive (min)', 'Productive (h)', 'Share'], projectRowsData, {
        widths: [28, 11, 18, 9, 14, 12, 11, 13, 12, 9],
        align: { 1: 'right', 2: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right', 7: 'right', 8: 'right', 9: 'right' },
        numFmt: { 1: '0', 2: '0', 3: '0', 4: '0', 5: '0', 6: '0.00', 7: '0', 8: '0.00' }
      });
      addDataSheet(wb, 'Project Activities', 'Project Activities', subtitle, ['Project', 'Date', 'Day', 'Start', 'End', 'Duration (min)', 'Duration (h)', 'Task', 'Activity', 'Source', 'Remarks'], ctx.activities.slice().sort((a, b) => a.dateKey === b.dateKey ? b.startMinutes - a.startMinutes : (a.dateKey < b.dateKey ? 1 : -1)).map((a) => {
        const task = a.taskId ? ctx.taskMap.get(a.taskId) : null;
        return [projectLabel(a.projectId || (task ? task.projectId : null)), fmtDate(a.dateKey), fmtDay(a.dateKey), fmtTime(a.startMinutes), fmtTime(a.endMinutes), a.durationMinutes, hours(a.durationMinutes), task ? task.title : (a.taskTitle || '—'), a.title, a.source === 'timer' ? 'Timer' : 'Manual', a.remarks || ''];
      }), {
        widths: [24, 13, 10, 10, 10, 12, 10, 34, 36, 9, 42],
        wrap: [7, 8, 10], align: { 5: 'right', 6: 'right' },
        numFmt: { 5: '0', 6: '0.00' }
      });
      addDataSheet(wb, 'Project Tasks', 'Project Tasks', subtitle, ['Project', 'Task', 'Status', 'Priority', 'Assigned', 'Estimated (min)', 'Actual (min)', 'Tracked (min)', 'Variance (min)'], projectTaskRows, {
        widths: [24, 38, 14, 10, 13, 12, 11, 12, 12],
        align: { 5: 'right', 6: 'right', 7: 'right', 8: 'right' },
        numFmt: { 5: '0', 6: '0', 7: '0', 8: '0' },
        colorMaps: { 2: STATUS_STYLE, 3: PRIORITY_STYLE }
      });
      filename = `FlowTrack_Project_Activity_${ctx.from}_to_${ctx.to}.xlsx`;
    }

    await new Promise((resolve) => setTimeout(resolve, 30));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    Utils.downloadBlob(blob, filename);
    return { filename, activities: ctx.activities.length, tasks: ctx.tasks.length, type: meta.label };
  }

  function open(options = {}) {
    const initialType = reportMeta(options.type).id;
    const range = defaultRange(initialType);
    const from = options.from || range.from;
    const to = options.to || range.to;
    const initialProject = options.projectId || 'all';
    const initialStatus = options.status || 'all';
    const initialPriority = options.priority || 'all';
    const projects = Store.getProjects();

    const optionsHtml = REPORT_TYPES.map((report) => `
      <label class="export-type ${report.id === initialType ? 'selected' : ''}" data-type-card="${report.id}">
        <input type="radio" name="reportType" value="${report.id}" ${report.id === initialType ? 'checked' : ''} hidden />
        ${Utils.icon(report.icon)}
        <span><strong>${Utils.escapeHtml(report.label)}</strong><span>${Utils.escapeHtml(report.desc)}</span></span>
      </label>`).join('');

    const body = `
      <div class="export-type-grid" role="radiogroup" aria-label="Report type">${optionsHtml}</div>
      <div class="export-section-label">Report period</div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label" for="exportFrom">From date</label>
          <input class="input" type="date" id="exportFrom" name="from" value="${from}" required />
        </div>
        <div class="field">
          <label class="field-label" for="exportTo">To date</label>
          <input class="input" type="date" id="exportTo" name="to" value="${to}" required />
        </div>
      </div>
      <div class="export-section-label">Filters</div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label" for="exportProject">Project</label>
          <select class="select" id="exportProject" name="projectId">
            <option value="all">All projects</option>
            ${projects.map((p) => `<option value="${p.id}" ${p.id === initialProject ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="exportStatus">Status <span class="optional">task sheets</span></label>
          <select class="select" id="exportStatus" name="status">
            <option value="all">All statuses</option>
            ${Utils.STATUSES.map((s) => `<option value="${s}" ${s === initialStatus ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="exportPriority">Priority <span class="optional">task sheets</span></label>
          <select class="select" id="exportPriority" name="priority">
            <option value="all">All priorities</option>
            ${Utils.PRIORITIES.map((p) => `<option value="${p}" ${p === initialPriority ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">Data source</label>
          <div class="input" style="display:flex;align-items:center;gap:7px;color:var(--muted);background:var(--surface-soft);">
            ${Utils.icon('database')}<span style="font-size:11px">Saved local data</span>
          </div>
        </div>
      </div>
      <div class="export-preview" id="exportPreview"></div>`;

    const modal = UI.openModal({
      title: 'Download Excel report',
      subtitle: 'Formatted workbooks with summary sheets, filters and full detail.',
      size: 'modal-lg',
      body,
      submitLabel: 'Generate Excel',
      submitIcon: 'download',
      onMount: (backdrop) => {
        const form = backdrop.querySelector('form');
        const preview = backdrop.querySelector('#exportPreview');
        const updatePreview = () => {
          const type = form.querySelector('input[name="reportType"]:checked')?.value || 'daily';
          const data = collect({
            from: form.from.value || from,
            to: form.to.value || to,
            projectId: form.projectId.value,
            status: form.status.value,
            priority: form.priority.value
          });
          const sheetCount = { daily: 3, weekly: 3, monthly: 5, history: 2, time: 4, projects: 4 }[type] || 2;
          preview.innerHTML = `<strong>${Utils.escapeHtml(reportMeta(type).label)}</strong>
            <span>${data.activities.length} activities · ${data.tasks.length} tasks in scope · ${sheetCount} worksheets</span>
            <span>Includes a summary sheet, filters and duration calculations. Dates shown as ${Utils.formatDate(form.from.value || from, 'short-year')} – ${Utils.formatDate(form.to.value || to, 'short-year')}.</span>`;
          backdrop.querySelectorAll('[data-type-card]').forEach((card) => card.classList.toggle('selected', card.dataset.typeCard === type));
          const submit = backdrop.querySelector('button[type="submit"] span');
          if (submit) submit.textContent = 'Generate Excel';
        };
        form.addEventListener('change', updatePreview);
        form.addEventListener('input', updatePreview);
        updatePreview();
      },
      onSubmit: async (form) => {
        const type = form.querySelector('input[name="reportType"]:checked')?.value || 'daily';
        const result = await generate({
          type,
          from: form.from.value,
          to: form.to.value,
          projectId: form.projectId.value,
          status: form.status.value,
          priority: form.priority.value
        });
        UI.toast(`Downloaded ${result.filename}`, 'success', 'Excel report ready');
      }
    });
    return modal;
  }

  return { open, generate, defaultRange, REPORT_TYPES };
})();

window.Exports = Exports;
