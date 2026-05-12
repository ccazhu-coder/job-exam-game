/*
GovOps OS｜49_GovOps_TenantRoleEngine.gs
目的：建立低風險 Tenant / User / Role / Permission Registry。
安全策略：
1. 不修改 37_core.gs / router。
2. 不產生 token、不處理登入憑證、不做強制攔截。
3. 只建立租戶、使用者、角色、權限規則與檢查函式。
4. 後續 Session Engine 另行拆分，不與本檔混合。
*/

var GOVOPS_TENANT_ROLE_VERSION = '1.0.0';
var GOVOPS_TENANT_SHEET = '組織資料表';
var GOVOPS_USER_ACCOUNT_SHEET = '使用者帳號表';
var GOVOPS_ROLE_ASSIGNMENT_SHEET = '使用者角色權限';
var GOVOPS_PERMISSION_RULES_SHEET = '權限規則';

var GOVOPS_TENANT_HEADERS = ['tenantId','組織名稱','組織類型','方案','狀態','OwnerEmail','建立時間','更新時間','備註'];
var GOVOPS_USER_ACCOUNT_HEADERS = ['userId','tenantId','姓名','Email','角色','狀態','最後登入時間','建立時間','更新時間','備註'];
var GOVOPS_ROLE_ASSIGNMENT_HEADERS = ['userId','tenantId','角色','模組範圍','狀態','建立時間','更新時間','備註'];
var GOVOPS_PERMISSION_RULES_HEADERS = ['角色','模組','動作','是否允許','風險等級','說明','建立時間','更新時間'];

var GOVOPS_DEFAULT_PERMISSION_RULES = [
  ['owner','*','*','是','高','系統擁有者，全部權限'],
  ['admin','*','read','是','中','管理者可讀所有模組'],
  ['admin','*','write','是','高','管理者可寫入多數模組'],
  ['pm','activity','*','是','中','專案管理者可管理活動'],
  ['pm','registration','*','是','中','專案管理者可管理報名'],
  ['pm','workflow','*','是','中','專案管理者可管理任務與流程'],
  ['pm','reimbursement','*','是','中','專案管理者可管理核銷'],
  ['finance','finance','*','是','高','財務角色可管理財務'],
  ['finance','activity','read','是','低','財務角色可讀活動'],
  ['staff','workflow','read','是','低','工作人員可讀任務'],
  ['staff','workflow','write','是','中','工作人員可更新任務'],
  ['staff','attendance','write','是','中','工作人員可更新簽到'],
  ['viewer','*','read','是','低','檢視者唯讀'],
  ['viewer','*','write','否','高','檢視者不可寫入']
];

