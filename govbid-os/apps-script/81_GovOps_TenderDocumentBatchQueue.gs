/* GovOps OS｜Tender Document Batch Queue v1
 * 目的：讓大量領標文件上傳改走批次任務 + Queue + Lock + Retry，避免同步處理造成 GAS/Sheets 不穩。
 */

function handleGovOpsTenderDocumentBatchQueueAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.document.batchCreate' || action === '建立標案文件批次') return GovOpsTenderDocBatch_create(data);
    if (action === 'tender.document.batchStatus' || action === '查詢標案文件批次') return GovOpsTenderDocBatch_status(data);
    if (action === 'tender.document.queueNext' || action === '處理標案文件佇列') return GovOpsTenderDocQueue_processNext(data);
    if (action === 'tender.document.queueRetryFailed' || action === '重試失敗文件佇列') return GovOpsTenderDocQueue_retryFailed(data);
    if (action === 'tender.document.queueHealth' || action === '標案文件佇列健康檢查') return GovOpsTenderDocQueue_health(data);
    return null;
  } catch (err) {
    GovOpsTenderDocQueue_logError('handleGovOpsTenderDocumentBatchQueueAction', err, data);
    return GovOpsTenderDocQueue_fail('標案文件批次佇列暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DOC_BATCH_QUEUE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderDocumentBatchQueueAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DOC_BATCH_QUEUE(action, data);
  };
}

function GovOpsTenderDocQueue_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderDocQueue_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderDocQueue_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderDocBatch_sheetName() { return '51_標案文件批次任務'; }
function GovOpsTenderDocQueue_sheetName() { return '52_標案文件處理佇列'; }

function GovOpsTenderDocBatch_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderDocBatch_sheetName(), ['批次ID','tenantId','標案ID','標案名稱','批次名稱','總文件數','已登錄數','已解析數','失敗數','批次狀態','建立時間','更新時間','userId','備註']);
    GovOpsProduct_ensureSheet(GovOpsTenderDocQueue_sheetName(), ['佇列ID','tenantId','批次ID','文件ID','標案ID','標案名稱','文件類型','檔案名稱','DriveFileID','DriveURL','IdempotencyKey','處理階段','處理狀態','重試次數','錯誤訊息','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderDocBatch_create(data) {
  data = data || {};
  GovOpsTenderDocBatch_ensureSheets();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return GovOpsTenderDocQueue_fail('系統正在處理其他上傳批次，請稍後再試。');
  try {
    var tenantId = data.tenantId || 'TENANT-DEMO';
    var files = GovOpsTenderDocBatch_normalizeFiles(data.files || data.文件清單 || []);
    if (!files.length) return GovOpsTenderDocQueue_fail('請提供文件清單 files。');
    var batchId = 'TDB-' + Utilities.getUuid().slice(0, 8);
    var batch = {
      批次ID: batchId,
      tenantId: tenantId,
      標案ID: data.標案ID || data.tenderId || '',
      標案名稱: data.標案名稱 || '',
      批次名稱: data.批次名稱 || data.batchName || '領標文件批次-' + GovOpsTenderDocQueue_now(),
      總文件數: files.length,
      已登錄數: 0,
      已解析數: 0,
      失敗數: 0,
      批次狀態: '等待處理',
      建立時間: GovOpsTenderDocQueue_now(),
      更新時間: GovOpsTenderDocQueue_now(),
      userId: data.userId || '',
      備註: data.備註 || '大量上傳採 Queue 分批處理，避免同步超時。'
    };
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderDocBatch_sheetName(), batch);
    var created = 0, skipped = 0;
    files.forEach(function(file) {
      var driveUrl = file.DriveURL || file.fileUrl || file.url || '';
      var driveId = file.DriveFileID || file.fileId || GovOpsTenderDocBatch_extractDriveId(driveUrl);
      var fileName = file.檔案名稱 || file.fileName || file.name || '';
      var key = GovOpsTenderDocBatch_key(tenantId, batch.標案ID, driveId, driveUrl, fileName);
      if (GovOpsTenderDocBatch_queueExists(key)) { skipped++; return; }
      var queue = {
        佇列ID: 'TDQ-' + Utilities.getUuid().slice(0, 8),
        tenantId: tenantId,
        批次ID: batchId,
        文件ID: '',
        標案ID: batch.標案ID,
        標案名稱: batch.標案名稱,
        文件類型: file.文件類型 || file.documentType || GovOpsTenderDocBatch_guessType(fileName || driveUrl),
        檔案名稱: fileName,
        DriveFileID: driveId,
        DriveURL: driveUrl,
        IdempotencyKey: key,
        處理階段: '登錄',
        處理狀態: '等待處理',
        重試次數: 0,
        錯誤訊息: '',
        建立時間: GovOpsTenderDocQueue_now(),
        更新時間: GovOpsTenderDocQueue_now(),
        userId: data.userId || '',
        備註: ''
      };
      if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderDocQueue_sheetName(), queue);
      created++;
    });
    GovOpsTenderDocBatch_updateBatchCounts(batchId, tenantId);
    return GovOpsTenderDocQueue_success('標案文件批次已建立，將由佇列分批處理。', { batchId: batchId, total: files.length, queued: created, skipped: skipped });
  } finally {
    lock.releaseLock();
  }
}

