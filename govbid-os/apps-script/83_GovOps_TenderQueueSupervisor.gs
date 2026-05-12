/* GovOps OS｜Tender Queue Supervisor v1
 * 目的：統一監控 Queue Worker、批次狀態、失敗佇列、卡住任務與自動修復建議。
 */

function handleGovOpsTenderQueueSupervisorAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.queue.supervisor.health' || action === '標案Queue總監健康檢查') return GovOpsTenderQueueSupervisor_health(data);
    if (action === 'tender.queue.supervisor.repair' || action === '標案Queue總監修復') return GovOpsTenderQueueSupervisor_repair(data);
    if (action === 'tender.queue.supervisor.report' || action === '標案Queue總監報告') return GovOpsTenderQueueSupervisor_report(data);
    return null;
  } catch (err) {
    GovOpsTenderQueueSupervisor_logError('handleGovOpsTenderQueueSupervisorAction', err, data);
    return GovOpsTenderQueueSupervisor_fail('標案 Queue Supervisor 暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_QUEUE_SUPERVISOR = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderQueueSupervisorAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_QUEUE_SUPERVISOR(action, data);
  };
}

function GovOpsTenderQueueSupervisor_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderQueueSupervisor_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderQueueSupervisor_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderQueueSupervisor_sheetName() { return '54_標案Queue總監紀錄'; }

function GovOpsTenderQueueSupervisor_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderQueueSupervisor_sheetName(), ['紀錄ID','tenantId','監控狀態','健康分數','Worker安裝','Queue等待','Queue處理中','Queue完成','Queue失敗','Queue重試','風險摘要','建議行動','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderQueueSupervisor_health(data) {
  data = data || {};
  GovOpsTenderQueueSupervisor_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var worker = typeof GovOpsTenderDocWorker_health === 'function' ? GovOpsTenderDocWorker_health({ tenantId: tenantId }).data : { installed: false, queueHealth: { summary: {} } };
  var q = worker.queueHealth && worker.queueHealth.summary || {};
  var score = GovOpsTenderQueueSupervisor_score(worker, q);
  var risk = GovOpsTenderQueueSupervisor_risk(worker, q);
  var action = GovOpsTenderQueueSupervisor_action(worker, q);
  var row = {
    紀錄ID: 'TQS-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    監控狀態: score >= 90 ? 'healthy' : score >= 70 ? 'warning' : 'critical',
    健康分數: score,
    Worker安裝: worker.installed ? '是' : '否',
    Queue等待: q.waiting || 0,
    Queue處理中: q.processing || 0,
    Queue完成: q.done || 0,
    Queue失敗: q.failed || 0,
    Queue重試: q.retry || 0,
    風險摘要: risk,
    建議行動: action,
    建立時間: GovOpsTenderQueueSupervisor_now(),
    更新時間: GovOpsTenderQueueSupervisor_now(),
    userId: data.userId || '',
    備註: 'Queue Supervisor 自動監控紀錄。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderQueueSupervisor_sheetName(), row);
  return GovOpsTenderQueueSupervisor_success('標案 Queue Supervisor 健康檢查完成。', row);
}

function GovOpsTenderQueueSupervisor_repair(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var actions = [];
  if (typeof GovOpsTenderDocWorker_health === 'function') {
    var h = GovOpsTenderDocWorker_health({ tenantId: tenantId }).data;
    if (!h.installed && typeof GovOpsTenderDocWorker_install === 'function') {
      actions.push(GovOpsTenderDocWorker_install({ tenantId: tenantId, everyMinutes: 5 }));
    }
  }
  if (typeof GovOpsTenderDocQueue_repair === 'function') actions.push(GovOpsTenderDocQueue_repair({ tenantId: tenantId, minutes: 20, maxRetry: 5 }));
  if (typeof GovOpsTenderDocWorker_run === 'function') actions.push(GovOpsTenderDocWorker_run({ tenantId: tenantId, limit: data.limit || 5 }));
  var health = GovOpsTenderQueueSupervisor_health({ tenantId: tenantId });
  return GovOpsTenderQueueSupervisor_success('標案 Queue Supervisor 修復完成。', { actions: actions.length, health: health.data });
}

function GovOpsTenderQueueSupervisor_report(data) {
  data = data || {};
  GovOpsTenderQueueSupervisor_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderQueueSupervisor_sheetName()).filter(function(r){ return String(r.tenantId || '') === String(tenantId); }) : [];
  return GovOpsTenderQueueSupervisor_success('標案 Queue Supervisor 報告完成。', { total: rows.length, latest: rows.slice(-10) });
}

function GovOpsTenderQueueSupervisor_score(worker, q) {
  var score = 100;
  if (!worker.installed) score -= 35;
  score -= Math.min(30, Number(q.failed || 0) * 10);
  score -= Math.min(20, Number(q.retry || 0) * 5);
  if (Number(q.waiting || 0) > 100) score -= 15;
  if (Number(q.processing || 0) > 20) score -= 10;
  return Math.max(0, score);
}

function GovOpsTenderQueueSupervisor_risk(worker, q) {
  var risks = [];
  if (!worker.installed) risks.push('Worker 尚未安裝');
  if (Number(q.failed || 0) > 0) risks.push('存在失敗佇列 ' + q.failed + ' 筆');
  if (Number(q.retry || 0) > 0) risks.push('存在重試佇列 ' + q.retry + ' 筆');
  if (Number(q.waiting || 0) > 100) risks.push('等待佇列過多');
  return risks.join('；') || 'Queue 運作正常。';
}

function GovOpsTenderQueueSupervisor_action(worker, q) {
  var actions = [];
  if (!worker.installed) actions.push('安裝 Worker Trigger');
  if (Number(q.failed || 0) > 0) actions.push('執行失敗佇列重試與人工檢查');
  if (Number(q.waiting || 0) > 100) actions.push('增加 Worker 執行頻率或降低單批上傳量');
  return actions.join('；') || '持續監控即可。';
}

function GovOpsTenderQueueSupervisor_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderQueueSupervisor_Health() { return GovOpsTenderQueueSupervisor_health({ tenantId: 'TENANT-DEMO' }); }
