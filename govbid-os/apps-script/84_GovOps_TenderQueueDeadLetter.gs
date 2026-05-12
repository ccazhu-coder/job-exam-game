/* GovOps OS｜Tender Queue Dead Letter v1
 * 目的：將重試超過上限或人工判定不可處理的 Queue 項目移入死信箱，避免無限重試造成系統不穩。
 */

function handleGovOpsTenderQueueDeadLetterAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.queue.deadLetter.move' || action === '移入標案死信佇列') return GovOpsTenderDeadLetter_move(data);
    if (action === 'tender.queue.deadLetter.query' || action === '查詢標案死信佇列') return GovOpsTenderDeadLetter_query(data);
    if (action === 'tender.queue.deadLetter.resolve' || action === '處理標案死信佇列') return GovOpsTenderDeadLetter_resolve(data);
    if (action === 'tender.queue.deadLetter.requeue' || action === '重新排入標案佇列') return GovOpsTenderDeadLetter_requeue(data);
    if (action === 'tender.queue.deadLetter.sweep' || action === '掃描標案死信佇列') return GovOpsTenderDeadLetter_sweep(data);
    return null;
  } catch (err) {
    GovOpsTenderDeadLetter_logError('handleGovOpsTenderQueueDeadLetterAction', err, data);
    return GovOpsTenderDeadLetter_fail('標案死信佇列暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DEAD_LETTER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderQueueDeadLetterAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DEAD_LETTER(action, data);
  };
}

function GovOpsTenderDeadLetter_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderDeadLetter_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderDeadLetter_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderDeadLetter_sheetName() { return '55_標案文件死信佇列'; }

function GovOpsTenderDeadLetter_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderDeadLetter_sheetName(), ['死信ID','tenantId','批次ID','佇列ID','文件ID','標案ID','標案名稱','文件類型','檔案名稱','DriveFileID','DriveURL','IdempotencyKey','失敗階段','失敗原因','重試次數','處理狀態','人工處理人','人工處理結果','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderDeadLetter_move(data) {
  data = data || {};
  GovOpsTenderDeadLetter_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var queueId = data.佇列ID || data.queueId || '';
  var q = GovOpsTenderDeadLetter_findQueue(tenantId, queueId, data.IdempotencyKey || '');
  if (!q) return GovOpsTenderDeadLetter_fail('找不到要移入死信箱的 Queue。');
  if (GovOpsTenderDeadLetter_exists(q.IdempotencyKey || q.佇列ID)) return GovOpsTenderDeadLetter_success('此 Queue 已存在於死信箱。', q);
  var row = {
    死信ID: 'TDL-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    批次ID: q.批次ID || '',
    佇列ID: q.佇列ID || '',
    文件ID: q.文件ID || '',
    標案ID: q.標案ID || '',
    標案名稱: q.標案名稱 || '',
    文件類型: q.文件類型 || '',
    檔案名稱: q.檔案名稱 || '',
    DriveFileID: q.DriveFileID || '',
    DriveURL: q.DriveURL || '',
    IdempotencyKey: q.IdempotencyKey || '',
    失敗階段: q.處理階段 || '',
    失敗原因: data.失敗原因 || q.錯誤訊息 || '重試超過上限',
    重試次數: q.重試次數 || 0,
    處理狀態: '待人工處理',
    人工處理人: '',
    人工處理結果: '',
    建立時間: GovOpsTenderDeadLetter_now(),
    更新時間: GovOpsTenderDeadLetter_now(),
    userId: data.userId || q.userId || '',
    備註: data.備註 || ''
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderDeadLetter_sheetName(), row);
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderDocQueue_sheetName(), q._row, { 處理狀態: '死信', 更新時間: GovOpsTenderDeadLetter_now(), 錯誤訊息: row.失敗原因 });
  return GovOpsTenderDeadLetter_success('Queue 已移入死信箱。', row);
}

