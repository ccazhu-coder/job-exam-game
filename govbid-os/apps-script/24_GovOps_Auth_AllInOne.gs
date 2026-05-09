/*
GovOps OS｜24_GovOps_Auth_AllInOne.gs
版本：Auth + Tenant Backend v1.0.0
用途：建立正式 SaaS 登入後端，不再只依賴 localStorage 假登入。

新增資料表：
- 組織資料表
- 使用者帳號表
- SaaS訂閱表
- 登入紀錄表

新增 action：
- 初始化Auth資料表
- 註冊組織與管理者
- 登入使用者
- 取得目前使用者Session

設計原則：
- patch layer，不修改 15 / 17～23 / 37
- 中文錯誤
- 不顯示技術堆疊
- 可由 router 逐步接入 handleGovOpsAuthAction(action, data)
*/

var GOVOPS_AUTH_VERSION = '1.0.0';

var GOVOPS_AUTH_SHEETS = {
  ORG: '組織資料表',
  USER: '使用者帳號表',
  SUB: 'SaaS訂閱表',
  LOGIN: '登入紀錄表'
};

var GOVOPS_AUTH_HEADERS = {
  '組織資料表': ['tenantId','組織名稱','組織類型','負責人姓名','Email','手機','狀態','建立時間','更新時間','備註'],
  '使用者帳號表': ['userId','tenantId','姓名','Email','手機','userRole','plan','狀態','最後登入時間','建立時間','更新時間','備註'],
  'SaaS訂閱表': ['tenantId','plan','方案名稱','狀態','開始日期','結束日期','活動數上限','CRM上限','AI查詢上限','財務操作上限','提醒操作上限','建立時間','更新時間'],
  '登入紀錄表': ['登入ID','tenantId','userId','Email','手機','登入狀態','登入時間','訊息','來源']
};

var GOVOPS_AUTH_ACTIONS = {
  '初始化Auth資料表': true,
  '註冊組織與管理者': true,
  '登入使用者': true,
  '取得目前使用者Session': true
};

function handleGovOpsAuthAction(action, data) {
  try {
    action = String(action || '').trim();
    if (!GOVOPS_AUTH_ACTIONS[action]) return null;

    if (action === '初始化Auth資料表') return 初始化Auth資料表();
    if (action === '註冊組織與管理者') return 註冊組織與管理者(data || {});
    if (action === '登入使用者') return 登入使用者(data || {});
    if (action === '取得目前使用者Session') return 取得目前使用者Session(data || {});

    return authFail_('找不到對應的 Auth 功能。');
  } catch (err) {
    return authFail_('系統暫時無法完成帳號操作，請稍後再試。');
  }
}

function 初始化Auth資料表() {
  try {
    Object.keys(GOVOPS_AUTH_HEADERS).forEach(function(sheetName) {
      authEnsureSheet_(sheetName, GOVOPS_AUTH_HEADERS[sheetName]);
    });
    return authSuccess_('Auth 資料表初始化完成。', {
      sheets: Object.keys(GOVOPS_AUTH_HEADERS),
      version: GOVOPS_AUTH_VERSION
    });
  } catch (err) {
    return authFail_('Auth 資料表初始化失敗，請稍後再試。');
  }
}

