/*
GovOps OS｜62_GovOps_FeatureFlagRuntime.gs
Dynamic Enterprise SaaS Feature Flag Runtime v1.0.0

目的：
1. SaaS Feature Gate
2. Plan Feature Enforcement
3. Beta Feature Runtime
4. Module Permission Runtime
5. Dynamic SaaS Capability Runtime

注意：
- 獨立 patch layer
- 不破壞 58 / 59 / 60 / 61
*/

var GOVOPS_FEATURE_FLAG_VERSION = '1.0.0';

var GOVOPS_FEATURE_SHEETS = {
  registry: 'FeatureFlagRegistry',
  override: 'TenantFeatureOverride',
  rolloutLog: 'FeatureRolloutLog',
  betaAccess: 'BetaFeatureAccess',
  modulePolicy: 'ModulePermissionPolicy',
  auditLog: 'FeatureAuditLog'
};

var GovOps_FeatureFlagActionMap = {
  '初始化FeatureFlagRuntime': true,
  'registerFeatureFlag': true,
  'updateFeatureFlag': true,
  'setTenantFeatureOverride': true,
  'grantBetaFeatureAccess': true,
  'revokeBetaFeatureAccess': true,
  'resolveFeatureAccess': true,
  'getTenantFeatureMatrix': true,
  'setModulePermissionPolicy': true,
  'checkModulePermission': true
};

function FF_response_(success, message, data) {
  return { success: success === true, message: message || (success ? '操作完成。' : '操作失敗。'), data: data || {} };
}

function FF_fail_(message, data) {
  return FF_response_(false, message || '功能旗標操作失敗。', data || {});
}

function FF_now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function FF_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function FF_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: String(data.userRole || data['使用者角色'] || data.role || 'viewer').toLowerCase(),
    plan: String(data.plan || data['SaaS方案'] || 'FREE').toUpperCase()
  };
}

function FF_requireDAL_() {
  if (typeof DAL_ensureHeaders_ !== 'function' || typeof DAL_append !== 'function' || typeof DAL_query !== 'function') {
    return FF_fail_('DataAccessLayer 尚未載入，請先安裝 39_GovOps_DataAccessLayer.gs。');
  }
  return null;
}

function FF_registryHeaders_() {
  return ['featureKey','featureName','moduleName','description','minPlan','defaultEnabled','betaOnly','status','createdAt','updatedAt'];
}

function FF_overrideHeaders_() {
  return ['overrideId','tenantId','featureKey','enabled','reason','updatedBy','updatedAt'];
}

function FF_rolloutHeaders_() {
  return ['rolloutId','tenantId','featureKey','action','status','message','createdAt'];
}

function FF_betaHeaders_() {
  return ['betaId','tenantId','featureKey','grantedBy','expiresAt','status','createdAt','updatedAt'];
}

function FF_policyHeaders_() {
  return ['policyId','moduleName','role','canView','canCreate','canUpdate','canDelete','canExport','updatedAt'];
}

function FF_auditHeaders_() {
  return ['auditId','tenantId','userId','featureKey','action','beforeValue','afterValue','message','createdAt'];
}

function 初始化FeatureFlagRuntime() {
  var err = FF_requireDAL_();
  if (err) return err;
  try {
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.registry, FF_registryHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.override, FF_overrideHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.rolloutLog, FF_rolloutHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.betaAccess, FF_betaHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.modulePolicy, FF_policyHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.auditLog, FF_auditHeaders_());
    建立預設核心功能旗標();
    建立預設模組權限政策();
    return FF_response_(true, 'Feature Flag Runtime 初始化完成。', { version: GOVOPS_FEATURE_FLAG_VERSION });
  } catch (err2) {
    return FF_fail_('Feature Flag Runtime 初始化失敗，請檢查資料表權限。');
  }
}

