/*
GovOps OS｜63_GovOps_RuntimeComposer.gs
Fully Composable Enterprise SaaS Runtime v1.0.0

目的：
1. Runtime Middleware Pipeline
2. Unified Runtime Guard
3. Cross Runtime Orchestration
4. Enterprise Runtime Composition

注意：
- 獨立 patch layer
- 不修改既有 router
- 不破壞 58 / 59 / 60 / 61 / 62
*/

var GOVOPS_ENTERPRISE_RUNTIME_COMPOSER_VERSION = '1.0.0';
var GOVOPS_RUNTIME_AUDIT_LOG_SHEET = 'RuntimeAuditLog';

var GovOps_RuntimePipeline = [
  'normalizeRuntimeContext',
  'systemGuardMiddleware',
  'tenantLifecycleMiddleware',
  'billingMiddleware',
  'apiGatewayMiddleware',
  'featureFlagMiddleware',
  'usageMeteringMiddleware',
  'auditLogMiddleware',
  'handlerExecutionMiddleware',
  'responseFilterMiddleware'
];

function runtimeComposerResponse(success, message, data) {
  return {
    success: success === true,
    message: message || (success ? '操作完成。' : '操作失敗。'),
    data: data || {}
  };
}

function runtimeComposerFail(message, data) {
  return runtimeComposerResponse(false, message || 'Runtime 執行失敗。', data || {});
}

function RC_headers_() {
  return ['requestId','tenantId','userId','action','status','latencyMs','source','建立時間','備註'];
}

function RC_now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function RC_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function 初始化RuntimeComposer() {
  try {
    if (typeof DAL_ensureHeaders_ === 'function') {
      DAL_ensureHeaders_(GOVOPS_RUNTIME_AUDIT_LOG_SHEET, RC_headers_());
    }
    return runtimeComposerResponse(true, 'Runtime Composer 初始化完成。', { version: GOVOPS_ENTERPRISE_RUNTIME_COMPOSER_VERSION });
  } catch (err) {
    return runtimeComposerFail('Runtime Composer 初始化失敗。');
  }
}

function normalizeRuntimeContext(action, data) {
  data = data || {};
  var ctx = {
    requestId: data.requestId || data['請求ID'] || RC_id_('REQ'),
    action: action || data.action || '',
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: String(data.userRole || data['使用者角色'] || data.role || 'viewer').toLowerCase(),
    plan: String(data.plan || data['SaaS方案'] || 'FREE').toUpperCase(),
    billingState: data.billingState || data['帳務狀態'] || '',
    apiKey: data.apiKey || data['APIKey'] || '',
    apiSecret: data.apiSecret || data['APISecret'] || '',
    source: data.source || data['來源'] || (data.apiKey ? 'public_api' : 'web_app'),
    timestamp: RC_now_(),
    startedAtMs: new Date().getTime(),
    data: Object.assign({}, data, { action: action })
  };

  ctx.data.tenantId = ctx.tenantId;
  ctx.data.userId = ctx.userId;
  ctx.data.userRole = ctx.userRole;
  ctx.data.plan = ctx.plan;
  ctx.data.requestId = ctx.requestId;
  ctx.data.source = ctx.source;
  return ctx;
}

function composeRuntime(action, data, handler) {
  初始化RuntimeComposer();
  try {
    var context = normalizeRuntimeContext(action, data || {});
    context.handler = handler;
    context.result = null;
    return runtimeMiddlewareNext(1, context, handler);
  } catch (err) {
    return runtimeComposerFail('Runtime Composer 執行失敗。');
  }
}

function runtimeMiddlewareNext(index, context, handler) {
  try {
    if (index >= GovOps_RuntimePipeline.length) {
      return context.result || runtimeComposerResponse(true, 'Runtime 執行完成。');
    }
    var middlewareName = GovOps_RuntimePipeline[index];
    if (typeof this[middlewareName] !== 'function') {
      return runtimeMiddlewareNext(index + 1, context, handler);
    }
    return this[middlewareName](context, function(nextContext) {
      return runtimeMiddlewareNext(index + 1, nextContext || context, handler);
    });
  } catch (err) {
    return runtimeComposerFail('Runtime Middleware 執行失敗。');
  }
}

function systemGuardMiddleware(context, next) {
  try {
    if (typeof handleGovOpsSystemGuardAction === 'function') {
      var status = handleGovOpsSystemGuardAction('取得SystemGuard狀態', context.data);
      if (status && status.success === false) return status;
    } else if (typeof 取得SystemGuard狀態 === 'function') {
      var s = 取得SystemGuard狀態(context.data);
      if (s && s.success === false) return s;
    }
    return next(context);
  } catch (err) {
    return runtimeComposerFail('系統狀態檢查失敗。');
  }
}

