/*
GovOps OS｜52_GovOps_LineSecretaryEngine.gs
目的：建立中文 LINE AI 總秘書底層引擎。
安全策略：
1. 不修改 37_core.gs / router。
2. 不直接接正式 LINE Webhook，不發送真實 Push，避免誤觸發。
3. 先建立指令解析、回覆資料結構、LINE使用者綁定、操作紀錄。
4. 後續正式 Webhook / Reply API 另行接入。
*/

var GOVOPS_LINE_SECRETARY_VERSION = '1.0.0';
var GOVOPS_LINE_USER_SHEET = 'LINE使用者綁定';
var GOVOPS_LINE_COMMAND_LOG_SHEET = 'LINE指令紀錄';
var GOVOPS_LINE_REPLY_TEMPLATE_SHEET = 'LINE回覆模板';

var GOVOPS_LINE_USER_HEADERS = ['LINE UID','tenantId','userId','姓名','LINE名稱','角色','綁定狀態','最後互動時間','建立時間','更新時間','備註'];
var GOVOPS_LINE_COMMAND_LOG_HEADERS = ['紀錄ID','tenantId','LINE UID','userId','指令內容','解析結果','執行狀態','回覆摘要','建立時間','更新時間'];
var GOVOPS_LINE_REPLY_TEMPLATE_HEADERS = ['模板名稱','指令關鍵字','回覆類型','模板內容','狀態','建立時間','更新時間'];

var GOVOPS_LINE_COMMANDS = [
  ['今日任務','今天要做什麼,今日任務,今天任務','文字','今日任務查詢'],
  ['今日提醒','今日提醒,今天提醒,提醒','文字','今日提醒查詢'],
  ['未收款','查詢未收款,未收款,應收款','文字','未收款查詢'],
  ['核銷缺件','查詢缺件,缺件,核銷缺件','文字','核銷缺件查詢'],
  ['活動查詢','查詢活動,活動列表,近期活動','文字','活動查詢'],
  ['後台總覽','後台總覽,系統狀態,營運摘要','文字','後台總覽'],
  ['完成任務','完成 ','文字','完成任務']
];

function 初始化LINE秘書引擎() {
  try {
    ensureLineSecretarySheets_();
    seedLineReplyTemplates_();
    return 建立中文成功回傳('LINE AI 總秘書引擎初始化完成。', {
      版本: GOVOPS_LINE_SECRETARY_VERSION,
      使用者綁定表: GOVOPS_LINE_USER_SHEET,
      指令紀錄表: GOVOPS_LINE_COMMAND_LOG_SHEET,
      回覆模板表: GOVOPS_LINE_REPLY_TEMPLATE_SHEET
    });
  } catch (err) {
    if (typeof logError === 'function') logError('初始化LINE秘書引擎', err);
    return 建立中文失敗回傳('系統錯誤', 'LINE AI 總秘書引擎初始化失敗。', {});
  }
}

function 綁定LINE使用者(data) {
  try {
    初始化LINE秘書引擎();
    data = data || {};
    var lineUid = String(data['LINE UID'] || data.lineUid || '').trim();
    if (!lineUid) return 建立中文失敗回傳('資料不足', '請提供 LINE UID。', {});
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_LINE_USER_SHEET);
    var headers = getLineHeaders_(sheet);
    var rows = readLineRows_(GOVOPS_LINE_USER_SHEET);
    var existed = rows.find(function(r){ return String(r['LINE UID']) === lineUid && String(r.tenantId || 'default') === tenantId; });
    var record = {
      'LINE UID': lineUid,
      tenantId: tenantId,
      userId: data.userId || '',
      姓名: data.姓名 || data.name || '',
      LINE名稱: data.LINE名稱 || data.lineName || '',
      角色: data.角色 || data.role || 'owner',
      綁定狀態: data.綁定狀態 || '已綁定',
      最後互動時間: nowLineSafe_(),
      更新時間: nowLineSafe_(),
      備註: data.備註 || ''
    };
    if (existed && existed._row) {
      updateLineRow_(sheet, existed._row, headers, record);
      return 建立中文成功回傳('LINE使用者綁定已更新。', Object.assign({}, existed, record));
    }
    record.建立時間 = nowLineSafe_();
    appendLineRow_(sheet, headers, record);
    return 建立中文成功回傳('LINE使用者已綁定。', record);
  } catch (err) {
    if (typeof logError === 'function') logError('綁定LINE使用者', err);
    return 建立中文失敗回傳('系統錯誤', 'LINE使用者綁定失敗。', {});
  }
}

