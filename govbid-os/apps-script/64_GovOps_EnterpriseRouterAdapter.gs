/*
GovOps OS｜64_GovOps_EnterpriseRouterAdapter.gs
Enterprise Router Adapter v1.0.0

目的：
1. 讓既有 router 安全接入 63_GovOps_RuntimeComposer.gs
2. 避免重寫既有 router
3. 避免無限遞迴
4. 提供 Enterprise Runtime Entry Point

注意：
- 獨立 patch layer
- 不修改 58～63
*/

var GOVOPS_ENTERPRISE_ROUTER_ADAPTER_VERSION = '1.0.0';
var GOVOPS_ENTERPRISE_ROUTER_AUDIT_SHEET = 'EnterpriseRouterAuditLog';

var EnterpriseRouterActionRegistry = {
  // Auth actions
  '註冊組織與管理者': true,
  '登入使用者': true,
  '取得目前使用者Session': true,
  '登出使用者': true,

  // Tenant lifecycle actions
  '建立租戶環境': true,
  '啟用租戶': true,
  '停用租戶': true,
  '升級租戶方案': true,
  '更新訂閱狀態': true,
  '檢查租戶狀態': true,
  '查詢租戶生命週期紀錄': true,

  // Billing actions
  '初始化BillingRuntime': true,
  'createBillingAccount': true,
  'createInvoice': true,
  'markInvoicePaid': true,
  'markInvoiceOverdue': true,
  'cancelInvoice': true,
  'scheduleRenewal': true,
  'runRenewalBilling': true,
  'getTenantBillingSummary': true,

  // API gateway actions
  '初始化APIGatewayRuntime': true,
  'createAPIKey': true,
  'revokeAPIKey': true,
  'validateAPIKey': true,
  'getAPIUsageSummary': true,
  'verifyWebhookSignature': true,

  // Feature flag actions
  '初始化FeatureFlagRuntime': true,
  'registerFeatureFlag': true,
  'updateFeatureFlag': true,
  'setTenantFeatureOverride': true,
  'grantBetaFeatureAccess': true,
  'revokeBetaFeatureAccess': true,
  'resolveFeatureAccess': true,
  'getTenantFeatureMatrix': true,
  'setModulePermissionPolicy': true,
  'checkModulePermission': true,

  // ERP module actions
  '系統健康檢查': true,
  '取得儀表板': true,
  '查詢': true,
  '新增活動': true,
  '新增報名': true,
  '查詢學員': true,
  '查詢可行銷名單': true,
  '查詢今日任務': true,
  '查詢物品': true,
  '查詢簽到名單': true,
  '查詢文件歸檔': true,
  '更新活動狀態': true,
  '更新任務狀態': true,
  '更新物品狀態': true,

  // Finance actions
  '建立應收帳款': true,
  '登錄收款': true,
  '登錄支出': true,
  '查詢未收款': true,
  '查詢專案損益': true,

  // AI actions
  'AI秘書查詢': true,
  'AI任務路由': true,
  '查詢AI記憶': true,
  '查詢AI任務紀錄': true,
  'AI工作流建議': true,

  // Workflow actions
  '初始化流程引擎': true,
  '建立流程定義': true,
  '啟動流程實例': true,
  '流程轉階段': true,
  '完成流程任務': true,
  '查詢流程任務': true,
  '檢查流程SLA': true,

  // Automation actions
  '初始化自動化引擎': true,
  '建立自動化規則': true,
  '查詢自動化規則': true,
  '執行自動化規則': true,
  '觸發自動化': true,
  '執行定時自動化': true,
  '查詢自動化執行紀錄': true,
  '建立預設自動化規則': true,

  // Report actions
  '初始化報表中心': true,
  '產生財務報表': true,
  '產生CRM報表': true,
  '產生Workflow報表': true,
  '產生SaaS使用量報表': true,
  '產生管理總報表': true,
  '查詢報表紀錄': true,

  // Admin actions
  '查詢管理後台總覽': true,
  '查詢租戶使用者': true,
  '更新使用者角色': true,
  '更新使用者狀態': true,
  '查詢租戶方案': true,
  '更新租戶方案': true,
  '查詢QueueDashboard': true,
  '查詢監控Dashboard': true,
  '查詢備份Dashboard': true,

  // Command / Installer actions
  '取得指揮中心總覽': true,
  '取得Runtime狀態': true,
  '執行系統自檢': true,
  '執行日常營運巡檢': true,
  '一鍵安裝GovOpsERP': true,
  '檢查Runtime相依': true,
  '執行GovOps部署驗收': true
};

function ERA_headers_() {
  return ['requestId','tenantId','userId','action','routeMode','status','latencyMs','建立時間','備註'];
}

function ERA_now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function ERA_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function ERA_response_(success, message, data) {
  return { success: success === true, message: message || (success ? '操作完成。' : '操作失敗。'), data: data || {} };
}

function ERA_fail_(message, data) {
  return ERA_response_(false, message || 'Enterprise Router Adapter 執行失敗。', data || {});
}

