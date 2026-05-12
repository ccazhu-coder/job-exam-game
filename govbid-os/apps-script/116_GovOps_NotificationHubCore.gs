/* GovOps OS｜Notification Hub Core v1
 * 正式上線商品版：通知中心。
 * 目的：統一管理報名通知、錄取通知、課前提醒、任務提醒、結案提醒，並串接 Queue Persistence。
 */

function handleGovOpsNotificationHubAction(action, data) {
  data = data || {};
  try {
    if (action === 'notification.template.create' || action === '建立通知模板') return GovOpsNotify_Template_create(data);
    if (action === 'notification.template.query' || action === '查詢通知模板') return GovOpsNotify_Template_query(data);
    if (action === 'notification.queue.create' || action === '建立通知佇列') return GovOpsNotify_Queue_create(data);
    if (action === 'notification.queue.query' || action === '查詢通知佇列') return GovOpsNotify_Queue_query(data);
    if (action === 'notification.dispatch.claim' || action === '領取通知派送') return GovOpsNotify_Dispatch_claim(data);
    if (action === 'notification.dispatch.mark' || action === '標記通知結果') return GovOpsNotify_Dispatch_mark(data);
    if (action === 'notification.hub.health' || action === '通知中心健康檢查') return GovOpsNotify_Health(data);
    return null;
  } catch (err) {
    GovOpsNotify_audit('NOTIFICATION_ERROR', action, data, 'fail', String(err));
    return GovOpsNotify_fail('通知中心暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_NOTIFICATION_HUB = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsNotificationHubAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_NOTIFICATION_HUB(action, data);
  };
}

function GovOpsNotify_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsNotify_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsNotify_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsNotify_sheetTemplate() { return '99_通知模板'; }
function GovOpsNotify_sheetQueue() { return '100_通知中心佇列'; }
function GovOpsNotify_sheetLog() { return '101_通知派送紀錄'; }

function GovOpsNotify_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsNotify_sheetTemplate(), ['模板ID','tenantId','模板類型','模板名稱','通知渠道','標題模板','內容模板','啟用狀態','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsNotify_sheetQueue(), ['通知ID','tenantId','來源模組','來源ID','通知類型','通知渠道','收件人','收件人姓名','標題','內容','排程時間','優先級','通知狀態','重試次數','最後錯誤','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsNotify_sheetLog(), ['紀錄ID','tenantId','通知ID','通知渠道','收件人','派送結果','派送時間','錯誤訊息','建立時間','userId','原始資料']);
}

function GovOpsNotify_Template_create(data) {
  data = data || {};
  GovOpsNotify_ensureSheets();
  var row = {
    模板ID: data.模板ID || data.templateId || 'NTPL-' + Utilities.getUuid().slice(0, 8),
    tenantId: data.tenantId || 'TENANT-DEMO',
    模板類型: data.模板類型 || data.templateType || '一般通知',
    模板名稱: data.模板名稱 || data.templateName || '未命名模板',
    通知渠道: data.通知渠道 || data.channel || 'Email/LINE',
    標題模板: data.標題模板 || data.subjectTemplate || '{{通知類型}}',
    內容模板: data.內容模板 || data.bodyTemplate || '{{姓名}}您好，{{內容}}',
    啟用狀態: data.啟用狀態 || '啟用',
    建立時間: GovOpsNotify_now(), 更新時間: GovOpsNotify_now(), userId: data.userId || '', 備註: data.備註 || ''
  };
  GovOpsProduct_append(GovOpsNotify_sheetTemplate(), row);
  return GovOpsNotify_success('通知模板已建立。', row);
}

function GovOpsNotify_Template_query(data) {
  data = data || {};
  GovOpsNotify_ensureSheets();
  var rows = GovOpsNotify_filterRows(GovOpsNotify_sheetTemplate(), data);
  return GovOpsNotify_success('通知模板查詢完成。', { total: rows.length, rows: rows.slice(0, 500) });
}

