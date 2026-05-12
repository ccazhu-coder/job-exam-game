/*
GovOps OS｜47_GovOps_WorkflowEventEngine.gs
目的：建立 GovOps OS Workflow / Event Engine。
安全策略：
1. 不修改 37_core.gs / router。
2. 不直接改既有活動、報名、財務資料。
3. 只建立/補齊「事件佇列中心」與「流程執行紀錄」。
4. 事件先採可手動執行模式，避免 Trigger 重複爆發。
5. 可由 Apps Script 手動執行測試函式。
*/

var GOVOPS_WORKFLOW_EVENT_ENGINE_VERSION = '1.0.0';
var GOVOPS_EVENT_QUEUE_SHEET = '事件佇列中心';
var GOVOPS_FLOW_LOG_SHEET = '流程執行紀錄';

var GOVOPS_EVENT_QUEUE_HEADERS = [
  '事件ID',
  'tenantId',
  '事件類型',
  '來源模組',
  '關聯ID',
  '事件狀態',
  '優先級',
  '事件資料JSON',
  '錯誤訊息',
  '重試次數',
  '建立時間',
  '預計執行時間',
  '開始執行時間',
  '完成時間',
  '更新時間',
  '備註'
];

var GOVOPS_FLOW_LOG_HEADERS = [
  '流程ID',
  'tenantId',
  '事件ID',
  '流程名稱',
  '來源模組',
  '關聯ID',
  '執行狀態',
  '執行摘要',
  '執行結果JSON',
  '錯誤訊息',
  '開始時間',
  '完成時間',
  '建立時間',
  '更新時間'
];

var GOVOPS_EVENT_TYPES = {
  ACTIVITY_CREATED: '活動建立',
  ACTIVITY_UPDATED: '活動更新',
  ACTIVITY_CANCELLED: '活動取消',
  REGISTRATION_CREATED: '報名建立',
  REGISTRATION_APPROVED: '報名通過',
  REGISTRATION_WAITLISTED: '報名候補',
  PAYMENT_RECEIVED: '收款完成',
  REIMBURSEMENT_MISSING: '核銷缺件',
  DOCUMENT_ARCHIVED: '文件歸檔',
  REMINDER_DUE: '提醒到期'
};

