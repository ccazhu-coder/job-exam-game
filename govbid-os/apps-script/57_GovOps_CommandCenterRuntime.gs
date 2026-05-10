/*
GovOps OS｜57_GovOps_CommandCenterRuntime.gs
Enterprise Autonomous Control Plane v1.0.0

用途：
1. ERP Command Center
2. SaaS Health Dashboard
3. Runtime Status Center
4. AI Operation Center
5. Multi-Tenant Monitoring
6. Enterprise Control Plane
*/

var GOVOPS_COMMAND_CENTER_VERSION = '1.0.0';
var GOVOPS_COMMAND_LOG_SHEET = '指揮中心操作紀錄';

function CMD_logHeaders_() {
  return ['commandId','tenantId','userId','commandType','commandName','status','message','createdAt'];
}

function CMD_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function CMD_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function CMD_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function CMD_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function CMD_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: String(data.userRole || data['使用者角色'] || '').toLowerCase(),
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化指揮中心() {
  if (typeof DAL_ensureHeaders_ === 'function') DAL_ensureHeaders_(GOVOPS_COMMAND_LOG_SHEET, CMD_logHeaders_());
  else if (typeof ensureSheet === 'function') ensureSheet(GOVOPS_COMMAND_LOG_SHEET, CMD_logHeaders_());
  return CMD_success_('指揮中心初始化完成。', { version: GOVOPS_COMMAND_CENTER_VERSION });
}

function CMD_log_(ctx, type, name, status, message) {
  if (typeof DAL_append !== 'function') return;
  DAL_append(GOVOPS_COMMAND_LOG_SHEET, {
    commandId: CMD_id_('CMD'),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    commandType: type,
    commandName: name,
    status: status,
    message: message || '',
    createdAt: CMD_now_()
  }, CMD_logHeaders_());
}

function 取得指揮中心總覽(data) {
  初始化指揮中心();
  data = data || {};
  var ctx = CMD_ctx_(data);
  var result = {
    system: CMD_runtimeStatus_(),
    admin: CMD_safeCall_('查詢管理後台總覽', data),
    queue: CMD_safeCall_('查詢QueueDashboard', data),
    monitor: CMD_safeCall_('查詢監控Dashboard', data),
    backup: CMD_safeCall_('查詢備份Dashboard', data),
    reports: CMD_safeCall_('查詢報表紀錄', Object.assign({}, data, { limit: 10 })),
    notifications: CMD_safeCall_('查詢系統通知', Object.assign({}, data, { limit: 10 })),
    automation: CMD_safeCall_('查詢自動化規則', Object.assign({}, data, { limit: 10 })),
    security: CMD_safeCall_('查詢安全稽核紀錄', Object.assign({}, data, { limit: 10 }))
  };
  CMD_log_(ctx, 'dashboard', '取得指揮中心總覽', 'success', '總覽已取得');
  return CMD_success_('指揮中心總覽取得完成。', result);
}

function 取得Runtime狀態(data) {
  初始化指揮中心();
  return CMD_success_('Runtime 狀態取得完成。', CMD_runtimeStatus_());
}

function CMD_runtimeStatus_() {
  return {
    version: GOVOPS_COMMAND_CENTER_VERSION,
    systemGuard: typeof handleGovOpsSystemGuardAction === 'function' ? 'loaded' : 'missing',
    dal: typeof DAL_query === 'function' ? 'loaded' : 'missing',
    queue: typeof 建立非同步任務 === 'function' ? 'loaded' : 'missing',
    cacheIndex: typeof 初始化快取索引系統 === 'function' ? 'loaded' : 'missing',
    observability: typeof 初始化監控系統 === 'function' ? 'loaded' : 'missing',
    backup: typeof 初始化備份復原系統 === 'function' ? 'loaded' : 'missing',
    admin: typeof 查詢管理後台總覽 === 'function' ? 'loaded' : 'missing',
    securityAudit: typeof 執行完整安全稽核 === 'function' ? 'loaded' : 'missing',
    workflow: typeof 初始化流程引擎 === 'function' ? 'loaded' : 'missing',
    ai: typeof 初始化AI協調器 === 'function' ? 'loaded' : 'missing',
    eventBus: typeof 初始化事件匯流排 === 'function' ? 'loaded' : 'missing',
    notification: typeof 初始化通知中心 === 'function' ? 'loaded' : 'missing',
    report: typeof 初始化報表中心 === 'function' ? 'loaded' : 'missing',
    integration: typeof 初始化整合中心 === 'function' ? 'loaded' : 'missing',
    warehouse: typeof 初始化資料倉儲 === 'function' ? 'loaded' : 'missing',
    automation: typeof 初始化自動化引擎 === 'function' ? 'loaded' : 'missing'
  };
}