function registerFeatureFlag(data) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var featureKey = data.featureKey || '';
  if (!featureKey) return FF_fail_('請提供 featureKey。');

  try {
    var existed = DAL_findOne(GOVOPS_FEATURE_SHEETS.registry, { filters: { featureKey: featureKey }, cache: false });
    var row = {
      featureKey: featureKey,
      featureName: data.featureName || featureKey,
      moduleName: data.moduleName || 'core',
      description: data.description || '',
      minPlan: String(data.minPlan || 'FREE').toUpperCase(),
      defaultEnabled: FF_bool_(data.defaultEnabled, true),
      betaOnly: FF_bool_(data.betaOnly, false),
      status: String(data.status || 'ACTIVE').toUpperCase(),
      createdAt: existed ? existed.createdAt : FF_now_(),
      updatedAt: FF_now_()
    };

    if (existed && typeof DAL_updateByRow === 'function') {
      DAL_updateByRow(GOVOPS_FEATURE_SHEETS.registry, existed._row, row);
      logFeatureAudit({ featureKey: featureKey, action: 'register_or_update', afterValue: JSON.stringify(row), message: '功能旗標已更新。' });
      return FF_response_(true, '功能旗標已更新。', row);
    }

    DAL_append(GOVOPS_FEATURE_SHEETS.registry, row, FF_registryHeaders_());
    logFeatureAudit({ featureKey: featureKey, action: 'register', afterValue: JSON.stringify(row), message: '功能旗標已建立。' });
    return FF_response_(true, '功能旗標已建立。', row);
  } catch (err) {
    return FF_fail_('功能旗標建立失敗。');
  }
}

function updateFeatureFlag(data) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var featureKey = data.featureKey || '';
  if (!featureKey) return FF_fail_('請提供 featureKey。');

  try {
    var feature = DAL_findOne(GOVOPS_FEATURE_SHEETS.registry, { filters: { featureKey: featureKey }, cache: false });
    if (!feature) return FF_fail_('查無功能旗標。');
    var beforeValue = JSON.stringify(feature);
    var patch = { updatedAt: FF_now_() };
    if (data.minPlan !== undefined) patch.minPlan = String(data.minPlan).toUpperCase();
    if (data.defaultEnabled !== undefined) patch.defaultEnabled = FF_bool_(data.defaultEnabled, false);
    if (data.betaOnly !== undefined) patch.betaOnly = FF_bool_(data.betaOnly, false);
    if (data.status !== undefined) patch.status = String(data.status).toUpperCase();
    DAL_updateByRow(GOVOPS_FEATURE_SHEETS.registry, feature._row, patch);
    logFeatureAudit({ featureKey: featureKey, action: 'updateFeatureFlag', beforeValue: beforeValue, afterValue: JSON.stringify(patch), message: '功能旗標已更新。' });
    return FF_response_(true, '功能旗標已更新。', { featureKey: featureKey, patch: patch });
  } catch (err) {
    return FF_fail_('功能旗標更新失敗。');
  }
}

function setTenantFeatureOverride(data) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var ctx = FF_ctx_(data);
  var featureKey = data.featureKey || '';
  if (!ctx.tenantId) return FF_fail_('缺少 tenantId。');
  if (!featureKey) return FF_fail_('請提供 featureKey。');

  try {
    var existed = DAL_findOne(GOVOPS_FEATURE_SHEETS.override, { tenantId: ctx.tenantId, filters: { featureKey: featureKey }, cache: false });
    var row = {
      overrideId: existed ? existed.overrideId : FF_id_('FOVR'),
      tenantId: ctx.tenantId,
      featureKey: featureKey,
      enabled: FF_bool_(data.enabled, true),
      reason: data.reason || '',
      updatedBy: data.updatedBy || ctx.userId,
      updatedAt: FF_now_()
    };
    if (existed && typeof DAL_updateByRow === 'function') DAL_updateByRow(GOVOPS_FEATURE_SHEETS.override, existed._row, row);
    else DAL_append(GOVOPS_FEATURE_SHEETS.override, row, FF_overrideHeaders_());
    logFeatureAudit({ tenantId: ctx.tenantId, userId: ctx.userId, featureKey: featureKey, action: 'setTenantFeatureOverride', afterValue: JSON.stringify(row), message: '租戶功能覆寫已設定。' });
    return FF_response_(true, '租戶功能覆寫已設定。', row);
  } catch (err) {
    return FF_fail_('租戶功能覆寫設定失敗。');
  }
}

