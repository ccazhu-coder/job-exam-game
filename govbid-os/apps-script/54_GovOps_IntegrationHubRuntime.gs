/*
GovOps OS｜54_GovOps_IntegrationHubRuntime.gs
Enterprise Integration SaaS ERP Runtime v1.0.0

用途：
1. LINE Hub
2. Gmail / Email Hub
3. Calendar Hub
4. Drive Hub
5. Webhook Hub
6. External API Integration Runtime
*/

var GOVOPS_INTEGRATION_VERSION = '1.0.0';
var GOVOPS_INTEGRATION_CONFIG_SHEET = '外部整合設定表';
var GOVOPS_INTEGRATION_LOG_SHEET = '外部整合紀錄表';
var GOVOPS_WEBHOOK_LOG_SHEET = 'Webhook紀錄表';

function INT_configHeaders_() {
  return ['integrationId','tenantId','integrationType','名稱','設定JSON','狀態','建立時間','更新時間'];
}

function INT_logHeaders_() {
  return ['logId','tenantId','userId','integrationType','action','status','message','createdAt'];
}

function INT_webhookHeaders_() {
  return ['webhookId','tenantId','source','eventType','payload','status','createdAt','processedAt','message'];
}

function INT_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function INT_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function INT_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function INT_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function INT_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化整合中心() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_INTEGRATION_CONFIG_SHEET, INT_configHeaders_());
    DAL_ensureHeaders_(GOVOPS_INTEGRATION_LOG_SHEET, INT_logHeaders_());
    DAL_ensureHeaders_(GOVOPS_WEBHOOK_LOG_SHEET, INT_webhookHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_INTEGRATION_CONFIG_SHEET, INT_configHeaders_());
    ensureSheet(GOVOPS_INTEGRATION_LOG_SHEET, INT_logHeaders_());
    ensureSheet(GOVOPS_WEBHOOK_LOG_SHEET, INT_webhookHeaders_());
  }
  return INT_success_('整合中心初始化完成。', { version: GOVOPS_INTEGRATION_VERSION });
}

function 建立整合設定(data) {
  初始化整合中心();
  data = data || {};
  if (typeof DAL_append !== 'function') return INT_fail_('DataAccessLayer 尚未載入。');
  var ctx = INT_ctx_(data);
  var type = data.integrationType || data['整合類型'] || '';
  if (!type) return INT_fail_('請提供整合類型。');
  var integrationId = INT_id_('INT');
  var row = {
    integrationId: integrationId,
    tenantId: ctx.tenantId,
    integrationType: type,
    名稱: data.name || data['名稱'] || type,
    設定JSON: JSON.stringify(data.config || {}),
    狀態: data.status || 'active',
    建立時間: INT_now_(),
    更新時間: INT_now_()
  };
  DAL_append(GOVOPS_INTEGRATION_CONFIG_SHEET, row, INT_configHeaders_());
  return INT_success_('整合設定已建立。', { integrationId: integrationId });
}

function 查詢整合設定(data) {
  初始化整合中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return INT_fail_('DataAccessLayer 尚未載入。');
  var ctx = INT_ctx_(data);
  var filters = {};
  if (data.integrationType) filters.integrationType = data.integrationType;
  var res = DAL_query(GOVOPS_INTEGRATION_CONFIG_SHEET, { tenantId: ctx.tenantId, keyword: data.keyword || data['關鍵字'] || '', filters: filters, limit: data.limit || 100, page: data.page || 1, cache: false });
  return INT_success_('整合設定查詢完成。', { 設定: res.data.rows, 筆數: res.data.total });
}

function 記錄Webhook(data) {
  初始化整合中心();
  data = data || {};
  if (typeof DAL_append !== 'function') return INT_fail_('DataAccessLayer 尚未載入。');
  var ctx = INT_ctx_(data);
  var webhookId = INT_id_('WH');
  var row = {
    webhookId: webhookId,
    tenantId: ctx.tenantId,
    source: data.source || data['來源'] || 'external',
    eventType: data.eventType || data['事件類型'] || '',
    payload: JSON.stringify(data.payload || data),
    status: 'received',
    createdAt: INT_now_(),
    processedAt: '',
    message: ''
  };
  DAL_append(GOVOPS_WEBHOOK_LOG_SHEET, row, INT_webhookHeaders_());
  return INT_success_('Webhook 已記錄。', { webhookId: webhookId });
}

