# FlowTrack — Daily Work & Task Tracking

A complete, offline-first work and productivity tracker built with **plain HTML, CSS and vanilla JavaScript** — no framework, no build step, no backend. Everything runs in the browser and persists to `localStorage`, so your data stays on your machine.

## Running the app

No install or server is required.

**Option 1 — open directly**

Double-click `index.html` (or open `file:///…/index.html` in Chrome/Edge/Firefox). The app is a set of classic scripts, so it works from the filesystem exactly as from a server.

**Option 2 — local server (recommended for testing)**

```bash
cd "codefyre ai pro"
python3 -m http.server 4173
# open http://127.0.0.1:4173/
```

All third-party libraries (Chart.js 4.4.7, ExcelJS 4.4.0) are vendored under `assets/js/vendor/`, so the app makes **zero network requests** and works fully offline.

## Pages

| Page | What it does |
|---|---|
| **Dashboard** | Task counts (total / completed / pending / in-progress), working vs productive hours today, daily + weekly + monthly summary cards, four charts (7-day trend, status split, project distribution, priority mix), today's activities and upcoming tasks. |
| **My Tasks** | Full CRUD for tasks — title, description, project, priority, status, assigned date, start/end time, estimated duration, actual time, notes. Search, filter by project/status/priority/date, sort, bulk status changes. |
| **Time Tracker** | Start / stop / pause / resume with a live timer that survives page reloads. Only one timer can run at a time; stopping writes a segment to the activity log. Quick stats on today's hours and the current task. |
| **Activity Log** | Chronological log of every activity with quick-logging (date, start/end time, remarks), editing, deleting, search, project/date filters, and automatic **idle-gap** detection and **overlap highlighting**. |
| **Calendar** | Monthly and weekly views with completion indicators, per-day task pills, click a day to see its tasks, add a task pre-filled with that date, and jump to a filtered Tasks page. |
| **Weekly Report** | Weekly metrics: hours logged vs target, tasks completed, productivity split by project, day-by-day breakdown, comparison with the previous week. Custom date ranges supported. |
| **Monthly Report** | Monthly roll-up: totals, weekly buckets, project distribution, comparison with the previous month, per-day trend. Custom date ranges supported. |
| **Projects** | Create/edit/archive projects with colors, view per-project stats and related tasks/activities. |
| **Settings** | Display name, workday start/end, daily target hours, idle threshold, week start day, default project; sample-data loader, backup/restore JSON, clear-all-data, and one-click Excel exports. |

## Data model

State is stored under a single `localStorage` key: **`flowtrack.state.v1`**.

- Dates are local-day keys in `YYYY-MM-DD` form (no UTC drift).
- Times are stored as minutes from midnight, so arithmetic is exact.
- A running timer is persisted with its `segmentStartedAt`, so elapsed time survives refreshes and browser restarts.

### Timer semantics

- Exactly **one** active timer is allowed globally; starting a second is blocked with a toast.
- **Pause** finalizes the current segment into the activity log; **resume** starts a new segment — the log shows the real work pattern.
- Segments that cross midnight are split into two activities (one per day).
- Working while a task's timer runs: the task cannot be marked Completed until the timer is stopped.

### Working vs productive hours

- **Working hours** = total duration of all logged activities for the period.
- **Productive hours** = duration of activities linked to a task.
- **Productivity %** = productive ÷ working.

## Excel exports (6 reports)

All reports are generated client-side with ExcelJS and download as `.xlsx` with a styled **Summary** sheet (title, filter line, key metrics/KPIs), frozen header rows, auto-filters, numeric duration columns, and status/priority coloring.

| Report | Contents |
|---|---|
| Daily activity | Summary, Activities, Idle Gaps for one day (or a from–to range) |
| Weekly tasks | Task list for the week plus daily breakdown |
| Monthly productivity | Summary, Daily and Weekly Breakdown |
| Complete task history | Full task history for a range with all fields |
| Time tracking | Time Entries, By Task, By Day |
| Project-wise activity | Projects, Project Activities, Project Tasks |

Export from **Settings → Exports** (all six cards) or the quick-log/export actions; each supports a custom date range with a live preview before download.

## Backup & restore

**Settings** can download the full state as a JSON backup and restore it (with confirmation), load a fresh set of realistic **sample data**, or wipe everything back to a clean slate. Sample data spans ~5 weeks of history across 5 projects with a deliberate overlapping activity on yesterday's log, so idle/overlap features are visible immediately.

## Keyboard shortcuts

- **⌘K / Ctrl+K** — global search (tasks, activities, projects; arrow keys to navigate, Enter to open, Esc to dismiss)
- **Esc** — close dialogs / dismiss the mobile sidebar

## Notes

- The app is 100% client-side; nothing is sent anywhere.
- First load seeds sample data automatically and marks it as demo data; editing settings or creating your own data clears that flag.
- Best viewed in a modern evergreen browser. Layout is responsive down to phone widths (sidebar collapses, calendar switches to dot markers, tables scroll horizontally).


## Accounts and local folder storage

- Create a local account with a user name and password, then sign in on later visits.
- Each account has its own browser storage key, so tasks and reports are separated by user.
- On the login screen, choose a folder (Chrome/Edge supported) to keep a per-user `flowtrack-<username>.json` backup. The browser asks permission; grant it when prompted.
- The app continues to save in browser localStorage even when folder access is unavailable. Folder backup is written after workspace changes and loaded at login when permission is available.
- This is a local/offline account gate, not server authentication. Passwords are hashed before being stored, but anyone with access to the same browser profile or local files may still access the data.
- For best folder access behavior, open the app from `http://localhost` using the local server instructions above.