function grantBetaFeatureAccess(data) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var ctx = FF_ctx_(data);
  var featureKey = data.featureKey || '';
  if (!ctx.tenantId) return FF_fail_('缺少 tenantId。');
  if (!featureKey) return FF_fail_('請提供 featureKey。');

  try {
    var existed = DAL_findOne(GOVOPS_FEATURE_SHEETS.betaAccess, { tenantId: ctx.tenantId, filters: { featureKey: featureKey }, cache: false });
    var row = {
      betaId: existed ? existed.betaId : FF_id_('BETA'),
      tenantId: ctx.tenantId,
      featureKey: featureKey,
      grantedBy: data.grantedBy || ctx.userId,
      expiresAt: data.expiresAt || FF_formatDate_(FF_addDays_(new Date(), 90)),
      status: 'ACTIVE',
      createdAt: existed ? existed.createdAt : FF_now_(),
      updatedAt: FF_now_()
    };
    if (existed && typeof DAL_updateByRow === 'function') DAL_updateByRow(GOVOPS_FEATURE_SHEETS.betaAccess, existed._row, row);
    else DAL_append(GOVOPS_FEATURE_SHEETS.betaAccess, row, FF_betaHeaders_());
    logFeatureAudit({ tenantId: ctx.tenantId, userId: ctx.userId, featureKey: featureKey, action: 'grantBetaFeatureAccess', afterValue: JSON.stringify(row), message: 'Beta 功能已授權。' });
    return FF_response_(true, 'Beta 功能已授權。', row);
  } catch (err) {
    return FF_fail_('Beta 功能授權失敗。');
  }
}

function revokeBetaFeatureAccess(data) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var ctx = FF_ctx_(data);
  var featureKey = data.featureKey || '';
  if (!ctx.tenantId) return FF_fail_('缺少 tenantId。');
  if (!featureKey) return FF_fail_('請提供 featureKey。');

  try {
    var beta = DAL_findOne(GOVOPS_FEATURE_SHEETS.betaAccess, { tenantId: ctx.tenantId, filters: { featureKey: featureKey }, cache: false });
    if (!beta) return FF_fail_('查無 Beta 功能授權。');
    DAL_updateByRow(GOVOPS_FEATURE_SHEETS.betaAccess, beta._row, { status: 'REVOKED', updatedAt: FF_now_() });
    logFeatureAudit({ tenantId: ctx.tenantId, userId: ctx.userId, featureKey: featureKey, action: 'revokeBetaFeatureAccess', beforeValue: JSON.stringify(beta), afterValue: 'REVOKED', message: 'Beta 功能已撤銷。' });
    return FF_response_(true, 'Beta 功能已撤銷。', { featureKey: featureKey, status: 'REVOKED' });
  } catch (err) {
    return FF_fail_('Beta 功能撤銷失敗。');
  }
}

