/* GovOps OS｜Tender Document Parser Queue v1
 * 目的：OCR 待解析文件進入 Parser Queue，由 Worker 分段建立文件解析結果。
 * 注意：本版以穩定狀態機與欄位抽取骨架為主；實際全文內容抽取需接 Drive OCR / Docs 文字來源。
 */

function handleGovOpsTenderParserQueueAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.parser.enqueue' || action === '加入標案解析佇列') return GovOpsTenderParser_enqueue(data);
    if (action === 'tender.parser.query' || action === '查詢標案解析佇列') return GovOpsTenderParser_query(data);
    if (action === 'tender.parser.worker.run' || action === '執行標案解析Worker') return GovOpsTenderParser_workerRun(data);
    if (action === 'tender.parser.worker.install' || action === '安裝標案解析Worker') return GovOpsTenderParser_workerInstall(data);
    if (action === 'tender.parser.result.query' || action === '查詢標案文件解析結果') return GovOpsTenderParserResult_query(data);
    return null;
  } catch (err) {
    GovOpsTenderParser_logError('handleGovOpsTenderParserQueueAction', err, data);
    return GovOpsTenderParser_fail('標案文件解析佇列暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_PARSER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderParserQueueAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_PARSER(action, data);
  };
}

function GovOpsTenderParser_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderParser_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderParser_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderParser_queueSheetName() { return '57_標案文件解析佇列'; }
function GovOpsTenderParser_resultSheetName() { return '49_標案文件解析結果'; }
function GovOpsTenderParser_workerName() { return 'GovOpsTenderParser_workerTrigger'; }

function GovOpsTenderParser_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderParser_queueSheetName(), ['ParserID','tenantId','文件ID','OCRID','標案ID','標案名稱','文件類型','檔案名稱','解析狀態','重試次數','錯誤訊息','建立時間','更新時間','userId','備註']);
    GovOpsProduct_ensureSheet(GovOpsTenderParser_resultSheetName(), ['解析ID','tenantId','文件ID','標案ID','文件類型','原文摘要','關鍵條款','資格條件','評選標準','工作項目','交付成果','驗收方式','請款條件','罰則條款','風險提醒','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderParser_enqueue(data) {
  data = data || {};
  GovOpsTenderParser_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var rows = [];
  if (data.文件ID || data.documentId) rows = [data];
  else if (typeof GovOpsTenderOCR_query === 'function') rows = GovOpsTenderOCR_query({ tenantId: tenantId, keyword: data.keyword || data.標案ID || '' }).data.rows || [];
  var created = 0, skipped = 0;
  rows.forEach(function(item) {
    var docId = item.文件ID || data.文件ID || data.documentId || '';
    if (!docId) return;
    if (GovOpsTenderParser_exists(tenantId, docId)) { skipped++; return; }
    var row = {
      ParserID: 'TPQ-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      文件ID: docId,
      OCRID: item.OCRID || data.OCRID || '',
      標案ID: item.標案ID || data.標案ID || '',
      標案名稱: item.標案名稱 || data.標案名稱 || '',
      文件類型: item.文件類型 || data.文件類型 || '',
      檔案名稱: item.檔案名稱 || data.檔案名稱 || '',
      解析狀態: '等待解析',
      重試次數: 0,
      錯誤訊息: '',
      建立時間: GovOpsTenderParser_now(),
      更新時間: GovOpsTenderParser_now(),
      userId: data.userId || '',
      備註: 'Parser Queue 登錄，將分段解析文件欄位。'
    };
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderParser_queueSheetName(), row);
    created++;
  });
  return GovOpsTenderParser_success('標案文件解析佇列已建立。', { created: created, skipped: skipped });
}

function GovOpsTenderParser_query(data) {
  data = data || {};
  GovOpsTenderParser_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderParser_queueSheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderParser_success('標案文件解析佇列查詢完成。', { total: rows.length, summary: GovOpsTenderParser_summary(rows), rows: rows.slice(0, 300) });
}

function GovOpsTenderParser_workerRun(data) {
  data = data || {};
  GovOpsTenderParser_ensureSheets();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return GovOpsTenderParser_fail('Parser Worker 正在執行中。');
  try {
    var tenantId = data.tenantId || 'TENANT-DEMO';
    var limit = Math.min(Number(data.limit || 3), 5);
    var rows = GovOpsProduct_readRows(GovOpsTenderParser_queueSheetName()).filter(function(row){
      return String(row.tenantId || '') === String(tenantId) && ['等待解析','重試中'].indexOf(String(row.解析狀態 || '')) >= 0;
    }).slice(0, limit);
    var processed = 0, failed = 0;
    rows.forEach(function(row){
      try {
        GovOpsProduct_update(GovOpsTenderParser_queueSheetName(), row._row, { 解析狀態: '解析中', 更新時間: GovOpsTenderParser_now() });
        var result = GovOpsTenderParser_buildResult(row);
        GovOpsProduct_append(GovOpsTenderParser_resultSheetName(), result);
        GovOpsProduct_update(GovOpsTenderParser_queueSheetName(), row._row, { 解析狀態: '已解析', 錯誤訊息: '', 更新時間: GovOpsTenderParser_now() });
        GovOpsTenderParser_updateDocument(row, '已解析');
        processed++;
      } catch (err) {
        var retry = Number(row.重試次數 || 0) + 1;
        GovOpsProduct_update(GovOpsTenderParser_queueSheetName(), row._row, { 解析狀態: retry >= 3 ? '解析失敗' : '重試中', 重試次數: retry, 錯誤訊息: String(err), 更新時間: GovOpsTenderParser_now() });
        failed++;
      }
    });
    return GovOpsTenderParser_success('標案解析 Worker 執行完成。', { processed: processed, failed: failed, limit: limit });
  } finally {
    lock.releaseLock();
  }
}

