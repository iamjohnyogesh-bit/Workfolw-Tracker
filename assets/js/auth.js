/* FlowTrack local accounts + optional user-selected folder backup. */
const Auth = (() => {
  const USERS_KEY = 'flowtrack.accounts.v1';
  const ACTIVE_KEY = 'flowtrack.activeUser.v1';
  let username = '';
  // Require credentials on every fresh page load; do not persist an authenticated session.
  localStorage.removeItem(ACTIVE_KEY);
  let directoryHandle = null;
  let folderReady = false;
  const $ = (id) => document.getElementById(id);
  function isAuthenticated() { return !!username; }
  function getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch (_) { return {}; } }
  function cleanName(v) { return String(v || '').trim().toLowerCase(); }
  async function hashPassword(password, salt) {
    const data = new TextEncoder().encode(`${salt}:${password}`);
    if (crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
    }
    // Compatibility fallback for older local-file browser contexts; not suitable for sensitive accounts.
    let h = 2166136261; for (const b of data) h = Math.imul(h ^ b, 16777619);
    return `fallback-${(h >>> 0).toString(16)}`;
  }
  const cloudMode = !!(window.Cloud && Cloud.enabled);
  function authMarkup() {
    document.body.insertAdjacentHTML('beforeend', `<section id="authScreen" class="auth-screen">
      <div class="auth-card"><div class="auth-mark">✓</div><p class="auth-eyebrow">FLOWTRACK WORKSPACE</p>
      <h1 id="authTitle">Welcome back</h1><p class="auth-sub" id="authSub">Sign in to continue to your workspace.</p>
      <form id="authForm"><label for="authUser">${cloudMode ? "Email address" : "User name"}</label><input id="authUser" ${cloudMode ? 'type="email"' : 'maxlength="40"'} autocomplete="username" required placeholder="${cloudMode ? "you@example.com" : "Enter user name"}">
      <label for="authPass">Password</label><input id="authPass" type="password" autocomplete="current-password" required minlength="${cloudMode ? 8 : 4}" placeholder="Enter password">
      <p id="authError" class="auth-error" role="alert"></p><button class="auth-submit" id="authSubmit" type="submit">Login</button></form>
      <button class="auth-switch" id="authSwitch" type="button">Create a new account</button>
      ${cloudMode ? '<p class="auth-note">Cloud account: your workspace is stored in Supabase and synced across devices. Each user can only access their own data.</p>' : ''}<div class="auth-folder" ${cloudMode ? 'style="display:none"' : ''}><div><strong>Local folder storage</strong><small id="folderStatus">Optional: choose a folder to keep a JSON copy of your workspace.</small></div>
      <button type="button" id="chooseFolder" class="auth-folder-btn">Choose folder</button></div>
      <p class="auth-note">${cloudMode ? "Use the same email and password on another device. Cloud sync needs internet access." : "Accounts and workspace data stay in this browser. Folder backup requires Chrome or Edge and your permission."}</p>
      </div></section>`);
    $('authSwitch').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
    $('authForm').addEventListener('submit', submit);
    $('chooseFolder').addEventListener('click', chooseFolder);
    setMode('login');
  }
  let mode = 'login';
  function setMode(next) {
    mode = next; $('authTitle').textContent = mode === 'login' ? 'Welcome back' : 'Create your account';
    $('authSub').textContent = mode === 'login' ? 'Sign in to continue to your workspace.' : 'Choose a user name and password for your personal workspace.';
    $('authSubmit').textContent = mode === 'login' ? 'Login' : 'Create account';
    $('authSwitch').textContent = mode === 'login' ? 'Create a new account' : 'Already have an account? Login';
    $('authPass').autocomplete = mode === 'login' ? 'current-password' : 'new-password'; $('authError').textContent = '';
  }
  async function submit(event) {
    event.preventDefault(); const name = cleanName($('authUser').value); const pass = $('authPass').value;
    const users = getUsers(); $('authError').textContent = '';
    if (cloudMode) { await cloudSubmit(event, name, pass); return; }
    if (!/^[a-z0-9._-]{3,40}$/.test(name)) { $('authError').textContent = 'Use 3–40 characters: letters, numbers, dot, underscore or hyphen.'; return; }
    if (pass.length < 4) { $('authError').textContent = 'Password must contain at least 4 characters.'; return; }
    const button = $('authSubmit'); button.disabled = true;
    try {
      if (mode === 'register') {
        if (users[name]) throw new Error('This user name already exists. Please choose another.');
        const salt = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        users[name] = { salt, passwordHash: await hashPassword(pass, salt), createdAt: new Date().toISOString() };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      } else {
        const record = users[name]; if (!record || await hashPassword(pass, record.salt) !== record.passwordHash) throw new Error('Incorrect user name or password.');
      }
      username = name; localStorage.setItem(ACTIVE_KEY, username);
      // If this user has an existing local folder backup, load it before opening the app.
      await loadFolderBackup();
      $('authScreen').remove(); if (window.App) App.init();
    } catch (err) { $('authError').textContent = err.message || 'Unable to sign in.'; }
    finally { button.disabled = false; }
  }

  async function cloudSubmit(event, email, pass) {
    const button = $('authSubmit'); button.disabled = true; $('authError').textContent = '';
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
      if (pass.length < 8) throw new Error('Use a password with at least 8 characters.');
      if (mode === 'register') {
        const result = await Cloud.signUp(email, pass);
        if (!result.access_token) { $('authError').textContent = 'Account created. Confirm your email, then log in.'; setMode('login'); return; }
      } else await Cloud.signIn(email, pass);
      username = Cloud.user.id;
      const key = `flowtrack.state.v1.${username}`;
      const remote = await Cloud.load();
      if (remote) localStorage.setItem(key, JSON.stringify(remote));
      else if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(SeedData.empty()));
      $('authScreen').remove(); if (window.App) App.init();
      if (!remote) Cloud.queue(Store.getState());
    } catch (err) { $('authError').textContent = err.message || 'Cloud login failed.'; }
    finally { button.disabled = false; }
  }
  async function openHandlesDb() {
    return new Promise((resolve, reject) => { const req = indexedDB.open('flowtrack-handles', 1); req.onupgradeneeded = () => req.result.createObjectStore('handles'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  }
  async function saveHandle(handle) { const db = await openHandlesDb(); return new Promise((resolve, reject) => { const tx = db.transaction('handles', 'readwrite'); tx.objectStore('handles').put(handle, username); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
  async function getHandle() { const db = await openHandlesDb(); return new Promise((resolve, reject) => { const req = db.transaction('handles').objectStore('handles').get(username); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error); }); }
  async function chooseFolder() {
    if (!username && $('authUser')) username = cleanName($('authUser').value);
    if (!username || !/^[a-z0-9._-]{3,40}$/.test(username)) { $('authError').textContent = 'Enter your user name first, then choose your storage folder.'; return; }
    if (!window.showDirectoryPicker) { $('folderStatus').textContent = 'Folder access is not supported in this browser. Use Chrome or Edge.'; return; }
    try { directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' }); await saveHandle(directoryHandle); folderReady = true; $('folderStatus').textContent = `Connected: ${directoryHandle.name}. Workspace backup will be saved here.`; if (window.Store) saveFolderBackup(Store.getState()); }
    catch (err) { if (err.name !== 'AbortError') $('folderStatus').textContent = 'Folder permission was not granted.'; }
  }
  async function loadFolderBackup() {
    try {
      directoryHandle = await getHandle(); if (!directoryHandle) return;
      let permission = await directoryHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') permission = await directoryHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') return;
      folderReady = true; const fileName = `flowtrack-${username}.json`;
      try { const fileHandle = await directoryHandle.getFileHandle(fileName); const file = await fileHandle.getFile(); const parsed = JSON.parse(await file.text()); if (parsed && parsed.version === 1 && parsed.state) localStorage.setItem(`flowtrack.state.v1.${username}`, JSON.stringify(parsed.state)); }
      catch (err) { if (err.name !== 'NotFoundError') console.warn('Folder backup could not be loaded', err); }
    } catch (err) { console.warn('Saved folder access unavailable', err); }
  }
  async function saveFolderBackup(state) {
    if (!directoryHandle || !folderReady || !username) return;
    try { const permission = await directoryHandle.queryPermission({ mode: 'readwrite' }); if (permission !== 'granted') return;
      const fileHandle = await directoryHandle.getFileHandle(`flowtrack-${username}.json`, { create: true });
      const writable = await fileHandle.createWritable(); await writable.write(JSON.stringify({ version: 1, username, savedAt: new Date().toISOString(), state }, null, 2)); await writable.close();
    } catch (err) { console.warn('Folder backup failed; browser storage is still active.', err); }
  }
  function showLogin() { if (!$('authScreen')) authMarkup(); }
  document.addEventListener('click', (event) => { if (event.target.closest('[data-auth-logout]')) logout(); });
  async function logout() { if (cloudMode) await Cloud.logout(); username = ''; localStorage.removeItem(ACTIVE_KEY); window.location.reload(); }
  return { get username() { return username; }, isAuthenticated, showLogin, logout, saveFolderBackup };
})();
window.Auth = Auth;
