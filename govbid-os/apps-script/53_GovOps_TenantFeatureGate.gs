/* GovOps OS｜Tenant Feature Gate v1
 * 目的：補齊正式 SaaS 的租戶隔離、方案限制、角色權限、功能開關。
 * 原則：先提供後端統一檢查，不破壞既有功能。
 */

var GOVOPS_FEATURE_PLANS = {
  free: ['dashboard','activity.basic','registration.basic','crm.basic'],
  pro: ['dashboard','activity.basic','activity.workflow','registration.basic','registration.sync','crm.basic','finance.basic','reminder.basic','drive.basic','tender.basic'],
  team: ['dashboard','activity.basic','activity.workflow','registration.basic','registration.sync','crm.basic','crm.marketing','finance.basic','reminder.basic','drive.basic','line.basic','calendar.basic','tender.basic'],
  enterprise: ['*']
};

var GOVOPS_ROLE_FEATURES = {
  owner: ['*'],
  admin: ['dashboard','activity.basic','activity.workflow','registration.basic','registration.sync','crm.basic','crm.marketing','reminder.basic','drive.basic','line.basic','calendar.basic','tender.basic'],
  pm: ['dashboard','activity.basic','activity.workflow','registration.basic','registration.sync','crm.basic','reminder.basic','drive.basic','calendar.basic','tender.basic'],
  finance: ['dashboard','finance.basic','reminder.basic'],
  staff: ['dashboard','activity.basic','registration.basic','reminder.basic'],
  viewer: ['dashboard']
};

function handleGovOpsTenantFeatureAction(action, data) {
  data = data || {};
  try {
    if (action === 'tenant.feature.check' || action === '檢查功能權限') return GovOpsFeature_check(data);
    if (action === 'tenant.feature.matrix' || action === '查詢功能矩陣') return GovOpsFeature_matrix(data);
    if (action === 'tenant.usage.check' || action === '檢查用量限制') return GovOpsFeature_usageCheck(data);
    return null;
  } catch (err) {
    GovOpsFeature_logError('handleGovOpsTenantFeatureAction', err, data);
    return GovOpsFeature_fail('權限檢查暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_FEATURE_GATE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenantFeatureAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_FEATURE_GATE(action, data);
  };
}

function GovOpsFeature_success(message, data) {
  return { success: true, message: message || '操作完成。', data: data || {} };
}

function GovOpsFeature_fail(message, data) {
  return { success: false, message: message || '操作失敗。', data: data || {} };
}

function GovOpsFeature_has(list, feature) {
  list = list || [];
  return list.indexOf('*') >= 0 || list.indexOf(feature) >= 0;
}

function GovOpsFeature_check(data) {
  data = data || {};
  var plan = String(data.plan || 'free').toLowerCase();
  var role = String(data.userRole || data.role || 'viewer').toLowerCase();
  var feature = data.feature || data.功能 || '';
  if (!feature) return GovOpsFeature_fail('請提供 feature。', { allowed: false });
  var planOk = GovOpsFeature_has(GOVOPS_FEATURE_PLANS[plan] || GOVOPS_FEATURE_PLANS.free, feature);
  var roleOk = GovOpsFeature_has(GOVOPS_ROLE_FEATURES[role] || GOVOPS_ROLE_FEATURES.viewer, feature);
  var allowed = planOk && roleOk;
  return GovOpsFeature_success(allowed ? '允許使用此功能。' : '目前方案或角色無法使用此功能。', {
    allowed: allowed,
    feature: feature,
    plan: plan,
    role: role,
    planOk: planOk,
    roleOk: roleOk
  });
}

function GovOpsFeature_matrix(data) {
  return GovOpsFeature_success('功能矩陣查詢完成。', {
    plans: GOVOPS_FEATURE_PLANS,
    roles: GOVOPS_ROLE_FEATURES
  });
}

function GovOpsFeature_usageCheck(data) {
  data = data || {};
  var plan = String(data.plan || 'free').toLowerCase();
  var usageType = data.usageType || data.用量類型 || 'events';
  var current = Number(data.current || data.目前用量 || 0);
  var limits = {
    free: { events: 3, crm: 100, ai: 0, users: 1 },
    pro: { events: 20, crm: 3000, ai: 1000, users: 3 },
    team: { events: 80, crm: 20000, ai: 5000, users: 10 },
    enterprise: { events: 999999, crm: 999999, ai: 999999, users: 999999 }
  };
  var limit = (limits[plan] || limits.free)[usageType];
  var allowed = current < limit;
  return GovOpsFeature_success(allowed ? '用量尚可使用。' : '已達目前方案用量上限。', {
    allowed: allowed,
    plan: plan,
    usageType: usageType,
    current: current,
    limit: limit
  });
}

function GovOpsFeature_require(data, feature) {
  var result = GovOpsFeature_check(Object.assign({}, data || {}, { feature: feature }));
  if (!result.data || !result.data.allowed) throw new Error('FEATURE_DENIED:' + feature);
  return true;
}

function GovOpsFeature_filterByTenant(rows, tenantId) {
  rows = rows || [];
  if (!tenantId) return [];
  return rows.filter(function(row) { return String(row.tenantId || '') === String(tenantId); });
}

function GovOpsFeature_logError(module, err, data) {
  try {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {});
    else if (typeof logError === 'function') logError(module, err);
  } catch (e) {}
}

function 測試_FeatureGate_Check() {
  return GovOpsFeature_check({ plan: 'pro', userRole: 'owner', feature: 'registration.sync' });
}