function GovOpsTenderParser_workerInstall(data) {
  data = data || {};
  var existing = ScriptApp.getProjectTriggers().filter(function(t){ return t.getHandlerFunction() === GovOpsTenderParser_workerName(); });
  if (!existing.length) ScriptApp.newTrigger(GovOpsTenderParser_workerName()).timeBased().everyMinutes(Number(data.everyMinutes || 10)).create();
  return GovOpsTenderParser_success('標案解析 Worker 已安裝。', { installed: true, worker: GovOpsTenderParser_workerName() });
}

function GovOpsTenderParser_workerTrigger() { return GovOpsTenderParser_workerRun({ tenantId: 'TENANT-DEMO', limit: 3, auto: true }); }

function GovOpsTenderParserResult_query(data) {
  data = data || {};
  GovOpsTenderParser_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderParser_resultSheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderParser_success('標案文件解析結果查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderParser_buildResult(row) {
  var type = String(row.文件類型 || '其他文件');
  return {
    解析ID: 'TPR-' + Utilities.getUuid().slice(0, 8),
    tenantId: row.tenantId || 'TENANT-DEMO',
    文件ID: row.文件ID || '',
    標案ID: row.標案ID || '',
    文件類型: type,
    原文摘要: GovOpsTenderParser_summaryByType(type, row),
    關鍵條款: GovOpsTenderParser_keyClause(type),
    資格條件: GovOpsTenderParser_qualification(type),
    評選標準: GovOpsTenderParser_evaluation(type),
    工作項目: GovOpsTenderParser_workItems(type),
    交付成果: GovOpsTenderParser_deliverables(type),
    驗收方式: GovOpsTenderParser_acceptance(type),
    請款條件: GovOpsTenderParser_payment(type),
    罰則條款: GovOpsTenderParser_penalty(type),
    風險提醒: GovOpsTenderParser_risk(type),
    建立時間: GovOpsTenderParser_now(),
    更新時間: GovOpsTenderParser_now(),
    userId: row.userId || '',
    備註: '本版為文件類型導向解析骨架；待接全文抽取後升級為本案內容解析。'
  };
}

function GovOpsTenderParser_summaryByType(type, row) { return '文件「' + (row.檔案名稱 || row.文件ID || '') + '」已依文件類型「' + type + '」建立解析骨架。'; }
function GovOpsTenderParser_keyClause(type) { return type === '契約草案' ? '需檢查履約期限、違約、請款、驗收與保證金條款。' : '需依本案文件逐項抽取關鍵條款。'; }
function GovOpsTenderParser_qualification(type) { return /投標須知|招標公告/.test(type) ? '需確認廠商資格、證照、實績、聲明書與應附文件。' : ''; }
function GovOpsTenderParser_evaluation(type) { return /評選/.test(type) ? '需抽取評選項目、配分、簡報規則與加分重點。' : ''; }
function GovOpsTenderParser_workItems(type) { return /工作說明|需求|規格/.test(type) ? '需抽取工作內容、服務對象、場次、期程、人力與執行方法。' : ''; }
function GovOpsTenderParser_deliverables(type) { return /工作說明|需求|規格|契約/.test(type) ? '需抽取成果報告、名冊、照片、教材、影音、系統資料等交付物。' : ''; }
function GovOpsTenderParser_acceptance(type) { return /契約|工作說明|需求/.test(type) ? '需抽取驗收方式、驗收文件、審查流程與補正期限。' : ''; }
function GovOpsTenderParser_payment(type) { return /契約|標價|經費|預算/.test(type) ? '需抽取請款期程、請款文件、可請款項目與不可請款風險。' : ''; }
function GovOpsTenderParser_penalty(type) { return /契約/.test(type) ? '需抽取逾期、缺件、履約不完全與違約扣款條款。' : ''; }
function GovOpsTenderParser_risk(type) { return '本文件需與招標公告、投標須知、評選須知、工作說明書、契約與標價清單交叉比對。'; }

function GovOpsTenderParser_updateDocument(row, status) {
  try {
    if (typeof GovOpsTenderDocument_updateStatus === 'function' && row.文件ID) {
      GovOpsTenderDocument_updateStatus({ tenantId: row.tenantId, 文件ID: row.文件ID, 解析狀態: status });
    }
  } catch (err) {}
}

function GovOpsTenderParser_summary(rows) {
  var out = { total: rows.length, waiting: 0, processing: 0, done: 0, retry: 0, failed: 0 };
  rows.forEach(function(r){
    var s = String(r.解析狀態 || '');
    if (s === '等待解析') out.waiting++;
    else if (s === '解析中') out.processing++;
    else if (s === '已解析') out.done++;
    else if (s === '重試中') out.retry++;
    else if (s === '解析失敗') out.failed++;
  });
  return out;
}

function GovOpsTenderParser_exists(tenantId, docId) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderParser_queueSheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.文件ID || '') === String(docId); });
  } catch (err) { return false; }
}

function GovOpsTenderParser_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderParser_Query() { return GovOpsTenderParser_query({ tenantId: 'TENANT-DEMO' }); }
