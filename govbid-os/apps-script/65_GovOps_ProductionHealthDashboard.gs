/*
GovOps OS｜65_GovOps_ProductionHealthDashboard.gs
Production Health Dashboard Runtime v1.0.0

目的：
1. Production Health Snapshot
2. Runtime Dependency Diagnosis
3. Production Error Analytics
4. Tenant Operation Status
5. Production Self Check

注意：
- Production Stabilization Phase
- 不新增業務功能
- 不修改 router
- 不破壞既有 runtime
*/

var GOVOPS_PRODUCTION_HEALTH_VERSION = '1.0.0';

var GOVOPS_PRODUCTION_HEALTH_SHEETS = {
  snapshot: 'ProductionHealthSnapshot',
  dependency: 'RuntimeDependencyStatus',
  errorAnalytics: 'ProductionErrorAnalytics',
  tenantStatus: 'TenantOperationStatus'
};

var GovOps_ProductionHealthActionMap = {
  '初始化ProductionHealthDashboard': true,
  'checkRuntimeDependencies': true,
  'collectProductionHealthSnapshot': true,
  'analyzeProductionErrors': true,
  'getTenantOperationStatus': true,
  'getProductionHealthDashboard': true,
  'runProductionSelfCheck': true
};

function productionHealthResponse(success, message, data) {
  return {
    success: success === true,
    message: message || (success ? '操作完成。' : '操作失敗。'),
    data: data || {}
  };
}

function productionHealthFail(message, data) {
  return productionHealthResponse(false, message || 'Production Health Dashboard 執行失敗。', data || {});
}

function PH_now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function PH_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function PH_snapshotHeaders_() {
  return ['snapshotId','時間','系統狀態','runtime狀態','tenant數','activeTenant數','errorCount','warningCount','最近部署版本','備註'];
}

function PH_dependencyHeaders_() {
  return ['runtimeName','是否存在','狀態','最後檢查時間','錯誤訊息'];
}

function PH_errorHeaders_() {
  return ['時間','tenantId','userId','action','錯誤類型','錯誤訊息','來源','處理狀態'];
}

function PH_tenantStatusHeaders_() {
  return ['tenantId','組織名稱','plan','billingState','tenantStatus','最近登入','最近操作','錯誤數','狀態'];
}

function 初始化ProductionHealthDashboard() {
  try {
    if (typeof DAL_ensureHeaders_ === 'function') {
      DAL_ensureHeaders_(GOVOPS_PRODUCTION_HEALTH_SHEETS.snapshot, PH_snapshotHeaders_());
      DAL_ensureHeaders_(GOVOPS_PRODUCTION_HEALTH_SHEETS.dependency, PH_dependencyHeaders_());
      DAL_ensureHeaders_(GOVOPS_PRODUCTION_HEALTH_SHEETS.errorAnalytics, PH_errorHeaders_());
      DAL_ensureHeaders_(GOVOPS_PRODUCTION_HEALTH_SHEETS.tenantStatus, PH_tenantStatusHeaders_());
    } else if (typeof ensureSheet === 'function') {
      ensureSheet(GOVOPS_PRODUCTION_HEALTH_SHEETS.snapshot, PH_snapshotHeaders_());
      ensureSheet(GOVOPS_PRODUCTION_HEALTH_SHEETS.dependency, PH_dependencyHeaders_());
      ensureSheet(GOVOPS_PRODUCTION_HEALTH_SHEETS.errorAnalytics, PH_errorHeaders_());
      ensureSheet(GOVOPS_PRODUCTION_HEALTH_SHEETS.tenantStatus, PH_tenantStatusHeaders_());
    } else {
      return productionHealthFail('資料表初始化工具尚未載入。');
    }
    return productionHealthResponse(true, 'Production Health Dashboard 初始化完成。', { version: GOVOPS_PRODUCTION_HEALTH_VERSION });
  } catch (err) {
    return productionHealthFail('Production Health Dashboard 初始化失敗。');
  }
}

