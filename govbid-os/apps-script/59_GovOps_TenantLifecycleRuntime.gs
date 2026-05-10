/*
GovOps OS｜59_GovOps_TenantLifecycleRuntime.gs
Enterprise Multi-Tenant SaaS Lifecycle Runtime v1.0.0

用途：
1. Tenant Provisioning
2. SaaS Subscription Lifecycle
3. Tenant Suspend / Activate Runtime
4. Tenant Upgrade Runtime
5. Billing State Runtime
*/

var GOVOPS_TENANT_LIFECYCLE_VERSION = '1.0.0';
var GOVOPS_TENANT_LIFECYCLE_LOG_SHEET = '租戶生命週期紀錄';

function TLC_logHeaders_() {
  return ['logId','tenantId','userId','action','fromState','toState','message','createdAt'];
}

function TLC_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function TLC_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function TLC_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function TLC_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function TLC_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: String(data.userRole || data['使用者角色'] || '').toLowerCase(),
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化租戶生命週期系統() {
  if (typeof DAL_ensureHeaders_ === 'function') DAL_ensureHeaders_(GOVOPS_TENANT_LIFECYCLE_LOG_SHEET, TLC_logHeaders_());
  else if (typeof ensureSheet === 'function') ensureSheet(GOVOPS_TENANT_LIFECYCLE_LOG_SHEET, TLC_logHeaders_());
  return TLC_success_('租戶生命週期系統初始化完成。', { version: GOVOPS_TENANT_LIFECYCLE_VERSION });
}

function TLC_log_(ctx, action, fromState, toState, message) {
  if (typeof DAL_append !== 'function') return;
  DAL_append(GOVOPS_TENANT_LIFECYCLE_LOG_SHEET, {
    logId: TLC_id_('TLC'),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: action,
    fromState: fromState || '',
    toState: toState || '',
    message: message || '',
    createdAt: TLC_now_()
  }, TLC_logHeaders_());
}

function 建立租戶環境(data) {
  初始化租戶生命週期系統();
  data = data || {};
  var ctx = TLC_ctx_(data);
  if (!ctx.tenantId) return TLC_fail_('缺少 tenantId。');
  var install = typeof 一鍵安裝GovOpsERP === 'function' ? 一鍵安裝GovOpsERP(data) : TLC_fail_('Runtime Installer 尚未載入。');
  var rules = typeof 建立預設自動化規則 === 'function' ? 建立預設自動化規則(data) : TLC_fail_('自動化引擎尚未載入。');
  var dwh = typeof 重建租戶資料倉儲 === 'function' ? 重建租戶資料倉儲(data) : TLC_fail_('資料倉儲尚未載入。');
  TLC_log_(ctx, 'provision', '', 'active', '租戶環境建立完成');
  return TLC_success_('租戶環境建立完成。', { 安裝: install, 規則: rules, 資料倉儲: dwh });
}

