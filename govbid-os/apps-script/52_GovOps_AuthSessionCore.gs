/* GovOps OS｜Auth Session Core v1
 * 目的：補齊 SaaS 產品需要的後端 Session/Auth 基礎層。
 * 原則：不取代現有前端 localStorage，先建立後端可驗證 session 與組織使用者資料。
 */

var GOVOPS_AUTH_SESSION_TTL_HOURS = 24;

function handleGovOpsAuthAction(action, data) {
  data = data || {};
  try {
    if (action === 'auth.login' || action === '登入') return GovOpsAuth_login(data);
    if (action === 'auth.logout' || action === '登出') return GovOpsAuth_logout(data);
    if (action === 'auth.validate' || action === '驗證Session') return GovOpsAuth_validate(data);
    if (action === 'auth.createUser' || action === '建立使用者') return GovOpsAuth_createUser(data);
    if (action === 'auth.queryUsers' || action === '查詢使用者') return GovOpsAuth_queryUsers(data);
    return null;
  } catch (err) {
    GovOpsAuth_logError('handleGovOpsAuthAction', err, data);
    return GovOpsAuth_fail('帳號權限功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_AUTH = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsAuthAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_AUTH(action, data);
  };
}

function GovOpsAuth_success(message, data) {
  return { success: true, message: message || '操作完成。', data: data || {} };
}

function GovOpsAuth_fail(message, data) {
  return { success: false, message: message || '操作失敗。', data: data || {} };
}

function GovOpsAuth_now() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function GovOpsAuth_expireAt() {
  var d = new Date(new Date().getTime() + GOVOPS_AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000);
  return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function GovOpsAuth_usersSheetName() {
  return (typeof GOVOPS_PRODUCT_SHEETS !== 'undefined' && GOVOPS_PRODUCT_SHEETS.使用者) ? GOVOPS_PRODUCT_SHEETS.使用者 : '25_組織與使用者';
}

function GovOpsAuth_sessionsSheetName() {
  return (typeof GOVOPS_PRODUCT_SHEETS !== 'undefined' && GOVOPS_PRODUCT_SHEETS.Session) ? GOVOPS_PRODUCT_SHEETS.Session : '26_Session紀錄';
}

function GovOpsAuth_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsAuth_usersSheetName(), ['tenantId','tenantName','userId','userName','email','phone','role','plan','status','passwordHash','建立時間','更新時間']);
  GovOpsProduct_ensureSheet(GovOpsAuth_sessionsSheetName(), ['sessionToken','tenantId','userId','email','role','plan','status','建立時間','過期時間','最後使用時間','來源','備註']);
}

