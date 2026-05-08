/*
GovOps OS｜21_GovOps_SaaSPlanEnforcement.gs
版本：SaaS Runtime Enforcement Layer v1.0.0
用途：建立真正的 SaaS Feature / Plan / Role 執行期權限控管。

重要原則：
- 不修改 15 / 17 / 18 / 19 / 20
- 不重寫 router
- 獨立 patch layer
- 中文錯誤
- 不顯示技術堆疊
- 與 20_GovOps_SaaSUsageMetering.gs 相容
*/

var GOVOPS_SAAS_PLAN_ENFORCEMENT_VERSION = '1.0.0';

var GovOps_PlanRank = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3
};

var GovOps_FeaturePlanMap = {
  finance: 'STARTER',
  ai_secretary: 'PRO',
  drive_archive: 'STARTER',
  advanced_crm: 'PRO',
  analytics_dashboard: 'PRO',
  multi_admin: 'ENTERPRISE',
  api_access: 'ENTERPRISE',
  line_bot: 'PRO',
  calendar_sync: 'STARTER'
};

var GovOps_RoleFeatureMap = {
  owner: ['all'],
  admin: ['finance', 'ai_secretary', 'crm', 'analytics', 'analytics_dashboard', 'drive_archive', 'calendar_sync'],
  finance: ['finance', 'analytics', 'analytics_dashboard'],
  staff: ['crm', 'calendar_sync'],
  viewer: ['query']
};

var GovOps_ActionFeatureMap = {
  '建立應收帳款': 'finance',
  '登錄收款': 'finance',
  '登錄支出': 'finance',
  'AI秘書查詢': 'ai_secretary',
  '產生秘書摘要': 'ai_secretary',
  '建立Drive資料夾': 'drive_archive',
  '查詢可行銷名單': 'advanced_crm',
  '查詢專案損益': 'analytics_dashboard',
  'LINE推播': 'line_bot',
  '同步GoogleCalendar': 'calendar_sync'
};

function hasPlanAccess(plan, feature) {
  plan = normalizePlan_(plan);
  feature = String(feature || '').trim();

  if (!feature) return false;
  if (!GovOps_FeaturePlanMap[feature]) return true;

  var requiredPlan = GovOps_FeaturePlanMap[feature];
  var currentRank = GovOps_PlanRank[plan];
  var requiredRank = GovOps_PlanRank[requiredPlan];

  if (currentRank === undefined) currentRank = GovOps_PlanRank.FREE;
  if (requiredRank === undefined) requiredRank = GovOps_PlanRank.ENTERPRISE;

  return currentRank >= requiredRank;
}

function hasRoleAccess(role, feature) {
  role = normalizeRole_(role);
  feature = String(feature || '').trim();

  if (!feature) return false;

  var allowed = GovOps_RoleFeatureMap[role] || [];
  if (allowed.indexOf('all') >= 0) return true;
  if (allowed.indexOf(feature) >= 0) return true;

  if (feature === 'advanced_crm' && allowed.indexOf('crm') >= 0) return true;
  if (feature === 'analytics_dashboard' && allowed.indexOf('analytics') >= 0) return true;

  return false;
}

function assertFeatureAccess(data, feature) {
  var ctx = getEnforcementContext_(data || {});
  feature = String(feature || '').trim();

  if (!feature) {
    return tenantFeatureFail('缺少功能代碼，無法檢查權限。', ctx, feature);
  }

  var planOk = hasPlanAccess(ctx.plan, feature);
  var roleOk = hasRoleAccess(ctx.userRole, feature);

  if (!planOk) {
    return tenantFeatureFail('目前方案無法使用此功能。' + getUpgradeMessage_(ctx.plan), ctx, feature, {
      reason: 'PLAN_DENIED',
      requiredPlan: GovOps_FeaturePlanMap[feature] || '',
      currentPlan: ctx.plan
    });
  }

  if (!roleOk) {
    return tenantFeatureFail('目前角色無法使用此功能，請切換管理者角色或請系統負責人協助。', ctx, feature, {
      reason: 'ROLE_DENIED',
      currentRole: ctx.userRole
    });
  }

  return tenantFeatureResponse('功能權限檢查通過。', {
    feature: feature,
    plan: ctx.plan,
    userRole: ctx.userRole,
    requiredPlan: GovOps_FeaturePlanMap[feature] || 'FREE'
  }, ctx);
}