function 初始化TenantRoleEngine() {
  try {
    ensureTenantRoleSheets_();
    seedTenantRolePermissionRules_();
    ensureDefaultTenant_();
    return success('Tenant / Role Engine 初始化完成。', {
      version: GOVOPS_TENANT_ROLE_VERSION,
      tenantSheet: GOVOPS_TENANT_SHEET,
      userSheet: GOVOPS_USER_ACCOUNT_SHEET,
      roleSheet: GOVOPS_ROLE_ASSIGNMENT_SHEET,
      permissionSheet: GOVOPS_PERMISSION_RULES_SHEET
    });
  } catch (err) {
    if (typeof logError === 'function') logError('初始化TenantRoleEngine', err);
    return fail('Tenant / Role Engine 初始化失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function 建立或更新Tenant(data) {
  try {
    初始化TenantRoleEngine();
    data = data || {};
    var tenantId = String(data.tenantId || data.組織ID || 'default').trim() || 'default';
    var orgName = String(data.組織名稱 || data.orgName || tenantId).trim();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_TENANT_SHEET);
    var headers = getTenantRoleHeaders_(sheet);
    var rows = readTenantRoleRows_(GOVOPS_TENANT_SHEET);
    var existed = rows.find(function(r){ return String(r.tenantId) === tenantId; });
    var patch = {
      tenantId: tenantId,
      組織名稱: orgName,
      組織類型: data.組織類型 || data.orgType || '一般組織',
      方案: data.方案 || data.plan || 'Free',
      狀態: data.狀態 || data.status || '啟用',
      OwnerEmail: data.OwnerEmail || data.ownerEmail || '',
      更新時間: nowTenantRoleSafe_(),
      備註: data.備註 || data.note || ''
    };
    if (existed && existed._row) {
      updateTenantRoleRow_(sheet, existed._row, headers, patch);
      return success('Tenant 已更新。', Object.assign({}, existed, patch));
    }
    patch.建立時間 = nowTenantRoleSafe_();
    appendTenantRoleRow_(sheet, headers, patch);
    return success('Tenant 已建立。', patch);
  } catch (err) {
    if (typeof logError === 'function') logError('建立或更新Tenant', err);
    return fail('Tenant 建立或更新失敗。');
  }
}

function 建立或更新GovOpsUser(data) {
  try {
    初始化TenantRoleEngine();
    data = data || {};
    var email = String(data.Email || data.email || '').trim().toLowerCase();
    if (!email) return fail('請提供 Email。');
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var role = String(data.角色 || data.role || 'owner').trim().toLowerCase();
    var name = String(data.姓名 || data.name || email).trim();
    建立或更新Tenant({ tenantId: tenantId, 組織名稱: data.組織名稱 || data.orgName || 'Default Organization', OwnerEmail: email });

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_USER_ACCOUNT_SHEET);
    var headers = getTenantRoleHeaders_(sheet);
    var rows = readTenantRoleRows_(GOVOPS_USER_ACCOUNT_SHEET);
    var existed = rows.find(function(r){ return String(r.tenantId || 'default') === tenantId && String(r.Email || '').toLowerCase() === email; });
    var patch = {
      tenantId: tenantId,
      姓名: name,
      Email: email,
      角色: role,
      狀態: data.狀態 || data.status || '啟用',
      更新時間: nowTenantRoleSafe_(),
      備註: data.備註 || data.note || ''
    };
    if (existed && existed._row) {
      updateTenantRoleRow_(sheet, existed._row, headers, patch);
      upsertGovOpsUserRole_(existed.userId, tenantId, role);
      return success('使用者已更新。', Object.assign({}, existed, patch));
    }
    patch.userId = generateTenantRoleId_('USR');
    patch.最後登入時間 = '';
    patch.建立時間 = nowTenantRoleSafe_();
    appendTenantRoleRow_(sheet, headers, patch);
    upsertGovOpsUserRole_(patch.userId, tenantId, role);
    return success('使用者已建立。', patch);
  } catch (err) {
    if (typeof logError === 'function') logError('建立或更新GovOpsUser', err);
    return fail('使用者建立或更新失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function 檢查TenantRolePermission(data) {
  try {
    初始化TenantRoleEngine();
    data = data || {};
    var role = String(data.角色 || data.role || '').trim().toLowerCase();
    var moduleName = String(data.模組 || data.module || '').trim().toLowerCase();
    var action = String(data.動作 || data.actionType || 'read').trim().toLowerCase();
    if (!role) return fail('請提供角色。', { allowed: false });
    if (!moduleName) return fail('請提供模組。', { allowed: false });
    var allowed = isTenantRoleAllowed_(role, moduleName, action);
    return success(allowed ? '權限允許。' : '權限不足。', { allowed: allowed, role: role, module: moduleName, action: action });
  } catch (err) {
    if (typeof logError === 'function') logError('檢查TenantRolePermission', err);
    return fail('權限檢查失敗。', { allowed: false });
  }
}

function 建立TenantContext(data) {
  try {
    data = data || {};
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var userId = String(data.userId || '').trim();
    var role = String(data.role || data.角色 || 'owner').trim().toLowerCase();
    return success('Tenant Context 已建立。', { tenantId: tenantId, userId: userId, role: role, source: 'tenant-role-engine' });
  } catch (err) {
    if (typeof logError === 'function') logError('建立TenantContext', err);
    return fail('Tenant Context 建立失敗。');
  }
}

function 查詢TenantUsers(data) {
  try {
    初始化TenantRoleEngine();
    data = data || {};
    var tenantId = String(data.tenantId || '').trim();
    var rows = readTenantRoleRows_(GOVOPS_USER_ACCOUNT_SHEET);
    if (tenantId) rows = rows.filter(function(r){ return String(r.tenantId || 'default') === tenantId; });
    return success('使用者清單已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    if (typeof logError === 'function') logError('查詢TenantUsers', err);
    return fail('使用者清單查詢失敗。');
  }
}

function upsertGovOpsUserRole_(userId, tenantId, role) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_ROLE_ASSIGNMENT_SHEET);
  var headers = getTenantRoleHeaders_(sheet);
  var rows = readTenantRoleRows_(GOVOPS_ROLE_ASSIGNMENT_SHEET);
  var existed = rows.find(function(r){ return String(r.userId) === userId && String(r.tenantId) === tenantId && String(r.角色) === role; });
  if (existed) return existed;
  var record = { userId: userId, tenantId: tenantId, 角色: role, 模組範圍: '*', 狀態: '啟用', 建立時間: nowTenantRoleSafe_(), 更新時間: nowTenantRoleSafe_(), 備註: '' };
  appendTenantRoleRow_(sheet, headers, record);
  return record;
}

function isTenantRoleAllowed_(role, moduleName, action) {
  if (role === 'owner') return true;
  var rows = readTenantRoleRows_(GOVOPS_PERMISSION_RULES_SHEET);
  return rows.some(function(r){
    if (String(r.是否允許) !== '是') return false;
    var roleMatch = String(r.角色).toLowerCase() === role;
    var moduleMatch = String(r.模組).toLowerCase() === '*' || String(r.模組).toLowerCase() === moduleName;
    var actionMatch = String(r.動作).toLowerCase() === '*' || String(r.動作).toLowerCase() === action;
    return roleMatch && moduleMatch && actionMatch;
  });
}

function ensureTenantRoleSheets_() {
  ensureTenantRoleSheet_(GOVOPS_TENANT_SHEET, GOVOPS_TENANT_HEADERS);
  ensureTenantRoleSheet_(GOVOPS_USER_ACCOUNT_SHEET, GOVOPS_USER_ACCOUNT_HEADERS);
  ensureTenantRoleSheet_(GOVOPS_ROLE_ASSIGNMENT_SHEET, GOVOPS_ROLE_ASSIGNMENT_HEADERS);
  ensureTenantRoleSheet_(GOVOPS_PERMISSION_RULES_SHEET, GOVOPS_PERMISSION_RULES_HEADERS);
}

function seedTenantRolePermissionRules_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_PERMISSION_RULES_SHEET);
  var headers = getTenantRoleHeaders_(sheet);
  var rows = readTenantRoleRows_(GOVOPS_PERMISSION_RULES_SHEET);
  GOVOPS_DEFAULT_PERMISSION_RULES.forEach(function(rule){
    var existed = rows.some(function(r){ return String(r.角色) === rule[0] && String(r.模組) === rule[1] && String(r.動作) === rule[2]; });
    if (!existed) {
      appendTenantRoleRow_(sheet, headers, { 角色: rule[0], 模組: rule[1], 動作: rule[2], 是否允許: rule[3], 風險等級: rule[4], 說明: rule[5], 建立時間: nowTenantRoleSafe_(), 更新時間: nowTenantRoleSafe_() });
    }
  });
}

