/* GovOps OS｜Tender Runtime Health v1
 * 目的：檢查 Tender ERP 核心模組、資料表、排程、日曆、財務摘要與健康狀態。
 */

function handleGovOpsTenderRuntimeHealthAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.runtime.health' || action === '標案系統健康檢查') return GovOpsTenderRuntime_health(data);
    if (action === 'tender.runtime.schema' || action === '標案資料表檢查') return GovOpsTenderRuntime_schema(data);
    if (action === 'tender.runtime.repair' || action === '修復標案資料表') return GovOpsTenderRuntime_repair(data);
    return null;
  } catch (err) {
    GovOpsTenderRuntime_logError('handleGovOpsTenderRuntimeHealthAction', err, data);
    return GovOpsTenderRuntime_fail('標案系統健康檢查暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_RUNTIME = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderRuntimeHealthAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_RUNTIME(action, data);
  };
}

function GovOpsTenderRuntime_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderRuntime_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }

function GovOpsTenderRuntime_health(data) {
  data = data || {};
  var schema = GovOpsTenderRuntime_schema(data).data;
  var triggers = GovOpsTenderRuntime_triggerHealth();
  var modules = GovOpsTenderRuntime_moduleHealth();
  var score = GovOpsTenderRuntime_score(schema, triggers, modules);
  return GovOpsTenderRuntime_success('標案系統健康檢查完成。', {
    score: score,
    status: score >= 90 ? 'healthy' : score >= 70 ? 'warning' : 'critical',
    schema: schema,
    triggers: triggers,
    modules: modules
  });
}

function GovOpsTenderRuntime_schema(data) {
  var required = GovOpsTenderRuntime_requiredSheets();
  var result = [];
  required.forEach(function(item) {
    var exists = GovOpsTenderRuntime_sheetExists(item.name);
    result.push({ sheet: item.name, exists: exists, requiredHeaders: item.headers.length, status: exists ? 'OK' : 'MISSING' });
  });
  return GovOpsTenderRuntime_success('標案資料表檢查完成。', { total: result.length, missing: result.filter(function(x){ return !x.exists; }).length, rows: result });
}

function GovOpsTenderRuntime_repair(data) {
  var required = GovOpsTenderRuntime_requiredSheets();
  var created = 0;
  required.forEach(function(item) {
    if (!GovOpsTenderRuntime_sheetExists(item.name) && typeof GovOpsProduct_ensureSheet === 'function') {
      GovOpsProduct_ensureSheet(item.name, item.headers);
      created++;
    }
  });
  return GovOpsTenderRuntime_success('標案資料表修復完成。', { created: created });
}

function GovOpsTenderRuntime_requiredSheets() {
  return [
    { name: '04_標案池', headers: ['標案ID','tenantId','標案名稱','機關名稱','預算金額','標案狀態'] },
    { name: '29_標案歷史分析', headers: ['分析ID','tenantId','標案ID','標案名稱','是否疑似新標案'] },
    { name: '30_標案廠商知識庫', headers: ['紀錄ID','tenantId','標案ID','廠商名稱','廠商角色'] },
    { name: '31_投標決策評分', headers: ['評分ID','tenantId','標案ID','總分','投標建議'] },
    { name: '32_標案流程追蹤', headers: ['流程ID','tenantId','標案ID','目前階段','完成率'] },
    { name: '33_標案工作任務', headers: ['任務ID','tenantId','標案ID','任務名稱','任務狀態'] },
    { name: '34_標案日曆紀錄', headers: ['日曆ID','tenantId','標案ID','事件類型','日曆狀態'] },
    { name: '35_標案CRM', headers: ['CRMID','tenantId','關係類型','單位名稱'] },
    { name: '36_標案費用核銷', headers: ['費用ID','tenantId','標案ID','科目','金額'] },
    { name: '37_標案合約金額', headers: ['合約ID','tenantId','標案ID','簽約金額','可請款金額','核定金額'] },
    { name: '38_標案財務摘要', headers: ['摘要ID','tenantId','標案ID','毛利','毛利率'] }
  ];
}

function GovOpsTenderRuntime_sheetExists(name) {
  try { return !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); } catch (err) { return false; }
}

function GovOpsTenderRuntime_triggerHealth() {
  var names = ['GovOpsTenderIntel_dailyTrigger'];
  var triggers = ScriptApp.getProjectTriggers().map(function(t){ return t.getHandlerFunction(); });
  return names.map(function(name){ return { trigger: name, installed: triggers.indexOf(name) >= 0 }; });
}

function GovOpsTenderRuntime_moduleHealth() {
  var checks = [
    ['TenderHistory', 'GovOpsTenderHistory_analyze'],
    ['VendorKB', 'GovOpsTenderVendorKB_summary'],
    ['Decision', 'GovOpsTenderDecision_score'],
    ['Pipeline', 'GovOpsTenderPipeline_create'],
    ['Task', 'GovOpsTenderTask_generate'],
    ['Calendar', 'GovOpsTenderCalendar_create'],
    ['KPI', 'GovOpsTenderKpi_summary'],
    ['CRM', 'GovOpsTenderCRM_create'],
    ['Reimbursement', 'GovOpsTenderReimb_create'],
    ['Contract', 'GovOpsTenderContract_create'],
    ['FinanceSummary', 'GovOpsTenderFinance_summary']
  ];
  return checks.map(function(x){ return { module: x[0], loaded: typeof this[x[1]] === 'function' }; }, this);
}

function GovOpsTenderRuntime_score(schema, triggers, modules) {
  var s = 100;
  s -= (schema.missing || 0) * 6;
  s -= triggers.filter(function(t){ return !t.installed; }).length * 5;
  s -= modules.filter(function(m){ return !m.loaded; }).length * 4;
  return Math.max(0, s);
}

function GovOpsTenderRuntime_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderRuntime_Health() { return GovOpsTenderRuntime_health({ tenantId: 'TENANT-DEMO' }); }
