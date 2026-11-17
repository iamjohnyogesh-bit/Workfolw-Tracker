/* ============================================================
   FlowTrack — Settings
   Workspace preferences, local data controls and Excel exports.
   ============================================================ */

const SettingsPage = (() => {
  const { value } = FormHelpers;

  function settingRow(label, description, control) {
    return `<div class="settings-row">
      <div class="copy"><strong>${Utils.escapeHtml(label)}</strong><p>${Utils.escapeHtml(description)}</p></div>
      <div class="control">${control}</div>
    </div>`;
  }

  function profileCard(settings) {
    const projects = Store.getProjects();
    const state = Store.getState();
    return `<section class="card">
      <div class="settings-section-header">
        <h2 class="card-title">${Utils.icon('user')} Profile &amp; workday</h2>
        <p class="card-subtitle">Personal details and the schedule that powers targets, idle gaps and reports.</p>
      </div>
      <form id="settingsForm" novalidate>
        <div class="settings-section-body">
          <div class="profile-strip">
            ${UI.avatar(settings.name, 'xl')}
            <div>
              <h3>${Utils.escapeHtml(settings.name)}</h3>
              <p>Personal workspace · stored only in this browser</p>
            </div>
            <span class="badge ${state.meta.isDemo ? 'badge-purple' : 'badge-success'}">${state.meta.isDemo ? 'Sample data' : 'Local workspace'}</span>
          </div>
          ${settingRow('Display name', 'Used in the greeting, sidebar and exports.',
            `<input class="input" id="settingsName" name="name" value="${Utils.escapeAttr(settings.name)}" maxlength="60" autocomplete="name" />`)}
          ${settingRow('Workday window', 'Idle gaps are measured between these times.',
            `<div class="flex gap-6"><input class="input" type="time" id="settingsStart" name="workdayStart" value="${settings.workdayStart}" aria-label="Workday start" style="width:112px" /><span class="muted tiny">to</span><input class="input" type="time" id="settingsEnd" name="workdayEnd" value="${settings.workdayEnd}" aria-label="Workday end" style="width:112px" /></div>`)}
          ${settingRow('Daily target', 'The hours you aim to track on a working day.',
            `<div class="flex gap-6"><input class="input" type="number" id="settingsTarget" name="dailyTargetHours" value="${settings.dailyTargetHours}" min="1" max="16" step="0.5" style="width:82px" /><span class="muted tiny">hours / day</span></div>`)}
          ${settingRow('Idle threshold', 'Only unaccounted gaps at least this long are flagged.',
            `<div class="flex gap-6"><input class="input" type="number" id="settingsIdle" name="idleThresholdMinutes" value="${settings.idleThresholdMinutes}" min="5" max="240" step="5" style="width:82px" /><span class="muted tiny">minutes</span></div>`)}
          ${settingRow('Week starts on', 'Applies to calendar, weekly reports and week buckets.',
            `<select class="select" id="settingsWeekStart" name="weekStartsOn"><option value="1" ${settings.weekStartsOn === 1 ? 'selected' : ''}>Monday</option><option value="0" ${settings.weekStartsOn === 0 ? 'selected' : ''}>Sunday</option></select>`)}
          ${settingRow('Default project', 'Pre-selected on new tasks and manual activities.',
            `<select class="select" id="settingsProject" name="defaultProjectId"><option value="">No default project</option>${projects.map((project) => `<option value="${project.id}" ${settings.defaultProjectId === project.id ? 'selected' : ''}>${Utils.escapeHtml(project.name)}</option>`).join('')}</select>`)}
          <p class="settings-note">${Utils.icon('info')} Changes apply immediately across the dashboard, reports and exports. Nothing leaves your browser.</p>
        </div>
        <div class="card-footer">
          <span class="muted tiny">Saved locally · no account required</span>
          <button class="btn btn-primary" type="submit">${Utils.icon('save')} Save changes</button>
        </div>
      </form>
    </section>`;
  }

  function storageCard() {
    const info = Store.getStorageInfo();
    const state = Store.getState();
    const savedAt = state.updatedAt ? Utils.formatTimestamp(state.updatedAt) : '—';
    return `<section class="card">
      <div class="settings-section-header">
        <h2 class="card-title">${Utils.icon('database')} Data &amp; backup</h2>
        <p class="card-subtitle">Everything is saved in this browser's localStorage. Keep a JSON backup for safety.</p>
      </div>
      <div class="settings-section-body">
        <div class="storage-meter">
          <div class="storage-bar"><span style="width:${Math.max(0.5, info.percent)}%"></span></div>
          <div class="storage-legend">
            <span><strong>${Utils.formatFileSize(info.bytes)}</strong> used of ~5 MB</span>
            <span>${info.percent.toFixed(1)}%</span>
          </div>
        </div>
        <div class="about-list mt-16">
          <div class="about-row">${Utils.icon('tasks')}<div><strong>${info.tasks}</strong> task${info.tasks === 1 ? '' : 's'} · <strong>${info.activities}</strong> activit${info.activities === 1 ? 'y' : 'ies'} · <strong>${info.projects}</strong> project${info.projects === 1 ? '' : 's'}</div></div>
          <div class="about-row">${Utils.icon(info.persistent ? 'check-circle' : 'alert-triangle')}<div>${info.persistent ? 'Local storage is available and saving correctly.' : 'Local storage is unavailable. Use a backup before closing this page.'}</div></div>
          <div class="about-row">${Utils.icon('clock')}<div>Last saved <strong>${Utils.escapeHtml(savedAt)}</strong></div></div>
        </div>
        <div class="data-actions">
          <button class="data-action-btn" type="button" data-settings-backup>${Utils.icon('download')}<span><strong>Download backup</strong><span>Full JSON snapshot</span></span></button>
          <button class="data-action-btn" type="button" data-settings-restore>${Utils.icon('upload')}<span><strong>Restore backup</strong><span>Replace with a JSON file</span></span></button>
          <button class="data-action-btn" type="button" data-settings-sample>${Utils.icon('sparkles')}<span><strong>Load sample data</strong><span>Fresh demo workspace</span></span></button>
          <button class="data-action-btn" type="button" data-settings-clear>${Utils.icon('trash')}<span><strong>Clear all data</strong><span>Start from empty</span></span></button>
        </div>
        <p class="settings-note">${Utils.icon('shield')} Backups include tasks, activities, projects, settings and any paused timer. Restoring replaces everything currently stored.</p>
        <input type="file" id="settingsRestoreFile" accept="application/json,.json" hidden />
      </div>
    </section>`;
  }

  function exportsCard() {
    return `<section class="card">
      <div class="settings-section-header">
        <h2 class="card-title">${Utils.icon('download')} Excel reports</h2>
        <p class="card-subtitle">Six ready-made workbooks with summary sheets, filters and formatted totals.</p>
      </div>
      <div class="settings-section-body">
        <div class="export-grid">
          ${Exports.REPORT_TYPES.map((report) => `<button class="export-card" type="button" data-settings-export="${report.id}">
            <span class="export-card-icon">${Utils.icon(report.icon)}</span>
            <span style="flex:1;min-width:0"><strong>${Utils.escapeHtml(report.label)}</strong><span>${Utils.escapeHtml(report.desc)}</span></span>
            <span class="export-arrow">${Utils.icon('arrow-up-right')}</span>
          </button>`).join('')}
        </div>
        <p class="settings-note">${Utils.icon('info')} Reports are generated entirely offline and open in Excel, Numbers or LibreOffice. Dates, durations, statuses and filters are preserved.</p>
      </div>
    </section>`;
  }

  function summaryCard() {
    const counts = Analytics.getTaskCounts();
    const activities = Store.getActivities();
    const tracked = activities.reduce((sum, activity) => sum + activity.durationMinutes, 0);
    const streak = Analytics.getActiveStreak();
    const projects = Store.getProjects().length;
    return `<section class="card">
      <div class="settings-section-header">
        <h2 class="card-title">${Utils.icon('layers')} Workspace at a glance</h2>
        <p class="card-subtitle">A quick summary of everything stored here.</p>
      </div>
      <div class="settings-section-body">
        <div class="snapshot-grid">
          <div class="snapshot-col">
            <div class="snapshot-label">Tasks</div>
            <div class="snapshot-value">${counts.total}</div>
            <div class="snapshot-sub">${counts.open} open · ${counts.completed} done</div>
          </div>
          <div class="snapshot-col">
            <div class="snapshot-label">Tracked</div>
            <div class="snapshot-value">${Utils.formatHours(tracked)}<span style="font-size:11px;color:var(--muted);font-weight:600">h</span></div>
            <div class="snapshot-sub">${activities.length} entries</div>
          </div>
          <div class="snapshot-col">
            <div class="snapshot-label">Projects</div>
            <div class="snapshot-value">${projects}</div>
            <div class="snapshot-sub">${streak} day streak</div>
          </div>
        </div>
        <div class="about-list mt-16">
          <div class="about-row">${Utils.icon('check-circle')}<div><strong>${counts.completionRate}%</strong> task completion rate across ${counts.total} task${counts.total === 1 ? '' : 's'}.</div></div>
          <div class="about-row">${Utils.icon('activity')}<div><strong>${Utils.formatDuration(tracked)}</strong> logged in total, with ${Utils.formatHours(activities.filter((activity) => activity.taskId).reduce((sum, activity) => sum + activity.durationMinutes, 0))}h linked to tasks.</div></div>
          <div class="about-row">${Utils.icon('flag')}<div><strong>${counts.overdue}</strong> overdue open task${counts.overdue === 1 ? '' : 's'} right now.</div></div>
        </div>
      </div>
    </section>`;
  }

  function shortcutsCard() {
    return `<section class="card">
      <div class="settings-section-header">
        <h2 class="card-title">${Utils.icon('command')} Keyboard shortcuts</h2>
        <p class="card-subtitle">Move around without reaching for the mouse.</p>
      </div>
      <div class="settings-section-body">
        ${settingRow('Search everything', 'Find tasks, activities and projects from any page.', '<kbd class="search-hint" style="font-size:10px;padding:4px 7px">⌘ K / Ctrl K</kbd>')}
        ${settingRow('Close a dialog', 'Dismiss the active modal without saving.', '<kbd class="search-hint" style="font-size:10px;padding:4px 7px">Esc</kbd>')}
        ${settingRow('Move through a dialog', 'Cycle focus between fields and buttons.', '<kbd class="search-hint" style="font-size:10px;padding:4px 7px">Tab / Shift Tab</kbd>')}
      </div>
    </section>`;
  }

  function aboutCard() {
    return `<section class="card">
      <div class="settings-section-header">
        <h2 class="card-title">${Utils.icon('info')} About FlowTrack</h2>
        <p class="card-subtitle">A private, offline-first work and productivity tracker.</p>
      </div>
      <div class="settings-section-body">
        <div class="about-list">
          <div class="about-row">${Utils.icon('sparkles')}<div><strong>FlowTrack 1.0.0</strong> — daily tasks, time tracking and weekly/monthly reporting in one workspace.</div></div>
          <div class="about-row">${Utils.icon('shield')}<div><strong>Private by default.</strong> No accounts, analytics or uploads. Everything lives in this browser.</div></div>
          <div class="about-row">${Utils.icon('database')}<div><strong>Offline-first.</strong> Chart.js and ExcelJS are bundled locally, so reports work without a connection.</div></div>
          <div class="about-row">${Utils.icon('file-text')}<div><strong>Your data, portable.</strong> Download a JSON backup or an Excel report whenever you need it.</div></div>
        </div>
        <div class="mt-16 flex gap-8">
          <button class="btn btn-secondary btn-sm" data-open-help>${Utils.icon('help')} Productivity guide</button>
          <button class="btn btn-ghost btn-sm" data-nav="weekly">${Utils.icon('bar-chart')} View reports</button>
        </div>
      </div>
    </section>`;
  }

  function dangerCard() {
    return `<section class="card danger-zone">
      <div class="settings-section-header">
        <h2 class="card-title" style="color:var(--danger)">${Utils.icon('alert-triangle')} Danger zone</h2>
        <p class="card-subtitle">Destructive actions cannot be undone. Download a backup first.</p>
      </div>
      <div class="settings-section-body">
        <div class="settings-row">
          <div class="copy"><strong>Clear the workspace</strong><p>Remove every task, activity, project and setting from this browser.</p></div>
          <div class="control"><button class="btn btn-danger-soft btn-sm" type="button" data-settings-clear>${Utils.icon('trash')} Clear all data</button></div>
        </div>
        <p class="settings-note">${Utils.icon('shield')} Tip: use <strong>Download backup</strong> above before clearing or restoring.</p>
      </div>
    </section>`;
  }

  async function backup() {
    try {
      const text = Store.exportData();
      Utils.downloadText(text, `FlowTrack_Backup_${Utils.todayKey()}.json`);
      UI.toast('Backup downloaded. Keep it somewhere safe.', 'success', 'Backup ready');
    } catch (err) {
      PageHelpers.toastError(err, 'Could not create the backup');
    }
  }

  async function restore(file) {
    if (!file) return;
    const ok = await UI.confirm({
      title: 'Restore this backup?',
      message: `“${file.name}” will replace all current tasks, activities, projects, settings and timer state. Download a fresh backup first if you might need the current workspace.`,
      confirmLabel: 'Restore backup',
      danger: true
    });
    if (!ok) return;
    try {
      const text = await file.text();
      Store.importData(text);
      UI.toast('Backup restored. Your workspace is ready.', 'success', 'Restore complete');
    } catch (err) {
      PageHelpers.toastError(err, 'Could not restore the backup');
    }
  }

  async function loadSample() {
    const ok = await UI.confirm({
      title: 'Load sample data?',
      message: 'This replaces the current workspace with a fresh demo containing projects, tasks and a month of activity history. Download a backup first if you want to keep what is here.',
      confirmLabel: 'Load sample data',
      danger: true
    });
    if (!ok) return;
    Store.loadSampleData();
    UI.toast('Sample workspace loaded.', 'success');
  }

  async function clearAll() {
    const ok = await UI.confirm({
      title: 'Clear all data?',
      message: 'Every task, activity, project and preference will be removed from this browser. This cannot be undone unless you have a JSON backup.',
      confirmLabel: 'Clear everything',
      danger: true
    });
    if (!ok) return;
    Store.clearAllData();
    UI.toast('Workspace cleared. A fresh General project is ready.', 'success');
  }

  function bind(root) {
    const form = root.querySelector('#settingsForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = value(form, 'name');
        const start = value(form, 'workdayStart');
        const end = value(form, 'workdayEnd');
        const target = Number(value(form, 'dailyTargetHours'));
        const idle = Number(value(form, 'idleThresholdMinutes'));
        if (!name) { UI.toast('Add a display name.', 'warning'); return; }
        if (!start || !end) { UI.toast('Set both a workday start and end time.', 'warning'); return; }
        if (end <= start) { UI.toast('Workday end must be after the start time.', 'warning'); return; }
        if (!Number.isFinite(target) || target < 1 || target > 16) { UI.toast('Daily target must be between 1 and 16 hours.', 'warning'); return; }
        if (!Number.isFinite(idle) || idle < 5 || idle > 240) { UI.toast('Idle threshold must be between 5 and 240 minutes.', 'warning'); return; }
        try {
          Store.updateSettings({
            name,
            workdayStart: start,
            workdayEnd: end,
            dailyTargetHours: target,
            idleThresholdMinutes: idle,
            weekStartsOn: Number(value(form, 'weekStartsOn')),
            defaultProjectId: value(form, 'defaultProjectId')
          });
          UI.toast('Preferences saved. Targets and reports are updated.', 'success', 'Settings saved');
        } catch (err) {
          PageHelpers.toastError(err, 'Could not save settings');
        }
      });
    }
    root.querySelectorAll('[data-settings-save]').forEach((btn) => btn.addEventListener('click', () => {
      if (form) form.requestSubmit();
    }));
    root.querySelectorAll('[data-settings-backup]').forEach((btn) => btn.addEventListener('click', backup));
    root.querySelectorAll('[data-settings-clear]').forEach((btn) => btn.addEventListener('click', clearAll));
    root.querySelectorAll('[data-settings-sample]').forEach((btn) => btn.addEventListener('click', loadSample));
    root.querySelectorAll('[data-settings-export]').forEach((btn) => btn.addEventListener('click', () => {
      Exports.open({ type: btn.dataset.settingsExport });
    }));
    const restoreBtn = root.querySelector('[data-settings-restore]');
    const fileInput = root.querySelector('#settingsRestoreFile');
    if (restoreBtn && fileInput) {
      restoreBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        restore(file);
      });
    }
  }

  function render(root) {
    const settings = Store.getSettings();
    const actions = `
      <button class="btn btn-secondary" type="button" data-settings-backup>${Utils.icon('download')} Backup data</button>
      <button class="btn btn-primary" type="button" data-settings-save>${Utils.icon('save')} Save changes</button>`;

    root.innerHTML = `
      ${PageHelpers.pageHeader({
        eyebrow: 'Configuration',
        title: 'Settings',
        subtitle: 'Tune your workday, protect your data and generate reports. Changes stay in this browser.',
        actions
      })}
      <div class="settings-layout">
        <div class="settings-col">
          ${profileCard(settings)}
          ${storageCard()}
          ${exportsCard()}
        </div>
        <div class="settings-col">
          ${summaryCard()}
          ${shortcutsCard()}
          ${aboutCard()}
          ${dangerCard()}
        </div>
      </div>`;

    bind(root);
  }

  return { render };
})();

window.SettingsPage = SettingsPage;
