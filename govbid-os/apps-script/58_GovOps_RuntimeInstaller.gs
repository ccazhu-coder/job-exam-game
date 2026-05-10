/*
GovOps OS｜58_GovOps_RuntimeInstaller.gs
One Click Autonomous ERP Deployment Runtime v1.0.0

用途：
1. Runtime Bootstrap
2. 全系統初始化
3. Trigger Auto Install
4. Runtime Dependency Check
5. One Click ERP Deployment
*/

var GOVOPS_INSTALLER_VERSION = '1.0.0';
var GOVOPS_INSTALL_LOG_SHEET = '系統安裝紀錄';

function INS_headers_() {
  return ['installId','tenantId','userId','installStep','status','message','createdAt'];
}

function INS_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function INS_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function INS_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function INS_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function INS_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化安裝器() {
  if (typeof DAL_ensureHeaders_ === 'function') DAL_ensureHeaders_(GOVOPS_INSTALL_LOG_SHEET, INS_headers_());
  else if (typeof ensureSheet === 'function') ensureSheet(GOVOPS_INSTALL_LOG_SHEET, INS_headers_());
  return INS_success_('安裝器初始化完成。', { version: GOVOPS_INSTALLER_VERSION });
}

function INS_log_(ctx, step, status, message) {
  if (typeof DAL_append !== 'function') return;
  DAL_append(GOVOPS_INSTALL_LOG_SHEET, {
    installId: INS_id_('INS'),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    installStep: step,
    status: status,
    message: message || '',
    createdAt: INS_now_()
  }, INS_headers_());
}

function 一鍵安裝GovOpsERP(data) {
  初始化安裝器();
  data = data || {};
  var ctx = INS_ctx_(data);
  var results = [];

  results.push(INS_call_('初始化系統', data, ctx));
  results.push(INS_call_('初始化SystemGuard', data, ctx));
  results.push(INS_call_('初始化財務資料表', data, ctx));
  results.push(INS_call_('初始化提醒中心', data, ctx));
  results.push(INS_call_('初始化任務佇列', data, ctx));
  results.push(INS_call_('初始化快取索引系統', data, ctx));
  results.push(INS_call_('初始化監控系統', data, ctx));
  results.push(INS_call_('初始化備份復原系統', data, ctx));
  results.push(INS_call_('初始化安全稽核系統', data, ctx));
  results.push(INS_call_('初始化流程引擎', data, ctx));
  results.push(INS_call_('初始化AI協調器', data, ctx));
  results.push(INS_call_('初始化事件匯流排', data, ctx));
  results.push(INS_call_('初始化通知中心', data, ctx));
  results.push(INS_call_('初始化報表中心', data, ctx));
  results.push(INS_call_('初始化整合中心', data, ctx));
  results.push(INS_call_('初始化資料倉儲', data, ctx));
  results.push(INS_call_('初始化自動化引擎', data, ctx));
  results.push(INS_call_('初始化指揮中心', data, ctx));

  results.push(INS_call_('建立預設自動化規則', data, ctx));
  results.push(INS_call_('安裝任務佇列觸發器', data, ctx));
  results.push(INS_call_('安裝事件匯流排觸發器', data, ctx));
  results.push(INS_call_('安裝通知中心觸發器', data, ctx));
  results.push(INS_call_('安裝自動化觸發器', data, ctx));
  results.push(INS_call_('建立備份觸發器', data, ctx));
  results.push(INS_call_('安裝指揮中心巡檢觸發器', data, ctx));

  var passed = results.filter(function(r){ return r.success; }).length;
  INS_log_(ctx, '一鍵安裝GovOpsERP', passed === results.length ? 'success' : 'warning', passed + '/' + results.length);
  return INS_success_('GovOps ERP 一鍵安裝完成。', { 通過數: passed, 總數: results.length, 結果: results });
}