function 註冊組織與管理者(data) {
  try {
    初始化Auth資料表();

    var orgName = authFirst_(data.organizationName, data.orgName, data['組織名稱'], data.userName);
    var email = String(authFirst_(data.email, data.Email, data['Email'])).trim();
    var phone = String(authFirst_(data.phone, data['手機'], data.mobile)).trim();
    var ownerName = authFirst_(data.ownerName, data.name, data['姓名'], data.userName, orgName);
    var orgType = authFirst_(data.orgType, data['組織類型'], '工作室／公司');
    var plan = normalizeAuthPlan_(authFirst_(data.plan, data['SaaS方案'], 'PRO'));

    if (!orgName) return authFail_('請先填寫組織名稱。');
    if (!email && !phone) return authFail_('請至少填寫 Email 或手機，作為日後登入帳號。');

    var existingUser = findAuthUser_(email, phone);
    if (existingUser) {
      return authFail_('此 Email 或手機已註冊，請改用登入使用者。', {
        tenantId: existingUser.tenantId,
        userId: existingUser.userId
      });
    }

    var tenantId = authGenerateId_('TENANT');
    var userId = authGenerateId_('USER');
    var nowText = authNow_();
    var limits = getAuthPlanLimit_(plan);

    authAppendObject_(GOVOPS_AUTH_SHEETS.ORG, {
      tenantId: tenantId,
      '組織名稱': orgName,
      '組織類型': orgType,
      '負責人姓名': ownerName,
      Email: email,
      '手機': phone,
      '狀態': 'active',
      '建立時間': nowText,
      '更新時間': nowText,
      '備註': 'Auth註冊建立'
    });

    authAppendObject_(GOVOPS_AUTH_SHEETS.USER, {
      userId: userId,
      tenantId: tenantId,
      '姓名': ownerName,
      Email: email,
      '手機': phone,
      userRole: 'owner',
      plan: plan,
      '狀態': 'active',
      '最後登入時間': nowText,
      '建立時間': nowText,
      '更新時間': nowText,
      '備註': '組織管理者'
    });

    authAppendObject_(GOVOPS_AUTH_SHEETS.SUB, {
      tenantId: tenantId,
      plan: plan,
      '方案名稱': limits.name,
      '狀態': 'active',
      '開始日期': authToday_(),
      '結束日期': '',
      '活動數上限': limits['活動數'],
      'CRM上限': limits['CRM筆數'],
      'AI查詢上限': limits['AI查詢數'],
      '財務操作上限': limits['財務操作數'],
      '提醒操作上限': limits['提醒操作數'],
      '建立時間': nowText,
      '更新時間': nowText
    });

    authLogLogin_(tenantId, userId, email, phone, '成功', '註冊組織與管理者成功', 'register');

    return authSuccess_('組織與管理者帳號建立完成。', buildAuthSession_({
      tenantId: tenantId,
      userId: userId,
      organizationName: orgName,
      userName: ownerName,
      email: email,
      phone: phone,
      userRole: 'owner',
      plan: plan,
      status: 'active'
    }));
  } catch (err) {
    return authFail_('組織註冊失敗，請稍後再試。');
  }
}

function 登入使用者(data) {
  try {
    初始化Auth資料表();

    var email = String(authFirst_(data.email, data.Email, data['Email'])).trim();
    var phone = String(authFirst_(data.phone, data['手機'], data.mobile)).trim();

    if (!email && !phone) return authFail_('請輸入 Email 或手機。');

    var user = findAuthUser_(email, phone);
    if (!user) {
      authLogLogin_('', '', email, phone, '失敗', '查無使用者', 'login');
      return authFail_('查無此帳號，請先註冊組織或確認 Email／手機是否正確。');
    }

    if (String(user['狀態'] || '').toLowerCase() !== 'active') {
      authLogLogin_(user.tenantId, user.userId, email, phone, '失敗', '帳號未啟用', 'login');
      return authFail_('此帳號目前未啟用，請聯絡系統管理者。');
    }

    var org = findAuthOrgByTenant_(user.tenantId);
    var sub = findAuthSubByTenant_(user.tenantId);
    var plan = normalizeAuthPlan_(user.plan || (sub && sub.plan) || 'FREE');
    var nowText = authNow_();

    updateAuthUserLastLogin_(user.userId, nowText);
    authLogLogin_(user.tenantId, user.userId, email, phone, '成功', '登入成功', 'login');

    return authSuccess_('登入成功。', buildAuthSession_({
      tenantId: user.tenantId,
      userId: user.userId,
      organizationName: org ? org['組織名稱'] : '',
      userName: user['姓名'] || '',
      email: user.Email || email,
      phone: user['手機'] || phone,
      userRole: user.userRole || 'viewer',
      plan: plan,
      status: user['狀態'] || 'active'
    }));
  } catch (err) {
    return authFail_('登入失敗，請稍後再試。');
  }
}