function resolveFeatureAccess(data, featureKey) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var ctx = FF_ctx_(data);
  featureKey = featureKey || data.featureKey || '';
  if (!featureKey) return FF_fail_('請提供 featureKey。');

  try {
    var feature = DAL_findOne(GOVOPS_FEATURE_SHEETS.registry, { filters: { featureKey: featureKey }, cache: false });
    if (!feature) return FF_featureDecision_(false, 'FEATURE_NOT_FOUND', '功能不存在。', ctx, {}, 'none');
    if (String(feature.status) !== 'ACTIVE') return FF_featureDecision_(false, 'FEATURE_DISABLED', '功能目前未啟用。', ctx, feature, 'registry');

    var override = ctx.tenantId ? DAL_findOne(GOVOPS_FEATURE_SHEETS.override, { tenantId: ctx.tenantId, filters: { featureKey: featureKey }, cache: false }) : null;
    if (override) {
      return FF_featureDecision_(FF_bool_(override.enabled, false), 'TENANT_OVERRIDE', override.reason || '租戶覆寫設定。', ctx, feature, 'tenant_override');
    }

    if (FF_bool_(feature.betaOnly, false)) {
      var beta = ctx.tenantId ? DAL_findOne(GOVOPS_FEATURE_SHEETS.betaAccess, { tenantId: ctx.tenantId, filters: { featureKey: featureKey, status: 'ACTIVE' }, cache: false }) : null;
      if (!beta || FF_isExpired_(beta.expiresAt)) return FF_featureDecision_(false, 'BETA_REQUIRED', '此功能仍在 Beta 階段，尚未開放給此租戶。', ctx, feature, 'beta');
    }

    if (!FF_planAllowed_(ctx.plan, feature.minPlan)) {
      return FF_featureDecision_(false, 'PLAN_REQUIRED', '目前方案無法使用此功能，請升級方案。', ctx, feature, 'plan');
    }

    if (!FF_bool_(feature.defaultEnabled, true)) {
      return FF_featureDecision_(false, 'DEFAULT_DISABLED', '此功能預設未啟用。', ctx, feature, 'default');
    }

    var policy = checkModulePermission({ moduleName: feature.moduleName, role: ctx.userRole, operation: 'view' });
    if (policy && policy.success === false) {
      return FF_featureDecision_(false, 'ROLE_DENIED', policy.message || '目前角色無法使用此功能。', ctx, feature, 'role');
    }

    return FF_featureDecision_(true, 'ENABLED', '功能可用。', ctx, feature, 'resolved');
  } catch (err) {
    return FF_fail_('功能存取判斷失敗。');
  }
}

function assertDynamicFeatureAccess(data, featureKey) {
  var res = resolveFeatureAccess(data || {}, featureKey);
  if (!res.success) return res;
  if (res.data.enabled) return FF_response_(true, '功能可用。', res.data);
  var code = res.data.reasonCode;
  if (code === 'PLAN_REQUIRED') return FF_fail_('目前方案無法使用此功能，請升級方案。', res.data);
  if (code === 'BETA_REQUIRED') return FF_fail_('此功能目前為 Beta 功能，尚未開放給您的租戶。', res.data);
  if (code === 'ROLE_DENIED') return FF_fail_('目前角色權限無法使用此功能。', res.data);
  return FF_fail_(res.data.reason || '此功能目前無法使用。', res.data);
}

function getTenantFeatureMatrix(data) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var ctx = FF_ctx_(data);
  try {
    var features = DAL_query(GOVOPS_FEATURE_SHEETS.registry, { limit: 500, cache: false }).data.rows || [];
    var matrix = features.map(function(f) {
      var r = resolveFeatureAccess(data, f.featureKey);
      return {
        featureKey: f.featureKey,
        featureName: f.featureName,
        moduleName: f.moduleName,
        enabled: r.success && r.data ? r.data.enabled : false,
        reason: r.data ? r.data.reason : '功能判斷失敗',
        minPlan: f.minPlan,
        currentPlan: ctx.plan,
        betaOnly: f.betaOnly,
        source: r.data ? r.data.source : 'unknown'
      };
    });
    return FF_response_(true, '租戶功能矩陣取得完成。', { tenantId: ctx.tenantId, features: matrix });
  } catch (err) {
    return FF_fail_('租戶功能矩陣取得失敗。');
  }
}

function setModulePermissionPolicy(data) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var moduleName = data.moduleName || '';
  var role = String(data.role || '').toLowerCase();
  if (!moduleName || !role) return FF_fail_('請提供 moduleName 與 role。');

  try {
    var existed = DAL_findOne(GOVOPS_FEATURE_SHEETS.modulePolicy, { filters: { moduleName: moduleName, role: role }, cache: false });
    var row = {
      policyId: existed ? existed.policyId : FF_id_('POL'),
      moduleName: moduleName,
      role: role,
      canView: FF_bool_(data.canView, true),
      canCreate: FF_bool_(data.canCreate, false),
      canUpdate: FF_bool_(data.canUpdate, false),
      canDelete: FF_bool_(data.canDelete, false),
      canExport: FF_bool_(data.canExport, false),
      updatedAt: FF_now_()
    };
    if (existed && typeof DAL_updateByRow === 'function') DAL_updateByRow(GOVOPS_FEATURE_SHEETS.modulePolicy, existed._row, row);
    else DAL_append(GOVOPS_FEATURE_SHEETS.modulePolicy, row, FF_policyHeaders_());
    return FF_response_(true, '模組權限政策已設定。', row);
  } catch (err) {
    return FF_fail_('模組權限政策設定失敗。');
  }
}