function 初始化WorkflowEventEngine() {
  try {
    ensureWorkflowEventSheets_();
    return success('Workflow / Event Engine 初始化完成。', {
      version: GOVOPS_WORKFLOW_EVENT_ENGINE_VERSION,
      eventQueue: GOVOPS_EVENT_QUEUE_SHEET,
      flowLog: GOVOPS_FLOW_LOG_SHEET
    });
  } catch (err) {
    if (typeof logError === 'function') logError('初始化WorkflowEventEngine', err);
    return fail('Workflow / Event Engine 初始化失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function 建立GovOps事件(data) {
  try {
    初始化WorkflowEventEngine();
    data = data || {};
    var eventType = String(data.事件類型 || data.eventType || '').trim();
    var sourceModule = String(data.來源模組 || data.sourceModule || '').trim();
    var relationId = String(data.關聯ID || data.relationId || data.id || '').trim();
    var tenantId = String(data.tenantId || 'default').trim() || 'default';

    if (!eventType) return fail('請提供事件類型。');
    if (!sourceModule) return fail('請提供來源模組。');
    if (!relationId) return fail('請提供關聯ID。');

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_EVENT_QUEUE_SHEET);
    var headers = getWorkflowEventHeaders_(sheet);
    var eventId = generateWorkflowEventId_('事件');
    var record = {
      事件ID: eventId,
      tenantId: tenantId,
      事件類型: eventType,
      來源模組: sourceModule,
      關聯ID: relationId,
      事件狀態: '待執行',
      優先級: data.優先級 || data.priority || '一般',
      事件資料JSON: safeStringify_(data.payload || data.事件資料 || {}),
      錯誤訊息: '',
      重試次數: 0,
      建立時間: nowWorkflowSafe_(),
      預計執行時間: data.預計執行時間 || data.scheduledAt || nowWorkflowSafe_(),
      開始執行時間: '',
      完成時間: '',
      更新時間: nowWorkflowSafe_(),
      備註: data.備註 || data.note || ''
    };

    appendByHeadersWorkflow_(sheet, headers, record);
    return success('事件已建立。', record);
  } catch (err) {
    if (typeof logError === 'function') logError('建立GovOps事件', err);
    return fail('事件建立失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function 執行GovOps事件佇列(data) {
  try {
    初始化WorkflowEventEngine();
    data = data || {};
    var limit = Number(data.limit || data.筆數 || 10);
    var tenantId = String(data.tenantId || '').trim();
    var rows = readWorkflowEventRows_(GOVOPS_EVENT_QUEUE_SHEET)
      .filter(function(row) { return String(row.事件狀態) === '待執行' || String(row.事件狀態) === '重試中'; })
      .filter(function(row) { return !tenantId || String(row.tenantId || 'default') === tenantId; })
      .slice(0, limit);

    var results = [];
    rows.forEach(function(eventRow) {
      results.push(processGovOpsEvent_(eventRow));
    });

    return success('事件佇列執行完成。', {
      執行筆數: results.length,
      結果: results
    });
  } catch (err) {
    if (typeof logError === 'function') logError('執行GovOps事件佇列', err);
    return fail('事件佇列執行失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function processGovOpsEvent_(eventRow) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_EVENT_QUEUE_SHEET);
  var headers = getWorkflowEventHeaders_(sheet);
  var startTime = nowWorkflowSafe_();
  updateByHeadersWorkflow_(sheet, eventRow._row, headers, {
    事件狀態: '執行中',
    開始執行時間: startTime,
    更新時間: startTime
  });

  var flowRecord = null;
  try {
    var flowResult = routeGovOpsWorkflow_(eventRow);
    var doneTime = nowWorkflowSafe_();
    updateByHeadersWorkflow_(sheet, eventRow._row, headers, {
      事件狀態: '已完成',
      完成時間: doneTime,
      更新時間: doneTime,
      錯誤訊息: ''
    });
    flowRecord = writeWorkflowLog_(eventRow, flowResult.flowName, '已完成', flowResult.summary, flowResult.data, '');
    return { 事件ID: eventRow.事件ID, 狀態: '已完成', 流程ID: flowRecord.流程ID, 摘要: flowResult.summary };
  } catch (err) {
    var retryCount = Number(eventRow.重試次數 || 0) + 1;
    var status = retryCount >= 3 ? '失敗' : '重試中';
    var failTime = nowWorkflowSafe_();
    updateByHeadersWorkflow_(sheet, eventRow._row, headers, {
      事件狀態: status,
      錯誤訊息: err && err.message ? err.message : String(err),
      重試次數: retryCount,
      更新時間: failTime
    });
    flowRecord = writeWorkflowLog_(eventRow, '事件處理失敗', status, '事件執行失敗', {}, err && err.message ? err.message : String(err));
    return { 事件ID: eventRow.事件ID, 狀態: status, 流程ID: flowRecord.流程ID, 錯誤: err && err.message ? err.message : String(err) };
  }
}

function routeGovOpsWorkflow_(eventRow) {
  var type = String(eventRow.事件類型 || '');
  var payload = parseJsonSafe_(eventRow.事件資料JSON);

  switch (type) {
    case GOVOPS_EVENT_TYPES.ACTIVITY_CREATED:
    case 'ACTIVITY_CREATED':
    case '活動建立':
      return workflowOnActivityCreated_(eventRow, payload);

    case GOVOPS_EVENT_TYPES.REGISTRATION_CREATED:
    case 'REGISTRATION_CREATED':
    case '報名建立':
      return workflowOnRegistrationCreated_(eventRow, payload);

    case GOVOPS_EVENT_TYPES.REGISTRATION_APPROVED:
    case 'REGISTRATION_APPROVED':
    case '報名通過':
      return workflowOnRegistrationApproved_(eventRow, payload);

    case GOVOPS_EVENT_TYPES.PAYMENT_RECEIVED:
    case 'PAYMENT_RECEIVED':
    case '收款完成':
      return workflowOnPaymentReceived_(eventRow, payload);

    case GOVOPS_EVENT_TYPES.REIMBURSEMENT_MISSING:
    case 'REIMBURSEMENT_MISSING':
    case '核銷缺件':
      return workflowOnReimbursementMissing_(eventRow, payload);

    default:
      return {
        flowName: '未指定事件流程',
        summary: '事件已記錄，但目前尚未綁定自動流程。',
        data: { 事件類型: type, 關聯ID: eventRow.關聯ID }
      };
  }
}

function workflowOnActivityCreated_(eventRow, payload) {
  var activityId = String(eventRow.關聯ID || payload.活動ID || '').trim();
  var data = { 活動ID: activityId };
  var result = null;
  if (typeof 生成活動作業包 === 'function' && activityId) {
    result = 生成活動作業包(data);
  }
  return {
    flowName: '活動建立後作業包流程',
    summary: '已嘗試建立活動作業包。',
    data: { 活動ID: activityId, result: result }
  };
}

function workflowOnRegistrationCreated_(eventRow, payload) {
  return {
    flowName: '報名建立後CRM追蹤流程',
    summary: '報名建立事件已記錄，CRM 已由報名模組同步處理。',
    data: { 報名ID: eventRow.關聯ID, payload: payload }
  };
}

function workflowOnRegistrationApproved_(eventRow, payload) {
  return {
    flowName: '報名通過後通知流程',
    summary: '報名通過事件已記錄，後續可接 LINE / Email 通知。',
    data: { 報名ID: eventRow.關聯ID, payload: payload }
  };
}

function workflowOnPaymentReceived_(eventRow, payload) {
  return {
    flowName: '收款完成後財務追蹤流程',
    summary: '收款完成事件已記錄，後續可接專案損益與提醒解除。',
    data: { 收款ID: eventRow.關聯ID, payload: payload }
  };
}

function workflowOnReimbursementMissing_(eventRow, payload) {
  return {
    flowName: '核銷缺件後提醒流程',
    summary: '核銷缺件事件已記錄，後續可接提醒中心與LINE通知。',
    data: { 核銷ID: eventRow.關聯ID, payload: payload }
  };
}

function writeWorkflowLog_(eventRow, flowName, status, summary, resultData, errorMessage) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_FLOW_LOG_SHEET);
  var headers = getWorkflowEventHeaders_(sheet);
  var nowText = nowWorkflowSafe_();
  var record = {
    流程ID: generateWorkflowEventId_('流程'),
    tenantId: eventRow.tenantId || 'default',
    事件ID: eventRow.事件ID || '',
    流程名稱: flowName || '',
    來源模組: eventRow.來源模組 || '',
    關聯ID: eventRow.關聯ID || '',
    執行狀態: status || '已完成',
    執行摘要: summary || '',
    執行結果JSON: safeStringify_(resultData || {}),
    錯誤訊息: errorMessage || '',
    開始時間: nowText,
    完成時間: nowText,
    建立時間: nowText,
    更新時間: nowText
  };
  appendByHeadersWorkflow_(sheet, headers, record);
  return record;
}

function 查詢GovOps事件佇列(data) {
  try {
    初始化WorkflowEventEngine();
    data = data || {};
    var status = String(data.事件狀態 || data.status || '').trim();
    var tenantId = String(data.tenantId || '').trim();
    var rows = readWorkflowEventRows_(GOVOPS_EVENT_QUEUE_SHEET);
    if (status) rows = rows.filter(function(r) { return String(r.事件狀態) === status; });
    if (tenantId) rows = rows.filter(function(r) { return String(r.tenantId || 'default') === tenantId; });
    return success('事件佇列已取得。', { 筆數: rows.length, 結果: rows.slice(0, Number(data.limit || 100)) });
  } catch (err) {
    if (typeof logError === 'function') logError('查詢GovOps事件佇列', err);
    return fail('事件佇列查詢失敗。');
  }
}

function 查詢流程執行紀錄(data) {
  try {
    初始化WorkflowEventEngine();
    data = data || {};
    var tenantId = String(data.tenantId || '').trim();
    var relationId = String(data.關聯ID || data.relationId || '').trim();
    var rows = readWorkflowEventRows_(GOVOPS_FLOW_LOG_SHEET);
    if (tenantId) rows = rows.filter(function(r) { return String(r.tenantId || 'default') === tenantId; });
    if (relationId) rows = rows.filter(function(r) { return String(r.關聯ID) === relationId; });
    return success('流程執行紀錄已取得。', { 筆數: rows.length, 結果: rows.slice(0, Number(data.limit || 100)) });
  } catch (err) {
    if (typeof logError === 'function') logError('查詢流程執行紀錄', err);
    return fail('流程執行紀錄查詢失敗。');
  }
}

function ensureWorkflowEventSheets_() {
  ensureWorkflowSheet_(GOVOPS_EVENT_QUEUE_SHEET, GOVOPS_EVENT_QUEUE_HEADERS);
  ensureWorkflowSheet_(GOVOPS_FLOW_LOG_SHEET, GOVOPS_FLOW_LOG_HEADERS);
}

function ensureWorkflowSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var current = getWorkflowEventHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var missing = headers.filter(function(h) { return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function readWorkflowEventRows_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getWorkflowEventHeaders_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx) {
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function getWorkflowEventHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim(); });
}

function appendByHeadersWorkflow_(sheet, headers, obj) {
  sheet.appendRow(headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; }));
}

