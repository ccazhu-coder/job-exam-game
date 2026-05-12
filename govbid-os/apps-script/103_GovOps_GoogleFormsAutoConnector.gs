/* GovOps OS｜Google Forms Auto Connector v1
 * 目的：使用者只貼 Google Form / Google Sheet / 問卷連結，系統自動解析內部 ID，建立滿意度同步，不要求使用者填試算表ID。
 * 注意：若是 Google Form 且 Apps Script 有權限存取，會嘗試取得回覆試算表ID；若無權限，標記為待授權/待連結。
 */

function handleGovOpsGoogleFormsAutoConnectorAction(action, data) {
  data = data || {};
  try {
    if (action === 'survey.googleForms.connect' || action === '連結Google問卷') return GovOpsGoogleFormsConnector_connect(data);
    if (action === 'survey.googleForms.query' || action === '查詢Google問卷連結') return GovOpsGoogleFormsConnector_query(data);
    if (action === 'survey.googleForms.sync' || action === '同步Google問卷滿意度') return GovOpsGoogleFormsConnector_sync(data);
    if (action === 'survey.googleForms.health' || action === 'Google問卷連結健康檢查') return GovOpsGoogleFormsConnector_health(data);
    return null;
  } catch (err) {
    GovOpsGoogleFormsConnector_logError('handleGovOpsGoogleFormsAutoConnectorAction', err, data);
    return GovOpsGoogleFormsConnector_fail('Google 問卷自動連結暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_GOOGLE_FORMS_CONNECTOR = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsGoogleFormsAutoConnectorAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_GOOGLE_FORMS_CONNECTOR(action, data);
  };
}

function GovOpsGoogleFormsConnector_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsGoogleFormsConnector_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsGoogleFormsConnector_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsGoogleFormsConnector_sheetName() { return '77_Google問卷自動連結'; }

function GovOpsGoogleFormsConnector_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsGoogleFormsConnector_sheetName(), ['連結ID','tenantId','標案ID','標案名稱','場次ID','活動名稱','活動日期','問卷URL','來源類型','FormID','SpreadsheetID','SheetName','連結狀態','授權狀態','回覆筆數','有效筆數','平均分數','滿意度百分比','最後同步時間','同步狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsGoogleFormsConnector_connect(data) {
  data = data || {};
  GovOpsGoogleFormsConnector_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var url = data.問卷URL || data.surveyUrl || data.url || data.問卷連結 || '';
  if (!url) return GovOpsGoogleFormsConnector_fail('請貼上問卷連結。');
  var parsed = GovOpsGoogleFormsConnector_parseUrl(url);
  var linked = GovOpsGoogleFormsConnector_resolveLinkedSheet(parsed);
  var row = {
    連結ID: 'GFC-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || '',
    場次ID: data.場次ID || data.eventId || '',
    活動名稱: data.活動名稱 || data.eventName || '',
    活動日期: data.活動日期 || data.eventDate || '',
    問卷URL: url,
    來源類型: parsed.type,
    FormID: parsed.formId || '',
    SpreadsheetID: linked.spreadsheetId || parsed.spreadsheetId || '',
    SheetName: linked.sheetName || data.sheetName || '',
    連結狀態: linked.connected ? '已連結' : '待授權/待確認',
    授權狀態: linked.authorized ? '已授權' : '需確認Google權限',
    回覆筆數: 0,
    有效筆數: 0,
    平均分數: 0,
    滿意度百分比: '0%',
    最後同步時間: '',
    同步狀態: '尚未同步',
    建立時間: GovOpsGoogleFormsConnector_now(),
    更新時間: GovOpsGoogleFormsConnector_now(),
    userId: data.userId || '',
    備註: linked.note || '使用者只需貼問卷連結，系統自動解析內部ID。'
  };
  var existing = GovOpsGoogleFormsConnector_findExisting(tenantId, row.場次ID, row.問卷URL);
  if (existing) {
    GovOpsProduct_update(GovOpsGoogleFormsConnector_sheetName(), existing._row, Object.assign({}, row, { 連結ID: existing.連結ID, 建立時間: existing.建立時間, 更新時間: GovOpsGoogleFormsConnector_now() }));
    return GovOpsGoogleFormsConnector_success('Google 問卷連結已更新。', Object.assign({}, existing, row));
  }
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsGoogleFormsConnector_sheetName(), row);
  if (linked.connected) GovOpsGoogleFormsConnector_sync({ tenantId: tenantId, 連結ID: row.連結ID, userId: data.userId || '' });
  return GovOpsGoogleFormsConnector_success('Google 問卷已自動連結。', row);
}

