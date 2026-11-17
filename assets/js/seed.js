/* ============================================================
   FlowTrack — Sample data
   Creates a realistic month of work so reports are useful on
   first load. Dates are relative to the day the app is opened.
   ============================================================ */

const SeedData = (() => {

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function localIso(key, hours = 9, minutes = 0) {
    const d = Utils.fromKey(key);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  }

  function generate() {
    const rng = mulberry32(20261116);
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
    const today = Utils.todayKey();
    const now = new Date();

    const projects = [
      { id: 'prj_ops', name: 'Production Operations', description: 'Daily production reviews, SOPs, quality checks and operational coordination.', color: '#4f46e5', createdAt: localIso(Utils.addDays(today, -60), 9, 0) },
      { id: 'prj_analytics', name: 'KPI & Analytics', description: 'Dashboards, KPI analysis, metrics definitions and performance reporting.', color: '#0d9488', createdAt: localIso(Utils.addDays(today, -60), 9, 5) },
      { id: 'prj_automation', name: 'Excel Automation', description: 'Scripts, templates and automations that remove repetitive reporting work.', color: '#d97706', createdAt: localIso(Utils.addDays(today, -60), 9, 10) },
      { id: 'prj_client', name: 'Client Reporting', description: 'Client reports, QBRs, onboarding packs and account communication.', color: '#e11d48', createdAt: localIso(Utils.addDays(today, -60), 9, 15) },
      { id: 'prj_team', name: 'Team & Admin', description: 'Team rituals, 1:1s, planning, onboarding and day-to-day admin.', color: '#7c3aed', createdAt: localIso(Utils.addDays(today, -60), 9, 20) }
    ];

    const templates = [
      {
        key: 'daily-review', title: 'Daily production review', project: 0, priority: 'High', status: 'Completed',
        description: 'Review overnight production output, downtime notes and the day\'s operational priorities. Flag anomalies for the shift leads.',
        assignedOffset: 0, start: '09:00', end: '09:45', estimate: 45, completedOffset: 0,
        notes: 'Two minor line stoppages reviewed; maintenance follow-up logged.'
      },
      {
        key: 'kpi-analysis', title: 'KPI dashboard analysis', project: 1, priority: 'High', status: 'Completed',
        description: 'Analyse the weekly KPI dashboard, validate source data and write up the key movements for the operations review.',
        assignedOffset: 0, start: '10:00', end: '11:30', estimate: 90, completedOffset: 0,
        notes: 'Output per hour trending up 4.2% week on week.'
      },
      {
        key: 'client-northwind', title: 'Client report — Northwind', project: 3, priority: 'High', status: 'Completed',
        description: 'Compile the monthly service report for Northwind, including SLA performance, incident summaries and the improvement roadmap.',
        assignedOffset: -2, start: '13:00', end: '15:00', estimate: 120, completedOffset: -1,
        notes: 'Sent for account director review before Friday\'s call.'
      },
      {
        key: 'weekly-ops', title: 'Weekly operations sync', project: 0, priority: 'Medium', status: 'Completed',
        description: 'Prepare the agenda and run the weekly operations sync with shift leads; capture actions and owners.',
        assignedOffset: -5, start: '10:00', end: '11:00', estimate: 60, completedOffset: -4,
        notes: 'Action log updated in the shared operations sheet.'
      },
      {
        key: 'quality-audit', title: 'Quality audit checklist', project: 0, priority: 'Medium', status: 'Completed',
        description: 'Refresh the monthly quality audit checklist and spot-check five recent production batches against the criteria.',
        assignedOffset: -10, start: '14:00', end: '15:00', estimate: 60, completedOffset: -9,
        notes: 'Two checklist items were out of date; corrected in the SOP.'
      },
      {
        key: 'one-on-one', title: 'Team 1:1 preparation', project: 4, priority: 'Low', status: 'Completed',
        description: 'Collect progress notes and talking points for this week\'s 1:1 conversations with the team.',
        assignedOffset: -3, start: '16:00', end: '16:30', estimate: 30, completedOffset: -3,
        notes: 'Added a workload check-in for the automation workstream.'
      },
      {
        key: 'client-feedback', title: 'Respond to client feedback', project: 3, priority: 'High', status: 'Completed',
        description: 'Review the client feedback thread, draft a response with the proposed fixes and confirm timelines with the account lead.',
        assignedOffset: -7, start: '11:00', end: '11:45', estimate: 45, completedOffset: -6,
        notes: 'Response approved; fix scheduled for next release.'
      },
      {
        key: 'data-quality', title: 'Data quality spot check', project: 1, priority: 'Medium', status: 'Completed',
        description: 'Run a spot check across the production and KPI datasets to catch missing values, duplicates and out-of-range entries.',
        assignedOffset: -12, start: '09:00', end: '10:00', estimate: 60, completedOffset: -11,
        notes: 'Three duplicate records removed from the daily export.'
      },
      {
        key: 'invoice-recon', title: 'Vendor invoice reconciliation', project: 0, priority: 'Medium', status: 'Completed',
        description: 'Match vendor invoices against purchase orders and delivery notes; resolve discrepancies with procurement.',
        assignedOffset: -13, start: '13:00', end: '14:30', estimate: 90, completedOffset: -12,
        notes: 'One invoice on hold pending a revised delivery note.'
      },
      {
        key: 'onboard-analyst', title: 'Onboarding: new analyst', project: 4, priority: 'Medium', status: 'Completed',
        description: 'Prepare the onboarding schedule, system access checklist and first-week walkthrough for the new data analyst.',
        assignedOffset: -9, start: '10:00', end: '12:00', estimate: 120, completedOffset: -8,
        notes: 'Access request submitted; buddy assigned.'
      },
      {
        key: 'handover-notes', title: 'Production handover notes', project: 0, priority: 'Medium', status: 'Completed',
        description: 'Write a concise handover covering current production issues, pending approvals and contacts for the weekend cover.',
        assignedOffset: -16, start: '16:00', end: '17:00', estimate: 60, completedOffset: -15,
        notes: 'Shared with the weekend duty lead.'
      },
      {
        key: 'dashboard-refresh', title: 'Dashboard refresh — operations', project: 1, priority: 'Medium', status: 'Completed',
        description: 'Refresh the operations dashboard layout and check that all source queries return current data.',
        assignedOffset: -17, start: '09:30', end: '11:00', estimate: 90, completedOffset: -16,
        notes: 'Charts now use the updated shift calendar.'
      },
      {
        key: 'archive-q3', title: 'Archive Q3 project files', project: 0, priority: 'Low', status: 'Completed',
        description: 'Archive the completed Q3 project files and confirm that shared links still resolve for the team.',
        assignedOffset: -21, start: '15:00', end: '16:00', estimate: 45, completedOffset: -20,
        notes: 'Archive index updated in the knowledge base.'
      },
      {
        key: 'client-data-issue', title: 'Resolve client data issue', project: 3, priority: 'High', status: 'Completed',
        description: 'Investigate the missing February records reported by the client and verify the corrected data export.',
        assignedOffset: -6, start: '12:00', end: '13:00', estimate: 60, completedOffset: -5,
        notes: 'Root cause: stale filter in the scheduled export. Fixed and verified.'
      },
      {
        key: 'kpi-commentary', title: 'Update weekly KPI commentary', project: 1, priority: 'Medium', status: 'Completed',
        description: 'Add context to the biggest KPI movements and prepare a short narrative for the leadership update.',
        assignedOffset: -3, start: '15:00', end: '16:00', estimate: 60, completedOffset: -2,
        notes: 'Commentary shared with the leadership channel.'
      },
      {
        key: 'production-summary', title: 'Automate production summary', project: 2, priority: 'Medium', status: 'Completed',
        description: 'Automate the daily production summary workbook, including validation, formatting and a one-click refresh.',
        assignedOffset: -11, start: '14:00', end: '15:30', estimate: 90, completedOffset: -10,
        notes: 'Saved roughly 25 minutes per day for the operations team.'
      },
      {
        key: 'ops-review-prep', title: 'Monthly operations review prep', project: 0, priority: 'High', status: 'Completed',
        description: 'Pull the monthly operations results together, clean the commentary and prepare the slide deck for the review.',
        assignedOffset: -19, start: '10:00', end: '12:00', estimate: 120, completedOffset: -18,
        notes: 'Deck shared two days ahead of the review.'
      },
      {
        key: 'client-acme', title: 'Client check-in — Acme', project: 3, priority: 'Low', status: 'Completed',
        description: 'Prepare a short check-in agenda and capture open client actions from the previous session.',
        assignedOffset: -15, start: '11:00', end: '11:30', estimate: 30, completedOffset: -14,
        notes: 'No escalations; next check-in booked.'
      },
      {
        key: 'excel-pack', title: 'Excel automation — monthly pack', project: 2, priority: 'High', status: 'In Progress',
        description: 'Build the automated monthly reporting pack: consolidated data, pivot summaries, KPI commentary and a validated output sheet.',
        assignedOffset: -3, start: '10:00', end: '11:30', estimate: 180, completedOffset: null,
        notes: 'Core refresh macro complete; chart templates still in progress.'
      },
      {
        key: 'team-productivity', title: 'Team productivity review', project: 4, priority: 'Medium', status: 'In Progress',
        description: 'Review last week\'s team workload, tracked time and delivery status; identify where work needs to be rebalanced.',
        assignedOffset: -2, start: '15:00', end: '16:00', estimate: 60, completedOffset: null,
        notes: 'Automation workload is heavier than planned — discuss in the next 1:1.'
      },
      {
        key: 'downtime-tracker', title: 'Production downtime tracker', project: 1, priority: 'High', status: 'In Progress',
        description: 'Design an easy downtime tracker for shift leads, with structured reason codes and a weekly roll-up view.',
        assignedOffset: -5, start: '14:00', end: '16:00', estimate: 240, completedOffset: null,
        notes: 'Reason code list agreed; building the summary view.'
      },
      {
        key: 'inventory-script', title: 'Inventory reconciliation script', project: 2, priority: 'Medium', status: 'In Progress',
        description: 'Write a reconciliation script that compares warehouse stock with the finance ledger and outputs variance notes.',
        assignedOffset: -7, start: '11:00', end: '12:30', estimate: 120, completedOffset: null,
        notes: 'Variance report works; handling units of measure next.'
      },
      {
        key: 'client-qbr', title: 'Client QBR agenda', project: 3, priority: 'High', status: 'In Progress',
        description: 'Prepare the QBR agenda, service performance narrative and follow-up actions for the Meridian account.',
        assignedOffset: -1, start: '16:00', end: '17:00', estimate: 60, completedOffset: null,
        notes: 'Agenda drafted; waiting on the latest incident summary.'
      },
      {
        key: 'workload-balance', title: 'Team workload balancing', project: 4, priority: 'Medium', status: 'In Progress',
        description: 'Review the delivery board against team capacity and rebalance assignments before the next sprint starts.',
        assignedOffset: -2, start: '13:00', end: '14:00', estimate: 90, completedOffset: null,
        notes: 'Two assignments can move to the analyst joining next week.'
      },
      {
        key: 'client-meridian', title: 'Client report — Meridian', project: 3, priority: 'High', status: 'In Progress',
        description: 'Assemble the Meridian monthly service report: SLA summary, incident review, usage trends and next-month actions.',
        assignedOffset: 0, start: '14:30', end: '16:00', estimate: 90, completedOffset: null,
        notes: 'SLA section complete; need final usage numbers.'
      },
      {
        key: 'excel-testing', title: 'Excel automation testing', project: 2, priority: 'High', status: 'In Progress',
        description: 'Test the monthly reporting automation against the last three months of data and document any edge cases.',
        assignedOffset: 0, start: '13:00', end: '14:30', estimate: 90, completedOffset: null,
        notes: 'Two formatting edge cases found in the summary tab.'
      },
      {
        key: 'data-validation', title: 'Automate data validation checks', project: 2, priority: 'Medium', status: 'Not Started',
        description: 'Add reusable validation rules for missing values, duplicates and out-of-range dates across the reporting templates.',
        assignedOffset: 1, start: '11:00', end: '12:00', estimate: 120, completedOffset: null,
        notes: 'Depends on the shared validation rule library.'
      },
      {
        key: 'board-deck', title: 'Board presentation draft', project: 3, priority: 'High', status: 'Not Started',
        description: 'Draft the quarterly board presentation with performance highlights, risks and the operational roadmap.',
        assignedOffset: 3, start: '09:30', end: '11:30', estimate: 180, completedOffset: null,
        notes: 'Inputs needed from finance and sales before the first draft.'
      },
      {
        key: 'onboarding-pack', title: 'Client onboarding pack', project: 3, priority: 'Medium', status: 'Not Started',
        description: 'Create a reusable onboarding pack covering support contacts, SLA definitions, reporting cadence and access steps.',
        assignedOffset: 5, start: '10:00', end: '12:00', estimate: 150, completedOffset: null,
        notes: 'Start from the latest account handover.'
      },
      {
        key: 'performance-summary', title: 'Monthly performance summary', project: 1, priority: 'High', status: 'Not Started',
        description: 'Produce the monthly performance summary with KPI trends, productivity insights and recommendations.',
        assignedOffset: 7, start: '09:00', end: '12:00', estimate: 180, completedOffset: null,
        notes: 'Use the new dashboard exports as the source.'
      },
      {
        key: 'next-sprint', title: 'Plan next sprint', project: 4, priority: 'Medium', status: 'Not Started',
        description: 'Confirm priorities, owners and acceptance criteria for the next two-week sprint.',
        assignedOffset: 2, start: '15:00', end: '16:30', estimate: 90, completedOffset: null,
        notes: 'Include the automation testing carry-over.'
      },
      {
        key: 'summary-email', title: 'Automate weekly summary email', project: 2, priority: 'Low', status: 'Not Started',
        description: 'Build a repeatable template that generates the weekly summary email from the latest reporting pack.',
        assignedOffset: 8, start: '10:00', end: '11:30', estimate: 90, completedOffset: null,
        notes: 'Lower priority until the monthly pack is stable.'
      },
      {
        key: 'client-survey', title: 'Client satisfaction survey', project: 3, priority: 'Low', status: 'Not Started',
        description: 'Refresh the client satisfaction survey questions and prepare the send list for the next account review cycle.',
        assignedOffset: 10, start: '11:00', end: '12:00', estimate: 45, completedOffset: null,
        notes: 'Keep the survey under 12 questions.'
      },
      {
        key: 'monthly-close', title: 'Prepare monthly close', project: 1, priority: 'High', status: 'Not Started',
        description: 'Prepare the data pack and reconciliation notes needed for the monthly close, including variances and adjustments.',
        assignedOffset: 4, start: '09:00', end: '11:00', estimate: 120, completedOffset: null,
        notes: 'Coordinate with finance on the cut-off date.'
      },
      {
        key: 'sop-docs', title: 'Update SOP documentation', project: 0, priority: 'Low', status: 'On Hold',
        description: 'Revise the production SOPs for the new shift handover process and remove outdated escalation details.',
        assignedOffset: -8, start: '16:00', end: '17:00', estimate: 90, completedOffset: null,
        notes: 'On hold until the new shift pattern is confirmed.'
      },
      {
        key: 'overtime-review', title: 'Review overtime hours', project: 4, priority: 'Medium', status: 'On Hold',
        description: 'Review overtime trends for the operations team and identify recurring coverage gaps or workload peaks.',
        assignedOffset: -4, start: '12:00', end: '13:00', estimate: 60, completedOffset: null,
        notes: 'Waiting on the corrected payroll extract.'
      },
      {
        key: 'kpi-definitions', title: 'Update KPI definitions', project: 1, priority: 'Low', status: 'On Hold',
        description: 'Align the KPI definitions document with the new production metrics and share the updated glossary.',
        assignedOffset: -6, start: '11:00', end: '12:00', estimate: 60, completedOffset: null,
        notes: 'Needs sign-off from the operations lead.'
      }
    ];

    const nowIso = now.toISOString();
    const tasks = templates.map((t, i) => {
      const assignedDate = Utils.addDays(today, t.assignedOffset);
      const createdAt = localIso(assignedDate, 8, 30);
      let completedAt = null;
      if (t.status === 'Completed') {
        if (t.completedOffset === 0) {
          const d = new Date(now.getTime() - 25 * 60000);
          completedAt = d.toISOString();
        } else {
          const completedDate = Utils.addDays(today, t.completedOffset ?? t.assignedOffset);
          completedAt = localIso(completedDate, 16, 20);
        }
      }
      return {
        id: `tsk_${String(i + 1).padStart(2, '0')}`,
        title: t.title,
        description: t.description,
        projectId: projects[t.project].id,
        priority: t.priority,
        status: t.status,
        assignedDate,
        startTime: t.start,
        endTime: t.end,
        estimatedMinutes: t.estimate,
        actualMinutes: 0,
        notes: t.notes,
        createdAt,
        updatedAt: completedAt || createdAt,
        completedAt
      };
    });

    const tasksByKey = {};
    templates.forEach((t, i) => { tasksByKey[t.key] = tasks[i]; });

    const activities = [];
    let activitySeq = 1;

    function addActivity({ dateKey, startMinutes, endMinutes, title, remarks, task = null, projectId = null, source = 'manual' }) {
      const duration = Math.max(1, Math.round(endMinutes - startMinutes));
      const activity = {
        id: `act_${String(activitySeq++).padStart(4, '0')}`,
        dateKey,
        startMinutes: Math.round(startMinutes),
        endMinutes: Math.round(endMinutes),
        durationMinutes: duration,
        title,
        remarks: remarks || '',
        taskId: task ? task.id : null,
        taskTitle: task ? task.title : '',
        projectId: task ? task.projectId : (projectId || null),
        source,
        createdAt: localIso(dateKey, Math.floor(startMinutes / 60), startMinutes % 60),
        updatedAt: nowIso
      };
      activities.push(activity);
      if (task) task.actualMinutes += duration;
      return activity;
    }

    /* ---------- Today: a polished, readable morning-to-afternoon log ---------- */
    const todayNum = Utils.weekdayIndex(today);
    if (todayNum !== 0 && todayNum !== 6) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const fixed = [
        {
          task: tasksByKey['daily-review'], start: 9 * 60, end: 9 * 60 + 45,
          title: 'Completed daily production review',
          remarks: 'Reviewed overnight output, downtime notes and shift priorities with the team.'
        },
        {
          task: tasksByKey['kpi-analysis'], start: 10 * 60 + 15, end: 11 * 60 + 15,
          title: 'Completed KPI dashboard analysis',
          remarks: 'Validated source data and captured the key KPI movements for the operations review.'
        },
        {
          task: null, projectId: 'prj_team', start: 11 * 60 + 30, end: 12 * 60,
          title: 'Attended team discussion',
          remarks: 'Aligned on this week\'s priorities and the automation handover.'
        },
        {
          task: tasksByKey['excel-testing'], start: 13 * 60, end: 14 * 60 + 15,
          title: 'Worked on Excel automation testing',
          remarks: 'Tested the monthly pack refresh against October data and logged two formatting issues.'
        },
        {
          task: tasksByKey['client-meridian'], start: 14 * 60 + 30, end: 15 * 60 + 30,
          title: 'Worked on client report — Meridian',
          remarks: 'Completed the SLA summary and incident review section of the report.'
        },
        {
          task: tasksByKey['team-productivity'], start: 16 * 60, end: 16 * 60 + 30,
          title: 'Reviewed team productivity',
          remarks: 'Compared tracked hours with delivery status and flagged workload to rebalance.'
        }
      ];

      fixed.forEach((block) => {
        if (block.start >= nowMinutes - 4) return;
        const end = Math.min(block.end, nowMinutes);
        if (end - block.start < 10) return;
        addActivity({
          dateKey: today,
          startMinutes: block.start,
          endMinutes: end,
          title: block.title,
          remarks: block.remarks,
          task: block.task,
          projectId: block.projectId,
          source: 'manual'
        });
      });
    }

    /* ---------- Previous workdays: generated task + admin sessions ---------- */
    const linkedCount = {};
    const taskActivityTitles = ['Worked on:', 'Continued:', 'Progress update —'];
    const generalTitles = [
      { title: 'Email triage & follow-ups', projectId: 'prj_team', remarks: 'Cleared the inbox and followed up on outstanding approvals.' },
      { title: 'Attended team discussion', projectId: 'prj_team', remarks: 'Daily coordination and priority check with the team.' },
      { title: 'Reviewed operations metrics', projectId: 'prj_ops', remarks: 'Checked the morning production numbers and highlighted exceptions.' },
      { title: 'Documentation & SOP review', projectId: 'prj_ops', remarks: 'Reviewed and cleaned up operational documentation.' },
      { title: 'Cross-team coordination', projectId: 'prj_ops', remarks: 'Aligned with procurement and maintenance on open actions.' },
      { title: 'Client call notes', projectId: 'prj_client', remarks: 'Captured follow-ups and shared the summary with the account team.' },
      { title: 'Admin and reporting', projectId: 'prj_analytics', remarks: 'Routine reporting, file organisation and data housekeeping.' }
    ];
    const remarksPool = [
      'Made steady progress and logged the remaining actions.',
      'Reviewed the working draft and refined the outputs.',
      'Shared a progress note with the team for visibility.',
      'Worked through the data and documented the findings.',
      'Closed the outstanding items for this stage.',
      'Prepared inputs for the next review.'
    ];

    for (let offset = -34; offset <= -1; offset++) {
      const key = Utils.addDays(today, offset);
      const dow = Utils.weekdayIndex(key);
      if (dow === 0 || dow === 6) continue;
      if (key === today) continue;

      let cursor = 9 * 60 + randInt(0, 20);
      const sessionCount = randInt(4, 6);
      for (let i = 0; i < sessionCount; i++) {
        if (cursor >= 17 * 60 + 20) break;
        const duration = randInt(25, 80);
        const end = Math.min(cursor + duration, 18 * 60);
        if (end - cursor < 15) break;

        const eligible = tasks.filter((t) => {
          if (t.assignedDate > key) return false;
          if (t.status !== 'Completed' && t.status !== 'In Progress') return false;
          if (t.completedAt && Utils.isoToKey(t.completedAt) < key) return false;
          if ((linkedCount[t.id] || 0) >= 4) return false;
          if (t.actualMinutes > t.estimatedMinutes * 1.55 + 25) return false;
          return true;
        });

        let linkedTask = null;
        if (eligible.length && rng() < 0.68) {
          const completing = eligible.filter((t) => t.completedAt && Utils.isoToKey(t.completedAt) === key);
          const pool = completing.length && rng() < 0.75 ? completing : eligible;
          linkedTask = pick(pool);
        }

        if (linkedTask) {
          const isCompletion = linkedTask.completedAt && Utils.isoToKey(linkedTask.completedAt) === key;
          const title = isCompletion
            ? `Completed: ${linkedTask.title}`
            : `${pick(taskActivityTitles)} ${linkedTask.title}`;
          addActivity({
            dateKey: key,
            startMinutes: cursor,
            endMinutes: end,
            title,
            remarks: pick(remarksPool),
            task: linkedTask,
            source: rng() < 0.25 ? 'timer' : 'manual'
          });
          linkedCount[linkedTask.id] = (linkedCount[linkedTask.id] || 0) + 1;
        } else {
          const general = pick(generalTitles);
          addActivity({
            dateKey: key,
            startMinutes: cursor,
            endMinutes: end,
            title: general.title,
            remarks: general.remarks,
            projectId: general.projectId,
            source: rng() < 0.3 ? 'timer' : 'manual'
          });
        }
        cursor = end + randInt(6, 22);
      }
    }

    /* One deliberately overlapping manual entry, so overlap highlighting is visible. */
    const recent = activities.filter((a) => a.dateKey === Utils.addDays(today, -1));
    if (recent.length) {
      const anchor = recent[Math.min(2, recent.length - 1)];
      const overlapStart = Math.max(0, anchor.startMinutes + 8);
      const overlapEnd = Math.min(23 * 60 + 40, overlapStart + 25);
      if (overlapEnd - overlapStart >= 10) {
        addActivity({
          dateKey: Utils.addDays(today, -1),
          startMinutes: overlapStart,
          endMinutes: overlapEnd,
          title: 'Quick client call',
          remarks: 'Manual note captured while the parallel work entry was open — shown as an overlap.',
          projectId: 'prj_client',
          source: 'manual'
        });
      }
    }

    /* Completed tasks should show plausible actual effort even if untracked. */
    tasks.forEach((task) => {
      if (task.status === 'Completed' && task.actualMinutes < task.estimatedMinutes * 0.35) {
        task.actualMinutes = Math.round(task.estimatedMinutes * (0.78 + rng() * 0.38));
      }
    });

    activities.sort((a, b) => (a.dateKey === b.dateKey ? a.startMinutes - b.startMinutes : (a.dateKey < b.dateKey ? -1 : 1)));

    return {
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      meta: {
        isDemo: true,
        seededAt: nowIso,
        seedVersion: 1,
        app: 'FlowTrack'
      },
      settings: {
        name: 'Yogesh',
        workdayStart: '09:00',
        workdayEnd: '18:00',
        dailyTargetHours: 8,
        idleThresholdMinutes: 15,
        weekStartsOn: 1,
        defaultProjectId: 'prj_ops'
      },
      projects,
      tasks,
      activities,
      timer: null
    };
  }

  function empty() {
    const nowIso = new Date().toISOString();
    return {
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      meta: { isDemo: false, seededAt: null, seedVersion: 1, app: 'FlowTrack' },
      settings: {
        name: 'Yogesh',
        workdayStart: '09:00',
        workdayEnd: '18:00',
        dailyTargetHours: 8,
        idleThresholdMinutes: 15,
        weekStartsOn: 1,
        defaultProjectId: 'prj_general'
      },
      projects: [{
        id: 'prj_general',
        name: 'General',
        description: 'A catch-all project for day-to-day work.',
        color: '#4f46e5',
        createdAt: nowIso
      }],
      tasks: [],
      activities: [],
      timer: null
    };
  }

  return { generate, empty };
})();

window.SeedData = SeedData;