function checkRuntimeDependencies() {
  初始化ProductionHealthDashboard();
  var required = [
    'routeWithEnterpriseRuntime',
    'handleRuntimeComposedAction',
    'normalizeRuntimeContext',
    'assertTenantActive',
    'assertBillingGoodStanding',
    'apiGatewayGuard',
    'featureFlagGuard',
    'assertPlanLimit',
    'incrementUsage',
    'handleAuthAction',
    'handleBillingAction',
    'handleTenantLifecycleAction',
    'handleFeatureFlagAction',
    'handleAPIGatewayAction'
  ];

  var rows = required.map(function(name) {
    var exists = typeof this[name] === 'function';
    return {
      runtimeName: name,
      是否存在: exists ? '是' : '否',
      狀態: exists ? 'OK' : 'MISSING',
      最後檢查時間: PH_now_(),
      錯誤訊息: exists ? '' : '必要 Runtime 函式不存在。'
    };
  });

  PH_replaceSheetRows_(GOVOPS_PRODUCTION_HEALTH_SHEETS.dependency, PH_dependencyHeaders_(), rows);

  var missing = rows.filter(function(r) { return r['狀態'] !== 'OK'; });
  return productionHealthResponse(true, 'Runtime 相依檢查完成。', {
    total: rows.length,
    ok: rows.length - missing.length,
    missing: missing.length,
    dependencies: rows
  });
}

function collectProductionHealthSnapshot(data) {
  初始化ProductionHealthDashboard();
  data = data || {};
  try {
    var deps = checkRuntimeDependencies();
    var tenantStatus = getTenantOperationStatus(data);
    var errors = analyzeProductionErrors(data);

    var dependencyMissing = deps.data ? Number(deps.data.missing || 0) : 0;
    var errorCount = errors.data ? Number(errors.data.errorCount || 0) : 0;
    var warningCount = dependencyMissing + (errors.data ? Number(errors.data.warningCount || 0) : 0);
    var tenants = tenantStatus.data && tenantStatus.data.tenants ? tenantStatus.data.tenants : [];
    var activeTenantCount = tenants.filter(function(t) { return String(t.tenantStatus).toLowerCase() === 'active'; }).length;

    var systemStatus = 'HEALTHY';
    if (warningCount > 0) systemStatus = 'WARNING';
    if (dependencyMissing > 3 || errorCount > 20) systemStatus = 'RISK';

    var row = {
      snapshotId: PH_id_('PHS'),
      時間: PH_now_(),
      系統狀態: systemStatus,
      runtime狀態: dependencyMissing === 0 ? 'OK' : 'MISSING_DEPENDENCIES',
      tenant數: tenants.length,
      activeTenant數: activeTenantCount,
      errorCount: errorCount,
      warningCount: warningCount,
      最近部署版本: data.deployVersion || data.version || GOVOPS_PRODUCTION_HEALTH_VERSION,
      備註: data.note || ''
    };

    PH_append_(GOVOPS_PRODUCTION_HEALTH_SHEETS.snapshot, row, PH_snapshotHeaders_());
    return productionHealthResponse(true, 'Production Health Snapshot 已建立。', row);
  } catch (err) {
    return productionHealthFail('Production Health Snapshot 建立失敗。');
  }
}

function analyzeProductionErrors(data) {
  初始化ProductionHealthDashboard();
  data = data || {};
  try {
    var errors = [];
    var runtimeLogs = [];

    if (typeof DAL_query === 'function') {
      try {
        errors = DAL_query('錯誤紀錄', { limit: data.limit || 500, cache: false }).data.rows || [];
      } catch (err1) { errors = []; }

      try {
        runtimeLogs = DAL_query('RuntimeAuditLog', { limit: data.limit || 500, cache: false }).data.rows || [];
      } catch (err2) { runtimeLogs = []; }
    }

    var runtimeFailures = runtimeLogs.filter(function(r) { return String(r.status || r['status'] || '').toLowerCase() === 'failed'; });
    var rows = [];

    errors.forEach(function(e) {
      rows.push({
        時間: e['時間'] || PH_now_(),
        tenantId: e.tenantId || e['組織ID'] || '',
        userId: e.userId || e['使用者ID'] || '',
        action: e['功能模組'] || '',
        錯誤類型: 'CoreError',
        錯誤訊息: e['錯誤摘要'] || '',
        來源: '錯誤紀錄',
        處理狀態: e['處理狀態'] || '未處理'
      });
    });

    runtimeFailures.forEach(function(r) {
      rows.push({
        時間: r['建立時間'] || PH_now_(),
        tenantId: r.tenantId || '',
        userId: r.userId || '',
        action: r.action || '',
        錯誤類型: 'RuntimeFailure',
        錯誤訊息: r['備註'] || '',
        來源: 'RuntimeAuditLog',
        處理狀態: '未處理'
      });
    });

    PH_replaceSheetRows_(GOVOPS_PRODUCTION_HEALTH_SHEETS.errorAnalytics, PH_errorHeaders_(), rows.slice(0, 500));

    return productionHealthResponse(true, 'Production Error Analytics 分析完成。', {
      errorCount: rows.length,
      warningCount: runtimeFailures.length,
      coreErrors: errors.length,
      runtimeFailures: runtimeFailures.length,
      latest: rows.slice(0, 20)
    });
  } catch (err) {
    return productionHealthFail('Production Error Analytics 分析失敗。');
  }
}