function GovOpsNotify_Queue_create(data) {
  data = data || {};
  GovOpsNotify_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var content = data.內容 || data.body || data.message || GovOpsNotify_renderDefault(data);
  var row = {
    通知ID: data.通知ID || data.notificationId || 'NOTIFY-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    來源模組: data.來源模組 || data.sourceModule || 'manual',
    來源ID: data.來源ID || data.sourceId || '',
    通知類型: data.通知類型 || data.noticeType || '一般通知',
    通知渠道: data.通知渠道 || data.channel || '系統/Email/LINE',
    收件人: data.收件人 || data.recipient || data.Email || data.LineID || data.電話 || '',
    收件人姓名: data.收件人姓名 || data.name || data.姓名 || '',
    標題: data.標題 || data.subject || data.通知類型 || 'GovOps OS 通知',
    內容: content,
    排程時間: data.排程時間 || data.scheduledAt || GovOpsNotify_now(),
    優先級: Number(data.優先級 || data.priority || 50),
    通知狀態: 'queued',
    重試次數: 0,
    最後錯誤: '',
    建立時間: GovOpsNotify_now(), 更新時間: GovOpsNotify_now(), userId: data.userId || '', 備註: data.備註 || ''
  };
  GovOpsProduct_append(GovOpsNotify_sheetQueue(), row);
  if (typeof GovOpsQueuePersist_enqueue === 'function') GovOpsQueuePersist_enqueue({ tenantId: tenantId, queueName: 'notification', jobType: 'notification_dispatch', priority: row.優先級, payload: row, userId: data.userId || '' });
  GovOpsNotify_audit('NOTIFICATION_QUEUE', 'notification.queue.create', row, 'success', '通知已排入佇列');
  return GovOpsNotify_success('通知已建立並排入佇列。', row);
}

function GovOpsNotify_Queue_query(data) {
  data = data || {};
  GovOpsNotify_ensureSheets();
  var rows = GovOpsNotify_filterRows(GovOpsNotify_sheetQueue(), data);
  return GovOpsNotify_success('通知佇列查詢完成。', { total: rows.length, summary: GovOpsNotify_count(rows), rows: rows.slice(-500).reverse() });
}

function GovOpsNotify_Dispatch_claim(data) {
  data = data || {};
  GovOpsNotify_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var limit = Number(data.limit || 10);
  var rows = GovOpsProduct_readRows(GovOpsNotify_sheetQueue()).filter(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.通知狀態 || '') === 'queued'; }).sort(function(a,b){ return Number(a.優先級 || 50) - Number(b.優先級 || 50); }).slice(0, limit);
  rows.forEach(function(r){ GovOpsProduct_update(GovOpsNotify_sheetQueue(), r._row, { 通知狀態: 'dispatching', 更新時間: GovOpsNotify_now() }); });
  return GovOpsNotify_success('已領取通知派送任務。', { total: rows.length, rows: rows });
}

function GovOpsNotify_Dispatch_mark(data) {
  data = data || {};
  GovOpsNotify_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.通知ID || data.notificationId || '';
  var row = GovOpsProduct_readRows(GovOpsNotify_sheetQueue()).find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.通知ID || '') === String(id); });
  if (!row) return GovOpsNotify_fail('找不到通知。');
  var status = data.通知狀態 || data.status || '已發送';
  GovOpsProduct_update(GovOpsNotify_sheetQueue(), row._row, { 通知狀態: status, 最後錯誤: data.錯誤訊息 || data.error || '', 更新時間: GovOpsNotify_now() });
  GovOpsProduct_append(GovOpsNotify_sheetLog(), { 紀錄ID: 'NLOG-' + Utilities.getUuid().slice(0,8), tenantId: tenantId, 通知ID: id, 通知渠道: row.通知渠道, 收件人: row.收件人, 派送結果: status, 派送時間: GovOpsNotify_now(), 錯誤訊息: data.錯誤訊息 || data.error || '', 建立時間: GovOpsNotify_now(), userId: data.userId || '', 原始資料: JSON.stringify(data).slice(0,10000) });
  return GovOpsNotify_success('通知結果已標記。', { 通知ID: id, status: status });
}

function GovOpsNotify_Health(data) {
  var q = GovOpsNotify_Queue_query(data).data.summary;
  return GovOpsNotify_success('通知中心健康檢查完成。', q);
}

function GovOpsNotify_filterRows(sheetName, data) {
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.通知類型 || data.收件人 || '').trim();
  return GovOpsProduct_readRows(sheetName).filter(function(r){ if (String(r.tenantId || '') !== String(tenantId)) return false; if (!keyword) return true; return JSON.stringify(r).indexOf(keyword) >= 0; });
}
function GovOpsNotify_count(rows) { var out={queued:0,dispatching:0,sent:0,failed:0,total:rows.length}; rows.forEach(function(r){ var s=String(r.通知狀態||'queued'); if(s==='queued')out.queued++; else if(s==='dispatching')out.dispatching++; else if(s==='已發送')out.sent++; else if(s==='失敗'||s==='failed')out.failed++; }); return out; }
function GovOpsNotify_renderDefault(data) { return (data.姓名 || data.name || '您好') + '，' + (data.通知內容 || data.content || '您有一則 GovOps OS 通知。'); }
function GovOpsNotify_audit(eventType, action, data, result, message) { try { if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write(eventType, action, data, result, message); } catch(e){} }
