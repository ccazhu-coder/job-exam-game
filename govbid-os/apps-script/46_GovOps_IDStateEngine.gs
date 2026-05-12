/*
GovOps OS｜46_GovOps_IDStateEngine.gs
目的：建立 GovOps OS 核心 ID Engine 與 State Engine。
安全策略：
1. 不修改 37_core.gs / router。
2. 不覆蓋既有 generateId()。
3. 新增 govOpsGenerateId() 作為正式 ID Engine，保留舊函式相容。
4. 新增狀態規則中心與狀態異動紀錄，不強制改既有資料。
5. 可由 Apps Script 手動執行測試函式。
*/

var GOVOPS_ID_STATE_ENGINE_VERSION = '1.0.0';
var GOVOPS_ID_CENTER_SHEET = '系統ID中心';
var GOVOPS_STATE_RULE_SHEET = '狀態規則中心';
var GOVOPS_STATE_CHANGE_LOG_SHEET = '狀態異動紀錄';

var GOVOPS_ID_CENTER_HEADERS = [
  'ID類型',
  'ID前綴',
  '民國年',
  '目前流水號',
  '最後產生ID',
  '最後產生時間',
  '狀態',
  '備註'
];

var GOVOPS_STATE_RULE_HEADERS = [
  '模組',
  '目前狀態',
  '允許下一狀態',
  '是否啟用',
  '風險等級',
  '說明',
  '建立時間',
  '更新時間'
];

var GOVOPS_STATE_CHANGE_LOG_HEADERS = [
  '異動ID',
  'tenantId',
  '模組',
  '關聯ID',
  '原狀態',
  '新狀態',
  '是否允許',
  '異動人',
  '異動時間',
  '結果訊息',
  '備註'
];

var GOVOPS_ID_TYPES = {
  '標案': 'BID',
  '投標': 'TDR',
  '活動': 'ACT',
  '報名': 'REG',
  '學員': 'STU',
  '任務': 'TSK',
  '物品': 'ITM',
  '餐點': 'MEAL',
  '簽到': 'ATT',
  '核銷': 'CHK',
  '文件': 'DOC',
  '候補': 'WAIT',
  '應收': 'AR',
  '收款': 'PAY',
  '支出': 'EXP',
  '損益': 'PL',
  '提醒': 'REM',
  '同步': 'SYNC',
  '組織': 'ORG',
  '使用者': 'USR',
  '租戶': 'TENANT',
  '廠商': 'VEN',
  '事件': 'EVT',
  '流程': 'FLOW',
  '稽核': 'AUDIT'
};

var GOVOPS_DEFAULT_STATE_RULES = [
  ['標案', '新標案', '評估中', '是', '低', '新標案進入初步評估。'],
  ['標案', '評估中', '決定投標', '是', '中', '完成投標評估後決定投標。'],
  ['標案', '評估中', '不投標', '是', '中', '完成評估後放棄投標。'],
  ['標案', '決定投標', '已投標', '是', '中', '已完成投標送件。'],
  ['標案', '已投標', '未得標', '是', '中', '開標或評選結果未得標。'],
  ['標案', '已投標', '已得標', '是', '中', '開標或評選結果得標。'],
  ['標案', '已得標', '履約中', '是', '高', '進入履約執行。'],
  ['標案', '履約中', '已結案', '是', '高', '履約完成並結案。'],

  ['活動', '籌備中', '招生中', '是', '低', '活動完成基本設定後開始招生。'],
  ['活動', '招生中', '報名截止', '是', '中', '報名截止，準備審核與通知。'],
  ['活動', '報名截止', '執行中', '是', '中', '活動進入現場執行。'],
  ['活動', '執行中', '已完成', '是', '中', '活動執行完成。'],
  ['活動', '已完成', '已結案', '是', '高', '活動核銷與歸檔完成。'],
  ['活動', '籌備中', '已取消', '是', '中', '活動取消。'],
  ['活動', '招生中', '已取消', '是', '中', '活動取消。'],
  ['活動', '報名截止', '已取消', '是', '高', '截止後取消需留紀錄。'],

  ['報名', '待審核', '已入選', '是', '低', '報名審核通過。'],
  ['報名', '待審核', '候補', '是', '低', '轉入候補。'],
  ['報名', '待審核', '未入選', '是', '低', '審核未通過。'],
  ['報名', '已入選', '已通知', '是', '中', '已通知學員。'],
  ['報名', '已通知', '已確認參加', '是', '中', '學員確認參加。'],
  ['報名', '已確認參加', '已出席', '是', '中', '完成簽到出席。'],
  ['報名', '已確認參加', '未出席', '是', '中', '未出席。'],
  ['報名', '候補', '已入選', '是', '中', '候補遞補成功。'],

  ['任務', '待執行', '進行中', '是', '低', '任務開始處理。'],
  ['任務', '進行中', '已完成', '是', '低', '任務完成。'],
  ['任務', '待執行', '異常', '是', '中', '任務發生異常。'],
  ['任務', '進行中', '異常', '是', '中', '任務發生異常。'],
  ['任務', '異常', '已完成', '是', '中', '異常排除後完成。'],
  ['任務', '待執行', '已取消', '是', '中', '任務取消。'],

  ['核銷', '未完成', '缺件', '是', '中', '發現缺件。'],
  ['核銷', '缺件', '處理中', '是', '中', '缺件補件中。'],
  ['核銷', '處理中', '已完成', '是', '低', '核銷項目完成。'],
  ['核銷', '未完成', '已完成', '是', '低', '核銷項目直接完成。'],

  ['財務', '未收款', '部分收款', '是', '中', '收到部分款項。'],
  ['財務', '未收款', '已收款', '是', '中', '款項全額收訖。'],
  ['財務', '部分收款', '已收款', '是', '低', '剩餘款項收訖。'],
  ['財務', '未收款', '呆帳風險', '是', '高', '逾期未收款。']
];