function GovOpsTenderDeadLetter_query(data) {
  data = data || {};
  GovOpsTenderDeadLetter_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderDeadLetter_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderDeadLetter_success('標案死信佇列查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderDeadLetter_resolve(data) {
  data = data || {};
  GovOpsTenderDeadLetter_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var deadId = data.死信ID || data.deadLetterId || '';
  if (!deadId) return GovOpsTenderDeadLetter_fail('請提供死信ID。');
  var rows = GovOpsProduct_readRows(GovOpsTenderDeadLetter_sheetName());
  var found = rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.死信ID || '') === String(deadId); });
  if (!found) return GovOpsTenderDeadLetter_fail('找不到死信紀錄。');
  var patch = {
    處理狀態: data.處理狀態 || '已處理',
    人工處理人: data.人工處理人 || data.userId || '',
    人工處理結果: data.人工處理結果 || data.result || '',
    更新時間: GovOpsTenderDeadLetter_now()
  };
  GovOpsProduct_update(GovOpsTenderDeadLetter_sheetName(), found._row, patch);
  return GovOpsTenderDeadLetter_success('死信紀錄已處理。', Object.assign({}, found, patch));
}

function GovOpsTenderDeadLetter_requeue(data) {
  data = data || {};
  GovOpsTenderDeadLetter_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var deadId = data.死信ID || data.deadLetterId || '';
  var rows = GovOpsProduct_readRows(GovOpsTenderDeadLetter_sheetName());
  var found = rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.死信ID || '') === String(deadId); });
  if (!found) return GovOpsTenderDeadLetter_fail('找不到死信紀錄。');
  var q = GovOpsTenderDeadLetter_findQueue(tenantId, found.佇列ID || '', found.IdempotencyKey || '');
  if (!q) return GovOpsTenderDeadLetter_fail('找不到原 Queue，無法重新排入。');
  GovOpsProduct_update(GovOpsTenderDocQueue_sheetName(), q._row, { 處理狀態: '重試中', 重試次數: 0, 錯誤訊息: '', 更新時間: GovOpsTenderDeadLetter_now() });
  GovOpsProduct_update(GovOpsTenderDeadLetter_sheetName(), found._row, { 處理狀態: '已重新排入', 人工處理人: data.userId || '', 人工處理結果: '重新排入 Queue', 更新時間: GovOpsTenderDeadLetter_now() });
  return GovOpsTenderDeadLetter_success('死信已重新排入 Queue。', { queueId: q.佇列ID, deadLetterId: deadId });
}

function GovOpsTenderDeadLetter_sweep(data) {
  data = data || {};
  GovOpsTenderDeadLetter_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var maxRetry = Number(data.maxRetry || 3);
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName()) : [];
  var moved = 0;
  rows.filter(function(row){
    return String(row.tenantId || '') === String(tenantId) && String(row.處理狀態 || '') === '失敗' && Number(row.重試次數 || 0) >= maxRetry;
  }).forEach(function(row){
    var r = GovOpsTenderDeadLetter_move({ tenantId: tenantId, 佇列ID: row.佇列ID, 失敗原因: row.錯誤訊息 || '重試超過上限', userId: data.userId || '' });
    if (r && r.success) moved++;
  });
  return GovOpsTenderDeadLetter_success('死信掃描完成。', { moved: moved, maxRetry: maxRetry });
}

function GovOpsTenderDeadLetter_findQueue(tenantId, queueId, key) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName());
    return rows.find(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (queueId && String(row.佇列ID || '') === String(queueId)) return true;
      if (key && String(row.IdempotencyKey || '') === String(key)) return true;
      return false;
    }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderDeadLetter_exists(key) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderDeadLetter_sheetName());
    return rows.some(function(row){ return String(row.IdempotencyKey || row.佇列ID || '') === String(key); });
  } catch (err) { return false; }
}

function GovOpsTenderDeadLetter_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderDeadLetter_Query() { return GovOpsTenderDeadLetter_query({ tenantId: 'TENANT-DEMO' }); }
