/* GovOps OS｜Tender OCR Queue Worker v1
 * 目的：建立穩定 OCR 佇列，不在上傳時同步解析，改由 Worker 分段處理 OCR 狀態。
 * 注意：本版先建立 OCR Queue 狀態機與穩定架構；實際 OCR 文字抽取需再接 Document Parser / Drive OCR Pipeline。
 */

function handleGovOpsTenderOCRQueueAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.ocr.enqueue' || action === '加入標案OCR佇列') return GovOpsTenderOCR_enqueue(data);
    if (action === 'tender.ocr.query' || action === '查詢標案OCR佇列') return GovOpsTenderOCR_query(data);
    if (action === 'tender.ocr.worker.run' || action === '執行標案OCRWorker') return GovOpsTenderOCR_workerRun(data);
    if (action === 'tender.ocr.worker.install' || action === '安裝標案OCRWorker') return GovOpsTenderOCR_workerInstall(data);
    if (action === 'tender.ocr.worker.health' || action === '標案OCRWorker健康檢查') return GovOpsTenderOCR_workerHealth(data);
    return null;
  } catch (err) {
    GovOpsTenderOCR_logError('handleGovOpsTenderOCRQueueAction', err, data);
    return GovOpsTenderOCR_fail('標案 OCR 佇列暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_OCR = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderOCRQueueAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_OCR(action, data);
  };
}

function GovOpsTenderOCR_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderOCR_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderOCR_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderOCR_sheetName() { return '56_標案OCR佇列'; }
function GovOpsTenderOCR_workerName() { return 'GovOpsTenderOCR_workerTrigger'; }

function GovOpsTenderOCR_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderOCR_sheetName(), ['OCRID','tenantId','文件ID','標案ID','標案名稱','文件類型','檔案名稱','DriveFileID','DriveURL','OCR狀態','OCR文字長度','重試次數','錯誤訊息','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderOCR_enqueue(data) {
  data = data || {};
  GovOpsTenderOCR_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var rows = [];
  if (data.文件ID || data.documentId) {
    rows = [data];
  } else if (typeof GovOpsTenderDocument_query === 'function') {
    rows = GovOpsTenderDocument_query({ tenantId: tenantId, keyword: data.keyword || data.標案ID || '' }).data.rows || [];
  }
  var created = 0, skipped = 0;
  rows.forEach(function(doc) {
    var fileId = doc.DriveFileID || data.DriveFileID || '';
    var docId = doc.文件ID || data.文件ID || data.documentId || '';
    if (!docId && !fileId) return;
    if (GovOpsTenderOCR_exists(tenantId, docId, fileId)) { skipped++; return; }
    var row = {
      OCRID: 'TOCR-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      文件ID: docId,
      標案ID: doc.標案ID || data.標案ID || '',
      標案名稱: doc.標案名稱 || data.標案名稱 || '',
      文件類型: doc.文件類型 || data.文件類型 || '',
      檔案名稱: doc.檔案名稱 || data.檔案名稱 || '',
      DriveFileID: fileId,
      DriveURL: doc.DriveURL || data.DriveURL || '',
      OCR狀態: '等待OCR',
      OCR文字長度: 0,
      重試次數: 0,
      錯誤訊息: '',
      建立時間: GovOpsTenderOCR_now(),
      更新時間: GovOpsTenderOCR_now(),
      userId: data.userId || '',
      備註: 'OCR 佇列登錄，實際文字抽取由後續 Parser/OCR pipeline 執行。'
    };
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderOCR_sheetName(), row);
    created++;
  });
  return GovOpsTenderOCR_success('標案 OCR 佇列已建立。', { created: created, skipped: skipped });
}

function GovOpsTenderOCR_query(data) {
  data = data || {};
  GovOpsTenderOCR_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderOCR_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderOCR_success('標案 OCR 佇列查詢完成。', { total: rows.length, summary: GovOpsTenderOCR_summary(rows), rows: rows.slice(0, 300) });
}

