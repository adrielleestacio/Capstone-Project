const API_BASE = (new URLSearchParams(location.search).get('api') || 'http://localhost:8787').replace(/\/$/, '');
const TOKEN_KEY = 'habitai-admin-token';
const USER_KEY = 'habitai-admin-user';
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  view: 'overview',
  overview: null,
  users: [],
  userTotal: 0,
  userPage: 1,
  userSearch: '',
  reports: [],
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'HA';
}

function displayDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return 'Never';
  const timestamp = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Never' : new Intl.DateTimeFormat(undefined, options).format(date);
}

function number(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function saveSession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Hindi maabot ang API sa ${API_BASE}. Paandarin ang backend at tiyaking pinapayagan nito ang admin panel origin.`);
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && state.token) {
    clearSession();
    renderAuth('login', 'Your session expired. Sign in again to continue.');
  }
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('visible'), 2800);
}

function renderAuth(mode = 'login', message = '') {
  app.innerHTML = `
    <section class="auth-screen">
      <aside class="auth-brand-panel">
        <div class="brand"><span class="brand-mark">✳</span><span class="brand-name">HabitAI <span style="color:#c8ec85">/</span> Admin</span></div>
        <div class="auth-message"><p class="eyebrow">Administrator workspace</p><h1>Small steps.<br />A healthier community.</h1><p>See how your community is growing, keep an eye on daily habits, and follow up on support requests.</p></div>
        <div class="auth-foot">HabitAI community operations</div>
      </aside>
      <div class="auth-main"><form class="auth-card" id="auth-form" novalidate>
        <h2>${mode === 'login' ? 'Welcome back' : 'Create your admin account'}</h2>
        <p>${mode === 'login' ? 'Sign in with an approved administrator account.' : 'Registration is limited to allowlisted email addresses.'}</p>
        <div class="auth-tabs" role="tablist" aria-label="Administrator access">
          <button class="auth-tab ${mode === 'login' ? 'active' : ''}" type="button" data-auth-mode="login">Sign in</button>
          <button class="auth-tab ${mode === 'register' ? 'active' : ''}" type="button" data-auth-mode="register">Register</button>
        </div>
        ${mode === 'register' ? '<div class="field"><label for="fullName">Full name</label><input id="fullName" name="fullName" autocomplete="name" required placeholder="Your name" /></div><div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required placeholder="admin.name" /></div>' : ''}
        <div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com" /></div>
        <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required placeholder="Enter your password" /></div>
        ${mode === 'register' ? '<div class="field"><label for="registrationKey">Registration key</label><input id="registrationKey" name="registrationKey" type="password" autocomplete="off" required placeholder="Provided by your system administrator" /></div>' : ''}
        <div class="auth-error" id="auth-error" role="alert">${escapeHtml(message)}</div>
        <button class="primary-button auth-submit" id="auth-submit" type="submit">${mode === 'login' ? 'Sign in to dashboard' : 'Create administrator account'}</button>
        <div class="auth-note">Access is protected by your account allowlist and administrator role.</div>
      </form></div>
    </section>`;
  app.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => renderAuth(button.dataset.authMode)));
  app.querySelector('#auth-form').addEventListener('submit', (event) => submitAuth(event, mode));
}

async function submitAuth(event, mode) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  const error = app.querySelector('#auth-error');
  const button = app.querySelector('#auth-submit');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Checking access...';
  try {
    saveSession(await api(`/api/admin/auth/${mode}`, { method: 'POST', body: JSON.stringify(payload) }));
    await renderDashboard();
  } catch (requestError) {
    error.textContent = requestError.message;
    button.disabled = false;
    button.textContent = mode === 'login' ? 'Sign in to dashboard' : 'Create administrator account';
  }
}

const navigation = [['overview', '◫', 'Overview'], ['users', '♙', 'Users'], ['reports', '▤', 'Support reports']];

function shell(content, active = state.view) {
  const name = state.user?.fullName || state.user?.name || 'Administrator';
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">✳</span><span class="brand-name">HabitAI</span></div>
      <div class="nav-caption">Workspace</div>
      <nav class="nav-list" aria-label="Main navigation">${navigation.map(([id, icon, label]) => `<button class="nav-link ${id === active ? 'active' : ''}" data-view="${id}" type="button"><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="health-box"><div class="health-heading"><span>Service health</span><span class="health-status"><i class="health-dot"></i><span id="sidebar-health">Checking</span></span></div><div class="health-note">Habit predictions and activity sync</div></div>
        <div class="admin-profile"><span class="avatar">${escapeHtml(initials(name))}</span><div class="profile-copy"><div class="profile-name">${escapeHtml(name)}</div><div class="profile-role">Administrator</div></div><button class="icon-button" id="logout" type="button" aria-label="Sign out" title="Sign out">↪</button></div>
      </div>
    </aside>
    <section class="workspace"><header class="topbar"><div class="breadcrumb">HabitAI <span aria-hidden="true">/</span> <strong>${navigation.find(([id]) => id === active)?.[2] || 'Overview'}</strong></div><div class="top-actions"><span class="updated" id="updated-at">Live data from your API</span><button class="icon-button refresh" id="refresh" type="button" aria-label="Refresh data" title="Refresh data">↻</button></div></header><main class="content" id="view-content">${content}</main></section>
  </div>`;
  app.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
  app.querySelector('#logout').addEventListener('click', logout);
  app.querySelector('#refresh').addEventListener('click', refreshView);
}

async function renderDashboard() {
  state.view = 'overview';
  shell('<div class="loading">Loading your community data...</div>');
  try {
    const [me, overview, reports] = await Promise.all([api('/api/admin/auth/me'), api('/api/admin/overview'), api('/api/admin/reports')]);
    state.user = me.user;
    localStorage.setItem(USER_KEY, JSON.stringify(me.user));
    state.overview = overview;
    state.reports = reports.reports || [];
    showOverview();
  } catch (error) {
    if (!state.token) return renderAuth();
    shell(`<div class="error-banner">${escapeHtml(error.message)} Check that the API is running with its administrator endpoints enabled. These admin endpoints require the backend's Neon database configuration.</div><button class="primary-button" id="retry">Retry connection</button>`);
    app.querySelector('#retry').addEventListener('click', renderDashboard);
  }
}