function checkModulePermission(data) {
  var init = 初始化FeatureFlagRuntime_NoDefaults_();
  if (!init.success) return init;
  data = data || {};
  var moduleName = data.moduleName || '';
  var role = String(data.role || data.userRole || 'viewer').toLowerCase();
  var operation = String(data.operation || 'view').toLowerCase();
  if (!moduleName) return FF_fail_('請提供 moduleName。');

  try {
    if (role === 'owner') return FF_response_(true, 'owner 可使用此模組。');
    var policy = DAL_findOne(GOVOPS_FEATURE_SHEETS.modulePolicy, { filters: { moduleName: moduleName, role: role }, cache: false });
    if (!policy) return FF_fail_('目前角色未設定此模組權限。');
    var field = 'canView';
    if (operation === 'create') field = 'canCreate';
    if (operation === 'update') field = 'canUpdate';
    if (operation === 'delete') field = 'canDelete';
    if (operation === 'export') field = 'canExport';
    if (!FF_bool_(policy[field], false)) return FF_fail_('目前角色無法執行此操作。', { moduleName: moduleName, role: role, operation: operation });
    return FF_response_(true, '模組權限通過。', { moduleName: moduleName, role: role, operation: operation });
  } catch (err) {
    return FF_fail_('模組權限檢查失敗。');
  }
}

function logFeatureAudit(data) {
  data = data || {};
  try {
    if (typeof DAL_append !== 'function') return FF_response_(true, '略過功能稽核紀錄。');
    var ctx = FF_ctx_(data);
    DAL_append(GOVOPS_FEATURE_SHEETS.auditLog, {
      auditId: FF_id_('FAUD'),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      featureKey: data.featureKey || '',
      action: data.action || '',
      beforeValue: data.beforeValue || '',
      afterValue: data.afterValue || '',
      message: data.message || '',
      createdAt: FF_now_()
    }, FF_auditHeaders_());
    return FF_response_(true, '功能稽核紀錄已建立。');
  } catch (err) {
    return FF_response_(true, '功能稽核紀錄略過。');
  }
}

function featureFlagGuard(action, data) {
  data = data || {};
  var featureKey = FF_actionFeature_(action);
  if (!featureKey) return FF_response_(true, '此 action 不需功能旗標檢查。');
  return assertDynamicFeatureAccess(data, featureKey);
}

function handleFeatureFlagAction(action, data) {
  if (!GovOps_FeatureFlagActionMap[action]) return null;
  try {
    if (action === '初始化FeatureFlagRuntime') return 初始化FeatureFlagRuntime(data || {});
    if (action === 'registerFeatureFlag') return registerFeatureFlag(data || {});
    if (action === 'updateFeatureFlag') return updateFeatureFlag(data || {});
    if (action === 'setTenantFeatureOverride') return setTenantFeatureOverride(data || {});
    if (action === 'grantBetaFeatureAccess') return grantBetaFeatureAccess(data || {});
    if (action === 'revokeBetaFeatureAccess') return revokeBetaFeatureAccess(data || {});
    if (action === 'resolveFeatureAccess') return resolveFeatureAccess(data || {}, data && data.featureKey);
    if (action === 'getTenantFeatureMatrix') return getTenantFeatureMatrix(data || {});
    if (action === 'setModulePermissionPolicy') return setModulePermissionPolicy(data || {});
    if (action === 'checkModulePermission') return checkModulePermission(data || {});
    return null;
  } catch (err) {
    return FF_fail_('Feature Flag 系統暫時無法完成操作，請稍後再試。');
  }
}

