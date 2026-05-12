/* GovOps OS｜Tender Document Queue Runtime v1
 * 目的：讓領標文件 Queue 可穩定營運，支援 Trigger Worker、卡住任務釋放、健康檢查、自我修復。
 */

function handleGovOpsTenderDocumentQueueRuntimeAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.document.worker.install' || action === '安裝標案文件Worker') return GovOpsTenderDocWorker_install(data);
    if (action === 'tender.document.worker.uninstall' || action === '移除標案文件Worker') return GovOpsTenderDocWorker_uninstall(data);
    if (action === 'tender.document.worker.run' || action === '執行標案文件Worker') return GovOpsTenderDocWorker_run(data);
    if (action === 'tender.document.worker.health' || action === '標案文件Worker健康檢查') return GovOpsTenderDocWorker_health(data);
    if (action === 'tender.document.queue.releaseStuck' || action === '釋放卡住文件佇列') return GovOpsTenderDocQueue_releaseStuck(data);
    if (action === 'tender.document.queue.repair' || action === '修復標案文件佇列') return GovOpsTenderDocQueue_repair(data);
    return null;
  } catch (err) {
    GovOpsTenderDocRuntime_logError('handleGovOpsTenderDocumentQueueRuntimeAction', err, data);
    return GovOpsTenderDocRuntime_fail('標案文件佇列 Runtime 暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DOC_QUEUE_RUNTIME = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderDocumentQueueRuntimeAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DOC_QUEUE_RUNTIME(action, data);
  };
}

function GovOpsTenderDocRuntime_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderDocRuntime_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderDocRuntime_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderDocRuntime_workerName() { return 'GovOpsTenderDocWorker_trigger'; }
function GovOpsTenderDocRuntime_runtimeSheetName() { return '53_標案文件佇列Runtime'; }

function GovOpsTenderDocRuntime_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderDocRuntime_runtimeSheetName(), ['RuntimeID','tenantId','Worker名稱','Worker狀態','最近執行時間','最近處理數','最近失敗數','佇列等待數','佇列失敗數','卡住數','健康狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderDocWorker_install(data) {
  data = data || {};
  GovOpsTenderDocRuntime_ensureSheet();
  var existing = ScriptApp.getProjectTriggers().filter(function(t){ return t.getHandlerFunction() === GovOpsTenderDocRuntime_workerName(); });
  if (!existing.length) {
    ScriptApp.newTrigger(GovOpsTenderDocRuntime_workerName()).timeBased().everyMinutes(Number(data.everyMinutes || 5)).create();
  }
  GovOpsTenderDocRuntime_upsertRuntime(data.tenantId || 'TENANT-DEMO', { Worker狀態: '已安裝', 健康狀態: 'healthy', 備註: '每次執行少量 Queue，避免 GAS timeout。' });
  return GovOpsTenderDocRuntime_success('標案文件 Worker 已安裝。', { installed: true, worker: GovOpsTenderDocRuntime_workerName() });
}

function GovOpsTenderDocWorker_uninstall(data) {
  data = data || {};
  var count = 0;
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === GovOpsTenderDocRuntime_workerName()) {
      ScriptApp.deleteTrigger(t);
      count++;
    }
  });
  GovOpsTenderDocRuntime_upsertRuntime(data.tenantId || 'TENANT-DEMO', { Worker狀態: '已移除', 健康狀態: 'warning' });
  return GovOpsTenderDocRuntime_success('標案文件 Worker 已移除。', { removed: count });
}

function GovOpsTenderDocWorker_trigger() {
  return GovOpsTenderDocWorker_run({ tenantId: 'TENANT-DEMO', limit: 5, auto: true });
}

function GovOpsTenderDocWorker_run(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  GovOpsTenderDocRuntime_ensureSheet();
  var release = GovOpsTenderDocQueue_releaseStuck({ tenantId: tenantId, minutes: data.stuckMinutes || 20 });
  var result = typeof GovOpsTenderDocQueue_processNext === 'function'
    ? GovOpsTenderDocQueue_processNext({ tenantId: tenantId, limit: data.limit || 5 })
    : GovOpsTenderDocRuntime_fail('找不到 Queue processNext。');
  var health = typeof GovOpsTenderDocQueue_health === 'function'
    ? GovOpsTenderDocQueue_health({ tenantId: tenantId }).data
    : { status: 'unknown', summary: {} };
  var summary = health.summary || {};
  GovOpsTenderDocRuntime_upsertRuntime(tenantId, {
    Worker狀態: '執行完成',
    最近執行時間: GovOpsTenderDocRuntime_now(),
    最近處理數: result.data && result.data.processed || 0,
    最近失敗數: result.data && result.data.failed || 0,
    佇列等待數: summary.waiting || 0,
    佇列失敗數: summary.failed || 0,
    卡住數: release.data && release.data.released || 0,
    健康狀態: GovOpsTenderDocRuntime_healthStatus(summary),
    備註: 'Worker 分段處理完成。'
  });
  return GovOpsTenderDocRuntime_success('標案文件 Worker 執行完成。', { release: release.data || {}, process: result.data || {}, queueHealth: health });
}

