/*
GovOps OS｜50_GovOps_APIStandardEngine.gs
目的：建立中文 API 標準化模組。
安全策略：
1. 不修改 37_core.gs / router。
2. 不強制取代現有 success / fail。
3. 提供中文標準回傳、中文錯誤代碼、中文請求紀錄、中文模組對照。
4. 後續可逐步接入 Router，先不影響既有前端。
*/

var GOVOPS_API_STANDARD_VERSION = '1.0.0';
var GOVOPS_API_REQUEST_LOG_SHEET = 'API請求紀錄';
var GOVOPS_API_ERROR_CODE_SHEET = 'API錯誤代碼';
var GOVOPS_API_ACTION_REGISTRY_SHEET = 'API功能註冊表';

var GOVOPS_API_REQUEST_LOG_HEADERS = [
  '請求ID',
  'tenantId',
  'userId',
  '角色',
  '功能名稱',
  '模組名稱',
  '請求狀態',
  '回傳代碼',
  '回傳訊息',
  '執行毫秒',
  '請求時間',
  '完成時間',
  '備註'
];

var GOVOPS_API_ERROR_CODE_HEADERS = [
  '代碼',
  '中文名稱',
  '說明',
  '風險等級',
  '建議處理方式',
  '建立時間',
  '更新時間'
];

var GOVOPS_API_ACTION_REGISTRY_HEADERS = [
  '功能名稱',
  '模組名稱',
  '功能說明',
  '是否需要權限',
  '建議角色',
  '狀態',
  '建立時間',
  '更新時間'
];

var GOVOPS_API_ERROR_CODES = [
  ['成功', '操作成功', 'API 正常完成。', '低', '無需處理'],
  ['資料不足', '資料不足', '必要欄位未提供。', '中', '請補齊必要欄位'],
  ['找不到資料', '找不到資料', '查無指定資料。', '中', '請確認ID或查詢條件'],
  ['權限不足', '權限不足', '目前角色無法執行此功能。', '高', '請確認角色與權限設定'],
  ['租戶不一致', '租戶不一致', '資料不屬於目前租戶。', '高', '請確認tenantId與使用者資料'],
  ['狀態不允許', '狀態不允許', '狀態跳轉不符合規則。', '中', '請確認狀態規則中心'],
  ['系統錯誤', '系統錯誤', '系統執行時發生例外。', '高', '請查看錯誤紀錄'],
  ['外部服務失敗', '外部服務失敗', 'Google Drive、LINE、Calendar等外部服務失敗。', '高', '請檢查授權與服務狀態'],
  ['重複資料', '重複資料', '資料已存在，系統已略過或阻擋。', '低', '確認是否需要更新既有資料'],
  ['同步失敗', '同步失敗', '表單或資料同步失敗。', '高', '請檢查同步紀錄與來源試算表']
];

var GOVOPS_API_ACTIONS = [
  ['初始化系統', '系統', '建立或補齊基礎資料表', '否', 'owner/admin', '啟用'],
  ['從報名表單同步報名資料', '報名', '同步Google表單回覆到報名資料庫', '是', 'owner/admin/pm', '啟用'],
  ['執行Schema治理稽核', '資料治理', '盤點工作表、重複表與欄位風險', '是', 'owner/admin', '啟用'],
  ['初始化IDStateEngine', '核心引擎', '建立ID中心與狀態規則中心', '是', 'owner/admin', '啟用'],
  ['建立GovOps事件', '工作流程', '建立事件佇列資料', '是', 'owner/admin/pm', '啟用'],
  ['執行GovOps事件佇列', '工作流程', '執行待處理事件', '是', 'owner/admin/pm', '啟用'],
  ['執行Runtime健康檢查', '系統監控', '檢查系統健康狀態', '是', 'owner/admin', '啟用'],
  ['執行RuntimeRecovery', '系統修復', '補齊缺表與缺欄', '是', 'owner/admin', '啟用'],
  ['初始化TenantRoleEngine', '權限', '建立租戶、使用者與權限規則', '是', 'owner/admin', '啟用'],
  ['檢查TenantRolePermission', '權限', '檢查角色是否可執行指定動作', '是', 'owner/admin', '啟用']
];