function 建立預設核心功能旗標() {
  var defaults = [
    ['finance','財務模組','finance','應收、收款、支出與損益','STARTER',true,false],
    ['ai_secretary','AI 秘書','ai','AI 查詢、摘要與工作流建議','PRO',true,false],
    ['drive_archive','Drive 歸檔','document','Drive 文件歸檔','STARTER',true,false],
    ['advanced_crm','進階 CRM','crm','可行銷名單與 CRM 分析','PRO',true,false],
    ['analytics_dashboard','分析儀表板','analytics','KPI 與報表中心','PRO',true,false],
    ['multi_admin','多人管理','admin','多管理者與角色管理','ENTERPRISE',true,false],
    ['api_access','API 存取','api','Enterprise API Gateway','ENTERPRISE',true,false],
    ['line_bot','LINE Bot','line','LINE Bot 與推播','PRO',true,false],
    ['calendar_sync','Calendar 同步','calendar','Google Calendar 整合','STARTER',true,false],
    ['data_warehouse','資料倉儲','analytics','Data Warehouse Runtime','PRO',true,false],
    ['automation','自動化引擎','automation','Automation Runtime','PRO',true,false],
    ['command_center','指揮中心','admin','Command Center Runtime','ENTERPRISE',true,false],
    ['billing','帳務系統','billing','Billing Runtime','STARTER',true,false],
    ['tenant_lifecycle','租戶生命週期','tenant','Tenant Lifecycle Runtime','ENTERPRISE',true,false]
  ];
  defaults.forEach(function(d) {
    var existed = DAL_findOne(GOVOPS_FEATURE_SHEETS.registry, { filters: { featureKey: d[0] }, cache: false });
    if (!existed) {
      DAL_append(GOVOPS_FEATURE_SHEETS.registry, {
        featureKey: d[0], featureName: d[1], moduleName: d[2], description: d[3], minPlan: d[4], defaultEnabled: d[5], betaOnly: d[6], status: 'ACTIVE', createdAt: FF_now_(), updatedAt: FF_now_()
      }, FF_registryHeaders_());
    }
  });
}

function 建立預設模組權限政策() {
  var roles = ['admin','finance','staff','viewer'];
  var modules = ['finance','ai','document','crm','analytics','admin','api','line','calendar','automation','billing','tenant'];
  modules.forEach(function(moduleName) {
    roles.forEach(function(role) {
      var existed = DAL_findOne(GOVOPS_FEATURE_SHEETS.modulePolicy, { filters: { moduleName: moduleName, role: role }, cache: false });
      if (existed) return;
      var canView = role !== 'viewer' || ['crm','analytics'].indexOf(moduleName) >= 0;
      var canCreate = ['admin','finance','staff'].indexOf(role) >= 0 && moduleName !== 'admin' && moduleName !== 'api' && moduleName !== 'tenant';
      var canUpdate = ['admin','finance'].indexOf(role) >= 0 && moduleName !== 'api' && moduleName !== 'tenant';
      var canDelete = false;
      var canExport = ['admin','finance'].indexOf(role) >= 0;
      if (role === 'admin') { canView = true; canCreate = true; canUpdate = true; canExport = true; }
      DAL_append(GOVOPS_FEATURE_SHEETS.modulePolicy, { policyId: FF_id_('POL'), moduleName: moduleName, role: role, canView: canView, canCreate: canCreate, canUpdate: canUpdate, canDelete: canDelete, canExport: canExport, updatedAt: FF_now_() }, FF_policyHeaders_());
    });
  });
}

function 初始化FeatureFlagRuntime_NoDefaults_() {
  var err = FF_requireDAL_();
  if (err) return err;
  try {
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.registry, FF_registryHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.override, FF_overrideHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.rolloutLog, FF_rolloutHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.betaAccess, FF_betaHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.modulePolicy, FF_policyHeaders_());
    DAL_ensureHeaders_(GOVOPS_FEATURE_SHEETS.auditLog, FF_auditHeaders_());
    return FF_response_(true, 'Feature Flag Runtime 初始化完成。');
  } catch (err) {
    return FF_fail_('Feature Flag Runtime 初始化失敗。');
  }
}

