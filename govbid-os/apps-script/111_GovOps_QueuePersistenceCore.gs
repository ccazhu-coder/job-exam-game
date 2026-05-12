/* GovOps OS｜Queue Persistence Core v1
 * 正式上線營運級骨架：持久化佇列。
 * 目的：避免 Apps Script Timeout 或暫時錯誤造成任務遺失，支援 priority、lock、retry、dead-letter。
 */

function handleGovOpsQueuePersistenceAction(action, data) {
  data = data || {};
  try {
    if (action === 'queue.persist.enqueue' || action === '建立持久化佇列任務') return GovOpsQueuePersist_enqueue(data);
    if (action === 'queue.persist.claim' || action === '領取持久化佇列任務') return GovOpsQueuePersist_claim(data);
    if (action === 'queue.persist.complete' || action === '完成持久化佇列任務') return GovOpsQueuePersist_complete(data);
    if (action === 'queue.persist.fail' || action === '標記持久化佇列失敗') return GovOpsQueuePersist_failJob(data);
    if (action === 'queue.persist.retry' || action === '重試持久化佇列任務') return GovOpsQueuePersist_retry(data);
    if (action === 'queue.persist.query' || action === '查詢持久化佇列') return GovOpsQueuePersist_query(data);
    if (action === 'queue.persist.health' || action === '持久化佇列健康檢查') return GovOpsQueuePersist_health(data);
    return null;
  } catch (err) {
    if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write('QUEUE_PERSIST_ERROR', action, data, 'fail', String(err));
    return GovOpsQueuePersist_fail('持久化佇列暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_QUEUE_PERSIST = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsQueuePersistenceAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_QUEUE_PERSIST(action, data);
  };
}

function GovOpsQueuePersist_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsQueuePersist_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsQueuePersist_nowDate() { return new Date(); }
function GovOpsQueuePersist_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsQueuePersist_sheetQueue() { return '98_持久化佇列'; }
function GovOpsQueuePersist_sheetDLQ() { return '99_持久化死信佇列'; }

function GovOpsQueuePersist_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsQueuePersist_sheetQueue(), ['jobId','tenantId','queueName','jobType','priority','status','payload','attempts','maxAttempts','availableAt','lockedBy','lockedUntil','lastError','result','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsQueuePersist_sheetDLQ(), ['deadId','jobId','tenantId','queueName','jobType','payload','attempts','lastError','failedAt','建立時間','userId','備註']);
}

function GovOpsQueuePersist_enqueue(data) {
  data = data || {};
  GovOpsQueuePersist_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var row = {
    jobId: data.jobId || 'JOB-' + Utilities.getUuid().slice(0, 10),
    tenantId: tenantId,
    queueName: data.queueName || data.佇列名稱 || 'default',
    jobType: data.jobType || data.任務類型 || 'generic',
    priority: Number(data.priority || data.優先級 || 100),
    status: 'queued',
    payload: typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || data.data || {}),
    attempts: Number(data.attempts || 0),
    maxAttempts: Number(data.maxAttempts || 3),
    availableAt: data.availableAt || GovOpsQueuePersist_now(),
    lockedBy: '',
    lockedUntil: '',
    lastError: '',
    result: '',
    建立時間: GovOpsQueuePersist_now(),
    更新時間: GovOpsQueuePersist_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  GovOpsProduct_append(GovOpsQueuePersist_sheetQueue(), row);
  if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write('QUEUE_ENQUEUE', 'queue.persist.enqueue', row, 'success', '持久化佇列任務已建立');
  return GovOpsQueuePersist_success('持久化佇列任務已建立。', row);
}

function GovOpsQueuePersist_claim(data) {
  data = data || {};
  GovOpsQueuePersist_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var queueName = data.queueName || data.佇列名稱 || 'default';
  var workerId = data.workerId || data.工作者ID || 'worker-' + Utilities.getUuid().slice(0, 6);
  var limit = Number(data.limit || 1);
  var lockMinutes = Number(data.lockMinutes || 5);
  var now = GovOpsQueuePersist_nowDate();
  var rows = GovOpsProduct_readRows(GovOpsQueuePersist_sheetQueue()).filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (String(r.queueName || '') !== String(queueName)) return false;
    if (String(r.status || '') !== 'queued' && String(r.status || '') !== 'retry') return false;
    if (GovOpsQueuePersist_parseDate(r.availableAt) > now) return false;
    return true;
  }).sort(function(a,b){ return Number(a.priority || 100) - Number(b.priority || 100); }).slice(0, limit);
  var claimed = [];
  rows.forEach(function(r){
    var patch = { status: 'running', lockedBy: workerId, lockedUntil: GovOpsQueuePersist_formatDate(new Date(now.getTime() + lockMinutes * 60000)), 更新時間: GovOpsQueuePersist_now() };
    GovOpsProduct_update(GovOpsQueuePersist_sheetQueue(), r._row, patch);
    claimed.push(Object.assign({}, r, patch));
  });
  return GovOpsQueuePersist_success('持久化佇列任務已領取。', { workerId: workerId, total: claimed.length, jobs: claimed });
}