function chartMarkup(signups = [], activity = []) {
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - offset));
    return { key: date.toISOString().slice(0, 10), label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date), signup: 0, activity: 0 };
  });
  signups.forEach((entry) => { const day = days.find((item) => item.key === entry.date); if (day) day.signup = Number(entry.count) || 0; });
  activity.forEach((entry) => { const day = days.find((item) => item.key === entry.date); if (day) day.activity = Number(entry.count) || 0; });
  const maximum = Math.max(1, ...days.flatMap((day) => [day.signup, day.activity]));
  return `<div class="chart"><div class="chart-grid"><span></span><span></span><span></span><span></span></div><div class="chart-bars">${days.map((day) => `<div class="chart-day"><div class="bar-pair"><div class="bar" title="${day.activity} completions" style="height:${Math.max(day.activity ? 4 : 2, day.activity / maximum * 100)}%"></div><div class="bar signup" title="${day.signup} sign-ups" style="height:${Math.max(day.signup ? 4 : 2, day.signup / maximum * 100)}%"></div></div><span class="day-label">${escapeHtml(day.label)}</span></div>`).join('')}</div></div>`;
}

function showOverview() {
  const data = state.overview;
  if (!data) return renderDashboard();
  const metrics = data.metrics || {};
  const mlReady = Boolean(metrics.ml?.ready);
  const recentReports = state.reports.filter((report) => report.status !== 'resolved').slice(0, 4);
  const signupChange = Number(metrics.users?.new_this_month) || 0;
  shell(`<div class="page-heading"><div><p class="eyebrow">Community pulse</p><h1>Good day, ${escapeHtml((state.user?.fullName || 'Admin').split(' ')[0])}.</h1><p class="subheading">Here's what's happening across your HabitAI community.</p></div><div class="date-chip"><span aria-hidden="true">◷</span><span>${escapeHtml(new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date()))}</span></div></div>
    <section class="metrics-grid" aria-label="Community metrics">
      <article class="metric-card"><div class="metric-top"><span>Total members</span><span class="metric-icon green" aria-hidden="true">♙</span></div><div class="metric-value">${number(metrics.users?.total)}</div><div class="metric-foot"><strong>+${number(signupChange)}</strong> joined in the last 30 days</div></article>
      <article class="metric-card"><div class="metric-top"><span>Habits created</span><span class="metric-icon orange" aria-hidden="true">✳</span></div><div class="metric-value">${number(metrics.habits)}</div><div class="metric-foot">Across your whole community</div></article>
      <article class="metric-card"><div class="metric-top"><span>Completions · 7 days</span><span class="metric-icon blue" aria-hidden="true">✓</span></div><div class="metric-value">${number(metrics.completions?.last_7_days)}</div><div class="metric-foot">${number(metrics.completions?.total)} total recorded</div></article>
      <article class="metric-card"><div class="metric-top"><span>Open support reports</span><span class="metric-icon yellow" aria-hidden="true">▤</span></div><div class="metric-value">${number(metrics.reports?.open)}</div><div class="metric-foot">${number(metrics.reports?.total)} reports submitted</div></article>
    </section>
    <section class="overview-grid">
      <article class="panel"><div class="panel-heading"><div><h2>Community activity</h2><p class="panel-note">Daily sign-ups and completed habits · last 7 days</p></div><div class="legend"><span><i></i> Completions</span><span><i></i> Sign-ups</span></div></div>${chartMarkup(data.signups, data.activity)}</article>
      <article class="panel"><div class="panel-heading"><div><h2>Engagement snapshot</h2><p class="panel-note">A quick look at your community</p></div></div>
        <div class="engagement-list"><div class="engagement-item"><div class="engagement-label"><span>Habit completions this week</span><strong>${number(metrics.completions?.last_7_days)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Number(metrics.completions?.last_7_days) / Math.max(1, Number(metrics.completions?.total) || 1) * 100)}%"></div></div></div>
        <div class="engagement-item"><div class="engagement-label"><span>New members this month</span><strong>${number(signupChange)}</strong></div><div class="progress-track"><div class="progress-fill orange" style="width:${Math.min(100, signupChange / Math.max(1, Number(metrics.users?.total) || 1) * 100 * 5)}%"></div></div></div>
        <div class="engagement-item"><div class="engagement-label"><span>Reports needing attention</span><strong>${number(metrics.reports?.open)}</strong></div><div class="progress-track"><div class="progress-fill blue" style="width:${Math.min(100, Number(metrics.reports?.open) / Math.max(1, Number(metrics.reports?.total) || 1) * 100)}%"></div></div></div></div>
        <div class="health-row"><span>Habit prediction service</span><span class="status-pill ${mlReady ? '' : 'in_progress'}">${mlReady ? 'Operational' : 'Unavailable'}</span></div></article>
    </section>
    <section class="lower-grid">
      <article class="panel"><div class="panel-heading"><div><h2>Recently joined</h2><p class="panel-note">The latest community members</p></div><button class="text-button" data-view="users" type="button">View all members →</button></div><div class="table-wrap" id="recent-users"><div class="loading">Loading members...</div></div></article>
      <article class="panel"><div class="panel-heading"><div><h2>Support inbox</h2><p class="panel-note">Follow up with members</p></div></div><div class="report-summary"><div class="report-stat"><strong>${number(metrics.reports?.open)}</strong><span>Need attention</span></div><div class="report-stat"><strong>${number(metrics.reports?.total)}</strong><span>Total received</span></div></div><div class="report-preview">${recentReports.length ? recentReports.map((report) => `<div class="report-item"><span class="report-mark" aria-hidden="true">!</span><div class="report-copy"><strong>${escapeHtml(report.topic)}</strong><span>${escapeHtml(report.userName || report.email)} · ${escapeHtml(displayDate(report.createdAt))}</span></div><span class="status-pill ${escapeHtml(report.status)}">${escapeHtml(report.status.replace('_', ' '))}</span></div>`).join('') : '<div class="empty-state">No open support reports.</div>'}</div><div class="view-all"><button class="text-button" data-view="reports" type="button">Open support inbox →</button></div></article>
    </section>`);
  state.view = 'overview';
  app.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
  loadUsers(1, '', true).catch(() => {});
  app.querySelector('#sidebar-health').textContent = mlReady ? 'Operational' : 'Unavailable';
  app.querySelector('#updated-at').textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())}`;
}

async function loadUsers(page = state.userPage, search = state.userSearch) {
  const query = new URLSearchParams({ page: String(page), search });
  const data = await api(`/api/admin/users?${query}`);
  state.users = data.users || [];
  state.userTotal = Number(data.total) || 0;
  state.userPage = Number(data.page) || page;
  if (state.view === 'users') showUsers();
  else if (state.view === 'overview') {
    const container = app.querySelector('#recent-users');
    if (container) container.innerHTML = state.users.length ? `<table><thead><tr><th>Member</th><th>Joined</th><th>Habits</th></tr></thead><tbody>${state.users.slice(0, 4).map((user) => `<tr><td><div class="user-cell"><span class="mini-avatar">${escapeHtml(initials(user.fullName))}</span><div><div class="user-name">${escapeHtml(user.fullName)}</div><div class="user-email">${escapeHtml(user.email)}</div></div></div></td><td>${escapeHtml(displayDate(user.createdAt))}</td><td>${number(user.habitCount)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No members yet.</div>';
  }
}

function showUsers() {
  const totalPages = Math.max(1, Math.ceil(state.userTotal / 25));
  shell(`<div class="page-heading"><div><p class="eyebrow">Community directory</p><h1>Members</h1><p class="subheading">Search and review registered HabitAI accounts.</p></div><div class="date-chip">${number(state.userTotal)} members</div></div>
    <section class="panel"><div class="toolbar"><label class="search-wrap"><input class="search-input" id="user-search" type="search" value="${escapeHtml(state.userSearch)}" placeholder="Search by name, username, or email" aria-label="Search members" /></label><span class="table-meta">${state.userTotal ? `${number((state.userPage - 1) * 25 + 1)}–${number(Math.min(state.userPage * 25, state.userTotal))} of ${number(state.userTotal)}` : 'No members found'}</span></div>
    <div class="table-wrap"><table><thead><tr><th>Member</th><th>Region</th><th>Habits</th><th>Completions</th><th>Last active</th><th>Joined</th></tr></thead><tbody>${state.users.length ? state.users.map((user) => `<tr><td><div class="user-cell"><span class="mini-avatar">${escapeHtml(initials(user.fullName))}</span><div><div class="user-name">${escapeHtml(user.fullName)}</div><div class="user-email">${escapeHtml(user.email)}</div></div></div></td><td>${escapeHtml(user.region || '—')}</td><td>${number(user.habitCount)}</td><td>${number(user.completionCount)}</td><td>${escapeHtml(displayDate(user.lastLogin))}</td><td>${escapeHtml(displayDate(user.createdAt))}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">No members match this search.</div></td></tr>'}</tbody></table></div>
    <div class="pagination"><span>Page ${state.userPage} of ${totalPages}</span><div class="pagination-actions"><button class="icon-button" id="previous-page" type="button" aria-label="Previous page" ${state.userPage <= 1 ? 'disabled' : ''}>←</button><button class="icon-button" id="next-page" type="button" aria-label="Next page" ${state.userPage >= totalPages ? 'disabled' : ''}>→</button></div></div></section>`);
  state.view = 'users';
  let searchTimer;
  app.querySelector('#user-search').addEventListener('input', (event) => {
    state.userSearch = event.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadUsers(1, state.userSearch).catch((error) => showToast(error.message)), 280);
  });
  app.querySelector('#previous-page').addEventListener('click', () => loadUsers(state.userPage - 1).catch((error) => showToast(error.message)));
  app.querySelector('#next-page').addEventListener('click', () => loadUsers(state.userPage + 1).catch((error) => showToast(error.message)));
}

function showReports() {
  shell(`<div class="page-heading"><div><p class="eyebrow">Member support</p><h1>Support reports</h1><p class="subheading">Review submitted issues and update their status.</p></div><div class="date-chip">${number(state.reports.length)} recent reports</div></div>
    <section class="panel"><div class="toolbar"><div><h2 style="margin:0;font:800 14px Manrope,sans-serif">Report queue</h2><p class="panel-note">Newest first · up to 100 reports</p></div><span class="status-pill">${number(state.reports.filter((report) => report.status === 'open').length)} open</span></div>
    <div class="table-wrap"><table><thead><tr><th>Topic</th><th>Member</th><th>Description</th><th>Submitted</th><th>Status</th></tr></thead><tbody>${state.reports.length ? state.reports.map((report) => `<tr><td><div class="report-title" title="${escapeHtml(report.topic)}">${escapeHtml(report.topic)}</div><div class="user-email">${escapeHtml(report.timing)}</div></td><td><div class="user-name">${escapeHtml(report.userName || 'HabitAI member')}</div><div class="user-email">${escapeHtml(report.email)}</div></td><td><div class="report-description" title="${escapeHtml(report.description)}">${escapeHtml(report.description)}</div>${report.attachmentName ? `<div class="user-email">Attachment: ${escapeHtml(report.attachmentName)}</div>` : ''}</td><td>${escapeHtml(displayDate(report.createdAt, { year: 'numeric', month: 'short', day: 'numeric' }))}</td><td><select class="status-select" data-report-id="${escapeHtml(report.id)}" aria-label="Status for ${escapeHtml(report.topic)}"><option value="open" ${report.status === 'open' ? 'selected' : ''}>Open</option><option value="in_progress" ${report.status === 'in_progress' ? 'selected' : ''}>In progress</option><option value="resolved" ${report.status === 'resolved' ? 'selected' : ''}>Resolved</option></select></td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state">No support reports have been submitted.</div></td></tr>'}</tbody></table></div></section>`);
  state.view = 'reports';
  app.querySelectorAll('[data-report-id]').forEach((select) => select.addEventListener('change', (event) => updateReport(event.target.dataset.reportId, event.target.value)));
}

async function updateReport(id, status) {
  try {
    await api(`/api/admin/reports/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    const report = state.reports.find((entry) => entry.id === id);
    if (report) report.status = status;
    showToast('Report status updated.');
    if (state.view === 'reports') showReports();
    else if (state.view === 'overview') showOverview();
  } catch (error) {
    showToast(error.message);
    await refreshView();
  }
}

async function navigate(view) {
  state.view = view;
  if (view === 'overview') return renderDashboard();
  if (view === 'users') {
    shell('<div class="loading">Loading members...</div>', view);
    try { await loadUsers(1, state.userSearch); showUsers(); }
    catch (error) { shell(`<div class="error-banner">${escapeHtml(error.message)}</div>`, view); }
    return;
  }
  shell('<div class="loading">Loading support reports...</div>', view);
  try { const data = await api('/api/admin/reports'); state.reports = data.reports || []; showReports(); }
  catch (error) { shell(`<div class="error-banner">${escapeHtml(error.message)}</div>`, view); }
}

async function refreshView() {
  if (state.view === 'users') return loadUsers(state.userPage, state.userSearch).catch((error) => showToast(error.message));
  if (state.view === 'reports') {
    try { const data = await api('/api/admin/reports'); state.reports = data.reports || []; showReports(); showToast('Support reports updated.'); }
    catch (error) { showToast(error.message); }
    return;
  }
  return renderDashboard();
}

async function logout() {
  try { await api('/api/admin/auth/logout', { method: 'POST' }); } catch { /* Clear local credentials even when the API is offline. */ }
  clearSession();
  renderAuth();
}

async function start() {
  if (!state.token) return renderAuth();
  try {
    const data = await api('/api/admin/auth/me');
    state.user = data.user;
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    await renderDashboard();
  } catch {
    clearSession();
    renderAuth('login', 'Your session expired. Sign in again to continue.');
  }
}

start();