function 初始化API標準化模組() {
  try {
    ensureApiStandardSheets_();
    seedApiErrorCodes_();
    seedApiActions_();
    return 建立中文成功回傳('API標準化模組初始化完成。', {
      版本: GOVOPS_API_STANDARD_VERSION,
      請求紀錄表: GOVOPS_API_REQUEST_LOG_SHEET,
      錯誤代碼表: GOVOPS_API_ERROR_CODE_SHEET,
      功能註冊表: GOVOPS_API_ACTION_REGISTRY_SHEET
    });
  } catch (err) {
    if (typeof logError === 'function') logError('初始化API標準化模組', err);
    return 建立中文失敗回傳('系統錯誤', 'API標準化模組初始化失敗：' + (err && err.message ? err.message : String(err)), {});
  }
}

function 建立API請求上下文(data) {
  data = data || {};
  return {
    請求ID: 產生API請求ID_(),
    tenantId: String(data.tenantId || 'default').trim() || 'default',
    userId: String(data.userId || '').trim(),
    角色: String(data.角色 || data.role || 'owner').trim(),
    功能名稱: String(data.action || data.功能名稱 || '').trim(),
    模組名稱: String(data.模組名稱 || data.module || '').trim(),
    開始時間: new Date().getTime(),
    請求時間: 現在API時間_()
  };
}

function 建立中文成功回傳(message, data, meta) {
  return {
    success: true,
    code: '成功',
    message: message || '操作完成。',
    data: data || {},
    meta: meta || {}
  };
}

function 建立中文失敗回傳(code, message, data, meta) {
  return {
    success: false,
    code: code || '系統錯誤',
    message: message || '操作失敗。',
    data: data || {},
    meta: meta || {}
  };
}

function 記錄API請求(context, result) {
  try {
    ensureApiStandardSheets_();
    context = context || {};
    result = result || {};
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_API_REQUEST_LOG_SHEET);
    var headers = 取得API表頭_(sheet);
    var nowText = 現在API時間_();
    var runtimeMs = context.開始時間 ? (new Date().getTime() - Number(context.開始時間)) : '';
    var record = {
      請求ID: context.請求ID || 產生API請求ID_(),
      tenantId: context.tenantId || 'default',
      userId: context.userId || '',
      角色: context.角色 || '',
      功能名稱: context.功能名稱 || '',
      模組名稱: context.模組名稱 || '',
      請求狀態: result.success ? '成功' : '失敗',
      回傳代碼: result.code || (result.success ? '成功' : '系統錯誤'),
      回傳訊息: result.message || '',
      執行毫秒: runtimeMs,
      請求時間: context.請求時間 || nowText,
      完成時間: nowText,
      備註: ''
    };
    sheet.appendRow(headers.map(function(h){ return record[h] !== undefined ? record[h] : ''; }));
    return record;
  } catch (err) {
    if (typeof logError === 'function') logError('記錄API請求', err);
    return null;
  }
}

function 包裝API執行(data, handler) {
  var context = 建立API請求上下文(data || {});
  try {
    if (typeof handler !== 'function') {
      var noHandler = 建立中文失敗回傳('找不到資料', '找不到對應的處理函式。', {}, { requestId: context.請求ID });
      記錄API請求(context, noHandler);
      return noHandler;
    }
    var result = handler(data || {}, context);
    if (!result || result.success === undefined) {
      result = 建立中文成功回傳('操作完成。', result || {}, { requestId: context.請求ID });
    }
    if (!result.code) result.code = result.success ? '成功' : '系統錯誤';
    if (!result.meta) result.meta = {};
    result.meta.requestId = context.請求ID;
    result.meta.runtimeMs = new Date().getTime() - Number(context.開始時間);
    記錄API請求(context, result);
    return result;
  } catch (err) {
    var failed = 建立中文失敗回傳('系統錯誤', err && err.message ? err.message : String(err), {}, { requestId: context.請求ID });
    記錄API請求(context, failed);
    if (typeof logError === 'function') logError('包裝API執行', err);
    return failed;
  }
}

