/* ========================================================================== */
/* SECURITY: login, sessions, backend token                                   */
/*                                                                            */
/* Nothing secret lives in this code or in the GitHub repo:                   */
/* - user passwords are stored only as salted hashes in Script Properties     */
/* - sessions live in CacheService (6 h) and are bound to a random token      */
/* - the read-only backend token is stored only as a hash                     */
/* Set everything up once from the sheet menu "Security" (see onOpen).        */
/* ========================================================================== */

const AUTH_USERS_PROP = 'AUTH_USERS';
const BACKEND_TOKEN_HASH_PROP = 'BACKEND_TOKEN_HASH';
const SESSION_SECONDS = 6 * 60 * 60;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const HASH_ROUNDS = 3000;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Security')
    .addItem('Add or update user', 'securityAddUser')
    .addItem('Create backend token (read-only)', 'securityCreateBackendToken')
    .addItem('Revoke backend token', 'securityRevokeBackendToken')
    .addItem('List users', 'securityListUsers')
    .addToUi();
}

/* ---- hashing helpers ---------------------------------------------------- */

function bytesToHex_(bytes) {
  return bytes.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function sha256Hex_(text) {
  return bytesToHex_(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
  );
}

function hashPassword_(password, salt) {
  const saltBytes = Utilities.newBlob(salt).getBytes();
  let h = Utilities.newBlob(salt + ':' + password).getBytes();
  for (let i = 0; i < HASH_ROUNDS; i++) {
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(saltBytes));
  }
  return bytesToHex_(h);
}

function safeEqual_(a, b) {
  a = String(a || '');
  b = String(b || '');
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function randomToken_() {
  return (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

/* ---- user store --------------------------------------------------------- */

function readAuthUsers_() {
  const raw = PropertiesService.getScriptProperties().getProperty(AUTH_USERS_PROP);
  return raw ? JSON.parse(raw) : {};
}

function writeAuthUsers_(users) {
  PropertiesService.getScriptProperties().setProperty(AUTH_USERS_PROP, JSON.stringify(users));
}

/** Public: only names and theme, never anything secret. */
function publicUsers_() {
  const users = readAuthUsers_();
  return Object.keys(users).map(function (key) {
    return { user_key: key, display_name: users[key].display_name, theme: users[key].theme };
  });
}

/* ---- login / sessions --------------------------------------------------- */

function loginUser_(userKey, password) {
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + String(userKey).toLowerCase();
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_FAILED_LOGINS) {
    throw new Error('Too many attempts. Try again in 15 minutes.');
  }
  const users = readAuthUsers_();
  const user = users[String(userKey)];
  // Same work whether the user exists or not, so timing does not reveal valid names.
  const salt = user ? user.salt : 'x';
  const ok = safeEqual_(hashPassword_(String(password || ''), salt), user ? user.hash : 'x') && !!user;
  if (!ok) {
    cache.put(failKey, String(fails + 1), LOCKOUT_SECONDS);
    throw new Error('Wrong user or password.');
  }
  cache.remove(failKey);
  const token = randomToken_();
  const session = { user_key: userKey, display_name: user.display_name, theme: user.theme };
  cache.put('sess_' + sha256Hex_(token), JSON.stringify(session), SESSION_SECONDS);
  return { token: token, user: session };
}

function logoutUser_(token) {
  if (token) CacheService.getScriptCache().remove('sess_' + sha256Hex_(String(token)));
}

/**
 * Returns {kind:'user', user} for a valid session token, {kind:'service'} for the
 * read-only backend token, or throws. Called for every request except ping/users/login.
 */
function authenticate_(body) {
  if (body.token) {
    const raw = CacheService.getScriptCache().get('sess_' + sha256Hex_(String(body.token)));
    if (raw) return { kind: 'user', user: JSON.parse(raw) };
  }
  if (body.service_token) {
    const stored = PropertiesService.getScriptProperties().getProperty(BACKEND_TOKEN_HASH_PROP);
    if (stored && safeEqual_(sha256Hex_(String(body.service_token)), stored)) return { kind: 'service' };
  }
  throw new Error('unauthorized');
}

/* ---- menu actions (run from the sheet, passwords never touch the code) -- */

function securityAddUser() {
  const ui = SpreadsheetApp.getUi();
  const ask = function (label) {
    const r = ui.prompt('Security', label, ui.ButtonSet.OK_CANCEL);
    return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null;
  };
  const key = ask('User key (short, e.g. maximilian)');
  if (!key) return;
  const name = ask('Display name (exactly as used in the app, e.g. Maximilian Hofer)');
  if (!name) return;
  const theme = ask('Theme: blue or pink');
  if (!theme) return;
  const password = ask('New password (min. 12 characters)');
  if (!password || password.length < 12) {
    ui.alert('Password too short. Nothing changed.');
    return;
  }
  const users = readAuthUsers_();
  const salt = randomToken_().slice(0, 24);
  users[key] = {
    display_name: name,
    theme: theme === 'pink' ? 'pink' : 'blue',
    salt: salt,
    hash: hashPassword_(password, salt)
  };
  writeAuthUsers_(users);
  ui.alert('Saved user "' + key + '". Existing sessions stay valid for up to 6 h.');
}

function securityCreateBackendToken() {
  const ui = SpreadsheetApp.getUi();
  const token = randomToken_();
  PropertiesService.getScriptProperties().setProperty(BACKEND_TOKEN_HASH_PROP, sha256Hex_(token));
  ui.alert(
    'Backend token (shown once; copy it into the PersonalAI .env as FINANCE_SERVICE_TOKEN):\n\n' + token +
    '\n\nIt can only read data (action getAll).'
  );
}

function securityRevokeBackendToken() {
  PropertiesService.getScriptProperties().deleteProperty(BACKEND_TOKEN_HASH_PROP);
  SpreadsheetApp.getUi().alert('Backend token revoked.');
}

function securityListUsers() {
  const users = readAuthUsers_();
  SpreadsheetApp.getUi().alert(
    Object.keys(users).map(function (k) { return k + ' -> ' + users[k].display_name; }).join('\n') || 'No users yet.'
  );
}