function GovOpsQueuePersist_complete(data) {
  data = data || {};
  GovOpsQueuePersist_ensureSheets();
  var job = GovOpsQueuePersist_findJob(data.tenantId || 'TENANT-DEMO', data.jobId || '');
  if (!job) return GovOpsQueuePersist_fail('找不到佇列任務。');
  var patch = { status: 'completed', result: typeof data.result === 'string' ? data.result : JSON.stringify(data.result || {}), lockedBy: '', lockedUntil: '', 更新時間: GovOpsQueuePersist_now() };
  GovOpsProduct_update(GovOpsQueuePersist_sheetQueue(), job._row, patch);
  if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write('QUEUE_COMPLETE', 'queue.persist.complete', Object.assign({}, job, patch), 'success', '佇列任務完成');
  return GovOpsQueuePersist_success('持久化佇列任務已完成。', Object.assign({}, job, patch));
}

function GovOpsQueuePersist_failJob(data) {
  data = data || {};
  GovOpsQueuePersist_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var job = GovOpsQueuePersist_findJob(tenantId, data.jobId || '');
  if (!job) return GovOpsQueuePersist_fail('找不到佇列任務。');
  var attempts = Number(job.attempts || 0) + 1;
  var maxAttempts = Number(job.maxAttempts || 3);
  var err = data.error || data.lastError || '任務執行失敗';
  if (attempts >= maxAttempts) {
    var dlq = { deadId: 'DLQ-' + Utilities.getUuid().slice(0, 10), jobId: job.jobId, tenantId: tenantId, queueName: job.queueName, jobType: job.jobType, payload: job.payload, attempts: attempts, lastError: err, failedAt: GovOpsQueuePersist_now(), 建立時間: GovOpsQueuePersist_now(), userId: data.userId || job.userId || '', 備註: '已達最大重試次數' };
    GovOpsProduct_append(GovOpsQueuePersist_sheetDLQ(), dlq);
    GovOpsProduct_update(GovOpsQueuePersist_sheetQueue(), job._row, { status: 'dead', attempts: attempts, lastError: err, lockedBy: '', lockedUntil: '', 更新時間: GovOpsQueuePersist_now() });
    return GovOpsQueuePersist_success('任務已進入死信佇列。', { job: job, dead: dlq });
  }
  var next = new Date(GovOpsQueuePersist_nowDate().getTime() + Math.pow(2, attempts) * 60000);
  var patch = { status: 'retry', attempts: attempts, availableAt: GovOpsQueuePersist_formatDate(next), lastError: err, lockedBy: '', lockedUntil: '', 更新時間: GovOpsQueuePersist_now() };
  GovOpsProduct_update(GovOpsQueuePersist_sheetQueue(), job._row, patch);
  return GovOpsQueuePersist_success('任務已排入重試。', Object.assign({}, job, patch));
}

function GovOpsQueuePersist_retry(data) {
  data = data || {};
  var job = GovOpsQueuePersist_findJob(data.tenantId || 'TENANT-DEMO', data.jobId || '');
  if (!job) return GovOpsQueuePersist_fail('找不到佇列任務。');
  var patch = { status: 'retry', availableAt: GovOpsQueuePersist_now(), lockedBy: '', lockedUntil: '', 更新時間: GovOpsQueuePersist_now(), lastError: '' };
  GovOpsProduct_update(GovOpsQueuePersist_sheetQueue(), job._row, patch);
  return GovOpsQueuePersist_success('任務已手動重試。', Object.assign({}, job, patch));
}

function GovOpsQueuePersist_query(data) {
  data = data || {};
  GovOpsQueuePersist_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.queueName || '').trim();
  var rows = GovOpsProduct_readRows(GovOpsQueuePersist_sheetQueue()).filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    return !keyword || JSON.stringify(r).indexOf(keyword) >= 0;
  });
  return GovOpsQueuePersist_success('持久化佇列查詢完成。', { total: rows.length, summary: GovOpsQueuePersist_count(rows), rows: rows.slice(-500).reverse() });
}

function GovOpsQueuePersist_health(data) {
  var q = GovOpsQueuePersist_query(data).data;
  var dlq = [];
  try { dlq = GovOpsProduct_readRows(GovOpsQueuePersist_sheetDLQ()).filter(function(r){ return String(r.tenantId || '') === String(data.tenantId || 'TENANT-DEMO'); }); } catch (err) {}
  return GovOpsQueuePersist_success('持久化佇列健康檢查完成。', Object.assign({}, q.summary, { deadLetter: dlq.length }));
}

function GovOpsQueuePersist_findJob(tenantId, jobId) { try { return GovOpsProduct_readRows(GovOpsQueuePersist_sheetQueue()).find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.jobId || '') === String(jobId); }) || null; } catch (err) { return null; } }
function GovOpsQueuePersist_count(rows) { var out = { queued: 0, running: 0, retry: 0, completed: 0, dead: 0 }; rows.forEach(function(r){ var s = r.status || 'queued'; out[s] = (out[s] || 0) + 1; }); return out; }
function GovOpsQueuePersist_parseDate(s) { if (!s) return new Date(0); var d = new Date(String(s).replace(/\//g,'-')); return isNaN(d.getTime()) ? new Date(0) : d; }
function GovOpsQueuePersist_formatDate(d) { return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
