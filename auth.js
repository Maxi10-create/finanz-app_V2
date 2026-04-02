let AUTH_USERS = [];
let SELECTED_USER = null;

async function loadUsersFromCsv() {
  const response = await fetch('users.csv');
  if (!response.ok) throw new Error('users.csv konnte nicht geladen werden.');
  const text = await response.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');

  AUTH_USERS = lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = (values[index] || '').trim();
    });
    return obj;
  });
  return AUTH_USERS;
}

function renderUserSelection() {
  const container = document.getElementById('userSelection');
  if (!container) return;

  container.innerHTML = AUTH_USERS.map(user => `
    <button class="login-user-card" data-userkey="${user.user_key}">
      <span class="login-user-name">${user.display_name}</span>
    </button>
  `).join('');

  container.querySelectorAll('.login-user-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const userKey = btn.dataset.userkey;
      SELECTED_USER = AUTH_USERS.find(u => u.user_key === userKey) || null;
      document.querySelectorAll('.login-user-card').forEach(el => el.classList.remove('active'));
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

function loginUser() {
  if (!SELECTED_USER) {
    setLoginMessage('Bitte zuerst einen Nutzer auswählen.');
    return false;
  }
  const password = document.getElementById('loginPassword').value;
  if (password !== SELECTED_USER.password) {
    setLoginMessage('Passwort falsch.');
    return false;
  }
  const sessionUser = {
    userKey: SELECTED_USER.user_key,
    displayName: SELECTED_USER.display_name,
    theme: SELECTED_USER.theme
  };
  sessionStorage.setItem('financeActiveUser', JSON.stringify(sessionUser));
  applyUserTheme(sessionUser.theme);
  showAppForLoggedInUser(sessionUser);
  setLoginMessage('', false);
  if (typeof onUserLoggedIn === 'function') onUserLoggedIn(sessionUser);
  return true;
}

function logoutUser() {
  sessionStorage.removeItem('financeActiveUser');
  document.body.classList.remove('theme-blue', 'theme-pink');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('passwordSection').style.display = 'none';
  document.querySelectorAll('.login-user-card').forEach(el => el.classList.remove('active'));
  SELECTED_USER = null;
}

async function initAuth() {
  await loadUsersFromCsv();
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
  if (activeUser) {
    applyUserTheme(activeUser.theme);
    showAppForLoggedInUser(activeUser);
  }
}