function GovOpsTenderDocBatch_status(data) {
  data = data || {};
  GovOpsTenderDocBatch_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var batchId = data.批次ID || data.batchId || '';
  var batches = GovOpsProduct_readRows(GovOpsTenderDocBatch_sheetName()).filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!batchId) return true;
    return String(row.批次ID || '') === String(batchId);
  });
  var queues = GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName()).filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!batchId) return true;
    return String(row.批次ID || '') === String(batchId);
  });
  return GovOpsTenderDocQueue_success('標案文件批次狀態查詢完成。', { batches: batches, queueSummary: GovOpsTenderDocQueue_summary(queues), queueRows: queues.slice(0, 200) });
}

function GovOpsTenderDocQueue_processNext(data) {
  data = data || {};
  GovOpsTenderDocBatch_ensureSheets();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return GovOpsTenderDocQueue_fail('佇列正在處理中，請稍後再試。');
  try {
    var tenantId = data.tenantId || 'TENANT-DEMO';
    var limit = Math.min(Number(data.limit || 5), 10);
    var batchId = data.批次ID || data.batchId || '';
    var rows = GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName()).filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (batchId && String(row.批次ID || '') !== String(batchId)) return false;
      return String(row.處理狀態 || '') === '等待處理' || String(row.處理狀態 || '') === '重試中';
    }).slice(0, limit);
    var processed = 0, failed = 0;
    rows.forEach(function(q) {
      try {
        GovOpsProduct_update(GovOpsTenderDocQueue_sheetName(), q._row, { 處理狀態: '處理中', 更新時間: GovOpsTenderDocQueue_now() });
        var docResult = GovOpsTenderDocument_register({
          tenantId: q.tenantId,
          userId: q.userId,
          標案ID: q.標案ID,
          標案名稱: q.標案名稱,
          文件類型: q.文件類型,
          檔案名稱: q.檔案名稱,
          DriveFileID: q.DriveFileID,
          DriveURL: q.DriveURL,
          備註: '由批次佇列登錄：' + q.批次ID
        });
        if (!docResult || !docResult.success) throw new Error(docResult && docResult.message || '文件登錄失敗');
        GovOpsProduct_update(GovOpsTenderDocQueue_sheetName(), q._row, { 文件ID: docResult.data.文件ID || '', 處理狀態: '已完成', 處理階段: '待解析', 錯誤訊息: '', 更新時間: GovOpsTenderDocQueue_now() });
        processed++;
      } catch (err) {
        failed++;
        var retry = Number(q.重試次數 || 0) + 1;
        GovOpsProduct_update(GovOpsTenderDocQueue_sheetName(), q._row, { 處理狀態: retry >= 3 ? '失敗' : '重試中', 重試次數: retry, 錯誤訊息: String(err), 更新時間: GovOpsTenderDocQueue_now() });
      }
    });
    GovOpsTenderDocBatch_updateBatchCounts(batchId, tenantId);
    return GovOpsTenderDocQueue_success('標案文件佇列處理完成。', { processed: processed, failed: failed, limit: limit });
  } finally {
    lock.releaseLock();
  }
}