function 執行系統自檢(data) {
  初始化指揮中心();
  data = data || {};
  var ctx = CMD_ctx_(data);
  var checks = [];
  checks.push(CMD_namedCall_('SystemGuard', '取得SystemGuard狀態', data));
  checks.push(CMD_namedCall_('DAL', '測試_DAL_健康檢查', data));
  checks.push(CMD_namedCall_('QueryWrappers', '測試_DAL_QueryWrappers', data));
  checks.push(CMD_namedCall_('WriteWrappers', '測試_DAL_WriteWrappers', data));
  checks.push(CMD_namedCall_('FinanceWrappers', '測試_DAL_FinanceWrappers', data));
  checks.push(CMD_namedCall_('Queue', '測試_AsyncQueue', data));
  checks.push(CMD_namedCall_('Observability', '測試_ObservabilityRuntime', data));
  checks.push(CMD_namedCall_('Backup', '測試_BackupRecoveryRuntime', data));
  checks.push(CMD_namedCall_('Admin', '測試_AdminConsoleRuntime', data));
  checks.push(CMD_namedCall_('SecurityAudit', '測試_MultiTenantIsolationAudit', data));
  checks.push(CMD_namedCall_('Workflow', '測試_WorkflowEngine', data));
  checks.push(CMD_namedCall_('AI', '測試_AIOrchestratorRuntime', data));
  checks.push(CMD_namedCall_('EventBus', '測試_EventBusRuntime', data));
  checks.push(CMD_namedCall_('Notification', '測試_NotificationCenterRuntime', data));
  checks.push(CMD_namedCall_('Report', '測試_ReportCenterRuntime', data));
  checks.push(CMD_namedCall_('Integration', '測試_IntegrationHubRuntime', data));
  checks.push(CMD_namedCall_('Warehouse', '測試_DataWarehouseRuntime', data));
  checks.push(CMD_namedCall_('Automation', '測試_AutomationRuntime', data));

  var passed = checks.filter(function(c){ return c.success; }).length;
  CMD_log_(ctx, 'self_check', '執行系統自檢', passed === checks.length ? 'success' : 'warning', passed + '/' + checks.length);
  return CMD_success_('系統自檢完成。', { 通過數: passed, 總數: checks.length, 結果: checks });
}

function CMD_namedCall_(name, fnName, data) {
  try {
    if (typeof this[fnName] !== 'function') return { name: name, success: false, message: 'missing' };
    var res = this[fnName](data || {});
    return { name: name, success: res && res.success !== false, message: res && res.message ? res.message : 'OK' };
  } catch (err) {
    return { name: name, success: false, message: 'failed' };
  }
}

function CMD_safeCall_(fnName, data) {
  try {
    if (typeof this[fnName] !== 'function') return { success: false, message: fnName + ' 尚未載入。', data: {} };
    return this[fnName](data || {});
  } catch (err) {
    return { success: false, message: fnName + ' 執行失敗。', data: {} };
  }
}

function 執行日常營運巡檢(data) {
  初始化指揮中心();
  data = data || {};
  var ctx = CMD_ctx_(data);
  var tasks = [];
  tasks.push(CMD_safeCall_('執行待處理任務', data));
  tasks.push(CMD_safeCall_('處理待處理ERP事件', data));
  tasks.push(CMD_safeCall_('發送待處理通知', data));
  tasks.push(CMD_safeCall_('檢查流程SLA', data));
  tasks.push(CMD_safeCall_('產生管理總報表', data));
  tasks.push(CMD_safeCall_('重建租戶資料倉儲', data));
  tasks.push(CMD_safeCall_('OBS_tenantHealth', data));
  CMD_log_(ctx, 'operation_check', '執行日常營運巡檢', 'success', '巡檢完成');
  return CMD_success_('日常營運巡檢完成。', { 結果: tasks });
}

function 安裝指揮中心巡檢觸發器() {
  初始化指揮中心();
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === '執行日常營運巡檢') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('執行日常營運巡檢').timeBased().everyHours(1).create();
  return CMD_success_('指揮中心巡檢觸發器已安裝。');
}

function 測試_CommandCenterRuntime() {
  初始化指揮中心();
  var ctx = { tenantId: 'QA-CMD', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' };
  var status = 取得Runtime狀態(ctx);
  var check = 執行系統自檢(ctx);
  return CMD_success_('Command Center Runtime 測試完成。', { Runtime: status, 自檢: check });
}