function GovOpsTenderOCR_workerRun(data) {
  data = data || {};
  GovOpsTenderOCR_ensureSheet();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return GovOpsTenderOCR_fail('OCR Worker 正在執行中。');
  try {
    var tenantId = data.tenantId || 'TENANT-DEMO';
    var limit = Math.min(Number(data.limit || 3), 5);
    var rows = GovOpsProduct_readRows(GovOpsTenderOCR_sheetName()).filter(function(row){
      return String(row.tenantId || '') === String(tenantId) && ['等待OCR','重試中'].indexOf(String(row.OCR狀態 || '')) >= 0;
    }).slice(0, limit);
    var processed = 0, failed = 0;
    rows.forEach(function(row){
      try {
        GovOpsProduct_update(GovOpsTenderOCR_sheetName(), row._row, { OCR狀態: 'OCR處理中', 更新時間: GovOpsTenderOCR_now() });
        var textLength = GovOpsTenderOCR_probeFile(row);
        GovOpsProduct_update(GovOpsTenderOCR_sheetName(), row._row, { OCR狀態: 'OCR待解析', OCR文字長度: textLength, 錯誤訊息: '', 更新時間: GovOpsTenderOCR_now() });
        GovOpsTenderOCR_updateDocument(row, 'OCR待解析');
        processed++;
      } catch (err) {
        var retry = Number(row.重試次數 || 0) + 1;
        GovOpsProduct_update(GovOpsTenderOCR_sheetName(), row._row, { OCR狀態: retry >= 3 ? 'OCR失敗' : '重試中', 重試次數: retry, 錯誤訊息: String(err), 更新時間: GovOpsTenderOCR_now() });
        failed++;
      }
    });
    return GovOpsTenderOCR_success('標案 OCR Worker 執行完成。', { processed: processed, failed: failed, limit: limit });
  } finally {
    lock.releaseLock();
  }
}

function GovOpsTenderOCR_workerInstall(data) {
  data = data || {};
  var existing = ScriptApp.getProjectTriggers().filter(function(t){ return t.getHandlerFunction() === GovOpsTenderOCR_workerName(); });
  if (!existing.length) ScriptApp.newTrigger(GovOpsTenderOCR_workerName()).timeBased().everyMinutes(Number(data.everyMinutes || 10)).create();
  return GovOpsTenderOCR_success('標案 OCR Worker 已安裝。', { installed: true, worker: GovOpsTenderOCR_workerName() });
}

function GovOpsTenderOCR_workerTrigger() {
  return GovOpsTenderOCR_workerRun({ tenantId: 'TENANT-DEMO', limit: 3, auto: true });
}

function GovOpsTenderOCR_workerHealth(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var triggers = ScriptApp.getProjectTriggers().filter(function(t){ return t.getHandlerFunction() === GovOpsTenderOCR_workerName(); });
  var q = GovOpsTenderOCR_query({ tenantId: tenantId }).data;
  return GovOpsTenderOCR_success('標案 OCR Worker 健康檢查完成。', { installed: triggers.length > 0, triggerCount: triggers.length, queue: q.summary || {} });
}

function GovOpsTenderOCR_probeFile(row) {
  if (!row.DriveFileID && !row.DriveURL && !row.檔案名稱) throw new Error('缺少檔案資訊');
  try {
    if (row.DriveFileID) {
      var f = DriveApp.getFileById(row.DriveFileID);
      return String(f.getName() || '').length;
    }
  } catch (err) {
    throw new Error('Drive 檔案讀取失敗：' + err);
  }
  return String(row.檔案名稱 || row.DriveURL || '').length;
}

function GovOpsTenderOCR_updateDocument(row, status) {
  try {
    if (typeof GovOpsTenderDocument_updateStatus === 'function' && row.文件ID) {
      GovOpsTenderDocument_updateStatus({ tenantId: row.tenantId, 文件ID: row.文件ID, OCR狀態: status, 解析狀態: '待解析' });
    }
  } catch (err) {}
}

function GovOpsTenderOCR_summary(rows) {
  var out = { total: rows.length, waiting: 0, processing: 0, ready: 0, retry: 0, failed: 0 };
  rows.forEach(function(r){
    var s = String(r.OCR狀態 || '');
    if (s === '等待OCR') out.waiting++;
    else if (s === 'OCR處理中') out.processing++;
    else if (s === 'OCR待解析') out.ready++;
    else if (s === '重試中') out.retry++;
    else if (s === 'OCR失敗') out.failed++;
  });
  return out;
}

function GovOpsTenderOCR_exists(tenantId, docId, fileId) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderOCR_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && ((docId && String(r.文件ID || '') === String(docId)) || (fileId && String(r.DriveFileID || '') === String(fileId))); });
  } catch (err) { return false; }
}

function GovOpsTenderOCR_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderOCR_Query() { return GovOpsTenderOCR_query({ tenantId: 'TENANT-DEMO' }); }