function GovOpsGoogleFormsConnector_query(data) {
  data = data || {};
  GovOpsGoogleFormsConnector_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || data.場次ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsGoogleFormsConnector_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsGoogleFormsConnector_success('Google 問卷連結查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsGoogleFormsConnector_sync(data) {
  data = data || {};
  GovOpsGoogleFormsConnector_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var connectors = GovOpsGoogleFormsConnector_targetRows(tenantId, data);
  if (!connectors.length) return GovOpsGoogleFormsConnector_fail('找不到可同步的 Google 問卷連結。');
  var synced = 0, failed = 0, results = [];
  connectors.forEach(function(row){
    try {
      var stats = GovOpsGoogleFormsConnector_readResponses(row);
      var patch = {
        回覆筆數: stats.responses,
        有效筆數: stats.validResponses,
        平均分數: stats.averageScore,
        滿意度百分比: stats.satisfactionPercent + '%',
        最後同步時間: GovOpsGoogleFormsConnector_now(),
        同步狀態: '已同步',
        更新時間: GovOpsGoogleFormsConnector_now(),
        備註: stats.note || row.備註 || ''
      };
      GovOpsProduct_update(GovOpsGoogleFormsConnector_sheetName(), row._row, patch);
      GovOpsGoogleFormsConnector_writeSatisfaction(Object.assign({}, row, patch), data);
      synced++;
      results.push(Object.assign({}, row, patch));
    } catch (err) {
      failed++;
      try { GovOpsProduct_update(GovOpsGoogleFormsConnector_sheetName(), row._row, { 同步狀態: '同步失敗', 更新時間: GovOpsGoogleFormsConnector_now(), 備註: String(err) }); } catch (e) {}
    }
  });
  return GovOpsGoogleFormsConnector_success('Google 問卷同步完成。', { synced: synced, failed: failed, results: results });
}

function GovOpsGoogleFormsConnector_health(data) {
  var q = GovOpsGoogleFormsConnector_query(data);
  var rows = q.data.rows || [];
  var out = { total: rows.length, connected: 0, needsAuth: 0, synced: 0, failed: 0 };
  rows.forEach(function(r){
    if (String(r.連結狀態 || '') === '已連結') out.connected++;
    if (String(r.授權狀態 || '').indexOf('需') >= 0) out.needsAuth++;
    if (String(r.同步狀態 || '') === '已同步') out.synced++;
    if (String(r.同步狀態 || '') === '同步失敗') out.failed++;
  });
  return GovOpsGoogleFormsConnector_success('Google 問卷連結健康檢查完成。', out);
}

function GovOpsGoogleFormsConnector_parseUrl(url) {
  url = String(url || '').trim();
  var out = { type: '其他線上問卷', formId: '', spreadsheetId: '', rawUrl: url };
  var formMatch = url.match(/\/forms\/d\/(?:e\/)?([^\/]+)/);
  if (formMatch) { out.type = 'Google表單'; out.formId = formMatch[1]; return out; }
  var sheetMatch = url.match(/\/spreadsheets\/d\/([^\/]+)/);
  if (sheetMatch) { out.type = 'Google試算表回覆'; out.spreadsheetId = sheetMatch[1]; return out; }
  if (/docs\.google\.com\/forms/.test(url)) out.type = 'Google表單';
  return out;
}

function GovOpsGoogleFormsConnector_resolveLinkedSheet(parsed) {
  var out = { connected: false, authorized: false, spreadsheetId: '', sheetName: '', note: '' };
  try {
    if (parsed.spreadsheetId) {
      var ss = SpreadsheetApp.openById(parsed.spreadsheetId);
      out.connected = true; out.authorized = true; out.spreadsheetId = parsed.spreadsheetId; out.sheetName = ss.getSheets()[0].getName(); out.note = '使用者貼的是 Google 試算表連結，系統已自動解析。';
      return out;
    }
    if (parsed.formId && typeof FormApp !== 'undefined') {
      var form = FormApp.openById(parsed.formId);
      var destId = form.getDestinationId ? form.getDestinationId() : '';
      if (destId) {
        var ss2 = SpreadsheetApp.openById(destId);
        out.connected = true; out.authorized = true; out.spreadsheetId = destId; out.sheetName = ss2.getSheets()[0].getName(); out.note = '系統已由 Google Form 自動取得回覆試算表。';
      } else {
        out.connected = false; out.authorized = true; out.note = 'Google Form 尚未連結回覆試算表，請在 Google Form 設定回覆目的地。';
      }
      return out;
    }
  } catch (err) {
    out.connected = false; out.authorized = false; out.note = '無法自動讀取 Google 問卷或回覆表，可能是權限不足或連結非同帳號擁有：' + err;
  }
  return out;
}

function GovOpsGoogleFormsConnector_readResponses(row) {
  if (!row.SpreadsheetID) throw new Error('缺少系統解析出的回覆試算表ID。');
  var ss = SpreadsheetApp.openById(row.SpreadsheetID);
  var sheet = row.SheetName ? ss.getSheetByName(row.SheetName) : ss.getSheets()[0];
  if (!sheet) throw new Error('找不到問卷回覆工作表。');
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { responses: 0, validResponses: 0, averageScore: 0, satisfactionPercent: 0, note: '尚無回覆資料。' };
  var headers = values[0].map(function(h){ return String(h || ''); });
  var scoreIndexes = GovOpsGoogleFormsConnector_scoreColumns(headers);
  var responses = values.length - 1;
  var valid = 0, scoreTotal = 0, scoreCount = 0;
  values.slice(1).forEach(function(r){
    var hasAny = r.some(function(x){ return String(x || '').trim(); });
    if (hasAny) valid++;
    scoreIndexes.forEach(function(i){ var n = Number(r[i]); if (!isNaN(n) && n > 0) { scoreTotal += n; scoreCount++; } });
  });
  var avg = scoreCount ? Math.round((scoreTotal / scoreCount) * 100) / 100 : 0;
  var pct = avg ? Math.round((avg / 5) * 10000) / 100 : 0;
  return { responses: responses, validResponses: valid, averageScore: avg, satisfactionPercent: pct, note: '已由回覆試算表自動同步。' };
}

function GovOpsGoogleFormsConnector_scoreColumns(headers) {
  var idx = [];
  headers.forEach(function(h, i){
    if (/滿意|分數|評分|整體|課程內容|講師|場地|收穫|推薦/.test(h)) idx.push(i);
  });
  return idx;
}

function GovOpsGoogleFormsConnector_writeSatisfaction(row, data) {
  try {
    if (typeof GovOpsTenderExecutionSatisfaction_create !== 'function') return;
    GovOpsTenderExecutionSatisfaction_create({
      tenantId: row.tenantId,
      userId: data.userId || row.userId || '',
      標案ID: row.標案ID,
      標案名稱: row.標案名稱,
      場次ID: row.場次ID,
      活動名稱: row.活動名稱,
      活動日期: row.活動日期,
      問卷方式: '線上問卷',
      問卷工具: row.來源類型 || 'Google表單',
      問卷連結: row.問卷URL,
      線上回覆試算表ID: row.SpreadsheetID,
      回收份數: row.回覆筆數,
      有效份數: row.有效筆數,
      平均分數: row.平均分數,
      備註: '由 Google Forms Auto Connector 自動同步。'
    });
  } catch (err) {}
}

function GovOpsGoogleFormsConnector_targetRows(tenantId, data) {
  var rows = GovOpsProduct_readRows(GovOpsGoogleFormsConnector_sheetName()).filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (data.連結ID && String(row.連結ID || '') === String(data.連結ID)) return true;
    var keyword = String(data.keyword || data.關鍵字 || data.標案ID || data.場次ID || '').trim();
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return rows;
}

function GovOpsGoogleFormsConnector_findExisting(tenantId, eventId, url) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsGoogleFormsConnector_sheetName());
    return rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.場次ID || '') === String(eventId || '') && String(r.問卷URL || '') === String(url || ''); }) || null;
  } catch (err) { return null; }
}

function GovOpsGoogleFormsConnector_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_GoogleFormsConnector_Parse() { return GovOpsGoogleFormsConnector_connect({ tenantId: 'TENANT-DEMO', 問卷URL: 'https://docs.google.com/forms/d/e/TEST/viewform' }); }
