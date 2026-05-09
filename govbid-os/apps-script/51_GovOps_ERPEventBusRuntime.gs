/*
GovOps OS｜51_GovOps_ERPEventBusRuntime.gs
Event-Driven SaaS ERP Event Bus Runtime v1.0.0

用途：
1. 系統事件流
2. Module Event Runtime
3. Queue Event Runtime
4. AI Event Runtime
5. Workflow Event Runtime
6. ERP Automation Runtime
*/

var GOVOPS_EVENT_BUS_VERSION = '1.0.0';
var GOVOPS_EVENT_SHEET = '系統事件流';
var GOVOPS_EVENT_HANDLER_SHEET = '事件處理器表';
var GOVOPS_EVENT_LOG_SHEET = '事件處理紀錄';

function EVT_eventHeaders_() {
  return ['eventId','tenantId','userId','eventType','sourceModule','sourceId','payload','status','createdAt','processedAt','message'];
}

function EVT_handlerHeaders_() {
  return ['handlerId','tenantId','eventType','handlerAction','handlerMode','status','createdAt','updatedAt','note'];
}

function EVT_logHeaders_() {
  return ['logId','eventId','tenantId','handlerAction','status','message','createdAt'];
}

function EVT_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function EVT_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function EVT_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function EVT_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function EVT_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化事件匯流排() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_EVENT_SHEET, EVT_eventHeaders_());
    DAL_ensureHeaders_(GOVOPS_EVENT_HANDLER_SHEET, EVT_handlerHeaders_());
    DAL_ensureHeaders_(GOVOPS_EVENT_LOG_SHEET, EVT_logHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_EVENT_SHEET, EVT_eventHeaders_());
    ensureSheet(GOVOPS_EVENT_HANDLER_SHEET, EVT_handlerHeaders_());
    ensureSheet(GOVOPS_EVENT_LOG_SHEET, EVT_logHeaders_());
  }
  return EVT_success_('事件匯流排初始化完成。', { version: GOVOPS_EVENT_BUS_VERSION });
}

function 發布ERP事件(data) {
  初始化事件匯流排();
  data = data || {};
  if (typeof DAL_append !== 'function') return EVT_fail_('DataAccessLayer 尚未載入。');
  var ctx = EVT_ctx_(data);
  var eventType = data.eventType || data['事件類型'] || '';
  if (!eventType) return EVT_fail_('請提供事件類型。');
  var eventId = EVT_id_('EVT');
  var row = {
    eventId: eventId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    eventType: eventType,
    sourceModule: data.sourceModule || data['來源模組'] || '',
    sourceId: data.sourceId || data['來源ID'] || '',
    payload: JSON.stringify(data.payload || {}),
    status: 'pending',
    createdAt: EVT_now_(),
    processedAt: '',
    message: ''
  };
  DAL_append(GOVOPS_EVENT_SHEET, row, EVT_eventHeaders_());
  return EVT_success_('ERP 事件已發布。', { eventId: eventId });
}

function 註冊事件處理器(data) {
  初始化事件匯流排();
  data = data || {};
  if (typeof DAL_append !== 'function') return EVT_fail_('DataAccessLayer 尚未載入。');
  var ctx = EVT_ctx_(data);
  var eventType = data.eventType || data['事件類型'] || '';
  var action = data.handlerAction || data['處理Action'] || '';
  if (!eventType || !action) return EVT_fail_('請提供事件類型與處理 Action。');
  var row = {
    handlerId: EVT_id_('HDL'),
    tenantId: ctx.tenantId,
    eventType: eventType,
    handlerAction: action,
    handlerMode: data.handlerMode || data['處理模式'] || 'sync',
    status: 'active',
    createdAt: EVT_now_(),
    updatedAt: EVT_now_(),
    note: data.note || data['備註'] || ''
  };
  DAL_append(GOVOPS_EVENT_HANDLER_SHEET, row, EVT_handlerHeaders_());
  return EVT_success_('事件處理器已註冊。', { handlerId: row.handlerId });
}