function tenantLifecycleMiddleware(context, next) {
  try {
    if (typeof assertTenantActive === 'function') {
      var tenant = assertTenantActive(context.data);
      if (tenant && tenant.success === false) return tenant;
    } else if (typeof 檢查租戶狀態 === 'function' && context.tenantId) {
      var st = 檢查租戶狀態(context.data);
      if (st && st.success && st.data && st.data.租戶) {
        var tenantStatus = st.data.租戶.status || st.data.租戶['狀態'] || '';
        if (tenantStatus && String(tenantStatus).toLowerCase() !== 'active') {
          return runtimeComposerFail('租戶目前不是啟用狀態。');
        }
      }
    }
    return next(context);
  } catch (err) {
    return runtimeComposerFail('租戶狀態檢查失敗。');
  }
}

function billingMiddleware(context, next) {
  try {
    if (typeof assertBillingGoodStanding === 'function') {
      var billing = assertBillingGoodStanding(context.data);
      if (billing && billing.success === false) return billing;
      if (billing && billing.data && billing.data.billingState) context.billingState = billing.data.billingState;
    }
    return next(context);
  } catch (err) {
    return runtimeComposerFail('帳務狀態檢查失敗。');
  }
}

function apiGatewayMiddleware(context, next) {
  try {
    if (context.apiKey && typeof apiGatewayGuard === 'function') {
      var api = apiGatewayGuard(context.action, context.data);
      if (api && api.success === false) return api;
      if (api && api.data) {
        context.data.tenantId = api.data.tenantId || context.tenantId;
        context.data.userId = api.data.userId || context.userId;
        context.apiKeyId = api.data.apiKeyId || '';
      }
    }
    return next(context);
  } catch (err) {
    return runtimeComposerFail('API Gateway 檢查失敗。');
  }
}

function featureFlagMiddleware(context, next) {
  try {
    if (typeof featureFlagGuard === 'function') {
      var feature = featureFlagGuard(context.action, context.data);
      if (feature && feature.success === false) return feature;
    }
    return next(context);
  } catch (err) {
    return runtimeComposerFail('功能權限檢查失敗。');
  }
}

function usageMeteringMiddleware(context, next) {
  try {
    var metric = RC_resolveUsageMetric_(context.action);
    if (metric && typeof assertPlanLimit === 'function') {
      var limit = assertPlanLimit(context.data, metric);
      if (limit && limit.success === false) return limit;
    }

    var result = next(context);

    if (metric && result && result.success !== false && typeof incrementUsage === 'function') {
      try { incrementUsage(context.data, metric, 1); } catch (err2) {}
    }
    return result;
  } catch (err) {
    return runtimeComposerFail('使用量檢查失敗。');
  }
}

function auditLogMiddleware(context, next) {
  var result;
  try {
    result = next(context);
    RC_writeAudit_(context, result && result.success === false ? 'failed' : 'success', result && result.message ? result.message : '');
    return result;
  } catch (err) {
    RC_writeAudit_(context, 'failed', 'Runtime 執行失敗。');
    return runtimeComposerFail('Runtime 執行失敗。');
  }
}

function handlerExecutionMiddleware(context, next) {
  try {
    if (typeof context.handler !== 'function') {
      context.result = runtimeComposerFail('Runtime handler 尚未提供。');
      return next(context);
    }
    var result = context.handler(context.data);
    context.result = result || runtimeComposerResponse(true, 'Handler 已執行。');
    return next(context);
  } catch (err) {
    context.result = runtimeComposerFail('Handler 執行失敗。');
    return next(context);
  }
}

function responseFilterMiddleware(context, next) {
  try {
    var result = context.result || runtimeComposerResponse(true, 'Runtime 執行完成。');
    if (typeof tenantFilterResult === 'function' && result && result.data) {
      try { result = tenantFilterResult(result, context.data); } catch (err2) {}
    }
    return result;
  } catch (err) {
    return runtimeComposerFail('回應資料過濾失敗。');
  }
}

function handleRuntimeComposedAction(action, data, handler) {
  try {
    if (!shouldUseEnterpriseRuntime(action, data || {})) return null;
    return composeRuntime(action, data || {}, handler);
  } catch (err) {
    return runtimeComposerFail('Enterprise Runtime 無法完成操作。');
  }
}

function shouldUseEnterpriseRuntime(action, data) {
  data = data || {};
  if (!action) return false;
  if (data.apiKey) return true;
  if (typeof GovOps_BillingActionMap !== 'undefined' && GovOps_BillingActionMap[action]) return true;
  if (typeof GovOps_APIGatewayActionMap !== 'undefined' && GovOps_APIGatewayActionMap[action]) return true;
  if (typeof GovOps_FeatureFlagActionMap !== 'undefined' && GovOps_FeatureFlagActionMap[action]) return true;
  if (typeof GovOps_UsageActionMetricMap !== 'undefined' && GovOps_UsageActionMetricMap[action]) return true;
  if (typeof GovOps_TenantActionMap !== 'undefined' && GovOps_TenantActionMap[action]) return true;
  if (typeof GovOps_TenantCoreActionMap !== 'undefined' && GovOps_TenantCoreActionMap[action]) return true;
  if (/新增|建立|更新|登錄|查詢|產生|執行|啟動|完成|註冊|發送|發布|匯出|重建|取得|AI|Workflow|Runtime|Billing|API|Feature/.test(String(action))) return true;
  return false;
}