function 取得目前使用者Session(data) {
  try {
    初始化Auth資料表();

    var tenantId = authFirst_(data.tenantId, data['組織ID']);
    var userId = authFirst_(data.userId, data['使用者ID']);
    var email = String(authFirst_(data.email, data.Email, data['Email'])).trim();
    var phone = String(authFirst_(data.phone, data['手機'], data.mobile)).trim();

    var user = null;
    if (userId) user = findAuthUserById_(userId);
    if (!user && (email || phone)) user = findAuthUser_(email, phone);
    if (!user) return authFail_('查無目前使用者 Session，請重新登入。');
    if (tenantId && String(user.tenantId) !== String(tenantId)) return authFail_('此使用者不屬於目前組織，請重新登入。');

    var org = findAuthOrgByTenant_(user.tenantId);
    var sub = findAuthSubByTenant_(user.tenantId);

    return authSuccess_('Session 取得成功。', buildAuthSession_({
      tenantId: user.tenantId,
      userId: user.userId,
      organizationName: org ? org['組織名稱'] : '',
      userName: user['姓名'] || '',
      email: user.Email || '',
      phone: user['手機'] || '',
      userRole: user.userRole || 'viewer',
      plan: normalizeAuthPlan_(user.plan || (sub && sub.plan) || 'FREE'),
      status: user['狀態'] || 'active'
    }));
  } catch (err) {
    return authFail_('Session 取得失敗，請稍後再試。');
  }
}

function buildAuthSession_(info) {
  var session = {
    tenantId: info.tenantId,
    userId: info.userId,
    userName: info.userName || '',
    organizationName: info.organizationName || '',
    orgName: info.organizationName || '',
    email: info.email || '',
    phone: info.phone || '',
    userRole: info.userRole || 'viewer',
    role: info.userRole || 'viewer',
    roleLabel: authRoleLabel_(info.userRole || 'viewer'),
    plan: normalizeAuthPlan_(info.plan || 'FREE'),
    planLabel: getAuthPlanLimit_(info.plan || 'FREE').name,
    status: info.status || 'active',
    issuedAt: authNow_(),
    authVersion: GOVOPS_AUTH_VERSION
  };
  return {
    session: session,
    govops_profile: session,
    govops_auth: {
      tenantId: session.tenantId,
      userId: session.userId,
      userRole: session.userRole,
      plan: session.plan,
      status: session.status
    }
  };
}

function findAuthUser_(email, phone) {
  var rows = authReadRows_(GOVOPS_AUTH_SHEETS.USER);
  email = String(email || '').trim().toLowerCase();
  phone = String(phone || '').trim();
  return rows.find(function(row) {
    var rowEmail = String(row.Email || '').trim().toLowerCase();
    var rowPhone = String(row['手機'] || '').trim();
    return (email && rowEmail === email) || (phone && rowPhone === phone);
  }) || null;
}

function findAuthUserById_(userId) {
  var rows = authReadRows_(GOVOPS_AUTH_SHEETS.USER);
  return rows.find(function(row) { return String(row.userId) === String(userId); }) || null;
}

function findAuthOrgByTenant_(tenantId) {
  var rows = authReadRows_(GOVOPS_AUTH_SHEETS.ORG);
  return rows.find(function(row) { return String(row.tenantId) === String(tenantId); }) || null;
}

function findAuthSubByTenant_(tenantId) {
  var rows = authReadRows_(GOVOPS_AUTH_SHEETS.SUB);
  return rows.find(function(row) { return String(row.tenantId) === String(tenantId) && String(row['狀態']).toLowerCase() === 'active'; }) || null;
}

function updateAuthUserLastLogin_(userId, loginTime) {
  var sheet = authSheet_(GOVOPS_AUTH_SHEETS.USER);
  var headers = authHeaders_(sheet);
  var rows = authReadRows_(GOVOPS_AUTH_SHEETS.USER);
  var row = rows.find(function(r) { return String(r.userId) === String(userId); });
  if (!row) return;
  var col = headers.indexOf('最後登入時間') + 1;
  var updateCol = headers.indexOf('更新時間') + 1;
  if (col > 0) sheet.getRange(row._row, col).setValue(loginTime);
  if (updateCol > 0) sheet.getRange(row._row, updateCol).setValue(loginTime);
}