function 解析LINE指令(data) {
  data = data || {};
  var text = String(data.text || data.指令內容 || '').trim();
  if (!text) return { 指令類型: '空指令', 模組: 'LINE', 動作: '無', 關鍵字: '', 原文: text };
  var templates = readLineRows_(GOVOPS_LINE_REPLY_TEMPLATE_SHEET);
  for (var i = 0; i < templates.length; i++) {
    var keys = String(templates[i].指令關鍵字 || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    for (var j = 0; j < keys.length; j++) {
      if (text.indexOf(keys[j]) >= 0) {
        return { 指令類型: templates[i].模板名稱, 模組: 'LINE秘書', 動作: templates[i].模板內容, 關鍵字: keys[j], 原文: text };
      }
    }
  }
  return { 指令類型: 'AI秘書查詢', 模組: 'AI秘書', 動作: '自然語言查詢', 關鍵字: '', 原文: text };
}

function 執行LINE秘書指令(data) {
  try {
    初始化LINE秘書引擎();
    data = data || {};
    var lineUid = String(data['LINE UID'] || data.lineUid || '').trim();
    var text = String(data.text || data.指令內容 || '').trim();
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var user = getLineUser_(lineUid, tenantId);
    var parsed = 解析LINE指令({ text: text });
    var result = routeLineSecretaryCommand_(parsed, data, user);
    writeLineCommandLog_(tenantId, lineUid, user ? user.userId : '', text, parsed, result);
    return 建立中文成功回傳('LINE秘書指令已處理。', {
      解析結果: parsed,
      回覆: result
    });
  } catch (err) {
    if (typeof logError === 'function') logError('執行LINE秘書指令', err);
    return 建立中文失敗回傳('系統錯誤', 'LINE秘書指令處理失敗。', {});
  }
}

function routeLineSecretaryCommand_(parsed, data, user) {
  var type = parsed.指令類型;
  if (type === '今日任務') return buildTextReply_('今日任務功能已接入，後續會讀取當日工作任務表。');
  if (type === '今日提醒') return buildTextReply_('今日提醒功能已接入，後續會讀取提醒中心。');
  if (type === '未收款') return buildTextReply_('未收款查詢功能已接入，後續會讀取應收帳款。');
  if (type === '核銷缺件') return buildTextReply_('核銷缺件查詢功能已接入，後續會讀取核銷檢查中心。');
  if (type === '活動查詢') return buildTextReply_('活動查詢功能已接入，後續會讀取招生活動管理。');
  if (type === '後台總覽') {
    if (typeof 取得後台總覽 === 'function') {
      var overview = 取得後台總覽({ tenantId: data.tenantId || 'default' });
      return buildTextReply_(formatAdminOverviewForLine_(overview));
    }
    return buildTextReply_('後台總覽模組尚未初始化。');
  }
  if (type === '完成任務') return buildTextReply_('完成任務指令已接入，後續會更新任務狀態。');
  return buildTextReply_('我已收到您的指令：「' + parsed.原文 + '」。目前已進入AI秘書查詢流程。');
}

function buildTextReply_(text) {
  return { 回覆類型: '文字', 文字: text || '' };
}

function formatAdminOverviewForLine_(overview) {
  if (!overview || !overview.success) return '後台總覽讀取失敗。';
  var latest = overview.data && overview.data.最新摘要 ? overview.data.最新摘要 : {};
  if (!latest || !latest.摘要內容) return '目前尚無後台營運摘要，請先產生後台營運摘要。';
  return '【GovOps 後台總覽】\n' + latest.摘要內容;
}

function getLineUser_(lineUid, tenantId) {
  if (!lineUid) return null;
  var rows = readLineRows_(GOVOPS_LINE_USER_SHEET);
  return rows.find(function(r){ return String(r['LINE UID']) === lineUid && String(r.tenantId || 'default') === String(tenantId || 'default'); }) || null;
}

function writeLineCommandLog_(tenantId, lineUid, userId, text, parsed, result) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_LINE_COMMAND_LOG_SHEET);
  var headers = getLineHeaders_(sheet);
  var record = {
    紀錄ID: generateLineId_('LINELOG'),
    tenantId: tenantId || 'default',
    'LINE UID': lineUid || '',
    userId: userId || '',
    指令內容: text || '',
    解析結果: JSON.stringify(parsed || {}),
    執行狀態: '完成',
    回覆摘要: result && result.文字 ? result.文字 : '',
    建立時間: nowLineSafe_(),
    更新時間: nowLineSafe_()
  };
  appendLineRow_(sheet, headers, record);
}

function ensureLineSecretarySheets_() {
  ensureLineSheet_(GOVOPS_LINE_USER_SHEET, GOVOPS_LINE_USER_HEADERS);
  ensureLineSheet_(GOVOPS_LINE_COMMAND_LOG_SHEET, GOVOPS_LINE_COMMAND_LOG_HEADERS);
  ensureLineSheet_(GOVOPS_LINE_REPLY_TEMPLATE_SHEET, GOVOPS_LINE_REPLY_TEMPLATE_HEADERS);
}

function seedLineReplyTemplates_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_LINE_REPLY_TEMPLATE_SHEET);
  var headers = getLineHeaders_(sheet);
  var rows = readLineRows_(GOVOPS_LINE_REPLY_TEMPLATE_SHEET);
  GOVOPS_LINE_COMMANDS.forEach(function(item){
    var existed = rows.some(function(r){ return String(r.模板名稱) === item[0]; });
    if (!existed) {
      var record = { 模板名稱: item[0], 指令關鍵字: item[1], 回覆類型: item[2], 模板內容: item[3], 狀態: '啟用', 建立時間: nowLineSafe_(), 更新時間: nowLineSafe_() };
      appendLineRow_(sheet, headers, record);
    }
  });
}

function ensureLineSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var current = getLineHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var missing = headers.filter(function(h){ return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function readLineRows_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getLineHeaders_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx){
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    return obj;
  });
}

function getLineHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
}

function appendLineRow_(sheet, headers, obj) {
  sheet.appendRow(headers.map(function(h){ return obj[h] !== undefined ? obj[h] : ''; }));
}

function updateLineRow_(sheet, rowNumber, headers, obj) {
  Object.keys(obj).forEach(function(key){
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowNumber, col).setValue(obj[key]);
  });
}

function generateLineId_(prefix) {
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  return prefix + '-' + roc + '-' + String(new Date().getTime()).slice(-8) + '-' + Math.floor(Math.random() * 1000);
}

function nowLineSafe_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_LINE秘書_初始化() {
  return 初始化LINE秘書引擎();
}

function 測試_LINE秘書_指令解析() {
  初始化LINE秘書引擎();
  return 執行LINE秘書指令({ tenantId: 'default', lineUid: 'TEST-LINE-UID', text: '今天要做什麼' });
}
