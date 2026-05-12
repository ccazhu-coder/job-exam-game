/*
GovOps OS｜51_GovOps_AdminConsoleEngine.gs
目的：建立中文後台營運引擎，彙整租戶、使用者、權限、Runtime、Queue、API 等資料。
安全策略：
1. 不修改 37_core.gs / router。
2. 不改前端 HTML。
3. 不刪除任何資料。
4. 只建立後台摘要表與查詢函式，讓後續 admin-console.html 可安全接入。
*/

var GOVOPS_ADMIN_CONSOLE_VERSION = '1.0.0';
var GOVOPS_ADMIN_SUMMARY_SHEET = '後台營運摘要';
var GOVOPS_ADMIN_ALERT_SHEET = '後台風險警示';

var GOVOPS_ADMIN_SUMMARY_HEADERS = [
  '摘要ID','產生時間','tenantId','租戶數','使用者數','API請求數','Runtime警告數','Runtime異常數','Queue待執行數','Queue失敗數','高風險Schema數','摘要內容','建立時間'
];

var GOVOPS_ADMIN_ALERT_HEADERS = [
  '警示ID','產生時間','tenantId','警示類型','風險等級','警示內容','建議處理','處理狀態','建立時間','更新時間'
];

function 初始化後台營運引擎() {
  try {
    ensureAdminConsoleSheets_();
    return 建立中文成功回傳('後台營運引擎初始化完成。', {
      版本: GOVOPS_ADMIN_CONSOLE_VERSION,
      摘要表: GOVOPS_ADMIN_SUMMARY_SHEET,
      警示表: GOVOPS_ADMIN_ALERT_SHEET
    });
  } catch (err) {
    if (typeof logError === 'function') logError('初始化後台營運引擎', err);
    return 建立中文失敗回傳('系統錯誤', '後台營運引擎初始化失敗。', {});
  }
}

function 產生後台營運摘要(data) {
  try {
    初始化後台營運引擎();
    data = data || {};
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var tenantRows = readAdminRows_('組織資料表');
    var userRows = readAdminRows_('使用者帳號表');
    var apiRows = readAdminRows_('API請求紀錄');
    var runtimeRows = readAdminRows_('Runtime健康檢查');
    var queueRows = readAdminRows_('事件佇列中心');
    var schemaRows = readAdminRows_('Schema治理中心');

    var runtimeWarn = runtimeRows.filter(function(r){ return String(r.檢查狀態) === '警告'; }).length;
    var runtimeBad = runtimeRows.filter(function(r){ return String(r.檢查狀態) === '異常'; }).length;
    var queuePending = queueRows.filter(function(r){ return String(r.事件狀態) === '待執行' || String(r.事件狀態) === '重試中'; }).length;
    var queueFailed = queueRows.filter(function(r){ return String(r.事件狀態) === '失敗'; }).length;
    var schemaHigh = schemaRows.filter(function(r){ return String(r.風險等級) === '高'; }).length;

    var summaryText = '租戶 ' + tenantRows.length + '；使用者 ' + userRows.length + '；API請求 ' + apiRows.length + '；Runtime警告 ' + runtimeWarn + '；Runtime異常 ' + runtimeBad + '；Queue待執行 ' + queuePending + '；Queue失敗 ' + queueFailed + '；高風險Schema ' + schemaHigh;
    var record = {
      摘要ID: generateAdminId_('ADMIN'),
      產生時間: nowAdminSafe_(),
      tenantId: tenantId,
      租戶數: tenantRows.length,
      使用者數: userRows.length,
      API請求數: apiRows.length,
      Runtime警告數: runtimeWarn,
      Runtime異常數: runtimeBad,
      Queue待執行數: queuePending,
      Queue失敗數: queueFailed,
      高風險Schema數: schemaHigh,
      摘要內容: summaryText,
      建立時間: nowAdminSafe_()
    };

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_ADMIN_SUMMARY_SHEET);
    var headers = getAdminHeaders_(sheet);
    sheet.appendRow(headers.map(function(h){ return record[h] !== undefined ? record[h] : ''; }));

    建立後台風險警示_('Runtime異常', runtimeBad, '高', 'Runtime 有異常項目，請執行健康檢查與Recovery。', tenantId);
    建立後台風險警示_('Queue失敗', queueFailed, '高', '事件佇列有失敗事件，請檢查流程執行紀錄。', tenantId);
    建立後台風險警示_('Schema高風險', schemaHigh, '高', 'Schema治理中心存在高風險項目，請收斂重複表與缺欄位。', tenantId);

    return 建立中文成功回傳('後台營運摘要已產生。', record);
  } catch (err) {
    if (typeof logError === 'function') logError('產生後台營運摘要', err);
    return 建立中文失敗回傳('系統錯誤', '後台營運摘要產生失敗。', {});
  }
}

