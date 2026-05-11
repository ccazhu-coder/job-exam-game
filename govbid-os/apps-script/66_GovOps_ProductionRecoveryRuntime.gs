/*
GovOps OS｜66_GovOps_ProductionRecoveryRuntime.gs
Production Recovery Runtime v1.0.0

目的：
1. 自動偵測缺失資料表
2. 自動修復缺失 Runtime Tables
3. 偵測缺失 Runtime Functions
4. Production Recovery Report
5. 穩定化與恢復能力

注意：
- 不新增業務功能
- 不修改 router
- 不破壞既有 runtime
*/

var GOVOPS_PRODUCTION_RECOVERY_VERSION = '1.0.0';
var GOVOPS_PRODUCTION_RECOVERY_LOG_SHEET = 'ProductionRecoveryLog';

var GovOps_ProductionRecoveryActionMap = {
  '初始化ProductionRecoveryRuntime': true,
  'detectMissingRuntimeTables': true,
  'repairMissingRuntimeTables': true,
  'detectMissingRuntimeFunctions': true,
  'repairRuntimeHealth': true,
  'createRecoveryReport': true
};

function PRR_response_(success, message, data) {
  return { success: success === true, message: message || (success ? '操作完成。' : '操作失敗。'), data: data || {} };
}

function PRR_fail_(message, data) {
  return PRR_response_(false, message || 'Production Recovery Runtime 執行失敗。', data || {});
}

function PRR_now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function PRR_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function PRR_headers_() {
  return ['recoveryId','時間','tenantId','recoveryType','target','status','message','beforeState','afterState','執行者'];
}

function PRR_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化ProductionRecoveryRuntime() {
  try {
    if (typeof DAL_ensureHeaders_ === 'function') {
      DAL_ensureHeaders_(GOVOPS_PRODUCTION_RECOVERY_LOG_SHEET, PRR_headers_());
    } else if (typeof ensureSheet === 'function') {
      ensureSheet(GOVOPS_PRODUCTION_RECOVERY_LOG_SHEET, PRR_headers_());
    } else {
      return PRR_fail_('資料表初始化工具尚未載入。');
    }
    return PRR_response_(true, 'Production Recovery Runtime 初始化完成。', { version: GOVOPS_PRODUCTION_RECOVERY_VERSION });
  } catch (err) {
    return PRR_fail_('Production Recovery Runtime 初始化失敗。');
  }
}

function detectMissingRuntimeTables(data) {
  初始化ProductionRecoveryRuntime();
  data = data || {};
  try {
    var required = PRR_requiredTables_();
    var existing = PRR_existingSheets_();
    var missing = required.filter(function(name) { return existing.indexOf(name) < 0; });
    var result = { requiredTables: required, existingTables: existing, missingTables: missing, missingCount: missing.length };
    logProductionRecovery(Object.assign({}, data, { recoveryType: 'detect_tables', target: 'runtime_tables', status: missing.length ? 'WARNING' : 'OK', message: '缺表數：' + missing.length, beforeState: '', afterState: JSON.stringify(missing) }));
    return PRR_response_(true, 'Runtime 資料表檢查完成。', result);
  } catch (err) {
    return PRR_fail_('Runtime 資料表檢查失敗。');
  }
}

