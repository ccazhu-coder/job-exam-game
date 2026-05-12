/*
GovOps OS｜48_GovOps_RuntimeRecoveryEngine.gs
目的：建立 GovOps OS Runtime Health / Recovery / Monitoring Engine。
安全策略：
1. 不修改 37_core.gs / router。
2. 不刪除任何工作表、不覆蓋主資料。
3. 只建立/補齊 Runtime 健康檢查、修復紀錄、監控摘要。
4. Recovery 預設只做缺表/缺欄補齊，不做資料搬移與刪除。
5. 可由 Apps Script 手動執行測試函式。
*/

var GOVOPS_RUNTIME_RECOVERY_VERSION = '1.0.0';
var GOVOPS_RUNTIME_HEALTH_SHEET = 'Runtime健康檢查';
var GOVOPS_RECOVERY_LOG_SHEET = 'Recovery修復紀錄';
var GOVOPS_MONITORING_SUMMARY_SHEET = '系統監控摘要';

var GOVOPS_RUNTIME_HEALTH_HEADERS = [
  '檢查ID','檢查時間','tenantId','檢查項目','檢查狀態','風險等級','檢查結果','處理建議','runtimeMs','建立時間'
];

var GOVOPS_RECOVERY_LOG_HEADERS = [
  '修復ID','修復時間','tenantId','修復類型','目標名稱','修復狀態','修復摘要','錯誤訊息','建立時間'
];

var GOVOPS_MONITORING_SUMMARY_HEADERS = [
  '摘要ID','產生時間','tenantId','總檢查數','正常數','警告數','異常數','高風險數','Queue待執行數','Queue失敗數','錯誤紀錄數','摘要內容','建立時間'
];

var GOVOPS_RUNTIME_REQUIRED_SHEETS = {
  '系統設定': ['設定鍵','設定值','說明','更新時間'],
  '招生活動管理': ['活動ID','活動名稱','活動日期','活動狀態','報名表單連結','表單回覆試算表ID','表單回覆分頁名稱','tenantId','userId'],
  '報名資料庫': ['報名ID','活動ID','學員ID','姓名','電話','Email','報名狀態','出席狀態','報名方式','tenantId','userId'],
  '學員CRM': ['學員ID','姓名','電話','Email','LINE UID','興趣標籤','報名次數','最後報名日期','tenantId'],
  '核銷檢查中心': ['核銷ID','活動ID','核銷項目','核銷狀態','負責人','tenantId'],
  '文件歸檔紀錄': ['文件ID','活動ID','文件類型','文件名稱','Drive連結','歸檔狀態','tenantId'],
  '應收帳款': ['應收ID','活動ID','應收金額','收款狀態','tenantId'],
  '收款紀錄': ['收款ID','應收ID','收款金額','收款日期','tenantId'],
  '支出明細': ['支出ID','活動ID','支出金額','支出分類','tenantId'],
  '提醒中心': ['提醒ID','活動ID','提醒類型','提醒時間','提醒狀態','tenantId'],
  '同步紀錄': ['同步ID','tenantId','活動ID','來源試算表ID','分頁名稱','最後同步列數','同步狀態'],
  'Schema治理中心': ['工作表名稱','分類','正式狀態','對應模組','風險等級','風險說明'],
  '系統ID中心': ['ID類型','ID前綴','民國年','目前流水號','最後產生ID'],
  '狀態規則中心': ['模組','目前狀態','允許下一狀態','是否啟用'],
  '狀態異動紀錄': ['異動ID','tenantId','模組','關聯ID','原狀態','新狀態','是否允許'],
  '事件佇列中心': ['事件ID','tenantId','事件類型','來源模組','關聯ID','事件狀態','重試次數'],
  '流程執行紀錄': ['流程ID','tenantId','事件ID','流程名稱','執行狀態'],
  '操作紀錄': ['時間','操作類型','資料表','關聯ID','操作內容','操作結果'],
  '錯誤紀錄': ['時間','功能模組','錯誤摘要','錯誤內容','處理狀態']
};