function getTenantOperationStatus(data) {
  初始化ProductionHealthDashboard();
  data = data || {};
  try {
    var tenants = [];
    var subscriptions = [];
    var logins = [];
    var runtimeLogs = [];
    var billingSummaries = {};

    if (typeof DAL_query === 'function') {
      try { tenants = DAL_query('組織資料表', { limit: data.limit || 500, cache: false }).data.rows || []; } catch (err1) { tenants = []; }
      try { subscriptions = DAL_query('SaaS訂閱表', { limit: data.limit || 500, cache: false }).data.rows || []; } catch (err2) { subscriptions = []; }
      try { logins = DAL_query('登入紀錄表', { limit: data.limit || 500, cache: false }).data.rows || []; } catch (err3) { logins = []; }
      try { runtimeLogs = DAL_query('RuntimeAuditLog', { limit: data.limit || 500, cache: false }).data.rows || []; } catch (err4) { runtimeLogs = []; }
    }

    var statusRows = tenants.map(function(t) {
      var tenantId = t.tenantId || t['組織ID'] || '';
      var sub = PH_findByTenant_(subscriptions, tenantId);
      var tenantLogs = runtimeLogs.filter(function(r) { return String(r.tenantId || '') === String(tenantId); });
      var tenantErrors = tenantLogs.filter(function(r) { return String(r.status || '').toLowerCase() === 'failed'; });
      var tenantLogin = PH_latestByTenant_(logins, tenantId);
      var lastOp = tenantLogs.length ? tenantLogs[0]['建立時間'] || tenantLogs[0].createdAt || '' : '';
      var billingState = '';

      if (typeof getTenantBillingSummary === 'function') {
        try {
          var bs = getTenantBillingSummary({ tenantId: tenantId, plan: sub ? (sub.plan || sub['方案名稱']) : '' });
          if (bs && bs.success && bs.data) {
            billingState = bs.data.billingState || '';
            billingSummaries[tenantId] = bs.data;
          }
        } catch (err5) {}
      }

      var tenantStatus = t.status || t['狀態'] || '';
      var rowStatus = 'OK';
      if (String(tenantStatus).toLowerCase() !== 'active') rowStatus = 'INACTIVE';
      if (tenantErrors.length > 0) rowStatus = 'WARNING';
      if (billingState === 'PAST_DUE' || billingState === 'CANCELED' || billingState === 'EXPIRED') rowStatus = 'BILLING_RISK';

      return {
        tenantId: tenantId,
        組織名稱: t.organizationName || t['組織名稱'] || t.name || '',
        plan: sub ? (sub.plan || sub['方案名稱'] || '') : '',
        billingState: billingState || '',
        tenantStatus: tenantStatus || '',
        最近登入: tenantLogin ? (tenantLogin['建立時間'] || tenantLogin.createdAt || tenantLogin['登入時間'] || '') : '',
        最近操作: lastOp || '',
        錯誤數: tenantErrors.length,
        狀態: rowStatus
      };
    });

    PH_replaceSheetRows_(GOVOPS_PRODUCTION_HEALTH_SHEETS.tenantStatus, PH_tenantStatusHeaders_(), statusRows);

    return productionHealthResponse(true, 'Tenant Operation Status 彙整完成。', {
      tenants: statusRows,
      billingSummaries: billingSummaries
    });
  } catch (err) {
    return productionHealthFail('Tenant Operation Status 彙整失敗。');
  }
}

function getProductionHealthDashboard(data) {
  初始化ProductionHealthDashboard();
  data = data || {};
  try {
    var dependencies = checkRuntimeDependencies();
    var errors = analyzeProductionErrors(data);
    var tenants = getTenantOperationStatus(data);
    var latestSnapshot = PH_latestSnapshot_();
    var warnings = PH_buildWarnings_(dependencies, errors, tenants);
    var recommendations = PH_buildRecommendations_(warnings);

    return productionHealthResponse(true, 'Production Health Dashboard 取得完成。', {
      runtimeDependencies: dependencies.data || {},
      latestSnapshot: latestSnapshot,
      tenantStatus: tenants.data || {},
      errorAnalytics: errors.data || {},
      warnings: warnings,
      recommendations: recommendations
    });
  } catch (err) {
    return productionHealthFail('Production Health Dashboard 取得失敗。');
  }
}