function 處理Webhook事件(data) {
  初始化整合中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return INT_fail_('DataAccessLayer 尚未載入。');
  var ctx = INT_ctx_(data);
  var res = DAL_query(GOVOPS_WEBHOOK_LOG_SHEET, { tenantId: ctx.tenantId, filters: { status: 'received' }, limit: data.limit || 20, cache: false });
  var rows = res.data.rows || [];
  var results = [];
  rows.forEach(function(w) {
    var payload = {};
    try { payload = JSON.parse(w.payload || '{}'); } catch (err) { payload = {}; }
    var eventResult = typeof 發布ERP事件 === 'function'
      ? 發布ERP事件({ tenantId: w.tenantId, eventType: w.eventType || 'webhook.received', sourceModule: w.source, sourceId: w.webhookId, payload: payload })
      : INT_fail_('事件匯流排尚未載入。');
    if (typeof DAL_updateByRow === 'function') {
      DAL_updateByRow(GOVOPS_WEBHOOK_LOG_SHEET, w._row, { status: eventResult.success ? 'processed' : 'failed', processedAt: INT_now_(), message: eventResult.message || '' });
    }
    results.push(eventResult);
  });
  return INT_success_('Webhook 事件處理完成。', { 處理數: results.length, 結果: results });
}

function 發送整合Email(data) {
  data = data || {};
  try {
    var to = data.to || data.email || data['Email'] || '';
    var subject = data.subject || data['主旨'] || 'GovOps 系統通知';
    var body = data.body || data['內容'] || '';
    if (!to) return INT_fail_('請提供收件 Email。');
    MailApp.sendEmail(to, subject, body);
    INT_log_(data, 'email', 'send', 'success', 'Email 已發送。');
    return INT_success_('Email 已發送。');
  } catch (err) {
    INT_log_(data, 'email', 'send', 'failed', 'Email 發送失敗。');
    return INT_fail_('Email 發送失敗。');
  }
}

function 建立Calendar事件(data) {
  data = data || {};
  try {
    var title = data.title || data['標題'] || data['活動名稱'] || 'GovOps 行程';
    var start = new Date(data.startTime || data['開始時間'] || data['活動日期'] || new Date());
    var end = new Date(data.endTime || data['結束時間'] || start.getTime() + 60 * 60 * 1000);
    var cal = CalendarApp.getDefaultCalendar();
    var event = cal.createEvent(title, start, end, { location: data.location || data['活動地點'] || '', description: data.description || data['說明'] || '' });
    INT_log_(data, 'calendar', 'create_event', 'success', 'Calendar 事件已建立。');
    return INT_success_('Calendar 事件已建立。', { eventId: event.getId() });
  } catch (err) {
    INT_log_(data, 'calendar', 'create_event', 'failed', 'Calendar 事件建立失敗。');
    return INT_fail_('Calendar 事件建立失敗。');
  }
}

function 建立Drive整合資料夾(data) {
  data = data || {};
  try {
    var name = data.folderName || data['資料夾名稱'] || 'GovOps 整合資料夾';
    var folder = DriveApp.createFolder(name);
    INT_log_(data, 'drive', 'create_folder', 'success', 'Drive 資料夾已建立。');
    return INT_success_('Drive 資料夾已建立。', { url: folder.getUrl(), folderId: folder.getId() });
  } catch (err) {
    INT_log_(data, 'drive', 'create_folder', 'failed', 'Drive 資料夾建立失敗。');
    return INT_fail_('Drive 資料夾建立失敗。');
  }
}

function LINE整合橋接(data) {
  data = data || {};
  INT_log_(data, 'line', 'bridge', 'queued', 'LINE 橋接已記錄，等待正式 LINE Token 接入。');
  return INT_success_('LINE 橋接已建立，等待正式 LINE Runtime 接入。');
}

function INT_log_(data, type, action, status, message) {
  if (typeof DAL_append !== 'function') return;
  var ctx = INT_ctx_(data || {});
  DAL_append(GOVOPS_INTEGRATION_LOG_SHEET, { logId: INT_id_('ILOG'), tenantId: ctx.tenantId, userId: ctx.userId, integrationType: type, action: action, status: status, message: message || '', createdAt: INT_now_() }, INT_logHeaders_());
}

function 測試_IntegrationHubRuntime() {
  初始化整合中心();
  var ctx = { tenantId: 'QA-INT', userId: 'QA-USER' };
  var cfg = 建立整合設定(Object.assign({}, ctx, { integrationType: 'webhook', name: '測試 Webhook', config: { enabled: true } }));
  var wh = 記錄Webhook(Object.assign({}, ctx, { source: 'qa', eventType: 'qa.test', payload: { ok: true } }));
  var list = 查詢整合設定(ctx);
  return INT_success_('Integration Hub Runtime 測試完成。', { 設定: cfg, Webhook: wh, 清單: list });
}
