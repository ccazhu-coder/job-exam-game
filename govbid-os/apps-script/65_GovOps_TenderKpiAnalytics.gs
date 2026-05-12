/* GovOps OS｜Tender KPI Analytics v1
 * 目的：彙整標案池、決策評分、流程、任務、日曆，形成 Tender ERP 管理指標。
 */

function handleGovOpsTenderKpiAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.kpi.summary' || action === '標案KPI總覽') return GovOpsTenderKpi_summary(data);
    if (action === 'tender.kpi.pipeline' || action === '標案流程KPI') return GovOpsTenderKpi_pipeline(data);
    if (action === 'tender.kpi.tasks' || action === '標案任務KPI') return GovOpsTenderKpi_tasks(data);
    return null;
  } catch (err) {
    GovOpsTenderKpi_logError('handleGovOpsTenderKpiAction', err, data);
    return GovOpsTenderKpi_fail('標案KPI功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_KPI = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderKpiAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_KPI(action, data);
  };
}

function GovOpsTenderKpi_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderKpi_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }

function GovOpsTenderKpi_summary(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenders = GovOpsTenderKpi_rows(GOVOPS_PRODUCT_SHEETS && GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池', tenantId);
  var decisions = GovOpsTenderKpi_rows('31_投標決策評分', tenantId);
  var pipelines = GovOpsTenderKpi_rows('32_標案流程追蹤', tenantId);
  var tasks = GovOpsTenderKpi_rows('33_標案工作任務', tenantId);
  var calendars = GovOpsTenderKpi_rows('34_標案日曆紀錄', tenantId);
  var statusMap = GovOpsTenderKpi_countBy(tenders, '標案狀態');
  var avgScore = GovOpsTenderKpi_average(decisions, '總分');
  var highPotential = decisions.filter(function(r){ return Number(r.總分 || 0) >= 75; }).length;
  var openTasks = tasks.filter(function(r){ return ['待執行','進行中','異常'].indexOf(String(r.任務狀態 || '')) >= 0; }).length;
  var doneTasks = tasks.filter(function(r){ return String(r.任務狀態 || '') === '已完成'; }).length;
  var upcomingCalendar = calendars.filter(function(r){ return String(r.日曆狀態 || '') === '已建立'; }).length;
  return GovOpsTenderKpi_success('標案KPI總覽完成。', {
    tenderTotal: tenders.length,
    statusMap: statusMap,
    decisionTotal: decisions.length,
    averageDecisionScore: avgScore,
    highPotentialTenderCount: highPotential,
    pipelineTotal: pipelines.length,
    taskTotal: tasks.length,
    openTaskCount: openTasks,
    completedTaskCount: doneTasks,
    calendarEventCount: upcomingCalendar,
    kpis: [
      { name: '標案總數', value: tenders.length },
      { name: '高潛力標案', value: highPotential },
      { name: '平均投標分數', value: avgScore },
      { name: '待處理任務', value: openTasks },
      { name: '已完成任務', value: doneTasks },
      { name: '日曆提醒', value: upcomingCalendar }
    ]
  });
}

function GovOpsTenderKpi_pipeline(data) {
  var tenantId = (data || {}).tenantId || 'TENANT-DEMO';
  var rows = GovOpsTenderKpi_rows('32_標案流程追蹤', tenantId);
  return GovOpsTenderKpi_success('標案流程KPI完成。', { total: rows.length, byStage: GovOpsTenderKpi_countBy(rows, '目前階段'), byStatus: GovOpsTenderKpi_countBy(rows, '流程狀態') });
}

function GovOpsTenderKpi_tasks(data) {
  var tenantId = (data || {}).tenantId || 'TENANT-DEMO';
  var rows = GovOpsTenderKpi_rows('33_標案工作任務', tenantId);
  return GovOpsTenderKpi_success('標案任務KPI完成。', { total: rows.length, byStatus: GovOpsTenderKpi_countBy(rows, '任務狀態'), byPriority: GovOpsTenderKpi_countBy(rows, '優先級'), byStage: GovOpsTenderKpi_countBy(rows, '任務階段') });
}

function GovOpsTenderKpi_rows(sheetName, tenantId) {
  try {
    if (typeof GovOpsProduct_readRows !== 'function') return [];
    return GovOpsProduct_readRows(sheetName).filter(function(row){ return String(row.tenantId || '') === String(tenantId || ''); });
  } catch (err) { return []; }
}

function GovOpsTenderKpi_countBy(rows, key) {
  var out = {};
  (rows || []).forEach(function(row){ var v = row[key] || '未分類'; out[v] = (out[v] || 0) + 1; });
  return out;
}

function GovOpsTenderKpi_average(rows, key) {
  var nums = (rows || []).map(function(r){ return Number(r[key] || 0); }).filter(function(n){ return !isNaN(n) && n > 0; });
  if (!nums.length) return 0;
  return Math.round(nums.reduce(function(a,b){ return a+b; }, 0) / nums.length);
}

function GovOpsTenderKpi_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderKpi_Summary() { return GovOpsTenderKpi_summary({ tenantId: 'TENANT-DEMO' }); }
