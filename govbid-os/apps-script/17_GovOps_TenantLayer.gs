/*
GovOps OS｜17_GovOps_TenantLayer.gs
版本：Tenant Layer Patch v1.0.0
用途：在不重寫 15_GovOps_MVP_AllInOne.gs / 37_core.gs 的前提下，補上 SaaS 多租戶欄位與查詢隔離工具。

貼上方式：
1. Apps Script 新增檔案：17_GovOps_TenantLayer
2. 貼上本檔全部內容
3. 執行：初始化租戶欄位()
4. 執行：測試_TenantLayer()

設計原則：
- 不覆蓋原有業務函式
- 不改原本資料表名稱
- 對主要資料表補 tenantId / userId / userRole / plan / 組織ID / 使用者ID
- 新增資料時用 attachTenantFields(rowObject, data)
- 查詢資料時用 filterRowsByTenant(rows, headers, data)
- 回傳時用 tenantAwareResponse(message, data, requestData)
*/

var GOVOPS_TENANT_LAYER_VERSION = '1.0.0';

var GOVOPS_TENANT_FIELDS = [
  'tenantId',
  'userId',
  'userRole',
  'plan',
  '組織ID',
  '使用者ID',
  '使用者角色',
  'SaaS方案'
];

var GOVOPS_TENANT_MAIN_SHEETS = [
  '招生活動管理',
  '報名資料庫',
  '學員CRM',
  '候補名單',
  '當日工作任務表',
  '物品清單',
  '餐點管理',
  '簽到表紀錄',
  '核銷檢查中心',
  '文件歸檔紀錄',
  '應收帳款',
  '收款紀錄',
  '支出明細',
  '提醒中心',
  'AI秘書紀錄',
  '操作紀錄',
  '錯誤紀錄',
  '使用者常用選項'
];

function 初始化租戶欄位() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var result = [];

  GOVOPS_TENANT_MAIN_SHEETS.forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      result.push({ 資料表: sheetName, 狀態: '略過，尚未建立' });
      return;
    }

    var added = 補齊租戶欄位_(sheet);
    result.push({ 資料表: sheetName, 新增欄位: added.join('、') || '無', 狀態: '完成' });
  });

  return tenantAwareResponse('Tenant Layer 初始化完成。', {
    version: GOVOPS_TENANT_LAYER_VERSION,
    結果: result
  }, {});
}

function 補所有主要資料表Tenant欄位() {
  return 初始化租戶欄位();
}

function 補齊租戶欄位_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = [];

  if (sheet.getLastRow() >= 1) {
    headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(v) { return String(v || '').trim(); });
  }

  if (!headers.length || headers.join('') === '') {
    sheet.getRange(1, 1, 1, GOVOPS_TENANT_FIELDS.length).setValues([GOVOPS_TENANT_FIELDS]);
    return GOVOPS_TENANT_FIELDS.slice();
  }

  var added = [];
  GOVOPS_TENANT_FIELDS.forEach(function(field) {
    if (headers.indexOf(field) === -1) {
      headers.push(field);
      added.push(field);
    }
  });

  if (added.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return added;
}

function getTenantContext(data) {
  data = data || {};

  var tenantId = firstNonEmpty_(
    data.tenantId,
    data.組織ID,
    data.organizationId,
    data.orgId,
    data.companyId,
    'TENANT-LOCAL'
  );

  var userId = firstNonEmpty_(
    data.userId,
    data.使用者ID,
    data.uid,
    data.lineUserId,
    data.LINE_UID,
    'USER-LOCAL'
  );

  var userRole = firstNonEmpty_(
    data.userRole,
    data.使用者角色,
    data.role,
    'owner'
  );

  var plan = firstNonEmpty_(
    data.plan,
    data.SaaS方案,
    data.subscriptionPlan,
    data.方案,
    'FREE'
  );

  tenantId = String(tenantId || '').trim() || 'TENANT-LOCAL';
  userId = String(userId || '').trim() || 'USER-LOCAL';
  userRole = String(userRole || '').trim() || 'owner';
  plan = String(plan || '').trim().toUpperCase() || 'FREE';

  return {
    tenantId: tenantId,
    userId: userId,
    userRole: userRole,
    plan: plan,
    組織ID: tenantId,
    使用者ID: userId,
    使用者角色: userRole,
    SaaS方案: plan,
    isLocalTenant: tenantId === 'TENANT-LOCAL',
    isLocalUser: userId === 'USER-LOCAL'
  };
}

function assertTenant(data) {
  var ctx = getTenantContext(data);
  if (!ctx.tenantId) throw new Error('缺少 tenantId / 組織ID。');
  if (!ctx.userId) throw new Error('缺少 userId / 使用者ID。');
  return ctx;
}

function attachTenantFields(rowObject, data) {
  var ctx = assertTenant(data);
  rowObject = rowObject || {};

  rowObject.tenantId = firstNonEmpty_(rowObject.tenantId, ctx.tenantId);
  rowObject.userId = firstNonEmpty_(rowObject.userId, ctx.userId);
  rowObject.userRole = firstNonEmpty_(rowObject.userRole, ctx.userRole);
  rowObject.plan = firstNonEmpty_(rowObject.plan, ctx.plan);

  rowObject['組織ID'] = firstNonEmpty_(rowObject['組織ID'], ctx.tenantId);
  rowObject['使用者ID'] = firstNonEmpty_(rowObject['使用者ID'], ctx.userId);
  rowObject['使用者角色'] = firstNonEmpty_(rowObject['使用者角色'], ctx.userRole);
  rowObject['SaaS方案'] = firstNonEmpty_(rowObject['SaaS方案'], ctx.plan);

  return rowObject;
}