function repairMissingRuntimeTables(data) {
  初始化ProductionRecoveryRuntime();
  data = data || {};
  try {
    var detected = detectMissingRuntimeTables(data);
    if (!detected.success) return detected;
    var missing = detected.data.missingTables || [];
    var repairResults = [];

    if (!missing.length) {
      logProductionRecovery(Object.assign({}, data, { recoveryType: 'repair_tables', target: 'runtime_tables', status: 'OK', message: '未發現缺失資料表。', beforeState: 'no_missing', afterState: 'no_action' }));
      return PRR_response_(true, '未發現缺失資料表。', { missingTables: [], repairedTables: [], results: [] });
    }

    PRR_repairGroups_(missing).forEach(function(group) {
      repairResults.push(PRR_callInitializer_(group.fnName, data, group.label));
    });

    var after = detectMissingRuntimeTables(data);
    var stillMissing = after.data ? after.data.missingTables || [] : missing;
    var repaired = missing.filter(function(name) { return stillMissing.indexOf(name) < 0; });

    logProductionRecovery(Object.assign({}, data, { recoveryType: 'repair_tables', target: 'runtime_tables', status: stillMissing.length ? 'PARTIAL' : 'OK', message: '已修復：' + repaired.length + '，仍缺：' + stillMissing.length, beforeState: JSON.stringify(missing), afterState: JSON.stringify(stillMissing) }));

    return PRR_response_(true, 'Runtime 資料表修復流程完成。', {
      missingTables: missing,
      repairedTables: repaired,
      stillMissingTables: stillMissing,
      results: repairResults
    });
  } catch (err) {
    return PRR_fail_('Runtime 資料表修復失敗。');
  }
}

function detectMissingRuntimeFunctions(data) {
  初始化ProductionRecoveryRuntime();
  data = data || {};
  try {
    var required = [
      'routeWithEnterpriseRuntime',
      'handleRuntimeComposedAction',
      'handleAuthAction',
      'handleBillingAction',
      'handleTenantLifecycleAction',
      'handleFeatureFlagAction',
      'handleAPIGatewayAction',
      'runProductionSelfCheck'
    ];
    var status = required.map(function(name) {
      var exists = typeof this[name] === 'function';
      return { functionName: name, exists: exists, status: exists ? 'OK' : 'MISSING' };
    });
    var missing = status.filter(function(r) { return !r.exists; }).map(function(r) { return r.functionName; });

    logProductionRecovery(Object.assign({}, data, { recoveryType: 'detect_functions', target: 'runtime_functions', status: missing.length ? 'WARNING' : 'OK', message: '缺少函式數：' + missing.length, beforeState: '', afterState: JSON.stringify(missing) }));

    return PRR_response_(true, 'Runtime 函式檢查完成。', {
      requiredFunctions: required,
      missingFunctions: missing,
      missingCount: missing.length,
      status: status
    });
  } catch (err) {
    return PRR_fail_('Runtime 函式檢查失敗。');
  }
}

function repairRuntimeHealth(data) {
  初始化ProductionRecoveryRuntime();
  data = data || {};
  try {
    var detectTables = detectMissingRuntimeTables(data);
    var repairTables = repairMissingRuntimeTables(data);
    var detectFunctions = detectMissingRuntimeFunctions(data);
    var selfCheck = typeof runProductionSelfCheck === 'function' ? runProductionSelfCheck(data) : PRR_fail_('Production Self Check 尚未載入。');

    var report = createRecoveryReport(Object.assign({}, data, {
      detectTables: detectTables.data || {},
      repairTables: repairTables.data || {},
      detectFunctions: detectFunctions.data || {},
      selfCheck: selfCheck.data || {}
    }));

    logProductionRecovery(Object.assign({}, data, { recoveryType: 'repair_health', target: 'production_runtime', status: report.data && report.data.status ? report.data.status : 'UNKNOWN', message: report.message || 'Runtime Health 修復流程完成。', beforeState: JSON.stringify(detectTables.data || {}), afterState: JSON.stringify(report.data || {}) }));

    return PRR_response_(true, 'Production Runtime Health 修復流程完成。', {
      detectTables: detectTables,
      repairTables: repairTables,
      detectFunctions: detectFunctions,
      selfCheck: selfCheck,
      report: report
    });
  } catch (err) {
    return PRR_fail_('Production Runtime Health 修復失敗。');
  }
}

