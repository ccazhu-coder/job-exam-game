/*
GovOps OS｜22_GovOps_RouterRuntimeComposer.gs
版本：Router Runtime Composer v1.0.0
用途：把 17 / 18 / 19 / 20 / 21 patch layer 串成統一 runtime composer。

重要原則：
- 不修改 15 / 17 / 18 / 19 / 20 / 21
- 不重寫 router
- 原 router 只需要接一個入口
- handler 回傳 null 時，不中斷原 router
- 中文錯誤
- 不顯示技術堆疊

最小 router 接入方式：

var composed = handleComposedGovOpsAction(action, data, function(runtimeData) {
  return handleTenantCoreAction(action, runtimeData);
});

if (composed) return outputJson(composed);

若 handleTenantCoreAction 回傳 null，composer 也會回傳 null，讓原 switch 繼續處理。
*/

var GOVOPS_RUNTIME_COMPOSER_VERSION = '1.0.0';

function composeGovOpsRuntime(action, data, originalHandler) {
  try {
    action = String(action || '').trim();
    var normalizedData = runtimeNormalizeData_(data || {});

    var guard = runtimeTenantGuard_(action, normalizedData);
    if (!guard.success) {
      return runtimeComposerFail(guard.message || '請先登入或重新整理頁面後再試。', {
        action: action,
        stage: 'tenantRouterGuard',
        reason: 'TENANT_GUARD_FAILED'
      });
    }

    normalizedData = guard.data || normalizedData;

    var feature = safeResolveActionFeature(action);
    if (feature) {
      var featureCheck = runtimeAssertFeature_(normalizedData, feature);
      if (!featureCheck.success) return featureCheck;
    }

    var metric = safeResolveActionMetric(action);
    if (metric) {
      var limitCheck = runtimeAssertPlanLimit_(normalizedData, metric);
      if (!limitCheck.success) return limitCheck;
    }

    if (typeof originalHandler !== 'function') {
      return runtimeComposerFail('系統尚未設定此功能處理器。', {
        action: action,
        stage: 'originalHandler'
      });
    }

    var result = originalHandler(normalizedData);

    if (result === null || result === undefined) {
      return null;
    }

    if (result && result.success === false) {
      return runtimeAttachComposerMeta_(result, action, normalizedData, feature, metric);
    }

    if (metric) {
      var usageResult = runtimeIncrementUsage_(normalizedData, metric, 1);
      if (result && typeof result === 'object') {
        result.data = result.data || {};
        result.data.usageMetering = usageResult && usageResult.data ? usageResult.data : usageResult;
      }
    }

    result = runtimeTenantFilterResult_(result, normalizedData);
    return runtimeAttachComposerMeta_(result, action, normalizedData, feature, metric);
  } catch (err) {
    return runtimeComposerFail('系統暫時無法完成操作，請稍後再試。', {
      action: action,
      stage: 'composeGovOpsRuntime',
      reason: 'RUNTIME_COMPOSER_ERROR'
    });
  }
}

function safeResolveActionFeature(action) {
  try {
    action = String(action || '').trim();
    if (typeof GovOps_ActionFeatureMap !== 'undefined' && GovOps_ActionFeatureMap[action]) {
      return GovOps_ActionFeatureMap[action];
    }
    return '';
  } catch (err) {
    return '';
  }
}

function safeResolveActionMetric(action) {
  try {
    action = String(action || '').trim();
    if (typeof GovOps_UsageActionMetricMap !== 'undefined' && GovOps_UsageActionMetricMap[action]) {
      return GovOps_UsageActionMetricMap[action];
    }
    return '';
  } catch (err) {
    return '';
  }
}

function shouldUseTenantRuntime(action) {
  try {
    action = String(action || '').trim();
    if (!action) return false;

    if (typeof GovOps_TenantActionMap !== 'undefined' && GovOps_TenantActionMap.hasOwnProperty(action)) return true;
    if (typeof GovOps_TenantCoreActionMap !== 'undefined' && GovOps_TenantCoreActionMap.hasOwnProperty(action)) return true;
    if (typeof GovOps_UsageActionMetricMap !== 'undefined' && GovOps_UsageActionMetricMap.hasOwnProperty(action)) return true;
    if (typeof GovOps_ActionFeatureMap !== 'undefined' && GovOps_ActionFeatureMap.hasOwnProperty(action)) return true;

    return false;
  } catch (err) {
    return false;
  }
}

function handleComposedGovOpsAction(action, data, originalHandler) {
  try {
    if (!shouldUseTenantRuntime(action)) return null;
    return composeGovOpsRuntime(action, data || {}, originalHandler);
  } catch (err) {
    return runtimeComposerFail('系統暫時無法完成操作，請稍後再試。', {
      action: action,
      stage: 'handleComposedGovOpsAction',
      reason: 'COMPOSED_ACTION_ERROR'
    });
  }
}

function runtimeComposerFail(message, extra) {
  extra = extra || {};
  return runtimeComposerResponse(false, message || '系統暫時無法完成操作，請稍後再試。', extra);
}

function runtimeComposerResponse(success, message, data) {
  return {
    success: !!success,
    message: message || (success ? '操作完成。' : '操作失敗。'),
    data: data || {}
  };
}