function RC_resolveUsageMetric_(action) {
  try {
    if (typeof GovOps_UsageActionMetricMap !== 'undefined' && GovOps_UsageActionMetricMap[action]) return GovOps_UsageActionMetricMap[action];
  } catch (err) {}
  var map = {
    '新增活動': '活動數',
    '新增報名': 'CRM筆數',
    'AI秘書查詢': 'AI查詢數',
    'AI任務路由': 'AI查詢數',
    '建立Drive資料夾': 'Drive建立數',
    '建立應收帳款': '財務操作數',
    '登錄收款': '財務操作數',
    '登錄支出': '財務操作數',
    '建立活動提醒': '提醒操作數'
  };
  return map[action] || '';
}

function RC_writeAudit_(context, status, note) {
  try {
    if (typeof DAL_append !== 'function') return;
    DAL_append(GOVOPS_RUNTIME_AUDIT_LOG_SHEET, {
      requestId: context.requestId,
      tenantId: context.tenantId,
      userId: context.userId,
      action: context.action,
      status: status,
      latencyMs: new Date().getTime() - Number(context.startedAtMs || new Date().getTime()),
      source: context.source,
      建立時間: RC_now_(),
      備註: note || ''
    }, RC_headers_());
  } catch (err) {}
}

function 查詢RuntimeAuditLog(data) {
  初始化RuntimeComposer();
  data = data || {};
  if (typeof DAL_query !== 'function') return runtimeComposerFail('DataAccessLayer 尚未載入。');
  var res = DAL_query(GOVOPS_RUNTIME_AUDIT_LOG_SHEET, {
    tenantId: data.tenantId || data['組織ID'] || '',
    keyword: data.keyword || data['關鍵字'] || '',
    limit: data.limit || 100,
    page: data.page || 1,
    cache: false
  });
  return runtimeComposerResponse(true, 'Runtime Audit Log 查詢完成。', { 紀錄: res.data.rows, 筆數: res.data.total });
}

/*
Router 接入範例：

if (typeof handleRuntimeComposedAction === 'function') {
  var runtimeHandled = handleRuntimeComposedAction(action, data, function(runtimeData) {
    return routerLegacyHandler(action, runtimeData);
  });
  if (runtimeHandled) return runtimeHandled;
}
*/

function 測試_RuntimeComposer_健康檢查() {
  return composeRuntime('系統健康檢查', { tenantId: 'QA-RC', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' }, function(runtimeData) {
    return runtimeComposerResponse(true, '健康檢查通過。', runtimeData);
  });
}

function 測試_RuntimeComposer_TenantGuard() {
  return composeRuntime('檢查租戶狀態', { tenantId: 'QA-RC', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' }, function(runtimeData) {
    return runtimeComposerResponse(true, 'Tenant Guard 測試完成。', runtimeData);
  });
}

function 測試_RuntimeComposer_BillingGuard() {
  return composeRuntime('新增活動', { tenantId: 'QA-RC', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' }, function(runtimeData) {
    return runtimeComposerResponse(true, 'Billing Guard 測試完成。', runtimeData);
  });
}

function 測試_RuntimeComposer_FeatureFlag() {
  return composeRuntime('AI秘書查詢', { tenantId: 'QA-RC', userId: 'QA-USER', userRole: 'owner', plan: 'ENTERPRISE' }, function(runtimeData) {
    return runtimeComposerResponse(true, 'Feature Flag 測試完成。', runtimeData);
  });
}

function 測試_RuntimeComposer_APIKey() {
  if (typeof createAPIKey !== 'function') return runtimeComposerFail('API Gateway 尚未載入。');
  var key = createAPIKey({ tenantId: 'QA-RC', userId: 'QA-USER', scope: 'read,write,admin', plan: 'ENTERPRISE' });
  if (!key.success) return key;
  return composeRuntime('查詢學員', { tenantId: 'QA-RC', userId: 'QA-USER', plan: 'ENTERPRISE', apiKey: key.data.apiKey, apiSecret: key.data.apiSecret }, function(runtimeData) {
    return runtimeComposerResponse(true, 'API Key 測試完成。', runtimeData);
  });
}

function 測試_RuntimeComposer_Usage() {
  return composeRuntime('新增報名', { tenantId: 'QA-RC', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' }, function(runtimeData) {
    return runtimeComposerResponse(true, 'Usage 測試完成。', runtimeData);
  });
}

function 測試_RuntimeComposer_AuditLog() {
  var run = 測試_RuntimeComposer_健康檢查();
  var log = 查詢RuntimeAuditLog({ tenantId: 'QA-RC' });
  return runtimeComposerResponse(true, 'Runtime Audit Log 測試完成。', { 執行: run, 紀錄: log });
}