function updateByHeadersWorkflow_(sheet, rowNumber, headers, obj) {
  Object.keys(obj).forEach(function(key) {
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowNumber, col).setValue(obj[key]);
  });
}

function generateWorkflowEventId_(type) {
  if (typeof govOpsGenerateId === 'function') return govOpsGenerateId(type);
  var prefix = type === '流程' ? 'FLOW' : 'EVT';
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  return prefix + '-' + roc + '-' + String(new Date().getTime()).slice(-6);
}

function safeStringify_(obj) {
  try { return JSON.stringify(obj || {}); } catch (err) { return '{}'; }
}

function parseJsonSafe_(text) {
  try { return JSON.parse(String(text || '{}')); } catch (err) { return {}; }
}

function nowWorkflowSafe_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_WorkflowEventEngine_初始化() {
  return 初始化WorkflowEventEngine();
}

function 測試_WorkflowEventEngine_建立事件() {
  初始化WorkflowEventEngine();
  return 建立GovOps事件({
    tenantId: 'default',
    事件類型: '活動建立',
    來源模組: 'Activity',
    關聯ID: 'ACT-115-TEST',
    優先級: '一般',
    payload: { 測試: true }
  });
}

function 測試_WorkflowEventEngine_執行佇列() {
  初始化WorkflowEventEngine();
  return 執行GovOps事件佇列({ limit: 5 });
}
