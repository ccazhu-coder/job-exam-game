/**
 * GovOps OS ERP Production Router Patch
 * 目的：先讓平台可以正式使用，而不是繼續擴充新功能。
 * 貼到 Apps Script 主專案後，在 doGet / doPost router 最前面呼叫 govopsProductionRoute(params)。
 */

function govopsProductionRoute(params) {
  params = params || {};
  var action = String(params.action || '');
  try {
    if (typeof erpRoute === 'function') {
      var erpResult = erpRoute(params);
      if (erpResult) return erpResult;
    }
    if (typeof erpWorkflowRoute === 'function') {
      var workflowResult = erpWorkflowRoute(params);
      if (workflowResult) return workflowResult;
    }
    if (typeof erpDriveRoute === 'function') {
      var driveResult = erpDriveRoute(params);
      if (driveResult) return driveResult;
    }
    if (typeof erpDashboardRoute === 'function') {
      var dashboardResult = erpDashboardRoute(params);
      if (dashboardResult) return dashboardResult;
    }
    if (action === '正式平台健康檢查' || action === 'production.health') {
      return govopsProductionHealth(params);
    }
    if (action === '正式平台初始化' || action === 'production.init') {
      return govopsProductionInit(params);
    }
    return null;
  } catch (err) {
    return { success: false, message: '正式平台 Router 發生錯誤：' + err.message, data: { action: action } };
  }
}

function govopsProductionInit(params) {
  var result = { success: true, message: '正式平台初始化完成', data: {} };
  if (typeof erpInitCommercialSchema === 'function') result.data.erp = erpInitCommercialSchema(params);
  if (typeof erpEnsureDriveTables_ === 'function') {
    erpEnsureDriveTables_();
    result.data.drive = 'ok';
  }
  return result;
}

function govopsProductionHealth(params) {
  var data = {
    time: new Date().toISOString(),
    modules: {
      erpRoute: typeof erpRoute === 'function',
      erpWorkflowRoute: typeof erpWorkflowRoute === 'function',
      erpDriveRoute: typeof erpDriveRoute === 'function',
      erpDashboardRoute: typeof erpDashboardRoute === 'function'
    },
    requiredSheets: []
  };
  try {
    if (typeof ERP_TABLES !== 'undefined') data.requiredSheets = Object.keys(ERP_TABLES);
  } catch (e) {}
  return { success: true, message: '正式平台健康檢查完成', data: data };
}

/**
 * doGet 接法範例：
 * function doGet(e) {
 *   var params = (e && e.parameter) ? e.parameter : {};
 *   var productionResult = govopsProductionRoute(params);
 *   if (productionResult) return jsonOutput(productionResult);
 *   // 原本 router 繼續
 * }
 */
