/*
GovOps OS｜45_GovOps_ObservabilityRuntime.gs
商用 SaaS ERP Observability Runtime v1.0.0

用途：
1. 錯誤追蹤
2. API 指標
3. 慢查詢紀錄
4. Queue 指標
5. 租戶健康狀態
6. 系統維運儀表板資料來源
*/

var GOVOPS_OBS_VERSION = '1.0.0';
var GOVOPS_OBS_ERROR_SHEET = '系統錯誤追蹤';
var GOVOPS_OBS_API_SHEET = '系統API指標';
var GOVOPS_OBS_SLOW_SHEET = '系統慢查詢紀錄';
var GOVOPS_OBS_TENANT_SHEET = '租戶健康狀態';

function OBS_errorHeaders_() {
  return ['errorId','tenantId','userId','module','action','message','severity','status','createdAt','updatedAt'];
}

function OBS_apiHeaders_() {
  return ['metricId','tenantId','userId','action','success','durationMs','createdAt','message'];
}

function OBS_slowHeaders_() {
  return ['slowId','tenantId','userId','sheetName','operation','durationMs','thresholdMs','createdAt','note'];
}

function OBS_tenantHeaders_() {
  return ['tenantId','最後檢查時間','API成功數','API失敗數','錯誤數','慢查詢數','Queue待處理數','健康狀態','更新時間'];
}

function OBS_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function OBS_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function OBS_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function OBS_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function OBS_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || ''
  };
}

function 初始化監控系統() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_OBS_ERROR_SHEET, OBS_errorHeaders_());
    DAL_ensureHeaders_(GOVOPS_OBS_API_SHEET, OBS_apiHeaders_());
    DAL_ensureHeaders_(GOVOPS_OBS_SLOW_SHEET, OBS_slowHeaders_());
    DAL_ensureHeaders_(GOVOPS_OBS_TENANT_SHEET, OBS_tenantHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_OBS_ERROR_SHEET, OBS_errorHeaders_());
    ensureSheet(GOVOPS_OBS_API_SHEET, OBS_apiHeaders_());
    ensureSheet(GOVOPS_OBS_SLOW_SHEET, OBS_slowHeaders_());
    ensureSheet(GOVOPS_OBS_TENANT_SHEET, OBS_tenantHeaders_());
  }
  return OBS_success_('監控系統初始化完成。', { version: GOVOPS_OBS_VERSION });
}

function OBS_recordError(data) {
  初始化監控系統();
  data = data || {};
  var ctx = OBS_ctx_(data);
  var row = {
    errorId: OBS_id_('ERR'),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    module: data.module || data['模組'] || '',
    action: data.action || '',
    message: data.message || data['錯誤訊息'] || '未提供錯誤訊息',
    severity: data.severity || 'medium',
    status: 'open',
    createdAt: OBS_now_(),
    updatedAt: OBS_now_()
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_OBS_ERROR_SHEET, row, OBS_errorHeaders_());
  return OBS_success_('錯誤已記錄。', { errorId: row.errorId });
}

function OBS_recordApiMetric(data) {
  初始化監控系統();
  data = data || {};
  var ctx = OBS_ctx_(data);
  var row = {
    metricId: OBS_id_('API'),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: data.action || '',
    success: data.success === false ? 'false' : 'true',
    durationMs: Number(data.durationMs || 0),
    createdAt: OBS_now_(),
    message: data.message || ''
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_OBS_API_SHEET, row, OBS_apiHeaders_());
  return OBS_success_('API 指標已記錄。', { metricId: row.metricId });
}

function OBS_recordSlowQuery(data) {
  初始化監控系統();
  data = data || {};
  var ctx = OBS_ctx_(data);
  var row = {
    slowId: OBS_id_('SLOW'),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    sheetName: data.sheetName || '',
    operation: data.operation || 'query',
    durationMs: Number(data.durationMs || 0),
    thresholdMs: Number(data.thresholdMs || 1000),
    createdAt: OBS_now_(),
    note: data.note || ''
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_OBS_SLOW_SHEET, row, OBS_slowHeaders_());
  return OBS_success_('慢查詢已記錄。', { slowId: row.slowId });
}