function ERA_ctx_(data) {
  data = data || {};
  return {
    requestId: data.requestId || data['請求ID'] || ERA_id_('EREQ'),
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || '',
    source: data.source || data['來源'] || (data.apiKey ? 'public_api' : 'web_app')
  };
}

function 初始化EnterpriseRouterAdapter() {
  try {
    if (typeof DAL_ensureHeaders_ === 'function') {
      DAL_ensureHeaders_(GOVOPS_ENTERPRISE_ROUTER_AUDIT_SHEET, ERA_headers_());
    }
    return ERA_response_(true, 'Enterprise Router Adapter 初始化完成。', { version: GOVOPS_ENTERPRISE_ROUTER_ADAPTER_VERSION });
  } catch (err) {
    return ERA_fail_('Enterprise Router Adapter 初始化失敗。');
  }
}

function shouldRouteThroughEnterpriseAdapter(action, data) {
  data = data || {};
  if (!action) return false;
  if (preventRouterRecursion(data)) return false;
  if (EnterpriseRouterActionRegistry[action]) return true;
  if (data.apiKey) return true;
  if (typeof shouldUseEnterpriseRuntime === 'function') {
    try { if (shouldUseEnterpriseRuntime(action, data)) return true; } catch (err) {}
  }
  if (typeof GovOps_BillingActionMap !== 'undefined' && GovOps_BillingActionMap[action]) return true;
  if (typeof GovOps_APIGatewayActionMap !== 'undefined' && GovOps_APIGatewayActionMap[action]) return true;
  if (typeof GovOps_FeatureFlagActionMap !== 'undefined' && GovOps_FeatureFlagActionMap[action]) return true;
  if (typeof GovOps_UsageActionMetricMap !== 'undefined' && GovOps_UsageActionMetricMap[action]) return true;
  return false;
}

function enterpriseRouterAdapter(action, data, legacyHandler) {
  初始化EnterpriseRouterAdapter();
  var started = new Date().getTime();
  data = data || {};
  var ctx = ERA_ctx_(data);

  try {
    if (!shouldRouteThroughEnterpriseAdapter(action, data)) {
      logEnterpriseRouterAudit({ requestId: ctx.requestId, tenantId: ctx.tenantId, userId: ctx.userId, action: action, routeMode: 'skip', status: 'skipped', latencyMs: new Date().getTime() - started, note: '不需進入 Enterprise Adapter。' });
      return null;
    }

    if (typeof handleRuntimeComposedAction !== 'function') {
      var fb = ERA_executeLegacy_(action, data, legacyHandler);
      logEnterpriseRouterAudit({ requestId: ctx.requestId, tenantId: ctx.tenantId, userId: ctx.userId, action: action, routeMode: 'legacy_fallback', status: fb && fb.success === false ? 'failed' : 'success', latencyMs: new Date().getTime() - started, note: 'Runtime Composer 不存在，已 fallback legacy handler。' });
      return fb;
    }

    var runtimeData = Object.assign({}, data, {
      requestId: ctx.requestId,
      __enterpriseRuntimeActive: true
    });

    var routed = handleRuntimeComposedAction(action, runtimeData, function(nextRuntimeData) {
      nextRuntimeData = nextRuntimeData || runtimeData;
      nextRuntimeData.__enterpriseRuntimeActive = true;
      return ERA_executeLegacy_(action, nextRuntimeData, legacyHandler);
    });

    if (!routed) {
      var legacy = ERA_executeLegacy_(action, runtimeData, legacyHandler);
      logEnterpriseRouterAudit({ requestId: ctx.requestId, tenantId: ctx.tenantId, userId: ctx.userId, action: action, routeMode: 'legacy_after_null', status: legacy && legacy.success === false ? 'failed' : 'success', latencyMs: new Date().getTime() - started, note: 'Runtime 回傳 null，已 fallback legacy handler。' });
      return legacy;
    }

    logEnterpriseRouterAudit({ requestId: ctx.requestId, tenantId: ctx.tenantId, userId: ctx.userId, action: action, routeMode: 'enterprise_runtime', status: routed && routed.success === false ? 'failed' : 'success', latencyMs: new Date().getTime() - started, note: routed && routed.message ? routed.message : '' });
    return routed;
  } catch (err) {
    logEnterpriseRouterAudit({ requestId: ctx.requestId, tenantId: ctx.tenantId, userId: ctx.userId, action: action, routeMode: 'enterprise_runtime', status: 'failed', latencyMs: new Date().getTime() - started, note: 'Enterprise Adapter 執行失敗。' });
    return ERA_fail_('Enterprise Router Adapter 暫時無法完成操作，請稍後再試。');
  }
}

function createLegacyHandlerAdapter(routerFn) {
  return function(action, runtimeData) {
    runtimeData = runtimeData || {};
    runtimeData.__enterpriseRuntimeActive = true;
    if (typeof routerFn !== 'function') return ERA_fail_('Legacy router 尚未提供。');
    return routerFn(action, runtimeData);
  };
}

function preventRouterRecursion(data) {
  data = data || {};
  return data.__enterpriseRuntimeActive === true || String(data.__enterpriseRuntimeActive) === 'true';
}