function authLogLogin_(tenantId, userId, email, phone, status, message, source) {
  try {
    authAppendObject_(GOVOPS_AUTH_SHEETS.LOGIN, {
      '登入ID': authGenerateId_('LOGIN'),
      tenantId: tenantId || '',
      userId: userId || '',
      Email: email || '',
      '手機': phone || '',
      '登入狀態': status || '',
      '登入時間': authNow_(),
      '訊息': message || '',
      '來源': source || 'web'
    });
  } catch (err) {}
}

function authSheet_(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  return sheet;
}

function authEnsureSheet_(name, headers) {
  var sheet = authSheet_(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }
  var current = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
  var missing = headers.filter(function(h) { return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function authHeaders_(sheet) {
  if (sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function authReadRows_(sheetName) {
  var sheet = authEnsureSheet_(sheetName, GOVOPS_AUTH_HEADERS[sheetName] || []);
  var headers = authHeaders_(sheet);
  if (sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx) {
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function authAppendObject_(sheetName, obj) {
  var headers = GOVOPS_AUTH_HEADERS[sheetName] || [];
  var sheet = authEnsureSheet_(sheetName, headers);
  sheet.appendRow(headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; }));
  return obj;
}

function authGenerateId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function normalizeAuthPlan_(plan) {
  plan = String(plan || 'FREE').trim().toUpperCase();
  if (plan === 'TEAM') return 'ENTERPRISE';
  if (['FREE','STARTER','PRO','ENTERPRISE'].indexOf(plan) < 0) return 'FREE';
  return plan;
}

function getAuthPlanLimit_(plan) {
  plan = normalizeAuthPlan_(plan);
  var map = {
    FREE: { name: '免費體驗版', '活動數': 3, 'CRM筆數': 50, 'AI查詢數': 0, '財務操作數': 0, '提醒操作數': 3 },
    STARTER: { name: '入門版', '活動數': 20, 'CRM筆數': 500, 'AI查詢數': 0, '財務操作數': 50, '提醒操作數': 100 },
    PRO: { name: '專業版', '活動數': 100, 'CRM筆數': 5000, 'AI查詢數': 300, '財務操作數': 500, '提醒操作數': 500 },
    ENTERPRISE: { name: '企業版', '活動數': 999999, 'CRM筆數': 999999, 'AI查詢數': 999999, '財務操作數': 999999, '提醒操作數': 999999 }
  };
  return map[plan] || map.FREE;
}

function authRoleLabel_(role) {
  var map = { owner: '負責人／系統管理者', admin: '管理者', finance: '財務人員', staff: '一般成員', viewer: '只讀檢視者' };
  return map[String(role || 'viewer').toLowerCase()] || '只讀檢視者';
}

function authFirst_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function authNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function authToday_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function authSuccess_(message, data) {
  return { success: true, message: message || '操作完成。', data: data || {} };
}

function authFail_(message, data) {
  return { success: false, message: message || '操作失敗。', data: data || {} };
}

function 測試_Auth_註冊登入流程() {
  var email = 'qa+' + new Date().getTime() + '@govops.local';
  var reg = 註冊組織與管理者({ orgName: 'QA Auth 測試組織', email: email, ownerName: 'QA 管理者', plan: 'PRO' });
  if (!reg.success) return reg;
  var login = 登入使用者({ email: email });
  return authSuccess_('Auth 註冊登入測試完成。', { register: reg, login: login });
}

/*
最小 router 接入片段：

var authHandled = null;
if (typeof handleGovOpsAuthAction === 'function') {
  authHandled = handleGovOpsAuthAction(action, data);
  if (authHandled) return authHandled;
}

建議位置：
router(action, data) 中，SaaS Runtime Composer 前或 switch(action) 前。
*/