function 取得後台總覽(data) {
  try {
    初始化後台營運引擎();
    data = data || {};
    var tenantId = String(data.tenantId || '').trim();
    var summaries = readAdminRows_(GOVOPS_ADMIN_SUMMARY_SHEET).reverse();
    var alerts = readAdminRows_(GOVOPS_ADMIN_ALERT_SHEET).reverse();
    if (tenantId) {
      summaries = summaries.filter(function(r){ return String(r.tenantId || 'default') === tenantId; });
      alerts = alerts.filter(function(r){ return String(r.tenantId || 'default') === tenantId; });
    }
    return 建立中文成功回傳('後台總覽已取得。', {
      最新摘要: summaries[0] || {},
      最近摘要: summaries.slice(0, 10),
      未處理警示: alerts.filter(function(r){ return String(r.處理狀態 || '未處理') === '未處理'; }).slice(0, 20),
      全部警示數: alerts.length
    });
  } catch (err) {
    if (typeof logError === 'function') logError('取得後台總覽', err);
    return 建立中文失敗回傳('系統錯誤', '後台總覽讀取失敗。', {});
  }
}

function 取得租戶總覽(data) {
  try {
    初始化後台營運引擎();
    var rows = readAdminRows_('組織資料表');
    return 建立中文成功回傳('租戶總覽已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    return 建立中文失敗回傳('系統錯誤', '租戶總覽讀取失敗。', {});
  }
}

function 取得使用者總覽(data) {
  try {
    初始化後台營運引擎();
    data = data || {};
    var tenantId = String(data.tenantId || '').trim();
    var rows = readAdminRows_('使用者帳號表');
    if (tenantId) rows = rows.filter(function(r){ return String(r.tenantId || 'default') === tenantId; });
    return 建立中文成功回傳('使用者總覽已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    return 建立中文失敗回傳('系統錯誤', '使用者總覽讀取失敗。', {});
  }
}

function 取得Runtime總覽(data) {
  try {
    初始化後台營運引擎();
    var rows = readAdminRows_('Runtime健康檢查').reverse().slice(0, 100);
    return 建立中文成功回傳('Runtime總覽已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    return 建立中文失敗回傳('系統錯誤', 'Runtime總覽讀取失敗。', {});
  }
}

function 取得Queue總覽(data) {
  try {
    初始化後台營運引擎();
    var rows = readAdminRows_('事件佇列中心').reverse().slice(0, 100);
    return 建立中文成功回傳('Queue總覽已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    return 建立中文失敗回傳('系統錯誤', 'Queue總覽讀取失敗。', {});
  }
}

function 建立後台風險警示_(type, count, risk, suggestion, tenantId) {
  if (!count || Number(count) <= 0) return;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_ADMIN_ALERT_SHEET);
  var headers = getAdminHeaders_(sheet);
  var record = {
    警示ID: generateAdminId_('ALERT'),
    產生時間: nowAdminSafe_(),
    tenantId: tenantId || 'default',
    警示類型: type,
    風險等級: risk,
    警示內容: type + ' 數量：' + count,
    建議處理: suggestion,
    處理狀態: '未處理',
    建立時間: nowAdminSafe_(),
    更新時間: nowAdminSafe_()
  };
  sheet.appendRow(headers.map(function(h){ return record[h] !== undefined ? record[h] : ''; }));
}

function ensureAdminConsoleSheets_() {
  ensureAdminSheet_(GOVOPS_ADMIN_SUMMARY_SHEET, GOVOPS_ADMIN_SUMMARY_HEADERS);
  ensureAdminSheet_(GOVOPS_ADMIN_ALERT_SHEET, GOVOPS_ADMIN_ALERT_HEADERS);
}

function ensureAdminSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var current = getAdminHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var missing = headers.filter(function(h){ return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function readAdminRows_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getAdminHeaders_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx){
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    return obj;
  });
}

function getAdminHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
}

function generateAdminId_(prefix) {
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  return prefix + '-' + roc + '-' + String(new Date().getTime()).slice(-8) + '-' + Math.floor(Math.random() * 1000);
}

function nowAdminSafe_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_後台營運引擎_初始化() {
  return 初始化後台營運引擎();
}

function 測試_後台營運引擎_產生摘要() {
  return 產生後台營運摘要({ tenantId: 'default' });
}

function 測試_後台營運引擎_取得總覽() {
  return 取得後台總覽({ tenantId: 'default' });
}