function 處理待處理ERP事件(data) {
  初始化事件匯流排();
  data = data || {};
  if (typeof DAL_query !== 'function') return EVT_fail_('DataAccessLayer 尚未載入。');
  var ctx = EVT_ctx_(data);
  var events = DAL_query(GOVOPS_EVENT_SHEET, Object.assign({}, ctx, { filters: { status: 'pending' }, limit: data.limit || 20, cache: false })).data.rows || [];
  var results = [];
  events.forEach(function(evt) { results.push(EVT_processOne_(evt)); });
  return EVT_success_('待處理事件處理完成。', { 處理數: results.length, 結果: results });
}

function EVT_processOne_(evt) {
  var handlers = DAL_query(GOVOPS_EVENT_HANDLER_SHEET, { tenantId: evt.tenantId, filters: { eventType: evt.eventType, status: 'active' }, limit: 20, cache: false }).data.rows || [];
  var payload = {};
  try { payload = evt.payload ? JSON.parse(evt.payload) : {}; } catch (err) { payload = {}; }
  var allOk = true;
  var messages = [];
  handlers.forEach(function(h) {
    var result = EVT_runHandler_(h, evt, payload);
    if (!result.success) allOk = false;
    messages.push(result.message || '');
    EVT_log_(evt, h.handlerAction, result.success ? 'success' : 'failed', result.message || '');
  });
  DAL_updateByRow(GOVOPS_EVENT_SHEET, evt._row, { status: allOk ? 'done' : 'failed', processedAt: EVT_now_(), message: messages.join('；') });
  return { eventId: evt.eventId, success: allOk, handlers: handlers.length };
}

function EVT_runHandler_(handler, evt, payload) {
  var action = handler.handlerAction;
  var mode = String(handler.handlerMode || 'sync');
  var data = Object.assign({}, payload || {}, { tenantId: evt.tenantId, userId: evt.userId, eventId: evt.eventId, sourceId: evt.sourceId });
  if (mode === 'async' && typeof 建立非同步任務 === 'function') {
    return 建立非同步任務({ tenantId: evt.tenantId, userId: evt.userId, taskType: 'event', targetAction: action, payload: data });
  }
  if (typeof router === 'function') return router(action, data);
  return EVT_fail_('router 尚未載入。');
}

function EVT_log_(evt, action, status, message) {
  var row = {
    logId: EVT_id_('ELOG'),
    eventId: evt.eventId,
    tenantId: evt.tenantId,
    handlerAction: action,
    status: status,
    message: message || '',
    createdAt: EVT_now_()
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_EVENT_LOG_SHEET, row, EVT_logHeaders_());
}

function 安裝事件匯流排觸發器() {
  初始化事件匯流排();
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === '處理待處理ERP事件') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('處理待處理ERP事件').timeBased().everyMinutes(5).create();
  return EVT_success_('事件匯流排觸發器已安裝。');
}

function 查詢ERP事件(data) {
  初始化事件匯流排();
  data = data || {};
  if (typeof DAL_query !== 'function') return EVT_fail_('DataAccessLayer 尚未載入。');
  var ctx = EVT_ctx_(data);
  var res = DAL_query(GOVOPS_EVENT_SHEET, { tenantId: ctx.tenantId, keyword: data.keyword || data['關鍵字'] || '', limit: data.limit || 100, page: data.page || 1, cache: false });
  return EVT_success_('ERP 事件查詢完成。', { 事件: res.data.rows, 筆數: res.data.total });
}

function 測試_EventBusRuntime() {
  初始化事件匯流排();
  var ctx = { tenantId: 'QA-EVT', userId: 'QA-USER' };
  var handler = 註冊事件處理器(Object.assign({}, ctx, { eventType: 'activity.created', handlerAction: '查詢今日任務', handlerMode: 'sync' }));
  var event = 發布ERP事件(Object.assign({}, ctx, { eventType: 'activity.created', sourceModule: 'activity', sourceId: 'QA-ACT', payload: { keyword: 'QA' } }));
  var run = 處理待處理ERP事件(ctx);
  return EVT_success_('Event Bus Runtime 測試完成。', { handler: handler, event: event, run: run });
}