function GovOpsTenderDocWorker_health(data) {
  data = data || {};
  GovOpsTenderDocRuntime_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var triggers = ScriptApp.getProjectTriggers().filter(function(t){ return t.getHandlerFunction() === GovOpsTenderDocRuntime_workerName(); });
  var queueHealth = typeof GovOpsTenderDocQueue_health === 'function' ? GovOpsTenderDocQueue_health({ tenantId: tenantId }).data : { status: 'unknown', summary: {} };
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderDocRuntime_runtimeSheetName()).filter(function(r){ return String(r.tenantId || '') === String(tenantId); }) : [];
  return GovOpsTenderDocRuntime_success('標案文件 Worker 健康檢查完成。', {
    installed: triggers.length > 0,
    triggerCount: triggers.length,
    queueHealth: queueHealth,
    runtimeRows: rows.slice(-5)
  });
}

function GovOpsTenderDocQueue_releaseStuck(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var minutes = Number(data.minutes || 20);
  if (typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return GovOpsTenderDocRuntime_fail('Queue adapter 不存在。');
  var rows = GovOpsProduct_readRows(GovOpsTenderDocQueue_sheetName()).filter(function(row){
    return String(row.tenantId || '') === String(tenantId) && String(row.處理狀態 || '') === '處理中';
  });
  var released = 0;
  rows.forEach(function(row){
    var updated = new Date(String(row.更新時間 || row.建立時間 || '').replace(/-/g, '/'));
    if (isNaN(updated.getTime())) return;
    var ageMin = (new Date().getTime() - updated.getTime()) / 60000;
    if (ageMin >= minutes) {
      var retry = Number(row.重試次數 || 0) + 1;
      GovOpsProduct_update(GovOpsTenderDocQueue_sheetName(), row._row, {
        處理狀態: retry >= 3 ? '失敗' : '重試中',
        重試次數: retry,
        錯誤訊息: 'Worker 超時卡住，自動釋放。',
        更新時間: GovOpsTenderDocRuntime_now()
      });
      released++;
    }
  });
  return GovOpsTenderDocRuntime_success('卡住佇列已釋放。', { released: released, minutes: minutes });
}

function GovOpsTenderDocQueue_repair(data) {
  data = data || {};
  if (typeof GovOpsTenderDocBatch_ensureSheets === 'function') GovOpsTenderDocBatch_ensureSheets();
  GovOpsTenderDocRuntime_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var released = GovOpsTenderDocQueue_releaseStuck({ tenantId: tenantId, minutes: data.minutes || 20 });
  var retried = typeof GovOpsTenderDocQueue_retryFailed === 'function'
    ? GovOpsTenderDocQueue_retryFailed({ tenantId: tenantId, maxRetry: data.maxRetry || 5 })
    : GovOpsTenderDocRuntime_fail('Retry function missing');
  var health = typeof GovOpsTenderDocQueue_health === 'function' ? GovOpsTenderDocQueue_health({ tenantId: tenantId }).data : {};
  return GovOpsTenderDocRuntime_success('標案文件佇列修復完成。', { released: released.data || {}, retried: retried.data || {}, health: health });
}

function GovOpsTenderDocRuntime_upsertRuntime(tenantId, patch) {
  try {
    GovOpsTenderDocRuntime_ensureSheet();
    var rows = GovOpsProduct_readRows(GovOpsTenderDocRuntime_runtimeSheetName());
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.Worker名稱 || '') === GovOpsTenderDocRuntime_workerName(); });
    var row = Object.assign({
      RuntimeID: 'TDRT-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      Worker名稱: GovOpsTenderDocRuntime_workerName(),
      Worker狀態: '',
      最近執行時間: '',
      最近處理數: 0,
      最近失敗數: 0,
      佇列等待數: 0,
      佇列失敗數: 0,
      卡住數: 0,
      健康狀態: 'unknown',
      建立時間: GovOpsTenderDocRuntime_now(),
      更新時間: GovOpsTenderDocRuntime_now(),
      userId: '',
      備註: ''
    }, patch || {}, { 更新時間: GovOpsTenderDocRuntime_now() });
    if (found) GovOpsProduct_update(GovOpsTenderDocRuntime_runtimeSheetName(), found._row, row);
    else GovOpsProduct_append(GovOpsTenderDocRuntime_runtimeSheetName(), row);
  } catch (err) {}
}

function GovOpsTenderDocRuntime_healthStatus(summary) {
  summary = summary || {};
  if ((summary.failed || 0) > 0) return 'warning';
  if ((summary.waiting || 0) > 100) return 'busy';
  return 'healthy';
}

function GovOpsTenderDocRuntime_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderDocWorker_Health() { return GovOpsTenderDocWorker_health({ tenantId: 'TENANT-DEMO' }); }