function filterRowsByTenant(rows, headers, data) {
  rows = rows || [];
  headers = headers || [];
  var ctx = getTenantContext(data);

  if (ctx.tenantId === 'TENANT-LOCAL') return rows;

  var hasTenantField = headers.indexOf('tenantId') >= 0 || headers.indexOf('組織ID') >= 0;
  if (!hasTenantField && rows.length) {
    hasTenantField = rows.some(function(row) {
      return row && (row.tenantId !== undefined || row['組織ID'] !== undefined);
    });
  }

  if (!hasTenantField) return rows;

  return rows.filter(function(row) {
    var rowTenant = firstNonEmpty_(row.tenantId, row['組織ID'], '');
    if (!rowTenant) return true;
    return String(rowTenant) === String(ctx.tenantId);
  });
}

function tenantAwareResponse(message, data, requestData) {
  var ctx = getTenantContext(requestData || {});
  data = data || {};

  data.tenant = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    plan: ctx.plan,
    組織ID: ctx.tenantId,
    使用者ID: ctx.userId,
    使用者角色: ctx.userRole,
    SaaS方案: ctx.plan
  };

  return {
    success: true,
    message: message || '操作完成。',
    data: data
  };
}

function tenantFailResponse(message, requestData, extraData) {
  var ctx = getTenantContext(requestData || {});
  extraData = extraData || {};
  extraData.tenant = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    plan: ctx.plan
  };

  return {
    success: false,
    message: message || '系統暫時無法完成操作，請稍後再試。',
    data: extraData
  };
}

function readRowsByTenant(sheetName, data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var rows = values.map(function(row, index) {
    var obj = { _row: index + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });

  return filterRowsByTenant(rows, headers, data);
}

function appendObjectWithTenant(sheetName, rowObject, data) {
  rowObject = attachTenantFields(rowObject || {}, data || {});
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);

  補齊租戶欄位_(sheet);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var row = headers.map(function(h) { return rowObject[h] !== undefined ? rowObject[h] : ''; });
  sheet.appendRow(row);
  return rowObject;
}

function migrateExistingRowsToTenant(sheetName, data) {
  var ctx = getTenantContext(data || {});
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return tenantFailResponse('找不到資料表：' + sheetName, data);

  補齊租戶欄位_(sheet);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var tenantCol = headers.indexOf('tenantId') + 1;
  var userCol = headers.indexOf('userId') + 1;
  var roleCol = headers.indexOf('userRole') + 1;
  var planCol = headers.indexOf('plan') + 1;
  var orgCol = headers.indexOf('組織ID') + 1;
  var userZhCol = headers.indexOf('使用者ID') + 1;
  var roleZhCol = headers.indexOf('使用者角色') + 1;
  var planZhCol = headers.indexOf('SaaS方案') + 1;

  var count = 0;
  for (var r = 2; r <= sheet.getLastRow(); r++) {
    if (tenantCol && !sheet.getRange(r, tenantCol).getValue()) sheet.getRange(r, tenantCol).setValue(ctx.tenantId);
    if (userCol && !sheet.getRange(r, userCol).getValue()) sheet.getRange(r, userCol).setValue(ctx.userId);
    if (roleCol && !sheet.getRange(r, roleCol).getValue()) sheet.getRange(r, roleCol).setValue(ctx.userRole);
    if (planCol && !sheet.getRange(r, planCol).getValue()) sheet.getRange(r, planCol).setValue(ctx.plan);
    if (orgCol && !sheet.getRange(r, orgCol).getValue()) sheet.getRange(r, orgCol).setValue(ctx.tenantId);
    if (userZhCol && !sheet.getRange(r, userZhCol).getValue()) sheet.getRange(r, userZhCol).setValue(ctx.userId);
    if (roleZhCol && !sheet.getRange(r, roleZhCol).getValue()) sheet.getRange(r, roleZhCol).setValue(ctx.userRole);
    if (planZhCol && !sheet.getRange(r, planZhCol).getValue()) sheet.getRange(r, planZhCol).setValue(ctx.plan);
    count++;
  }

  return tenantAwareResponse('既有資料已補上租戶資訊。', { 資料表: sheetName, 補齊筆數: count }, data);
}

function migrateAllExistingRowsToTenant(data) {
  var result = [];
  GOVOPS_TENANT_MAIN_SHEETS.forEach(function(sheetName) {
    var res = migrateExistingRowsToTenant(sheetName, data || {});
    result.push({ 資料表: sheetName, 結果: res.message, 筆數: res.data && res.data.補齊筆數 });
  });
  return tenantAwareResponse('所有主要資料表既有資料租戶補齊完成。', { 結果: result }, data || {});
}

function 測試_TenantLayer() {
  var data = {
    tenantId: 'TENANT-TEST',
    userId: 'USER-TEST',
    userRole: 'owner',
    plan: 'PRO'
  };

  var ctx = getTenantContext(data);
  var row = attachTenantFields({ 活動ID: 'ACT-TEST-001', 活動名稱: 'Tenant Layer 測試活動' }, data);
  var rows = [
    row,
    { 活動ID: 'ACT-OTHER-001', 活動名稱: '其他租戶活動', tenantId: 'TENANT-OTHER', userId: 'USER-OTHER' }
  ];
  var filtered = filterRowsByTenant(rows, ['活動ID', '活動名稱', 'tenantId', 'userId'], data);

  return tenantAwareResponse('Tenant Layer 測試完成。', {
    context: ctx,
    attachedRow: row,
    filterResultCount: filtered.length,
    filterResult: filtered
  }, data);
}

function 測試_初始化租戶欄位() {
  return 初始化租戶欄位();
}

function firstNonEmpty_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}