function 啟用租戶(data) {
  初始化租戶生命週期系統();
  data = data || {};
  if (typeof DAL_findOne !== 'function' || typeof DAL_updateByRow !== 'function') return TLC_fail_('DataAccessLayer 尚未載入。');
  var ctx = TLC_ctx_(data);
  var tenant = DAL_findOne('組織資料表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
  if (!tenant) return TLC_fail_('查無租戶。');
  DAL_updateByRow('組織資料表', tenant._row, { status: 'active', 狀態: 'active', 更新時間: TLC_now_() });
  TLC_log_(ctx, 'activate', tenant.status || tenant['狀態'] || '', 'active', '租戶已啟用');
  return TLC_success_('租戶已啟用。', { tenantId: ctx.tenantId });
}

function 停用租戶(data) {
  初始化租戶生命週期系統();
  data = data || {};
  if (typeof DAL_findOne !== 'function' || typeof DAL_updateByRow !== 'function') return TLC_fail_('DataAccessLayer 尚未載入。');
  var ctx = TLC_ctx_(data);
  var reason = data.reason || data['原因'] || 'manual_suspend';
  var tenant = DAL_findOne('組織資料表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
  if (!tenant) return TLC_fail_('查無租戶。');
  DAL_updateByRow('組織資料表', tenant._row, { status: 'suspended', 狀態: 'suspended', 停用原因: reason, 更新時間: TLC_now_() });
  TLC_log_(ctx, 'suspend', tenant.status || tenant['狀態'] || '', 'suspended', reason);
  return TLC_success_('租戶已停用。', { tenantId: ctx.tenantId });
}

function 升級租戶方案(data) {
  初始化租戶生命週期系統();
  data = data || {};
  if (typeof DAL_findOne !== 'function' || typeof DAL_updateByRow !== 'function') return TLC_fail_('DataAccessLayer 尚未載入。');
  var ctx = TLC_ctx_(data);
  var plan = String(data.newPlan || data.plan || data['新方案'] || '').toUpperCase();
  if (['FREE','STARTER','PRO','ENTERPRISE'].indexOf(plan) < 0) return TLC_fail_('方案不正確。');
  var sub = DAL_findOne('SaaS訂閱表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
  if (!sub) return TLC_fail_('查無訂閱資料。');
  var oldPlan = sub.plan || sub['方案名稱'] || '';
  DAL_updateByRow('SaaS訂閱表', sub._row, { plan: plan, 方案名稱: plan, status: 'active', 訂閱狀態: 'active', 更新時間: TLC_now_() });
  TLC_log_(ctx, 'upgrade_plan', oldPlan, plan, '方案已更新');
  return TLC_success_('租戶方案已更新。', { tenantId: ctx.tenantId, plan: plan });
}

function 更新訂閱狀態(data) {
  初始化租戶生命週期系統();
  data = data || {};
  if (typeof DAL_findOne !== 'function' || typeof DAL_updateByRow !== 'function') return TLC_fail_('DataAccessLayer 尚未載入。');
  var ctx = TLC_ctx_(data);
  var status = data.status || data['訂閱狀態'] || '';
  if (['active','past_due','canceled','trialing'].indexOf(String(status)) < 0) return TLC_fail_('訂閱狀態不正確。');
  var sub = DAL_findOne('SaaS訂閱表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
  if (!sub) return TLC_fail_('查無訂閱資料。');
  var old = sub.status || sub['訂閱狀態'] || '';
  DAL_updateByRow('SaaS訂閱表', sub._row, { status: status, 訂閱狀態: status, 更新時間: TLC_now_() });
  TLC_log_(ctx, 'subscription_status', old, status, '訂閱狀態已更新');
  return TLC_success_('訂閱狀態已更新。', { tenantId: ctx.tenantId, status: status });
}

function 檢查租戶狀態(data) {
  初始化租戶生命週期系統();
  data = data || {};
  if (typeof DAL_findOne !== 'function') return TLC_fail_('DataAccessLayer 尚未載入。');
  var ctx = TLC_ctx_(data);
  var tenant = DAL_findOne('組織資料表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
  var sub = DAL_findOne('SaaS訂閱表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
  return TLC_success_('租戶狀態查詢完成。', { 租戶: tenant || {}, 訂閱: sub || {} });
}

function 查詢租戶生命週期紀錄(data) {
  初始化租戶生命週期系統();
  data = data || {};
  if (typeof DAL_query !== 'function') return TLC_fail_('DataAccessLayer 尚未載入。');
  var ctx = TLC_ctx_(data);
  var res = DAL_query(GOVOPS_TENANT_LIFECYCLE_LOG_SHEET, { tenantId: ctx.tenantId, keyword: data.keyword || data['關鍵字'] || '', limit: data.limit || 100, page: data.page || 1, cache: false });
  return TLC_success_('租戶生命週期紀錄查詢完成。', { 紀錄: res.data.rows, 筆數: res.data.total });
}

function 測試_TenantLifecycleRuntime() {
  初始化租戶生命週期系統();
  var ctx = { tenantId: 'QA-TLC', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' };
  TLC_log_(ctx, 'test', '', 'ok', '測試紀錄');
  var list = 查詢租戶生命週期紀錄(ctx);
  return TLC_success_('Tenant Lifecycle Runtime 測試完成。', { 紀錄: list });
}