function ensureDefaultTenant_() {
  var rows = readTenantRoleRows_(GOVOPS_TENANT_SHEET);
  var existed = rows.find(function(r){ return String(r.tenantId) === 'default'; });
  if (!existed) 建立或更新Tenant({ tenantId: 'default', 組織名稱: 'Default Organization', 方案: 'Free', 狀態: '啟用' });
}

function ensureTenantRoleSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var current = getTenantRoleHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var missing = headers.filter(function(h){ return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function readTenantRoleRows_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getTenantRoleHeaders_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx){
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    return obj;
  });
}

function getTenantRoleHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
}

function appendTenantRoleRow_(sheet, headers, obj) {
  sheet.appendRow(headers.map(function(h){ return obj[h] !== undefined ? obj[h] : ''; }));
}

function updateTenantRoleRow_(sheet, rowNumber, headers, obj) {
  Object.keys(obj).forEach(function(key){
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowNumber, col).setValue(obj[key]);
  });
}

function generateTenantRoleId_(prefix) {
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  return prefix + '-' + roc + '-' + String(new Date().getTime()).slice(-8) + '-' + Math.floor(Math.random() * 1000);
}

function nowTenantRoleSafe_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_TenantRoleEngine_初始化() {
  return 初始化TenantRoleEngine();
}

function 測試_TenantRoleEngine_建立使用者() {
  return 建立或更新GovOpsUser({ email: 'ccazhu@gmail.com', tenantId: 'default', name: '張鄭珠', role: 'owner' });
}

function 測試_TenantRoleEngine_權限() {
  初始化TenantRoleEngine();
  return success('Tenant Role 權限測試完成。', {
    owner: 檢查TenantRolePermission({ role: 'owner', module: 'finance', actionType: 'write' }).data,
    viewerWrite: 檢查TenantRolePermission({ role: 'viewer', module: 'finance', actionType: 'write' }).data,
    financeWrite: 檢查TenantRolePermission({ role: 'finance', module: 'finance', actionType: 'write' }).data
  });
}