function FF_featureDecision_(enabled, reasonCode, reason, ctx, feature, source) {
  return FF_response_(true, '功能存取判斷完成。', {
    enabled: enabled === true,
    reasonCode: reasonCode,
    reason: reason,
    featureKey: feature.featureKey || '',
    featureName: feature.featureName || '',
    moduleName: feature.moduleName || '',
    minPlan: feature.minPlan || '',
    currentPlan: ctx.plan,
    betaOnly: feature.betaOnly || false,
    source: source || ''
  });
}

function FF_actionFeature_(action) {
  var map = {
    '建立應收帳款': 'finance', '登錄收款': 'finance', '登錄支出': 'finance', '查詢未收款': 'finance', '查詢專案損益': 'finance',
    'AI秘書查詢': 'ai_secretary', 'AI任務路由': 'ai_secretary', '產生秘書摘要': 'ai_secretary',
    '建立Drive資料夾': 'drive_archive', '查詢可行銷名單': 'advanced_crm', '產生管理總報表': 'analytics_dashboard',
    'createAPIKey': 'api_access', 'validateAPIKey': 'api_access', 'LINE推播': 'line_bot', '建立Calendar事件': 'calendar_sync',
    '重建租戶資料倉儲': 'data_warehouse', '觸發自動化': 'automation', '取得指揮中心總覽': 'command_center',
    'createInvoice': 'billing', 'markInvoicePaid': 'billing', '建立租戶環境': 'tenant_lifecycle'
  };
  return map[action] || '';
}

function FF_planAllowed_(currentPlan, minPlan) {
  var rank = { FREE: 0, STARTER: 1, PRO: 2, ENTERPRISE: 3 };
  return Number(rank[String(currentPlan || 'FREE').toUpperCase()] || 0) >= Number(rank[String(minPlan || 'FREE').toUpperCase()] || 0);
}

function FF_bool_(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback === true;
  if (value === true || value === 'true' || value === 'TRUE' || value === '是' || value === 1 || value === '1') return true;
  return false;
}

function FF_formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function FF_addDays_(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function FF_isExpired_(expiresAt) {
  if (!expiresAt) return false;
  var d = new Date(expiresAt);
  if (String(d) === 'Invalid Date') return false;
  return d < new Date();
}

function 測試_RegisterFeatureFlag() {
  return registerFeatureFlag({ featureKey: 'qa_feature', featureName: 'QA 功能', moduleName: 'qa', minPlan: 'FREE', defaultEnabled: true, betaOnly: false, status: 'ACTIVE' });
}

function 測試_TenantFeatureOverride() {
  registerFeatureFlag({ featureKey: 'qa_override', featureName: 'QA 覆寫', moduleName: 'qa', minPlan: 'FREE', defaultEnabled: false, betaOnly: false, status: 'ACTIVE' });
  return setTenantFeatureOverride({ tenantId: 'QA-FF', userId: 'QA-USER', featureKey: 'qa_override', enabled: true, reason: '測試開啟' });
}

function 測試_BetaFeatureAccess() {
  registerFeatureFlag({ featureKey: 'qa_beta', featureName: 'QA Beta', moduleName: 'qa', minPlan: 'FREE', defaultEnabled: true, betaOnly: true, status: 'ACTIVE' });
  return grantBetaFeatureAccess({ tenantId: 'QA-FF', userId: 'QA-USER', featureKey: 'qa_beta', grantedBy: 'QA-USER' });
}

function 測試_FeatureMatrix() {
  初始化FeatureFlagRuntime();
  return getTenantFeatureMatrix({ tenantId: 'QA-FF', userId: 'QA-USER', userRole: 'owner', plan: 'ENTERPRISE' });
}

function 測試_ModulePermissionPolicy() {
  setModulePermissionPolicy({ moduleName: 'qa', role: 'staff', canView: true, canCreate: true, canUpdate: false, canDelete: false, canExport: false });
  return checkModulePermission({ moduleName: 'qa', role: 'staff', operation: 'create' });
}