function 執行Runtime健康檢查(data) {
  var started = new Date().getTime();
  try {
    data = data || {};
    ensureRuntimeRecoverySheets_();
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var checks = [];

    checks.push(checkSpreadsheetAccess_(tenantId));
    checks = checks.concat(checkRequiredSheets_(tenantId));
    checks.push(checkEventQueueHealth_(tenantId));
    checks.push(checkErrorLogHealth_(tenantId));
    checks.push(checkIdStateEngineHealth_(tenantId));
    checks.push(checkSchemaGovernanceHealth_(tenantId));

    var runtimeMs = new Date().getTime() - started;
    writeRuntimeHealthRows_(checks, runtimeMs);
    var summary = writeMonitoringSummary_(checks, tenantId);

    return success('Runtime健康檢查完成。', {
      version: GOVOPS_RUNTIME_RECOVERY_VERSION,
      tenantId: tenantId,
      runtimeMs: runtimeMs,
      總檢查數: checks.length,
      正常數: checks.filter(function(c){ return c.檢查狀態 === '正常'; }).length,
      警告數: checks.filter(function(c){ return c.檢查狀態 === '警告'; }).length,
      異常數: checks.filter(function(c){ return c.檢查狀態 === '異常'; }).length,
      高風險數: checks.filter(function(c){ return c.風險等級 === '高'; }).length,
      監控摘要: summary
    });
  } catch (err) {
    if (typeof logError === 'function') logError('執行Runtime健康檢查', err);
    return fail('Runtime健康檢查失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function 執行RuntimeRecovery(data) {
  try {
    data = data || {};
    ensureRuntimeRecoverySheets_();
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var dryRun = data.dryRun === true || data.預演 === true;
    var results = [];

    Object.keys(GOVOPS_RUNTIME_REQUIRED_SHEETS).forEach(function(sheetName) {
      var headers = GOVOPS_RUNTIME_REQUIRED_SHEETS[sheetName];
      results.push(recoverRequiredSheet_(sheetName, headers, tenantId, dryRun));
    });

    return success(dryRun ? 'Runtime Recovery 預演完成。' : 'Runtime Recovery 執行完成。', {
      tenantId: tenantId,
      dryRun: dryRun,
      修復筆數: results.length,
      結果: results
    });
  } catch (err) {
    if (typeof logError === 'function') logError('執行RuntimeRecovery', err);
    return fail('Runtime Recovery 失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function 取得Runtime監控摘要(data) {
  try {
    ensureRuntimeRecoverySheets_();
    data = data || {};
    var tenantId = String(data.tenantId || '').trim();
    var rows = readRuntimeRows_(GOVOPS_MONITORING_SUMMARY_SHEET);
    if (tenantId) rows = rows.filter(function(r){ return String(r.tenantId || 'default') === tenantId; });
    rows = rows.reverse().slice(0, Number(data.limit || 10));
    return success('Runtime監控摘要已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    if (typeof logError === 'function') logError('取得Runtime監控摘要', err);
    return fail('Runtime監控摘要讀取失敗。');
  }
}

function checkSpreadsheetAccess_(tenantId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return buildRuntimeCheck_(tenantId, 'Spreadsheet Access', '正常', '低', '已連線：' + ss.getName(), '無需處理');
  } catch (err) {
    return buildRuntimeCheck_(tenantId, 'Spreadsheet Access', '異常', '高', err.message || String(err), '檢查 Apps Script 與 Google Sheet 權限');
  }
}

function checkRequiredSheets_(tenantId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return Object.keys(GOVOPS_RUNTIME_REQUIRED_SHEETS).map(function(sheetName) {
    var required = GOVOPS_RUNTIME_REQUIRED_SHEETS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return buildRuntimeCheck_(tenantId, 'Sheet: ' + sheetName, '異常', '高', '缺少工作表', '執行RuntimeRecovery補齊工作表');
    var headers = getRuntimeHeaders_(sheet);
    var missing = required.filter(function(h){ return headers.indexOf(h) < 0; });
    if (missing.length) return buildRuntimeCheck_(tenantId, 'Sheet: ' + sheetName, '警告', '中', '缺少欄位：' + missing.join('、'), '執行RuntimeRecovery補齊欄位');
    return buildRuntimeCheck_(tenantId, 'Sheet: ' + sheetName, '正常', '低', '工作表與必要欄位存在', '無需處理');
  });
}

function checkEventQueueHealth_(tenantId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('事件佇列中心');
  if (!sheet) return buildRuntimeCheck_(tenantId, 'Event Queue', '警告', '中', '事件佇列中心尚未建立', '初始化 WorkflowEventEngine');
  var rows = readRuntimeRows_('事件佇列中心');
  var failed = rows.filter(function(r){ return String(r.事件狀態) === '失敗'; }).length;
  var pending = rows.filter(function(r){ return String(r.事件狀態) === '待執行' || String(r.事件狀態) === '重試中'; }).length;
  if (failed > 0) return buildRuntimeCheck_(tenantId, 'Event Queue', '異常', '高', '失敗事件：' + failed + '，待執行/重試：' + pending, '檢查流程執行紀錄並重跑事件');
  if (pending > 20) return buildRuntimeCheck_(tenantId, 'Event Queue', '警告', '中', '待執行事件偏多：' + pending, '分批執行事件佇列');
  return buildRuntimeCheck_(tenantId, 'Event Queue', '正常', '低', '待執行/重試：' + pending + '，失敗：' + failed, '無需處理');
}

function checkErrorLogHealth_(tenantId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('錯誤紀錄') || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('系統錯誤紀錄');
  if (!sheet) return buildRuntimeCheck_(tenantId, 'Error Log', '警告', '中', '錯誤紀錄表尚未建立', '執行RuntimeRecovery補齊錯誤紀錄表');
  var rowCount = Math.max(0, sheet.getLastRow() - 1);
  if (rowCount > 200) return buildRuntimeCheck_(tenantId, 'Error Log', '警告', '中', '錯誤紀錄累積較多：' + rowCount, '檢查近期待處理錯誤並歸檔');
  return buildRuntimeCheck_(tenantId, 'Error Log', '正常', '低', '錯誤紀錄數：' + rowCount, '無需處理');
}

function checkIdStateEngineHealth_(tenantId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var idSheet = ss.getSheetByName('系統ID中心');
  var stateSheet = ss.getSheetByName('狀態規則中心');
  if (!idSheet || !stateSheet) return buildRuntimeCheck_(tenantId, 'ID/State Engine', '警告', '中', 'ID或狀態規則表尚未建立', '執行初始化IDStateEngine');
  return buildRuntimeCheck_(tenantId, 'ID/State Engine', '正常', '低', 'ID中心與狀態規則中心存在', '無需處理');
}

function checkSchemaGovernanceHealth_(tenantId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schema治理中心');
  if (!sheet) return buildRuntimeCheck_(tenantId, 'Schema Governance', '警告', '中', 'Schema治理中心尚未建立', '執行Schema治理稽核');
  var rows = readRuntimeRows_('Schema治理中心');
  var high = rows.filter(function(r){ return String(r.風險等級) === '高'; }).length;
  if (high > 0) return buildRuntimeCheck_(tenantId, 'Schema Governance', '警告', '高', '高風險Schema：' + high, '檢查Schema治理中心並收斂重複表');
  return buildRuntimeCheck_(tenantId, 'Schema Governance', '正常', '低', '未發現高風險Schema', '定期稽核');
}

function recoverRequiredSheet_(sheetName, requiredHeaders, tenantId, dryRun) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  var status = '完成';
  var summary = '';
  var error = '';

  try {
    if (!sheet) {
      summary = '建立缺少工作表：' + sheetName;
      if (!dryRun) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      }
      writeRecoveryLog_(tenantId, '缺表修復', sheetName, dryRun ? '預演' : status, summary, '');
      return { 目標名稱: sheetName, 修復狀態: dryRun ? '預演' : status, 修復摘要: summary };
    }

    var current = getRuntimeHeaders_(sheet);
    if (!current.length) {
      summary = '補齊空表表頭：' + requiredHeaders.join('、');
      if (!dryRun) sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      writeRecoveryLog_(tenantId, '缺欄修復', sheetName, dryRun ? '預演' : status, summary, '');
      return { 目標名稱: sheetName, 修復狀態: dryRun ? '預演' : status, 修復摘要: summary };
    }

    var missing = requiredHeaders.filter(function(h){ return current.indexOf(h) < 0; });
    if (missing.length) {
      summary = '補齊缺少欄位：' + missing.join('、');
      if (!dryRun) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
      writeRecoveryLog_(tenantId, '缺欄修復', sheetName, dryRun ? '預演' : status, summary, '');
      return { 目標名稱: sheetName, 修復狀態: dryRun ? '預演' : status, 修復摘要: summary };
    }

    summary = '無需修復';
    writeRecoveryLog_(tenantId, '檢查', sheetName, '略過', summary, '');
    return { 目標名稱: sheetName, 修復狀態: '略過', 修復摘要: summary };
  } catch (err) {
    error = err && err.message ? err.message : String(err);
    writeRecoveryLog_(tenantId, '修復失敗', sheetName, '失敗', summary, error);
    return { 目標名稱: sheetName, 修復狀態: '失敗', 修復摘要: summary, 錯誤訊息: error };
  }
}

function buildRuntimeCheck_(tenantId, item, status, risk, result, suggestion) {
  return {
    檢查ID: generateRuntimeId_('HEALTH'),
    檢查時間: nowRuntimeSafe_(),
    tenantId: tenantId || 'default',
    檢查項目: item,
    檢查狀態: status,
    風險等級: risk,
    檢查結果: result,
    處理建議: suggestion,
    runtimeMs: '',
    建立時間: nowRuntimeSafe_()
  };
}

function writeRuntimeHealthRows_(checks, runtimeMs) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_RUNTIME_HEALTH_SHEET);
  var headers = getRuntimeHeaders_(sheet);
  checks.forEach(function(check) {
    check.runtimeMs = runtimeMs;
    sheet.appendRow(headers.map(function(h){ return check[h] !== undefined ? check[h] : ''; }));
  });
}