function GovOpsAuth_hashPassword(password) {
  var raw = String(password || '');
  if (!raw) return '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw + '|GovOpsOS');
  return bytes.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function GovOpsAuth_token() {
  return 'SESS-' + Utilities.getUuid();
}

function GovOpsAuth_createUser(data) {
  data = data || {};
  GovOpsAuth_ensureSheets();
  var tenantId = data.tenantId || ('TENANT-' + Utilities.getUuid().slice(0, 8));
  var email = String(data.email || data.Email || '').trim().toLowerCase();
  if (!email) return GovOpsAuth_fail('請提供 Email。');
  var rows = GovOpsProduct_readRows(GovOpsAuth_usersSheetName());
  var existed = rows.find(function(r) { return String(r.email || '').toLowerCase() === email && String(r.tenantId || '') === String(tenantId); });
  if (existed) return GovOpsAuth_fail('此使用者已存在。');
  var userId = data.userId || ('USR-' + Utilities.getUuid().slice(0, 8));
  var row = {
    tenantId: tenantId,
    tenantName: data.tenantName || data.organizationName || data.orgName || '未命名組織',
    userId: userId,
    userName: data.userName || data.name || '未命名使用者',
    email: email,
    phone: data.phone || '',
    role: data.role || 'owner',
    plan: data.plan || 'pro',
    status: data.status || 'active',
    passwordHash: GovOpsAuth_hashPassword(data.password || data.密碼 || ''),
    建立時間: GovOpsAuth_now(),
    更新時間: GovOpsAuth_now()
  };
  GovOpsProduct_append(GovOpsAuth_usersSheetName(), row);
  return GovOpsAuth_success('使用者已建立。', { tenantId: tenantId, userId: userId, email: email, role: row.role, plan: row.plan });
}

function GovOpsAuth_login(data) {
  data = data || {};
  GovOpsAuth_ensureSheets();
  var email = String(data.email || data.Email || '').trim().toLowerCase();
  var password = String(data.password || data.密碼 || '');
  if (!email) return GovOpsAuth_fail('請提供 Email。');
  var rows = GovOpsProduct_readRows(GovOpsAuth_usersSheetName());
  var found = rows.find(function(r) { return String(r.email || '').toLowerCase() === email && String(r.status || 'active') === 'active'; });
  if (!found) return GovOpsAuth_fail('找不到可登入的使用者。');
  if (found.passwordHash && found.passwordHash !== GovOpsAuth_hashPassword(password)) return GovOpsAuth_fail('帳號或密碼不正確。');
  var token = GovOpsAuth_token();
  var session = {
    sessionToken: token,
    tenantId: found.tenantId || '',
    userId: found.userId || '',
    email: found.email || email,
    role: found.role || 'owner',
    plan: found.plan || 'pro',
    status: 'active',
    建立時間: GovOpsAuth_now(),
    過期時間: GovOpsAuth_expireAt(),
    最後使用時間: GovOpsAuth_now(),
    來源: data.source || 'web',
    備註: ''
  };
  GovOpsProduct_append(GovOpsAuth_sessionsSheetName(), session);
  return GovOpsAuth_success('登入成功。', session);
}

function GovOpsAuth_validate(data) {
  data = data || {};
  GovOpsAuth_ensureSheets();
  var token = String(data.sessionToken || data.token || '').trim();
  if (!token) return GovOpsAuth_fail('缺少 sessionToken。', { valid: false });
  var rows = GovOpsProduct_readRows(GovOpsAuth_sessionsSheetName());
  var found = rows.find(function(r) { return String(r.sessionToken || '') === token && String(r.status || '') === 'active'; });
  if (!found) return GovOpsAuth_fail('Session 無效或已登出。', { valid: false });
  var expire = new Date(String(found.過期時間 || '').replace(/-/g, '/'));
  if (!isNaN(expire.getTime()) && expire < new Date()) {
    GovOpsProduct_update(GovOpsAuth_sessionsSheetName(), found._row, { status: 'expired', 最後使用時間: GovOpsAuth_now() });
    return GovOpsAuth_fail('Session 已過期，請重新登入。', { valid: false });
  }
  GovOpsProduct_update(GovOpsAuth_sessionsSheetName(), found._row, { 最後使用時間: GovOpsAuth_now() });
  return GovOpsAuth_success('Session 驗證成功。', { valid: true, tenantId: found.tenantId, userId: found.userId, email: found.email, role: found.role, plan: found.plan });
}

function GovOpsAuth_logout(data) {
  data = data || {};
  GovOpsAuth_ensureSheets();
  var token = String(data.sessionToken || data.token || '').trim();
  if (!token) return GovOpsAuth_fail('缺少 sessionToken。');
  var rows = GovOpsProduct_readRows(GovOpsAuth_sessionsSheetName());
  var found = rows.find(function(r) { return String(r.sessionToken || '') === token; });
  if (found) GovOpsProduct_update(GovOpsAuth_sessionsSheetName(), found._row, { status: 'logout', 最後使用時間: GovOpsAuth_now() });
  return GovOpsAuth_success('已登出。');
}

function GovOpsAuth_queryUsers(data) {
  data = data || {};
  GovOpsAuth_ensureSheets();
  var tenantId = data.tenantId || '';
  var rows = GovOpsProduct_readRows(GovOpsAuth_usersSheetName()).filter(function(r) {
    return !tenantId || String(r.tenantId || '') === String(tenantId);
  }).map(function(r) {
    delete r.passwordHash;
    return r;
  });
  return GovOpsAuth_success('使用者查詢完成。', { total: rows.length, rows: rows });
}

function GovOpsAuth_logError(module, err, data) {
  try {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {});
    else if (typeof logError === 'function') logError(module, err);
  } catch (e) {}
}

function 測試_Auth_建立使用者() {
  return GovOpsAuth_createUser({ tenantId: 'TENANT-DEMO', tenantName: 'GovOps Demo', userName: 'Demo Owner', email: 'demo@govops.local', password: 'demo1234', role: 'owner', plan: 'pro' });
}

function 測試_Auth_登入() {
  return GovOpsAuth_login({ email: 'demo@govops.local', password: 'demo1234' });
}