function featureAwareAction(action, data, handler) {
  try {
    action = String(action || '').trim();
    var feature = GovOps_ActionFeatureMap[action];

    if (!feature) {
      if (typeof handler === 'function') return handler(data || {});
      return tenantFeatureFail('找不到此 action 對應的功能權限設定。', getEnforcementContext_(data || {}), '', { action: action });
    }

    var access = assertFeatureAccess(data || {}, feature);
    if (!access.success) return access;

    if (typeof handler !== 'function') {
      return tenantFeatureFail('系統尚未設定此功能處理器。', getEnforcementContext_(data || {}), feature, { action: action });
    }

    var result;
    if (typeof usageAwareAction === 'function') {
      result = usageAwareAction(action, data || {}, handler);
    } else {
      result = handler(data || {});
    }

    if (result && typeof result === 'object') {
      result.data = result.data || {};
      result.data.featureAccess = access.data || {};
    }

    return result;
  } catch (err) {
    return tenantFeatureFail('系統暫時無法完成操作，請稍後再試。', getEnforcementContext_(data || {}), GovOps_ActionFeatureMap[action] || '', { action: action, reason: 'FEATURE_ACTION_ERROR' });
  }
}

function handleFeatureAwareAction(action, data, handler) {
  return featureAwareAction(action, data, handler);
}

function tenantFeatureResponse(message, data, context) {
  context = context || getEnforcementContext_({});
  data = data || {};
  data.tenant = {
    tenantId: context.tenantId,
    userId: context.userId,
    userRole: context.userRole,
    plan: context.plan,
    組織ID: context.tenantId,
    使用者ID: context.userId,
    使用者角色: context.userRole,
    SaaS方案: context.plan
  };

  return {
    success: true,
    message: message || '操作完成。',
    data: data
  };
}

function tenantFeatureFail(message, context, feature, extraData) {
  context = context || getEnforcementContext_({});
  extraData = extraData || {};
  extraData.feature = feature || '';
  extraData.tenant = {
    tenantId: context.tenantId,
    userId: context.userId,
    userRole: context.userRole,
    plan: context.plan,
    組織ID: context.tenantId,
    使用者ID: context.userId,
    使用者角色: context.userRole,
    SaaS方案: context.plan
  };

  return {
    success: false,
    message: message || '目前方案或角色無法使用此功能。',
    data: extraData
  };
}

function getEnforcementContext_(data) {
  data = data || {};

  if (typeof getUsageContext === 'function') {
    var usageCtx = getUsageContext(data);
    return {
      tenantId: usageCtx.tenantId || 'TENANT-LOCAL',
      userId: usageCtx.userId || 'USER-LOCAL',
      userRole: normalizeRole_(firstEnforcementValue_(data.userRole, data['使用者角色'], data.role, 'owner')),
      plan: normalizePlan_(usageCtx.plan || data.plan || data['SaaS方案'] || 'FREE')
    };
  }

  if (typeof getTenantContext === 'function') {
    var tenantCtx = getTenantContext(data);
    return {
      tenantId: tenantCtx.tenantId || 'TENANT-LOCAL',
      userId: tenantCtx.userId || 'USER-LOCAL',
      userRole: normalizeRole_(tenantCtx.userRole || data.userRole || 'owner'),
      plan: normalizePlan_(tenantCtx.plan || data.plan || 'FREE')
    };
  }

  return {
    tenantId: firstEnforcementValue_(data.tenantId, data['組織ID'], 'TENANT-LOCAL'),
    userId: firstEnforcementValue_(data.userId, data['使用者ID'], 'USER-LOCAL'),
    userRole: normalizeRole_(firstEnforcementValue_(data.userRole, data['使用者角色'], data.role, 'owner')),
    plan: normalizePlan_(firstEnforcementValue_(data.plan, data['SaaS方案'], 'FREE'))
  };
}