function createRecoveryReport(data) {
  初始化ProductionRecoveryRuntime();
  data = data || {};
  try {
    var tableInfo = data.detectTables || (detectMissingRuntimeTables(data).data || {});
    var repairInfo = data.repairTables || {};
    var functionInfo = data.detectFunctions || (detectMissingRuntimeFunctions(data).data || {});

    var missingTables = tableInfo.missingTables || [];
    var repairedTables = repairInfo.repairedTables || [];
    var stillMissingTables = repairInfo.stillMissingTables || missingTables;
    var missingFunctions = functionInfo.missingFunctions || [];
    var recommendations = [];

    if (stillMissingTables.length) recommendations.push('仍有資料表缺失，請確認對應 Runtime 檔案已部署並手動執行初始化。');
    if (missingFunctions.length) recommendations.push('仍有 Runtime 函式缺失，請確認 Apps Script 專案已包含所有 runtime 檔案。');
    if (!stillMissingTables.length && !missingFunctions.length) recommendations.push('Production Runtime 狀態穩定，建議執行部署驗收與前端健康檢查。');

    var status = 'OK';
    if (stillMissingTables.length || missingFunctions.length) status = 'WARNING';
    if (stillMissingTables.length > 3 || missingFunctions.length > 3) status = 'RISK';

    var report = {
      missingTables: missingTables,
      repairedTables: repairedTables,
      stillMissingTables: stillMissingTables,
      missingFunctions: missingFunctions,
      recommendations: recommendations,
      status: status
    };

    logProductionRecovery(Object.assign({}, data, { recoveryType: 'recovery_report', target: 'production_runtime', status: status, message: 'Recovery Report 已產生。', beforeState: JSON.stringify({ missingTables: missingTables, missingFunctions: missingFunctions }), afterState: JSON.stringify(report) }));

    return PRR_response_(true, 'Recovery Report 已產生。', report);
  } catch (err) {
    return PRR_fail_('Recovery Report 產生失敗。');
  }
}

function logProductionRecovery(data) {
  初始化ProductionRecoveryRuntime_NoLog_();
  data = data || {};
  try {
    var ctx = PRR_ctx_(data);
    var row = {
      recoveryId: data.recoveryId || PRR_id_('REC'),
      時間: PH_safeNow_(),
      tenantId: ctx.tenantId,
      recoveryType: data.recoveryType || '',
      target: data.target || '',
      status: data.status || '',
      message: data.message || '',
      beforeState: data.beforeState || '',
      afterState: data.afterState || '',
      執行者: data.executor || ctx.userId || 'system'
    };
    if (typeof DAL_append === 'function') DAL_append(GOVOPS_PRODUCTION_RECOVERY_LOG_SHEET, row, PRR_headers_());
    else if (typeof appendObject === 'function') appendObject(GOVOPS_PRODUCTION_RECOVERY_LOG_SHEET, row);
    return PRR_response_(true, 'Production Recovery Log 已建立。', row);
  } catch (err) {
    return PRR_response_(true, 'Production Recovery Log 略過。');
  }
}

function handleProductionRecoveryAction(action, data) {
  try {
    if (!GovOps_ProductionRecoveryActionMap[action]) return null;
    if (action === '初始化ProductionRecoveryRuntime') return 初始化ProductionRecoveryRuntime(data || {});
    if (action === 'detectMissingRuntimeTables') return detectMissingRuntimeTables(data || {});
    if (action === 'repairMissingRuntimeTables') return repairMissingRuntimeTables(data || {});
    if (action === 'detectMissingRuntimeFunctions') return detectMissingRuntimeFunctions(data || {});
    if (action === 'repairRuntimeHealth') return repairRuntimeHealth(data || {});
    if (action === 'createRecoveryReport') return createRecoveryReport(data || {});
    return null;
  } catch (err) {
    return PRR_fail_('Production Recovery Action 執行失敗。');
  }
}