function runtimeNormalizeData_(data) {
  try {
    if (typeof normalizeTenantData === 'function') return normalizeTenantData(data || {});
    if (typeof getTenantContext === 'function') {
      var ctx = getTenantContext(data || {});
      var copy = runtimeCopyObject_(data || {});
      copy.tenantId = ctx.tenantId;
      copy.userId = ctx.userId;
      copy.userRole = ctx.userRole;
      copy.plan = ctx.plan;
      copy['組織ID'] = ctx.tenantId;
      copy['使用者ID'] = ctx.userId;
      copy['使用者角色'] = ctx.userRole;
      copy['SaaS方案'] = ctx.plan;
      return copy;
    }
  } catch (err) {}
  return data || {};
}

function runtimeTenantGuard_(action, data) {
  try {
    if (typeof tenantRouterGuard === 'function') return tenantRouterGuard(action, data || {});
    return { success: true, required: false, action: action, data: data || {} };
  } catch (err) {
    return { success: false, message: '租戶檢查失敗，請重新登入後再試。', data: data || {} };
  }
}

function runtimeAssertFeature_(data, feature) {
  try {
    if (typeof assertFeatureAccess === 'function') return assertFeatureAccess(data || {}, feature);
    return runtimeComposerResponse(true, '功能權限檢查略過。', { feature: feature });
  } catch (err) {
    return runtimeComposerFail('功能權限檢查失敗，請稍後再試。', { feature: feature, stage: 'assertFeatureAccess' });
  }
}

function runtimeAssertPlanLimit_(data, metric) {
  try {
    if (typeof assertPlanLimit === 'function') return assertPlanLimit(data || {}, metric);
    return runtimeComposerResponse(true, '方案使用量檢查略過。', { metric: metric });
  } catch (err) {
    return runtimeComposerFail('方案使用量檢查失敗，請稍後再試。', { metric: metric, stage: 'assertPlanLimit' });
  }
}

function runtimeIncrementUsage_(data, metric, amount) {
  try {
    if (typeof incrementUsage === 'function') return incrementUsage(data || {}, metric, amount || 1);
    return runtimeComposerResponse(true, '使用量計算略過。', { metric: metric, amount: amount || 1 });
  } catch (err) {
    return runtimeComposerFail('使用量更新失敗，請稍後再試。', { metric: metric, stage: 'incrementUsage' });
  }
}

function runtimeTenantFilterResult_(result, data) {
  try {
    if (typeof tenantFilterResult === 'function') return tenantFilterResult(result, data || {});
    return result;
  } catch (err) {
    return result;
  }
}

function runtimeAttachComposerMeta_(result, action, data, feature, metric) {
  if (!result || typeof result !== 'object') return result;
  result.data = result.data || {};
  result.data.runtimeComposer = {
    version: GOVOPS_RUNTIME_COMPOSER_VERSION,
    action: action,
    feature: feature || '',
    metric: metric || '',
    tenantId: data && data.tenantId ? data.tenantId : '',
    userId: data && data.userId ? data.userId : '',
    userRole: data && data.userRole ? data.userRole : '',
    plan: data && data.plan ? data.plan : ''
  };
  return result;
}

function runtimeCopyObject_(obj) {
  var copy = {};
  Object.keys(obj || {}).forEach(function(key) { copy[key] = obj[key]; });
  return copy;
}

function 測試_RuntimeComposer_新增活動() {
  var data = {
    tenantId: 'TENANT-RUNTIME-TEST',
    userId: 'USER-RUNTIME-TEST',
    userRole: 'owner',
    plan: 'PRO',
    '活動名稱': 'Runtime Composer 測試活動',
    '活動日期': runtimeToday_(),
    '活動地點': '測試地點'
  };

  return handleComposedGovOpsAction('新增活動', data, function(runtimeData) {
    return {
      success: true,
      message: '測試新增活動 handler 已執行。',
      data: {
        活動ID: 'ACT-RUNTIME-TEST',
        runtimeData: runtimeData
      }
    };
  });
}

function 測試_RuntimeComposer_財務權限() {
  var data = {
    tenantId: 'TENANT-RUNTIME-FINANCE',
    userId: 'USER-RUNTIME-FINANCE',
    userRole: 'staff',
    plan: 'FREE'
  };

  return handleComposedGovOpsAction('建立應收帳款', data, function(runtimeData) {
    return {
      success: true,
      message: '這段不應該在 FREE/staff 權限下被執行。',
      data: { runtimeData: runtimeData }
    };
  });
}

function 測試_RuntimeComposer_AI限制() {
  var data = {
    tenantId: 'TENANT-RUNTIME-AI',
    userId: 'USER-RUNTIME-AI',
    userRole: 'owner',
    plan: 'STARTER'
  };

  return handleComposedGovOpsAction('AI秘書查詢', data, function(runtimeData) {
    return {
      success: true,
      message: '這段不應該在 STARTER AI 權限下被執行。',
      data: { runtimeData: runtimeData }
    };
  });
}

function runtimeToday_() {
  try {
    if (typeof today === 'function') return today();
  } catch (err) {}
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

/*
進階接入範例：

var composed = handleComposedGovOpsAction(action, data, function(runtimeData) {
  var tenantHandled = handleTenantCoreAction(action, runtimeData);
  if (tenantHandled) return tenantHandled;
  return null;
});

if (composed) return outputJson(composed);

// composed 為 null 時，代表：
// 1. action 不需要 runtime composer，或
// 2. handleTenantCoreAction 回傳 null
// 此時繼續交給原 switch(action) 處理。
*/