function getUpgradeMessage_(plan) {
  plan = normalizePlan_(plan);
  if (plan === 'FREE') return '請升級 STARTER 或 PRO 方案。';
  if (plan === 'STARTER') return '請升級 PRO 方案。';
  if (plan === 'PRO') return '請聯絡企業方案。';
  return '請聯絡系統管理者確認方案權限。';
}

function normalizePlan_(plan) {
  plan = String(plan || 'FREE').trim().toUpperCase();
  if (!GovOps_PlanRank.hasOwnProperty(plan)) return 'FREE';
  return plan;
}

function normalizeRole_(role) {
  role = String(role || 'viewer').trim().toLowerCase();
  if (!GovOps_RoleFeatureMap.hasOwnProperty(role)) return 'viewer';
  return role;
}

function firstEnforcementValue_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function 測試_FeatureAccess() {
  var cases = [
    { tenantId: 'TENANT-FEATURE-TEST', userId: 'USER-OWNER-FREE', userRole: 'owner', plan: 'FREE', feature: 'finance' },
    { tenantId: 'TENANT-FEATURE-TEST', userId: 'USER-OWNER-STARTER', userRole: 'owner', plan: 'STARTER', feature: 'finance' },
    { tenantId: 'TENANT-FEATURE-TEST', userId: 'USER-OWNER-STARTER-AI', userRole: 'owner', plan: 'STARTER', feature: 'ai_secretary' },
    { tenantId: 'TENANT-FEATURE-TEST', userId: 'USER-ADMIN-PRO', userRole: 'admin', plan: 'PRO', feature: 'analytics_dashboard' },
    { tenantId: 'TENANT-FEATURE-TEST', userId: 'USER-OWNER-ENT', userRole: 'owner', plan: 'ENTERPRISE', feature: 'api_access' }
  ];

  return tenantFeatureResponse('Feature Access 測試完成。', {
    結果: cases.map(function(item) {
      return {
        plan: item.plan,
        role: item.userRole,
        feature: item.feature,
        result: assertFeatureAccess(item, item.feature)
      };
    })
  }, { tenantId: 'TENANT-FEATURE-TEST', userId: 'USER-TEST', userRole: 'owner', plan: 'PRO' });
}

function 測試_RoleAccess() {
  var roles = ['owner', 'admin', 'finance', 'staff', 'viewer'];
  var features = ['finance', 'ai_secretary', 'drive_archive', 'advanced_crm', 'analytics_dashboard', 'multi_admin', 'api_access', 'line_bot', 'calendar_sync'];
  var matrix = {};

  roles.forEach(function(role) {
    matrix[role] = {};
    features.forEach(function(feature) {
      matrix[role][feature] = hasRoleAccess(role, feature);
    });
  });

  return tenantFeatureResponse('Role Access 測試完成。', {
    角色權限矩陣: matrix,
    方案權限範例: {
      FREE_finance: hasPlanAccess('FREE', 'finance'),
      STARTER_finance: hasPlanAccess('STARTER', 'finance'),
      STARTER_ai_secretary: hasPlanAccess('STARTER', 'ai_secretary'),
      PRO_ai_secretary: hasPlanAccess('PRO', 'ai_secretary'),
      ENTERPRISE_api_access: hasPlanAccess('ENTERPRISE', 'api_access')
    }
  }, { tenantId: 'TENANT-ROLE-TEST', userId: 'USER-TEST', userRole: 'owner', plan: 'PRO' });
}

/*
最小 router 接入片段：

case '建立應收帳款':
  return handleFeatureAwareAction(action, data, 建立應收帳款);

或在 19_GovOps_TenantCoreIntegration.gs 的 handler 外層包：

return handleFeatureAwareAction(action, data, function(safeData) {
  return handleTenantCoreAction(action, safeData);
});

若需要同時套用 feature enforcement + usage metering：
featureAwareAction() 會在 usageAwareAction 存在時自動呼叫 usageAwareAction(action, data, handler)。
*/
