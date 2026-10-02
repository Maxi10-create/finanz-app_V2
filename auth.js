// Login against the Apps Script backend. No passwords or user lists live in this repo:
// the server checks the password and returns a session token that every request must carry.
let AUTH_USERS = [];
let SELECTED_USER = null;

function authBaseUrl() {
  return (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URLS && CONFIG.API_BASE_URLS[0]) || '';
}

async function authPost(body) {
  const response = await fetch(authBaseUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  if (!result?.success) throw new Error(result?.error || 'Request failed');
  return result;
}

async function loadUsers() {
  const response = await fetch(`${authBaseUrl()}?action=users&_=${Date.now()}`, { cache: 'no-store' });
  const result = await response.json();
  AUTH_USERS = result?.users || [];
  return AUTH_USERS;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderUserSelection() {
  const container = document.getElementById('userSelection');
  if (!container) return;

  container.innerHTML = AUTH_USERS.map((user) => `
    <button class="login-user-card" data-userkey="${escapeHtml(user.user_key)}">
      <span class="login-user-name">${escapeHtml(user.display_name)}</span>
    </button>
  `).join('');

  container.querySelectorAll('.login-user-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      SELECTED_USER = AUTH_USERS.find((u) => u.user_key === btn.dataset.userkey) || null;
      document.querySelectorAll('.login-user-card').forEach((el) => el.classList.remove('active'));
      btn.classList.add('active');

      const selectedName = document.getElementById('selectedUserName');
      if (selectedName && SELECTED_USER) selectedName.textContent = SELECTED_USER.display_name;

      const passwordSection = document.getElementById('passwordSection');
      if (passwordSection) passwordSection.style.display = 'grid';

      const passwordInput = document.getElementById('loginPassword');
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
      setLoginMessage('');
    });
  });
}

function setLoginMessage(message, isError = true) {
  const box = document.getElementById('loginMessage');
  if (!box) return;
  box.textContent = message;
  box.className = message ? `login-message ${isError ? 'error' : 'success'}` : 'login-message';
}

function applyUserTheme(theme) {
  document.body.classList.remove('theme-blue', 'theme-pink');
  document.body.classList.add(theme === 'pink' ? 'theme-pink' : 'theme-blue');
}

function showAppForLoggedInUser(user) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'grid';
  document.getElementById('pageTitle').textContent = `Finanzdashboard – ${user.displayName}`;
  document.getElementById('activeUserLabel').textContent = user.displayName;
}

function getActiveUser() {
  const raw = sessionStorage.getItem('financeActiveUser');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getAuthToken() {
  return sessionStorage.getItem('financeToken') || '';
}

async function loginUser() {
  if (!SELECTED_USER) {
    setLoginMessage('Bitte zuerst einen Nutzer auswählen.');
    return false;
  }
  const password = document.getElementById('loginPassword').value;
  const button = document.getElementById('loginBtn');
  if (button) button.disabled = true;
  try {
    const result = await authPost({ action: 'login', user_key: SELECTED_USER.user_key, password });
    const sessionUser = {
      userKey: result.user.user_key,
      displayName: result.user.display_name,
      theme: result.user.theme
    };
    sessionStorage.setItem('financeToken', result.token);
    sessionStorage.setItem('financeActiveUser', JSON.stringify(sessionUser));
    document.getElementById('loginPassword').value = '';
    applyUserTheme(sessionUser.theme);
    showAppForLoggedInUser(sessionUser);
    setLoginMessage('', false);
    if (typeof onUserLoggedIn === 'function') onUserLoggedIn(sessionUser);
    return true;
  } catch (error) {
    setLoginMessage(error.message || 'Login fehlgeschlagen.');
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

function logoutUser() {
  const token = getAuthToken();
  if (token) authPost({ action: 'logout', token }).catch(() => {});
  sessionStorage.removeItem('financeActiveUser');
  sessionStorage.removeItem('financeToken');
  document.body.classList.remove('theme-blue', 'theme-pink');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('passwordSection').style.display = 'none';
  document.querySelectorAll('.login-user-card').forEach((el) => el.classList.remove('active'));
  SELECTED_USER = null;
}

async function initAuth() {
  await loadUsers();
  renderUserSelection();
  document.getElementById('loginBtn')?.addEventListener('click', loginUser);
  document.getElementById('loginPassword')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loginUser();
    }
  });
  document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);

  const activeUser = getActiveUser();
  if (activeUser && getAuthToken()) {
    applyUserTheme(activeUser.theme);
    showAppForLoggedInUser(activeUser);
  } else {
    sessionStorage.removeItem('financeActiveUser');
  }
}