function runProductionSelfCheck(data) {
  初始化ProductionHealthDashboard();
  data = data || {};
  try {
    var dependencies = checkRuntimeDependencies();
    var snapshot = collectProductionHealthSnapshot(data);
    var errors = analyzeProductionErrors(data);
    var tenants = getTenantOperationStatus(data);
    return productionHealthResponse(true, 'Production Self Check 執行完成。', {
      runtimeDependencies: dependencies.data || {},
      snapshot: snapshot.data || {},
      errorAnalytics: errors.data || {},
      tenantStatus: tenants.data || {}
    });
  } catch (err) {
    return productionHealthFail('Production Self Check 執行失敗。');
  }
}

function handleProductionHealthAction(action, data) {
  try {
    if (!GovOps_ProductionHealthActionMap[action]) return null;
    if (action === '初始化ProductionHealthDashboard') return 初始化ProductionHealthDashboard(data || {});
    if (action === 'checkRuntimeDependencies') return checkRuntimeDependencies(data || {});
    if (action === 'collectProductionHealthSnapshot') return collectProductionHealthSnapshot(data || {});
    if (action === 'analyzeProductionErrors') return analyzeProductionErrors(data || {});
    if (action === 'getTenantOperationStatus') return getTenantOperationStatus(data || {});
    if (action === 'getProductionHealthDashboard') return getProductionHealthDashboard(data || {});
    if (action === 'runProductionSelfCheck') return runProductionSelfCheck(data || {});
    return null;
  } catch (err) {
    return productionHealthFail('Production Health Action 執行失敗。');
  }
}

function PH_append_(sheetName, row, headers) {
  if (typeof DAL_append === 'function') return DAL_append(sheetName, row, headers);
  if (typeof appendObject === 'function') return appendObject(sheetName, row);
}

function PH_replaceSheetRows_(sheetName, headers, rows) {
  try {
    if (typeof getSheet !== 'function') return;
    var sheet = getSheet(sheetName);
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (!rows || !rows.length) return;
    var values = rows.map(function(row) {
      return headers.map(function(h) { return row[h] !== undefined ? row[h] : ''; });
    });
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  } catch (err) {}
}

function PH_latestSnapshot_() {
  try {
    if (typeof DAL_query !== 'function') return {};
    var rows = DAL_query(GOVOPS_PRODUCTION_HEALTH_SHEETS.snapshot, { limit: 1, cache: false }).data.rows || [];
    return rows.length ? rows[0] : {};
  } catch (err) {
    return {};
  }
}

function PH_findByTenant_(rows, tenantId) {
  return (rows || []).filter(function(r) {
    return String(r.tenantId || r['組織ID'] || '') === String(tenantId);
  })[0] || null;
}

function PH_latestByTenant_(rows, tenantId) {
  var filtered = (rows || []).filter(function(r) {
    return String(r.tenantId || r['組織ID'] || '') === String(tenantId);
  });
  return filtered.length ? filtered[0] : null;
}

function PH_buildWarnings_(dependencies, errors, tenants) {
  var warnings = [];
  var depData = dependencies.data || {};
  if (Number(depData.missing || 0) > 0) warnings.push('有必要 Runtime 函式尚未載入。');
  var errData = errors.data || {};
  if (Number(errData.errorCount || 0) > 0) warnings.push('目前存在 production 錯誤紀錄，需檢查錯誤分析表。');
  var tenantRows = tenants.data && tenants.data.tenants ? tenants.data.tenants : [];
  var riskTenants = tenantRows.filter(function(t) { return t['狀態'] !== 'OK'; });
  if (riskTenants.length > 0) warnings.push('有租戶狀態需注意，包含帳務、停用或錯誤風險。');
  return warnings;
}

function PH_buildRecommendations_(warnings) {
  if (!warnings || !warnings.length) return ['目前系統狀態穩定，建議維持定期巡檢。'];
  var rec = [];
  warnings.forEach(function(w) {
    if (w.indexOf('Runtime') >= 0) rec.push('請先補齊缺少的 Runtime 檔案，並重新部署 Apps Script。');
    if (w.indexOf('錯誤') >= 0) rec.push('請查看 ProductionErrorAnalytics，優先處理 RuntimeFailure 與 CoreError。');
    if (w.indexOf('租戶') >= 0) rec.push('請查看 TenantOperationStatus，確認 tenantStatus、billingState 與最近操作。');
  });
  return rec.length ? rec : ['請依照 warnings 逐項檢查。'];
}

function 測試_ProductionHealthDashboard() {
  return getProductionHealthDashboard({ tenantId: 'QA-PROD', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' });
}

function 測試_RuntimeDependencyCheck() {
  return checkRuntimeDependencies();
}

function 測試_ProductionSelfCheck() {
  return runProductionSelfCheck({ tenantId: 'QA-PROD', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' });
}
