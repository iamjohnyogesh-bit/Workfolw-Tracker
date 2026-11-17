/* ============================================================
   FlowTrack — Utilities
   Dates are handled as local YYYY-MM-DD keys; times as minutes
   from midnight. This avoids timezone drift across the app.
   ============================================================ */

const Utils = (() => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const PRIORITIES = ['High', 'Medium', 'Low'];
  const STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
  const PROJECT_COLORS = ['#4f46e5', '#0d9488', '#e11d48', '#d97706', '#7c3aed', '#2563eb', '#0891b2', '#65a30d', '#db2777', '#64748b'];

  const pad = (n) => String(n).padStart(2, '0');

  function toKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromKey(key) {
    if (!key || typeof key !== 'string') return new Date(NaN);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m) return new Date(NaN);
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return new Date(NaN);
    return d;
  }

  function todayKey() { return toKey(new Date()); }

  function addDays(key, days) {
    const d = fromKey(key);
    if (isNaN(d.getTime())) return key;
    d.setDate(d.getDate() + Number(days || 0));
    return toKey(d);
  }

  function addMonths(key, months) {
    const d = fromKey(key);
    if (isNaN(d.getTime())) return key;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + Number(months || 0));
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, maxDay));
    return toKey(d);
  }

  function startOfWeek(key, weekStartsOn = 1) {
    const d = fromKey(key);
    if (isNaN(d.getTime())) return key;
    const diff = (d.getDay() - Number(weekStartsOn) + 7) % 7;
    d.setDate(d.getDate() - diff);
    return toKey(d);
  }

  function endOfWeek(key, weekStartsOn = 1) {
    return addDays(startOfWeek(key, weekStartsOn), 6);
  }

  function startOfMonth(key) {
    const d = fromKey(key);
    if (isNaN(d.getTime())) return key;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  }

  function endOfMonth(key) {
    const d = fromKey(key);
    if (isNaN(d.getTime())) return key;
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return toKey(last);
  }

  function eachDay(from, to) {
    const out = [];
    if (!from || !to || from > to) return out;
    let cursor = from;
    let guard = 0;
    while (cursor <= to && guard < 4000) {
      out.push(cursor);
      cursor = addDays(cursor, 1);
      guard++;
    }
    return out;
  }

  function daysBetween(from, to) {
    const a = fromKey(from); const b = fromKey(to);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    return Math.round((b - a) / 86400000);
  }

  function isWeekend(key, weekStartsOn = 1) {
    const day = fromKey(key).getDay();
    return weekStartsOn === 1 ? (day === 0 || day === 6) : (day === 0 || day === 6);
  }

  function weekdayIndex(key) { return fromKey(key).getDay(); }
  function weekdayShort(key) { return WEEKDAYS_SHORT[fromKey(key).getDay()] || ''; }
  function weekdayLong(key) { return WEEKDAYS[fromKey(key).getDay()] || ''; }
  function dayNumber(key) { return fromKey(key).getDate(); }

  function formatDate(key, style = 'medium') {
    const d = fromKey(key);
    if (isNaN(d.getTime())) return '—';
    const day = d.getDate();
    const wd = WEEKDAYS[d.getDay()];
    const wdShort = WEEKDAYS_SHORT[d.getDay()];
    const month = MONTHS[d.getMonth()];
    const monthShort = MONTHS_SHORT[d.getMonth()];
    const year = d.getFullYear();
    switch (style) {
      case 'short': return `${day} ${monthShort}`;
      case 'short-year': return `${day} ${monthShort} ${year}`;
      case 'medium': return `${wdShort}, ${day} ${monthShort}`;
      case 'medium-year': return `${wdShort}, ${day} ${monthShort} ${year}`;
      case 'long': return `${wd}, ${day} ${month} ${year}`;
      case 'long-short-year': return `${wd}, ${day} ${month}`;
      case 'numeric': return `${pad(day)}/${pad(d.getMonth() + 1)}/${year}`;
      case 'iso': return key;
      case 'month-year': return `${month} ${year}`;
      case 'month-short-year': return `${monthShort} ${year}`;
      case 'weekday': return wd;
      case 'weekday-short': return wdShort;
      case 'day': return String(day);
      default: return `${wdShort}, ${day} ${monthShort} ${year}`;
    }
  }

  function formatRange(from, to, style = 'medium') {
    if (from === to) return formatDate(from, style);
    const a = fromKey(from); const b = fromKey(to);
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
    }
    return `${formatDate(from, 'short-year')} – ${formatDate(to, 'short-year')}`;
  }

  function relativeLabel(key) {
    const today = todayKey();
    if (key === today) return 'Today';
    if (key === addDays(today, 1)) return 'Tomorrow';
    if (key === addDays(today, -1)) return 'Yesterday';
    if (key === addDays(today, 2)) return 'In 2 days';
    if (key < today) {
      const diff = daysBetween(key, today);
      if (diff <= 6) return `${diff} day${diff === 1 ? '' : 's'} ago`;
    }
    return formatDate(key, 'medium');
  }

  function dueLabel(key) {
    const today = todayKey();
    if (key === today) return { text: 'Due today', cls: 'due-today' };
    if (key < today) {
      const diff = daysBetween(key, today);
      return { text: diff === 1 ? 'Overdue by 1 day' : `Overdue by ${diff} days`, cls: 'due-overdue' };
    }
    if (key === addDays(today, 1)) return { text: 'Due tomorrow', cls: '' };
    return { text: formatDate(key, 'medium'), cls: '' };
  }

  function todayLong() {
    const d = new Date();
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function timeToMinutes(time) {
    if (typeof time !== 'string') return NaN;
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) return NaN;
    const h = Number(m[1]); const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return NaN;
    return h * 60 + min;
  }

  function minutesToTime(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${pad(h)}:${pad(m)}`;
  }

  function formatTime12(minutes) {
    const total = Number(minutes) || 0;
    const normalized = ((Math.round(total) % 1440) + 1440) % 1440;
    let h = Math.floor(normalized / 60);
    const m = normalized % 60;
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${pad(m)} ${suffix}`;
  }

  function formatTimeRange(start, end) {
    return `${formatTime12(start)} – ${formatTime12(end)}`;
  }

  function formatDuration(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    if (total === 0) return '0m';
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function formatDurationLong(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hour${h === 1 ? '' : 's'}`;
    return `${h}h ${m}m`;
  }

  function formatHours(minutes, digits = 1) {
    return (Math.max(0, Number(minutes) || 0) / 60).toFixed(digits);
  }

  function formatClock(totalSeconds) {
    const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function formatClockShort(totalSeconds) {
    const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${pad(m)}m`;
    return `${m}m ${pad(sec % 60)}s`;
  }

  function formatTimestamp(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${formatTime12(d.getHours() * 60 + d.getMinutes())}`;
  }

  function isoToKey(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return toKey(d);
  }

  function pct(part, total, digits = 0) {
    if (!total) return 0;
    const value = (Number(part) / Number(total)) * 100;
    if (!isFinite(value)) return 0;
    return Number(value.toFixed(digits));
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function sum(arr, selector = (v) => v) { return arr.reduce((acc, item) => acc + (Number(selector(item)) || 0), 0); }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(value) { return escapeHtml(value); }

  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return safe.replace(new RegExp(`(${q})`, 'ig'), '<mark>$1</mark>');
    } catch (_) { return safe; }
  }

  function uid(prefix = 'id') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}_${window.crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    }
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  }

  function initials(name) {
    const parts = String(name || 'You').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Y';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function icon(name, cls = '') {
    return `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function projectColor(color, fallback = '#4f46e5') {
    return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : fallback;
  }

  function statusClass(status) {
    return ({
      'Completed': 'completed',
      'In Progress': 'inprogress',
      'Not Started': 'notstarted',
      'On Hold': 'onhold'
    })[status] || 'neutral';
  }

  function priorityClass(priority) {
    return ({ High: 'high', Medium: 'medium', Low: 'low' })[priority] || 'neutral';
  }

  function greeting(name) {
    const h = new Date().getHours();
    const who = name ? `, ${name.split(' ')[0]}` : '';
    if (h < 5) return `Working late${who}`;
    if (h < 12) return `Good morning${who}`;
    if (h < 17) return `Good afternoon${who}`;
    if (h < 21) return `Good evening${who}`;
    return `Good night${who}`;
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadText(text, filename, mime = 'application/json') {
    downloadBlob(new Blob([text], { type: mime }), filename);
  }

  function debounce(fn, wait = 200) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function clampText(text, length = 80) {
    const value = String(text || '').trim();
    return value.length > length ? `${value.slice(0, length - 1)}…` : value;
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }

  function sortTasks(a, b) {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1;
    if (b.status === 'Completed' && a.status !== 'Completed') return -1;
    const dateCompare = String(a.assignedDate).localeCompare(String(b.assignedDate));
    if (dateCompare !== 0) return dateCompare;
    const p = { High: 0, Medium: 1, Low: 2 };
    return (p[a.priority] ?? 3) - (p[b.priority] ?? 3);
  }

  return {
    MONTHS, MONTHS_SHORT, WEEKDAYS, WEEKDAYS_SHORT, PRIORITIES, STATUSES, PROJECT_COLORS,
    pad, toKey, fromKey, todayKey, addDays, addMonths, startOfWeek, endOfWeek,
    startOfMonth, endOfMonth, eachDay, daysBetween, isWeekend, weekdayIndex,
    weekdayShort, weekdayLong, dayNumber, formatDate, formatRange, relativeLabel, dueLabel,
    todayLong, nowMinutes, timeToMinutes, minutesToTime, formatTime12, formatTimeRange,
    formatDuration, formatDurationLong, formatHours, formatClock, formatClockShort,
    formatTimestamp, isoToKey, pct, clamp, sum, escapeHtml, escapeAttr, highlight, uid,
    initials, icon, projectColor, statusClass, priorityClass, greeting, timeAgo,
    downloadBlob, downloadText, debounce, clampText, formatFileSize, sortTasks
  };
})();

window.Utils = Utils;
