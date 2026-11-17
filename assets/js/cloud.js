/* Supabase Auth + RLS-protected per-user workspace sync. */
const Cloud = (() => {
  const cfg = window.FLOWTRACK_CLOUD || {};
  const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url || '') && cfg.anonKey && !cfg.anonKey.startsWith('YOUR_');
  let session = null, timer = null, pending = null, saving = false, revision = 0;
  const tokenKey = 'flowtrack.cloud.session';
  const base = (cfg.url || '').replace(/\/$/, '');
  function headers(token) { return { apikey: cfg.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }
  async function request(path, { method = 'GET', body, token, extraHeaders = {} } = {}) {
    const response = await fetch(base + path, { method, headers: { ...headers(token || session?.access_token || cfg.anonKey), ...extraHeaders }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const content = await response.text(); let data; try { data = content ? JSON.parse(content) : null; } catch (_) { data = content; }
    if (!response.ok) throw new Error(data?.msg || data?.error_description || data?.message || data?.error || `Cloud request failed (${response.status})`);
    return data;
  }
  function storeSession(data) { session = data; if (data) localStorage.setItem(tokenKey, JSON.stringify(data)); else localStorage.removeItem(tokenKey); }
  async function signUp(email, password) {
    const data = await request('/auth/v1/signup', { method: 'POST', body: { email, password } });
    if (data.access_token) storeSession(data);
    return data;
  }
  async function signIn(email, password) {
    const data = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    storeSession(data); return data;
  }
  async function restore() {
    try {
      const raw = localStorage.getItem(tokenKey); if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved.refresh_token) return null;
      const data = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: saved.refresh_token }, token: cfg.anonKey });
      storeSession(data); return data;
    } catch (e) { storeSession(null); return null; }
  }
  async function refresh() {
    if (!session?.refresh_token) throw new Error('Please log in again.');
    const data = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, token: cfg.anonKey });
    storeSession(data);
  }
  async function authorized(path, options = {}) {
    if (!session) throw new Error('Not signed in.');
    if (session.expires_at && session.expires_at * 1000 < Date.now() + 60000) await refresh();
    return request(path, options);
  }
  async function load() {
    const rows = await authorized(`/rest/v1/workspaces?user_id=eq.${encodeURIComponent(session.user.id)}&select=data,updated_at`);
    return rows?.[0]?.data || null;
  }
  function status(message, error = false) {
    let node = document.getElementById('cloudSyncStatus');
    if (!node) { node = document.createElement('div'); node.id = 'cloudSyncStatus'; node.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:9998;background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px 12px;font:12px system-ui;box-shadow:0 2px 12px #0002;max-width:300px'; document.body.append(node); }
    node.textContent = message; if (error) { const retry = document.createElement('button'); retry.textContent = 'Retry sync'; retry.type = 'button'; retry.style.cssText = 'margin-left:8px;cursor:pointer'; retry.onclick = () => flush(); node.append(retry); } node.style.color = error ? '#b91c1c' : '#334155';
  }
  function queue(state) {
    if (!session) return;
    pending = structuredClone(state); revision++;
    status('Cloud: changes pending…');
    clearTimeout(timer); timer = setTimeout(flush, 800);
  }
  async function flush() {
    if (saving || !pending || !session) return;
    saving = true; const snapshot = pending; const currentRevision = revision;
    try {
      await authorized('/rest/v1/workspaces?on_conflict=user_id', {
        method: 'POST', body: { user_id: session.user.id, data: snapshot },
        extraHeaders: { Prefer: 'resolution=merge-duplicates,return=minimal' }
      });
      if (revision === currentRevision) { pending = null; status('Cloud: saved ✓'); }
    } catch (e) { status('Cloud sync failed: ' + e.message + ' — use Retry sync', true); console.error(e); }
    finally { saving = false; if (pending && revision !== currentRevision) { clearTimeout(timer); timer = setTimeout(flush, 400); } }
  }
  async function logout() { clearTimeout(timer); await flush(); try { await authorized('/auth/v1/logout', { method: 'POST' }); } catch (_) {} storeSession(null); }
  return { enabled, signUp, signIn, restore, load, queue, flush, logout, get user() { return session?.user; } };
})();
window.Cloud = Cloud;
