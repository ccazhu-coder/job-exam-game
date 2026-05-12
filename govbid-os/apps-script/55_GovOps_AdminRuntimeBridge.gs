/* GovOps OS｜Admin Runtime Bridge v1
 * 目的：後台統一讀取正式產品狀態：Schema、Auth、Billing、Feature、Trigger。
 */

function handleGovOpsAdminRuntimeAction(action, data) {
  data = data || {};
  try {
    if (action === 'admin.runtime.overview' || action === '管理後台總覽') return GovOpsAdminRuntime_overview(data);
    if (action === 'admin.runtime.health' || action === '管理後台健康檢查') return GovOpsAdminRuntime_health(data);
    return null;
  } catch (err) {
    GovOpsAdminRuntime_logError('handleGovOpsAdminRuntimeAction', err, data);
    return GovOpsAdminRuntime_fail('管理後台暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_ADMIN_RUNTIME = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsAdminRuntimeAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_ADMIN_RUNTIME(action, data);
  };
}

function GovOpsAdminRuntime_success(message, data) {
  return { success: true, message: message || '操作完成。', data: data || {} };
}

function GovOpsAdminRuntime_fail(message, data) {
  return { success: false, message: message || '操作失敗。', data: data || {} };
}

function GovOpsAdminRuntime_safeCall(name, fn) {
  try {
    if (typeof fn !== 'function') return { ok: false, message: name + ' 尚未載入。', data: {} };
    var result = fn();
    return { ok: !!(result && result.success), message: result && result.message || '', data: result && result.data || {} };
  } catch (err) {
    return { ok: false, message: name + ' 執行失敗。', data: { error: err && err.message ? err.message : String(err) } };
  }
}

function GovOpsAdminRuntime_overview(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var overview = {
    tenantId: tenantId,
    schema: GovOpsAdminRuntime_safeCall('schemaHealth', function(){ return typeof GovOpsProduct_schemaHealth === 'function' ? GovOpsProduct_schemaHealth(data) : null; }),
    billing: GovOpsAdminRuntime_safeCall('billingUsage', function(){ return typeof GovOpsBilling_usageSummary === 'function' ? GovOpsBilling_usageSummary(data) : null; }),
    feature: GovOpsAdminRuntime_safeCall('featureMatrix', function(){ return typeof GovOpsFeature_matrix === 'function' ? GovOpsFeature_matrix(data) : null; }),
    trigger: GovOpsAdminRuntime_safeCall('triggerHealth', function(){ return typeof GovOpsTrigger_health === 'function' ? GovOpsTrigger_health(data) : null; }),
    users: GovOpsAdminRuntime_safeCall('authUsers', function(){ return typeof GovOpsAuth_queryUsers === 'function' ? GovOpsAuth_queryUsers(data) : null; })
  };
  return GovOpsAdminRuntime_success('管理後台總覽完成。', overview);
}

function GovOpsAdminRuntime_health(data) {
  var overview = GovOpsAdminRuntime_overview(data).data || {};
  var checks = [];
  Object.keys(overview).forEach(function(key) {
    if (key === 'tenantId') return;
    checks.push({ module: key, ok: !!(overview[key] && overview[key].ok), message: overview[key] && overview[key].message || '' });
  });
  var ok = checks.every(function(c){ return c.ok; });
  return GovOpsAdminRuntime_success(ok ? '管理後台健康檢查通過。' : '管理後台有部分模組需檢查。', { ok: ok, checks: checks });
}

function GovOpsAdminRuntime_logError(module, err, data) {
  try {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {});
    else if (typeof logError === 'function') logError(module, err);
  } catch (e) {}
}

function 測試_AdminRuntime_Overview() {
  return GovOpsAdminRuntime_overview({ tenantId: 'TENANT-DEMO', userId: 'SYSTEM-QA' });
}