function INS_call_(fnName, data, ctx) {
  try {
    if (typeof this[fnName] !== 'function') {
      INS_log_(ctx, fnName, 'missing', '函式尚未載入');
      return { step: fnName, success: false, message: '函式尚未載入' };
    }
    var res = this[fnName](data || {});
    var ok = res && res.success !== false;
    INS_log_(ctx, fnName, ok ? 'success' : 'failed', res && res.message ? res.message : '');
    return { step: fnName, success: ok, message: res && res.message ? res.message : '' };
  } catch (err) {
    INS_log_(ctx, fnName, 'failed', '執行失敗');
    return { step: fnName, success: false, message: '執行失敗' };
  }
}

function 檢查Runtime相依(data) {
  初始化安裝器();
  var status = {
    core: typeof router === 'function' ? 'loaded' : 'missing',
    systemGuard: typeof handleGovOpsSystemGuardAction === 'function' ? 'loaded' : 'missing',
    dal: typeof DAL_query === 'function' ? 'loaded' : 'missing',
    queryWrapper: typeof 查詢學員 === 'function' ? 'loaded' : 'missing',
    writeWrapper: typeof 新增活動 === 'function' ? 'loaded' : 'missing',
    financeWrapper: typeof 建立應收帳款 === 'function' ? 'loaded' : 'missing',
    queue: typeof 初始化任務佇列 === 'function' ? 'loaded' : 'missing',
    cache: typeof 初始化快取索引系統 === 'function' ? 'loaded' : 'missing',
    observability: typeof 初始化監控系統 === 'function' ? 'loaded' : 'missing',
    backup: typeof 初始化備份復原系統 === 'function' ? 'loaded' : 'missing',
    admin: typeof 查詢管理後台總覽 === 'function' ? 'loaded' : 'missing',
    audit: typeof 初始化安全稽核系統 === 'function' ? 'loaded' : 'missing',
    workflow: typeof 初始化流程引擎 === 'function' ? 'loaded' : 'missing',
    ai: typeof 初始化AI協調器 === 'function' ? 'loaded' : 'missing',
    eventBus: typeof 初始化事件匯流排 === 'function' ? 'loaded' : 'missing',
    notification: typeof 初始化通知中心 === 'function' ? 'loaded' : 'missing',
    report: typeof 初始化報表中心 === 'function' ? 'loaded' : 'missing',
    integration: typeof 初始化整合中心 === 'function' ? 'loaded' : 'missing',
    warehouse: typeof 初始化資料倉儲 === 'function' ? 'loaded' : 'missing',
    automation: typeof 初始化自動化引擎 === 'function' ? 'loaded' : 'missing',
    commandCenter: typeof 初始化指揮中心 === 'function' ? 'loaded' : 'missing'
  };
  var keys = Object.keys(status);
  var loaded = keys.filter(function(k){ return status[k] === 'loaded'; }).length;
  return INS_success_('Runtime 相依檢查完成。', { loaded: loaded, total: keys.length, status: status });
}

function 執行GovOps部署驗收(data) {
  var deps = 檢查Runtime相依(data || {});
  var install = 一鍵安裝GovOpsERP(data || {});
  var selfCheck = typeof 執行系統自檢 === 'function' ? 執行系統自檢(data || {}) : INS_fail_('指揮中心自檢尚未載入。');
  return INS_success_('GovOps 部署驗收完成。', { 相依檢查: deps, 安裝: install, 自檢: selfCheck });
}

function 查詢安裝紀錄(data) {
  初始化安裝器();
  data = data || {};
  if (typeof DAL_query !== 'function') return INS_fail_('DataAccessLayer 尚未載入。');
  var ctx = INS_ctx_(data);
  var res = DAL_query(GOVOPS_INSTALL_LOG_SHEET, { tenantId: ctx.tenantId, keyword: data.keyword || data['關鍵字'] || '', limit: data.limit || 100, page: data.page || 1, cache: false });
  return INS_success_('安裝紀錄查詢完成。', { 紀錄: res.data.rows, 筆數: res.data.total });
}

function 測試_RuntimeInstaller() {
  初始化安裝器();
  var ctx = { tenantId: 'QA-INSTALL', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' };
  var deps = 檢查Runtime相依(ctx);
  return INS_success_('Runtime Installer 測試完成。', deps.data);
}