function OBS_wrapAction(action, data, handler) {
  var started = new Date().getTime();
  var result;
  try {
    result = handler(data || {});
    OBS_recordApiMetric(Object.assign({}, data || {}, {
      action: action,
      success: result && result.success !== false,
      durationMs: new Date().getTime() - started,
      message: result && result.message ? result.message : ''
    }));
    return result;
  } catch (err) {
    OBS_recordError(Object.assign({}, data || {}, {
      module: 'router',
      action: action,
      message: '系統執行失敗',
      severity: 'high'
    }));
    OBS_recordApiMetric(Object.assign({}, data || {}, {
      action: action,
      success: false,
      durationMs: new Date().getTime() - started,
      message: '系統執行失敗'
    }));
    return OBS_fail_('系統暫時無法完成操作，請稍後再試。');
  }
}

function OBS_tenantHealth(data) {
  初始化監控系統();
  data = data || {};
  var tenantId = data.tenantId || data['組織ID'] || '';
  if (!tenantId) return OBS_fail_('缺少 tenantId。');
  if (typeof DAL_query !== 'function') return OBS_fail_('DataAccessLayer 尚未載入。');

  var api = DAL_query(GOVOPS_OBS_API_SHEET, { tenantId: tenantId, limit: 500, cache: false }).data.rows || [];
  var errors = DAL_query(GOVOPS_OBS_ERROR_SHEET, { tenantId: tenantId, limit: 500, cache: false }).data.rows || [];
  var slow = DAL_query(GOVOPS_OBS_SLOW_SHEET, { tenantId: tenantId, limit: 500, cache: false }).data.rows || [];

  var apiSuccess = api.filter(function(r){ return String(r.success) === 'true'; }).length;
  var apiFail = api.filter(function(r){ return String(r.success) === 'false'; }).length;
  var status = 'healthy';
  if (apiFail > 10 || errors.length > 10 || slow.length > 20) status = 'warning';
  if (apiFail > 30 || errors.length > 30) status = 'risk';

  var row = {
    tenantId: tenantId,
    最後檢查時間: OBS_now_(),
    API成功數: apiSuccess,
    API失敗數: apiFail,
    錯誤數: errors.length,
    慢查詢數: slow.length,
    Queue待處理數: OBS_queuePendingCount_(tenantId),
    健康狀態: status,
    更新時間: OBS_now_()
  };

  var existing = DAL_findOne(GOVOPS_OBS_TENANT_SHEET, { tenantId: tenantId, filters: { tenantId: tenantId }, cache: false });
  if (existing) DAL_updateByRow(GOVOPS_OBS_TENANT_SHEET, existing._row, row);
  else DAL_append(GOVOPS_OBS_TENANT_SHEET, row, OBS_tenantHeaders_());

  return OBS_success_('租戶健康狀態已更新。', row);
}

function OBS_queuePendingCount_(tenantId) {
  try {
    if (typeof DAL_query !== 'function') return 0;
    var res = DAL_query('系統任務佇列', { tenantId: tenantId, filters: { '狀態': 'pending' }, limit: 1, cache: false });
    return res.data.total || 0;
  } catch (err) {
    return 0;
  }
}

function 查詢系統監控(data) {
  初始化監控系統();
  data = data || {};
  if (typeof DAL_query !== 'function') return OBS_fail_('DataAccessLayer 尚未載入。');
  var tenantId = data.tenantId || data['組織ID'] || '';
  var errors = DAL_query(GOVOPS_OBS_ERROR_SHEET, { tenantId: tenantId, limit: data.limit || 50, cache: false }).data.rows || [];
  var api = DAL_query(GOVOPS_OBS_API_SHEET, { tenantId: tenantId, limit: data.limit || 50, cache: false }).data.rows || [];
  var slow = DAL_query(GOVOPS_OBS_SLOW_SHEET, { tenantId: tenantId, limit: data.limit || 50, cache: false }).data.rows || [];
  return OBS_success_('系統監控資料取得完成。', { 錯誤: errors, API: api, 慢查詢: slow });
}

function 測試_ObservabilityRuntime() {
  初始化監控系統();
  var ctx = { tenantId: 'QA-OBS', userId: 'QA-USER' };
  var api = OBS_recordApiMetric(Object.assign({}, ctx, { action: '測試', success: true, durationMs: 88, message: 'OK' }));
  var err = OBS_recordError(Object.assign({}, ctx, { module: 'QA', action: '測試', message: '測試錯誤', severity: 'low' }));
  var slow = OBS_recordSlowQuery(Object.assign({}, ctx, { sheetName: 'QA', operation: 'query', durationMs: 1500, thresholdMs: 1000 }));
  var health = OBS_tenantHealth(ctx);
  return OBS_success_('Observability Runtime 測試完成。', { API: api, Error: err, Slow: slow, Health: health });
}