function GovOpsTenderDocQueue_retryFailed(data) {
  data = data || {};
  GovOpsTenderDocBatch_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var rows = GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName()).filter(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.處理狀態 || '') === '失敗'; });
  var maxRetry = Number(data.maxRetry || 5);
  var count = 0;
  rows.forEach(function(row){
    if (Number(row.重試次數 || 0) < maxRetry) {
      GovOpsProduct_update(GovOpsTenderDocQueue_sheetName(), row._row, { 處理狀態: '重試中', 錯誤訊息: '', 更新時間: GovOpsTenderDocQueue_now() });
      count++;
    }
  });
  return GovOpsTenderDocQueue_success('失敗佇列已重新排入處理。', { retryQueued: count });
}

function GovOpsTenderDocQueue_health(data) {
  data = data || {};
  GovOpsTenderDocBatch_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var rows = GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName()).filter(function(row){ return String(row.tenantId || '') === String(tenantId); });
  var summary = GovOpsTenderDocQueue_summary(rows);
  var status = summary.failed > 0 ? 'warning' : (summary.waiting > 50 ? 'busy' : 'healthy');
  return GovOpsTenderDocQueue_success('標案文件佇列健康檢查完成。', { status: status, summary: summary });
}

function GovOpsTenderDocQueue_summary(rows) {
  var out = { total: rows.length, waiting: 0, processing: 0, done: 0, retry: 0, failed: 0 };
  rows.forEach(function(row){
    var s = String(row.處理狀態 || '');
    if (s === '等待處理') out.waiting++;
    else if (s === '處理中') out.processing++;
    else if (s === '已完成') out.done++;
    else if (s === '重試中') out.retry++;
    else if (s === '失敗') out.failed++;
  });
  return out;
}

function GovOpsTenderDocBatch_updateBatchCounts(batchId, tenantId) {
  try {
    if (!batchId) return;
    var batches = GovOpsProduct_readRows(GovOpsTenderDocBatch_sheetName());
    var batch = batches.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.批次ID || '') === String(batchId); });
    if (!batch) return;
    var queues = GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName()).filter(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.批次ID || '') === String(batchId); });
    var summary = GovOpsTenderDocQueue_summary(queues);
    var status = summary.failed > 0 ? '部分失敗' : (summary.done >= summary.total && summary.total > 0 ? '登錄完成' : '處理中');
    GovOpsProduct_update(GovOpsTenderDocBatch_sheetName(), batch._row, { 已登錄數: summary.done, 失敗數: summary.failed, 批次狀態: status, 更新時間: GovOpsTenderDocQueue_now() });
  } catch (err) {}
}

function GovOpsTenderDocBatch_normalizeFiles(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try { var parsed = JSON.parse(input); if (Array.isArray(parsed)) return parsed; } catch (e) {}
    return input.split('\n').map(function(line){ return line.trim(); }).filter(Boolean).map(function(url){ return { DriveURL: url }; });
  }
  return [];
}

function GovOpsTenderDocBatch_key(tenantId, tenderId, driveId, driveUrl, fileName) {
  return [tenantId || '', tenderId || '', driveId || driveUrl || fileName || ''].join('|');
}

function GovOpsTenderDocBatch_queueExists(key) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName());
    return rows.some(function(r){ return String(r.IdempotencyKey || '') === String(key); });
  } catch (err) { return false; }
}

function GovOpsTenderDocBatch_extractDriveId(url) {
  var text = String(url || '');
  var m = text.match(/\/d\/([a-zA-Z0-9_-]+)/) || text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

function GovOpsTenderDocBatch_guessType(text) {
  if (typeof GovOpsTenderDocument_guessType === 'function') return GovOpsTenderDocument_guessType(text);
  text = String(text || '');
  if (/公告/.test(text)) return '招標公告';
  if (/投標須知/.test(text)) return '投標須知';
  if (/評選/.test(text)) return '評選須知';
  if (/工作說明|需求|規格/.test(text)) return '工作說明書';
  if (/契約/.test(text)) return '契約草案';
  if (/標價|經費|預算/.test(text)) return '標價清單';
  return '其他文件';
}

function GovOpsTenderDocQueue_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderDocBatch_Create() { return GovOpsTenderDocBatch_create({ tenantId: 'TENANT-DEMO', 標案ID: 'TEST', 標案名稱: '測試標案', files: [{檔案名稱:'招標公告.pdf'}, {檔案名稱:'工作說明書.pdf'}] }); }