function writeMonitoringSummary_(checks, tenantId) {
  var queueRows = readRuntimeRows_('事件佇列中心');
  var queuePending = queueRows.filter(function(r){ return String(r.事件狀態) === '待執行' || String(r.事件狀態) === '重試中'; }).length;
  var queueFailed = queueRows.filter(function(r){ return String(r.事件狀態) === '失敗'; }).length;
  var errorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('錯誤紀錄') || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('系統錯誤紀錄');
  var errorCount = errorSheet ? Math.max(0, errorSheet.getLastRow() - 1) : 0;
  var normal = checks.filter(function(c){ return c.檢查狀態 === '正常'; }).length;
  var warn = checks.filter(function(c){ return c.檢查狀態 === '警告'; }).length;
  var abnormal = checks.filter(function(c){ return c.檢查狀態 === '異常'; }).length;
  var high = checks.filter(function(c){ return c.風險等級 === '高'; }).length;
  var summaryText = '正常 ' + normal + '；警告 ' + warn + '；異常 ' + abnormal + '；高風險 ' + high + '；Queue待執行 ' + queuePending + '；Queue失敗 ' + queueFailed + '；錯誤紀錄 ' + errorCount;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_MONITORING_SUMMARY_SHEET);
  var headers = getRuntimeHeaders_(sheet);
  var record = {
    摘要ID: generateRuntimeId_('MON'),
    產生時間: nowRuntimeSafe_(),
    tenantId: tenantId || 'default',
    總檢查數: checks.length,
    正常數: normal,
    警告數: warn,
    異常數: abnormal,
    高風險數: high,
    Queue待執行數: queuePending,
    Queue失敗數: queueFailed,
    錯誤紀錄數: errorCount,
    摘要內容: summaryText,
    建立時間: nowRuntimeSafe_()
  };
  sheet.appendRow(headers.map(function(h){ return record[h] !== undefined ? record[h] : ''; }));
  return record;
}