function 初始化IDStateEngine() {
  try {
    ensureIdStateEngineSheets_();
    seedDefaultStateRules_();
    seedDefaultIdTypes_();
    return success('ID / State Engine 初始化完成。', {
      version: GOVOPS_ID_STATE_ENGINE_VERSION,
      idCenter: GOVOPS_ID_CENTER_SHEET,
      stateRules: GOVOPS_STATE_RULE_SHEET,
      stateChangeLog: GOVOPS_STATE_CHANGE_LOG_SHEET
    });
  } catch (err) {
    if (typeof logError === 'function') logError('初始化IDStateEngine', err);
    return fail('ID / State Engine 初始化失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function govOpsGenerateId(type, data) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    data = data || {};
    ensureIdStateEngineSheets_();
    lock.waitLock(30000);
    locked = true;

    var prefix = data.prefix || GOVOPS_ID_TYPES[type] || GOVOPS_ID_TYPES[String(type || '').replace('ID', '')] || 'ID';
    var roc = data.rocYear || getRocYear_();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_ID_CENTER_SHEET);
    var headers = getIdStateHeaders_(sheet);
    var rows = readIdCenterRows_();
    var row = rows.find(function(r) {
      return String(r.ID類型) === String(type) && String(r.ID前綴) === String(prefix) && String(r.民國年) === String(roc);
    });

    var nextNo = row ? Number(row.目前流水號 || 0) + 1 : 1;
    var newId = prefix + '-' + roc + '-' + String(nextNo).padStart(4, '0');
    var record = {
      ID類型: type,
      ID前綴: prefix,
      民國年: roc,
      目前流水號: nextNo,
      最後產生ID: newId,
      最後產生時間: nowIdStateSafe_(),
      狀態: '啟用',
      備註: data.note || ''
    };

    if (row && row._row) updateRowByHeaders_(sheet, row._row, headers, record);
    else appendByHeaders_(sheet, headers, record);

    return newId;
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

function 檢查狀態跳轉(data) {
  try {
    初始化IDStateEngine();
    data = data || {};
    var moduleName = String(data.模組 || data.module || '').trim();
    var fromState = String(data.目前狀態 || data.fromState || '').trim();
    var toState = String(data.新狀態 || data.toState || '').trim();

    if (!moduleName) return fail('請提供模組。');
    if (!toState) return fail('請提供新狀態。');
    if (!fromState) return success('初始狀態允許設定。', { allowed: true, 模組: moduleName, 目前狀態: fromState, 新狀態: toState });

    var allowed = isStateTransitionAllowed_(moduleName, fromState, toState);
    return success(allowed ? '狀態跳轉允許。' : '狀態跳轉不允許。', {
      allowed: allowed,
      模組: moduleName,
      目前狀態: fromState,
      新狀態: toState
    });
  } catch (err) {
    if (typeof logError === 'function') logError('檢查狀態跳轉', err);
    return fail('狀態跳轉檢查失敗。');
  }
}

function 記錄狀態異動(data) {
  try {
    初始化IDStateEngine();
    data = data || {};
    var moduleName = String(data.模組 || data.module || '').trim();
    var relationId = String(data.關聯ID || data.id || data.relationId || '').trim();
    var fromState = String(data.原狀態 || data.fromState || '').trim();
    var toState = String(data.新狀態 || data.toState || '').trim();
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var userId = String(data.userId || data.異動人 || '').trim();

    if (!moduleName) return fail('請提供模組。');
    if (!relationId) return fail('請提供關聯ID。');
    if (!toState) return fail('請提供新狀態。');

    var allowed = !fromState || isStateTransitionAllowed_(moduleName, fromState, toState);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_STATE_CHANGE_LOG_SHEET);
    var headers = getIdStateHeaders_(sheet);
    var record = {
      異動ID: govOpsGenerateId('稽核'),
      tenantId: tenantId,
      模組: moduleName,
      關聯ID: relationId,
      原狀態: fromState,
      新狀態: toState,
      是否允許: allowed ? '是' : '否',
      異動人: userId,
      異動時間: nowIdStateSafe_(),
      結果訊息: allowed ? '狀態異動允許' : '狀態異動不允許',
      備註: data.備註 || data.note || ''
    };
    appendByHeaders_(sheet, headers, record);

    return success(record.結果訊息, Object.assign({ allowed: allowed }, record));
  } catch (err) {
    if (typeof logError === 'function') logError('記錄狀態異動', err);
    return fail('狀態異動紀錄失敗。');
  }
}

function 取得狀態規則(data) {
  try {
    初始化IDStateEngine();
    data = data || {};
    var moduleName = String(data.模組 || data.module || '').trim();
    var rows = readStateRuleRows_().filter(function(r) { return String(r.是否啟用 || '是') === '是'; });
    if (moduleName) rows = rows.filter(function(r) { return String(r.模組) === moduleName; });
    return success('狀態規則已取得。', { 筆數: rows.length, 結果: rows });
  } catch (err) {
    if (typeof logError === 'function') logError('取得狀態規則', err);
    return fail('狀態規則讀取失敗。');
  }
}

function isStateTransitionAllowed_(moduleName, fromState, toState) {
  if (!fromState || fromState === toState) return true;
  var rows = readStateRuleRows_();
  return rows.some(function(r) {
    return String(r.模組) === String(moduleName) &&
      String(r.目前狀態) === String(fromState) &&
      String(r.允許下一狀態) === String(toState) &&
      String(r.是否啟用 || '是') === '是';
  });
}

function ensureIdStateEngineSheets_() {
  ensureIdStateSheet_(GOVOPS_ID_CENTER_SHEET, GOVOPS_ID_CENTER_HEADERS);
  ensureIdStateSheet_(GOVOPS_STATE_RULE_SHEET, GOVOPS_STATE_RULE_HEADERS);
  ensureIdStateSheet_(GOVOPS_STATE_CHANGE_LOG_SHEET, GOVOPS_STATE_CHANGE_LOG_HEADERS);
}

function seedDefaultIdTypes_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_ID_CENTER_SHEET);
  var headers = getIdStateHeaders_(sheet);
  var rows = readIdCenterRows_();
  var roc = getRocYear_();
  Object.keys(GOVOPS_ID_TYPES).forEach(function(type) {
    var prefix = GOVOPS_ID_TYPES[type];
    var existed = rows.some(function(r) {
      return String(r.ID類型) === String(type) && String(r.ID前綴) === String(prefix) && String(r.民國年) === String(roc);
    });
    if (!existed) {
      appendByHeaders_(sheet, headers, {
        ID類型: type,
        ID前綴: prefix,
        民國年: roc,
        目前流水號: 0,
        最後產生ID: '',
        最後產生時間: '',
        狀態: '啟用',
        備註: '系統預設ID類型'
      });
    }
  });
}

