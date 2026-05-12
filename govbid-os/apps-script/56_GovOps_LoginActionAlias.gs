/* GovOps OS｜Login Action Alias v1
 * 目的：相容既有 login-auth-adapter.js 的舊 action 名稱。
 */

function handleGovOpsLoginAliasAction(action, data) {
  data = data || {};
  try {
    if (action === '註冊組織與管理者') return GovOpsLoginAlias_register(data);
    if (action === '登入使用者') return GovOpsLoginAlias_login(data);
    return null;
  } catch (err) {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError('handleGovOpsLoginAliasAction', err, data);
    return { success: false, message: '登入功能暫時無法完成操作，請稍後再試。', data: {} };
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_LOGIN_ALIAS = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsLoginAliasAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_LOGIN_ALIAS(action, data);
  };
}

function GovOpsLoginAlias_register(data) {
  if (typeof GovOpsAuth_createUser !== 'function') return { success: false, message: 'Auth Core 尚未載入。', data: {} };
  var tenantId = data.tenantId || ('TENANT-' + Utilities.getUuid().slice(0, 8));
  var result = GovOpsAuth_createUser({
    tenantId: tenantId,
    tenantName: data.organizationName || data.orgName || '未命名組織',
    userName: data.ownerName || data.userName || data.organizationName || '管理者',
    email: data.email || '',
    phone: data.phone || '',
    role: 'owner',
    plan: data.plan || 'pro',
    status: 'active'
  });
  if (!result.success && String(result.message || '').indexOf('已存在') < 0) return result;
  return GovOpsLoginAlias_buildSession({
    tenantId: tenantId,
    userId: result.data && result.data.userId || ('USR-' + Utilities.getUuid().slice(0, 8)),
    email: data.email || '',
    role: 'owner',
    plan: data.plan || 'pro',
    orgName: data.organizationName || data.orgName || '未命名組織',
    userName: data.ownerName || data.userName || data.organizationName || '管理者'
  }, '註冊成功。');
}

function GovOpsLoginAlias_login(data) {
  if (typeof GovOpsProduct_readRows !== 'function') return { success: false, message: 'Auth Core 尚未載入。', data: {} };
  var email = String(data.email || '').trim().toLowerCase();
  var rows = GovOpsProduct_readRows('25_組織與使用者');
  var found = rows.find(function(r){ return String(r.email || '').toLowerCase() === email && String(r.status || 'active') === 'active'; });
  if (!found) return { success: false, message: '找不到可登入的使用者。', data: {} };
  return GovOpsLoginAlias_buildSession({
    tenantId: found.tenantId,
    userId: found.userId,
    email: found.email,
    role: found.role || 'owner',
    plan: found.plan || 'pro',
    orgName: found.tenantName || found.tenantId,
    userName: found.userName || found.email
  }, '登入成功。');
}

function GovOpsLoginAlias_buildSession(info, message) {
  var token = 'SESS-' + Utilities.getUuid();
  var auth = {
    tenantId: info.tenantId,
    userId: info.userId,
    userRole: info.role,
    plan: info.plan,
    status: 'active',
    sessionToken: token,
    email: info.email
  };
  var profile = {
    tenantId: info.tenantId,
    userId: info.userId,
    orgName: info.orgName,
    organizationName: info.orgName,
    userName: info.userName,
    email: info.email,
    role: info.role,
    userRole: info.role,
    plan: info.plan,
    status: 'active'
  };
  return { success: true, message: message || '操作完成。', data: { tenantId: info.tenantId, userId: info.userId, email: info.email, role: info.role, plan: info.plan, sessionToken: token, govops_profile: profile, govops_auth: auth } };
}