function 取得API功能註冊表(data) {
  try {
    初始化API標準化模組();
    data = data || {};
    var moduleName = String(data.模組名稱 || data.module || '').trim();
    var rows = 讀取API資料列_(GOVOPS_API_ACTION_REGISTRY_SHEET);
    if (moduleName) rows = rows.filter(function(r){ return String(r.模組名稱) === moduleName; });
    return 建立中文成功回傳('API功能註冊表已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    return 建立中文失敗回傳('系統錯誤', 'API功能註冊表讀取失敗。', {});
  }
}

function 取得API錯誤代碼表(data) {
  try {
    初始化API標準化模組();
    var rows = 讀取API資料列_(GOVOPS_API_ERROR_CODE_SHEET);
    return 建立中文成功回傳('API錯誤代碼表已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    return 建立中文失敗回傳('系統錯誤', 'API錯誤代碼表讀取失敗。', {});
  }
}

function ensureApiStandardSheets_() {
  ensureApiSheet_(GOVOPS_API_REQUEST_LOG_SHEET, GOVOPS_API_REQUEST_LOG_HEADERS);
  ensureApiSheet_(GOVOPS_API_ERROR_CODE_SHEET, GOVOPS_API_ERROR_CODE_HEADERS);
  ensureApiSheet_(GOVOPS_API_ACTION_REGISTRY_SHEET, GOVOPS_API_ACTION_REGISTRY_HEADERS);
}

function seedApiErrorCodes_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_API_ERROR_CODE_SHEET);
  var headers = 取得API表頭_(sheet);
  var rows = 讀取API資料列_(GOVOPS_API_ERROR_CODE_SHEET);
  GOVOPS_API_ERROR_CODES.forEach(function(item){
    var existed = rows.some(function(r){ return String(r.代碼) === item[0]; });
    if (!existed) {
      var record = { 代碼: item[0], 中文名稱: item[1], 說明: item[2], 風險等級: item[3], 建議處理方式: item[4], 建立時間: 現在API時間_(), 更新時間: 現在API時間_() };
      sheet.appendRow(headers.map(function(h){ return record[h] !== undefined ? record[h] : ''; }));
    }
  });
}

function seedApiActions_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_API_ACTION_REGISTRY_SHEET);
  var headers = 取得API表頭_(sheet);
  var rows = 讀取API資料列_(GOVOPS_API_ACTION_REGISTRY_SHEET);
  GOVOPS_API_ACTIONS.forEach(function(item){
    var existed = rows.some(function(r){ return String(r.功能名稱) === item[0]; });
    if (!existed) {
      var record = { 功能名稱: item[0], 模組名稱: item[1], 功能說明: item[2], 是否需要權限: item[3], 建議角色: item[4], 狀態: item[5], 建立時間: 現在API時間_(), 更新時間: 現在API時間_() };
      sheet.appendRow(headers.map(function(h){ return record[h] !== undefined ? record[h] : ''; }));
    }
  });
}

function ensureApiSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var current = 取得API表頭_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var missing = headers.filter(function(h){ return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function 讀取API資料列_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = 取得API表頭_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx){
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    return obj;
  });
}

function 取得API表頭_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
}

function 產生API請求ID_() {
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  return 'REQ-' + roc + '-' + String(new Date().getTime()).slice(-8) + '-' + Math.floor(Math.random() * 1000);
}

function 現在API時間_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_API標準化_初始化() {
  return 初始化API標準化模組();
}

function 測試_API標準化_包裝執行() {
  return 包裝API執行({ action: '測試功能', 模組名稱: '系統測試', tenantId: 'default', 角色: 'owner' }, function(data, context){
    return 建立中文成功回傳('測試功能執行完成。', { 測試: true, 請求ID: context.請求ID });
  });
}