function PRR_requiredTables_() {
  return [
    'TenantLifecycle',
    'TenantSubscriptionState',
    'SaaSInvoice',
    'SaaSPayment',
    'APIKeyRegistry',
    'FeatureFlagRegistry',
    'RuntimeAuditLog',
    'RuntimeDependencyStatus',
    'ProductionHealthSnapshot',
    '使用者帳號表',
    '組織資料表'
  ];
}

function PRR_existingSheets_() {
  try {
    if (typeof ss === 'function') return ss().getSheets().map(function(s) { return s.getName(); });
    return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function(s) { return s.getName(); });
  } catch (err) {
    return [];
  }
}

function PRR_repairGroups_(missing) {
  var groups = [];
  if (PRR_hasAny_(missing, ['TenantLifecycle','TenantSubscriptionState'])) groups.push({ fnName: '初始化TenantLifecycleRuntime', label: 'Tenant Lifecycle Runtime' });
  if (PRR_hasAny_(missing, ['SaaSInvoice','SaaSPayment'])) groups.push({ fnName: '初始化BillingRuntime', label: 'Billing Runtime' });
  if (PRR_hasAny_(missing, ['APIKeyRegistry'])) groups.push({ fnName: '初始化APIGatewayRuntime', label: 'API Gateway Runtime' });
  if (PRR_hasAny_(missing, ['FeatureFlagRegistry'])) groups.push({ fnName: '初始化FeatureFlagRuntime', label: 'Feature Flag Runtime' });
  if (PRR_hasAny_(missing, ['RuntimeAuditLog'])) groups.push({ fnName: '初始化RuntimeComposer', label: 'Runtime Composer' });
  if (PRR_hasAny_(missing, ['RuntimeDependencyStatus','ProductionHealthSnapshot'])) groups.push({ fnName: '初始化ProductionHealthDashboard', label: 'Production Health Dashboard' });
  if (PRR_hasAny_(missing, ['使用者帳號表','組織資料表'])) groups.push({ fnName: '初始化Auth資料表', label: 'Auth Runtime' });
  if (PRR_hasAny_(missing, ['使用者帳號表','組織資料表'])) groups.push({ fnName: '初始化系統', label: 'Core System' });
  return groups;
}

function PRR_callInitializer_(fnName, data, label) {
  try {
    if (typeof this[fnName] !== 'function') {
      return { label: label || fnName, fnName: fnName, success: false, message: '初始化函式不存在。' };
    }
    var res = this[fnName](data || {});
    return { label: label || fnName, fnName: fnName, success: res && res.success !== false, message: res && res.message ? res.message : '已執行初始化。' };
  } catch (err) {
    return { label: label || fnName, fnName: fnName, success: false, message: '初始化執行失敗。' };
  }
}

function PRR_hasAny_(arr, targets) {
  return targets.some(function(t) { return arr.indexOf(t) >= 0; });
}

function 初始化ProductionRecoveryRuntime_NoLog_() {
  try {
    if (typeof DAL_ensureHeaders_ === 'function') DAL_ensureHeaders_(GOVOPS_PRODUCTION_RECOVERY_LOG_SHEET, PRR_headers_());
    else if (typeof ensureSheet === 'function') ensureSheet(GOVOPS_PRODUCTION_RECOVERY_LOG_SHEET, PRR_headers_());
  } catch (err) {}
}

function PH_safeNow_() {
  try { return PRR_now_(); } catch (err) { return new Date().toISOString(); }
}

function 測試_ProductionRecovery_DetectTables() {
  return detectMissingRuntimeTables({ tenantId: 'QA-RECOVERY', userId: 'QA-USER' });
}

function 測試_ProductionRecovery_DetectFunctions() {
  return detectMissingRuntimeFunctions({ tenantId: 'QA-RECOVERY', userId: 'QA-USER' });
}

function 測試_ProductionRecovery_Report() {
  return createRecoveryReport({ tenantId: 'QA-RECOVERY', userId: 'QA-USER' });
}