function writeRecoveryLog_(tenantId, type, target, status, summary, error) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_RECOVERY_LOG_SHEET);
  var headers = getRuntimeHeaders_(sheet);
  var record = {
    修復ID: generateRuntimeId_('REC'),
    修復時間: nowRuntimeSafe_(),
    tenantId: tenantId || 'default',
    修復類型: type,
    目標名稱: target,
    修復狀態: status,
    修復摘要: summary,
    錯誤訊息: error || '',
    建立時間: nowRuntimeSafe_()
  };
  sheet.appendRow(headers.map(function(h){ return record[h] !== undefined ? record[h] : ''; }));
}

function ensureRuntimeRecoverySheets_() {
  ensureRuntimeSheet_(GOVOPS_RUNTIME_HEALTH_SHEET, GOVOPS_RUNTIME_HEALTH_HEADERS);
  ensureRuntimeSheet_(GOVOPS_RECOVERY_LOG_SHEET, GOVOPS_RECOVERY_LOG_HEADERS);
  ensureRuntimeSheet_(GOVOPS_MONITORING_SUMMARY_SHEET, GOVOPS_MONITORING_SUMMARY_HEADERS);
}

function ensureRuntimeSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var current = getRuntimeHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var missing = headers.filter(function(h){ return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function readRuntimeRows_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getRuntimeHeaders_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx){
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    return obj;
  });
}

function getRuntimeHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
}

function generateRuntimeId_(prefix) {
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  return prefix + '-' + roc + '-' + String(new Date().getTime()).slice(-8) + '-' + Math.floor(Math.random() * 1000);
}

function nowRuntimeSafe_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_RuntimeRecovery_健康檢查() {
  return 執行Runtime健康檢查({ tenantId: 'default' });
}

function 測試_RuntimeRecovery_預演修復() {
  return 執行RuntimeRecovery({ tenantId: 'default', dryRun: true });
}

function 測試_RuntimeRecovery_執行修復() {
  return 執行RuntimeRecovery({ tenantId: 'default', dryRun: false });
}