function seedDefaultStateRules_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_STATE_RULE_SHEET);
  var headers = getIdStateHeaders_(sheet);
  var rows = readStateRuleRows_();
  GOVOPS_DEFAULT_STATE_RULES.forEach(function(rule) {
    var existed = rows.some(function(r) {
      return String(r.模組) === String(rule[0]) && String(r.目前狀態) === String(rule[1]) && String(r.允許下一狀態) === String(rule[2]);
    });
    if (!existed) {
      appendByHeaders_(sheet, headers, {
        模組: rule[0],
        目前狀態: rule[1],
        允許下一狀態: rule[2],
        是否啟用: rule[3],
        風險等級: rule[4],
        說明: rule[5],
        建立時間: nowIdStateSafe_(),
        更新時間: nowIdStateSafe_()
      });
    }
  });
}

function readIdCenterRows_() {
  return readSheetRowsByName_(GOVOPS_ID_CENTER_SHEET);
}

function readStateRuleRows_() {
  return readSheetRowsByName_(GOVOPS_STATE_RULE_SHEET);
}

function readSheetRowsByName_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getIdStateHeaders_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx) {
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function ensureIdStateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var current = getIdStateHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var missing = headers.filter(function(h) { return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function getIdStateHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim(); });
}

function appendByHeaders_(sheet, headers, obj) {
  sheet.appendRow(headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; }));
}

function updateRowByHeaders_(sheet, rowNumber, headers, obj) {
  Object.keys(obj).forEach(function(key) {
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowNumber, col).setValue(obj[key]);
  });
}

function getRocYear_() {
  return String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
}

function nowIdStateSafe_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_IDStateEngine_初始化() {
  return 初始化IDStateEngine();
}

function 測試_IDStateEngine_產生ID() {
  初始化IDStateEngine();
  return success('ID 產生測試完成。', {
    標案ID: govOpsGenerateId('標案'),
    活動ID: govOpsGenerateId('活動'),
    報名ID: govOpsGenerateId('報名')
  });
}

function 測試_IDStateEngine_狀態跳轉() {
  初始化IDStateEngine();
  return success('狀態跳轉測試完成。', {
    合法: 檢查狀態跳轉({ 模組: '報名', 目前狀態: '待審核', 新狀態: '已入選' }).data,
    非法: 檢查狀態跳轉({ 模組: '報名', 目前狀態: '未入選', 新狀態: '已出席' }).data
  });
}