function routeWithEnterpriseRuntime(action, data, legacyHandler) {
  data = data || {};
  if (preventRouterRecursion(data)) {
    return null;
  }
  return enterpriseRouterAdapter(action, data, legacyHandler);
}

function ERA_executeLegacy_(action, data, legacyHandler) {
  try {
    if (typeof legacyHandler !== 'function') return ERA_fail_('Legacy handler 尚未提供。');
    data = data || {};
    data.__enterpriseRuntimeActive = true;
    return legacyHandler(data);
  } catch (err) {
    return ERA_fail_('Legacy handler 執行失敗。');
  }
}

function logEnterpriseRouterAudit(data) {
  data = data || {};
  try {
    if (typeof DAL_append !== 'function') return ERA_response_(true, '略過 Enterprise Router Audit。');
    DAL_append(GOVOPS_ENTERPRISE_ROUTER_AUDIT_SHEET, {
      requestId: data.requestId || ERA_id_('EREQ'),
      tenantId: data.tenantId || '',
      userId: data.userId || '',
      action: data.action || '',
      routeMode: data.routeMode || '',
      status: data.status || '',
      latencyMs: Number(data.latencyMs || 0),
      建立時間: ERA_now_(),
      備註: data.note || data['備註'] || ''
    }, ERA_headers_());
    return ERA_response_(true, 'Enterprise Router Audit 已記錄。');
  } catch (err) {
    return ERA_response_(true, 'Enterprise Router Audit 略過。');
  }
}

function 查詢EnterpriseRouterAuditLog(data) {
  初始化EnterpriseRouterAdapter();
  data = data || {};
  try {
    if (typeof DAL_query !== 'function') return ERA_fail_('DataAccessLayer 尚未載入。');
    var res = DAL_query(GOVOPS_ENTERPRISE_ROUTER_AUDIT_SHEET, {
      tenantId: data.tenantId || data['組織ID'] || '',
      keyword: data.keyword || data['關鍵字'] || '',
      limit: data.limit || 100,
      page: data.page || 1,
      cache: false
    });
    return ERA_response_(true, 'Enterprise Router Audit Log 查詢完成。', { 紀錄: res.data.rows, 筆數: res.data.total });
  } catch (err) {
    return ERA_fail_('Enterprise Router Audit Log 查詢失敗。');
  }
}

function handleEnterpriseRouterAdapterAction(action, data) {
  try {
    if (action === '初始化EnterpriseRouterAdapter') return 初始化EnterpriseRouterAdapter(data || {});
    if (action === '查詢EnterpriseRouterAuditLog') return 查詢EnterpriseRouterAuditLog(data || {});
    return null;
  } catch (err) {
    return ERA_fail_('Enterprise Router Adapter Action 執行失敗。');
  }
}

/*
最小 router 接入片段：

if (typeof routeWithEnterpriseRuntime === 'function' && !data.__enterpriseRuntimeActive) {
  var routed = routeWithEnterpriseRuntime(action, data, function(runtimeData) {
    runtimeData.__enterpriseRuntimeActive = true;
    return router(action, runtimeData);
  });

  if (routed) return routed;
}
*/

function 測試_EnterpriseRouterAdapter_健康檢查() {
  var data = { tenantId: 'QA-ERA', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' };
  return routeWithEnterpriseRuntime('系統健康檢查', data, function(runtimeData) {
    return ERA_response_(true, '健康檢查 adapter 測試完成。', runtimeData);
  });
}

function 測試_EnterpriseRouterAdapter_新增活動() {
  var data = { tenantId: 'QA-ERA', userId: 'QA-USER', userRole: 'owner', plan: 'PRO', 活動名稱: 'Adapter 測試活動' };
  return routeWithEnterpriseRuntime('新增活動', data, function(runtimeData) {
    return ERA_response_(true, '新增活動 adapter 測試完成。', runtimeData);
  });
}

function 測試_EnterpriseRouterAdapter_Auth() {
  var data = { tenantId: 'QA-ERA', userId: 'QA-USER', userRole: 'owner', plan: 'PRO', email: 'qa@example.com' };
  return routeWithEnterpriseRuntime('取得目前使用者Session', data, function(runtimeData) {
    return ERA_response_(true, 'Auth adapter 測試完成。', runtimeData);
  });
}

function 測試_EnterpriseRouterAdapter_防遞迴() {
  var data = { tenantId: 'QA-ERA', userId: 'QA-USER', __enterpriseRuntimeActive: true };
  var routed = routeWithEnterpriseRuntime('新增活動', data, function(runtimeData) {
    return ERA_response_(true, '不應該被執行。', runtimeData);
  });
  return ERA_response_(true, '防遞迴測試完成。', { routed: routed, prevented: routed === null });
}

function 測試_EnterpriseRouterAdapter_AuditLog() {
  測試_EnterpriseRouterAdapter_健康檢查();
  return 查詢EnterpriseRouterAuditLog({ tenantId: 'QA-ERA', limit: 20 });
}
