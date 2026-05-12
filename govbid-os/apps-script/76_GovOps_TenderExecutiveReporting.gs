/* GovOps OS｜Tender Executive Reporting v1
 * 目的：產生標案週報、月報、老闆摘要，整合 KPI、推薦、風險、財務與任務。
 */

function handleGovOpsTenderExecutiveReportAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.report.generate' || action === '產生標案報告') return GovOpsTenderReport_generate(data);
    if (action === 'tender.report.query' || action === '查詢標案報告') return GovOpsTenderReport_query(data);
    return null;
  } catch (err) {
    GovOpsTenderReport_logError('handleGovOpsTenderExecutiveReportAction', err, data);
    return GovOpsTenderReport_fail('標案報告暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_REPORT = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderExecutiveReportAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_REPORT(action, data);
  };
}

function GovOpsTenderReport_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderReport_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderReport_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderReport_sheetName() { return '44_標案營運報告'; }

function GovOpsTenderReport_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderReport_sheetName(), ['報告ID','tenantId','報告類型','報告期間','標案總數','高潛力標案','高風險標案','待處理任務','簽約總額','可請款總額','未收款總額','毛利摘要','老闆摘要','下一步建議','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderReport_generate(data) {
  data = data || {};
  GovOpsTenderReport_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var type = data.報告類型 || data.reportType || '週報';
  var period = data.報告期間 || data.period || GovOpsTenderReport_defaultPeriod(type);
  var kpi = GovOpsTenderReport_safeCall('GovOpsTenderKpi_summary', { tenantId: tenantId }).data || {};
  var recRows = GovOpsTenderReport_rows('42_標案AI推薦', tenantId);
  var riskRows = GovOpsTenderReport_rows('43_標案風險分析', tenantId);
  var financeRows = GovOpsTenderReport_rows('38_標案財務摘要', tenantId);
  var taskRows = GovOpsTenderReport_rows('33_標案工作任務', tenantId);
  var highRisk = riskRows.filter(function(r){ return String(r.風險等級 || '') === '高'; }).length;
  var finance = GovOpsTenderReport_finance(financeRows);
  var summary = GovOpsTenderReport_buildSummary(kpi, recRows, riskRows, finance, taskRows);
  var next = GovOpsTenderReport_nextActions(recRows, riskRows, taskRows, finance);
  var row = {
    報告ID: 'TER-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    報告類型: type,
    報告期間: period,
    標案總數: kpi.tenderTotal || 0,
    高潛力標案: kpi.highPotentialTenderCount || 0,
    高風險標案: highRisk,
    待處理任務: kpi.openTaskCount || 0,
    簽約總額: finance.signed,
    可請款總額: finance.claimable,
    未收款總額: finance.receivable,
    毛利摘要: finance.marginText,
    老闆摘要: summary,
    下一步建議: next,
    建立時間: GovOpsTenderReport_now(),
    更新時間: GovOpsTenderReport_now(),
    userId: data.userId || '',
    備註: '本報告由 Tender Executive Reporting 自動產生。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderReport_sheetName(), row);
  return GovOpsTenderReport_success('標案營運報告已產生。', row);
}

function GovOpsTenderReport_query(data) {
  data = data || {};
  GovOpsTenderReport_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.報告類型 || '').trim();
  var rows = GovOpsTenderReport_rows(GovOpsTenderReport_sheetName(), tenantId);
  rows = rows.filter(function(row){ return !keyword || JSON.stringify(row).indexOf(keyword) >= 0; });
  return GovOpsTenderReport_success('標案營運報告查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderReport_rows(sheetName, tenantId) {
  try {
    if (typeof GovOpsProduct_readRows !== 'function') return [];
    return GovOpsProduct_readRows(sheetName).filter(function(row){ return String(row.tenantId || '') === String(tenantId); });
  } catch (err) { return []; }
}

function GovOpsTenderReport_safeCall(fnName, data) {
  try {
    if (typeof this[fnName] === 'function') return this[fnName](data);
  } catch (err) {}
  return { success: false, data: {} };
}

function GovOpsTenderReport_finance(rows) {
  var signed = 0, claimable = 0, receivable = 0, profit = 0;
  rows.forEach(function(r){
    signed += GovOpsTenderReport_num(r.簽約金額);
    claimable += GovOpsTenderReport_num(r.可請款金額 || r.核定金額);
    receivable += GovOpsTenderReport_num(r.未收款金額);
    profit += GovOpsTenderReport_num(r.毛利);
  });
  return { signed: signed, claimable: claimable, receivable: receivable, profit: profit, marginText: '毛利合計 ' + profit + '；未收款 ' + receivable };
}

function GovOpsTenderReport_num(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }

function GovOpsTenderReport_buildSummary(kpi, recRows, riskRows, finance, taskRows) {
  var highRec = recRows.filter(function(r){ return String(r.推薦等級 || '').indexOf('A') === 0; }).length;
  var highRisk = riskRows.filter(function(r){ return String(r.風險等級 || '') === '高'; }).length;
  var openTasks = taskRows.filter(function(r){ return ['待執行','進行中','異常'].indexOf(String(r.任務狀態 || '')) >= 0; }).length;
  return '目前標案總數 ' + (kpi.tenderTotal || 0) + ' 件，高潛力標案 ' + highRec + ' 件，高風險標案 ' + highRisk + ' 件，待處理任務 ' + openTasks + ' 項。簽約總額 ' + finance.signed + '，可請款總額 ' + finance.claimable + '，未收款 ' + finance.receivable + '。';
}

function GovOpsTenderReport_nextActions(recRows, riskRows, taskRows, finance) {
  var actions = [];
  if (recRows.some(function(r){ return String(r.推薦等級 || '').indexOf('A') === 0; })) actions.push('優先推進 A 級標案，立即建立備標任務與時程。');
  if (riskRows.some(function(r){ return String(r.風險等級 || '') === '高'; })) actions.push('高風險標案需先召開風險檢核，補齊文件、成本與時程控管。');
  if (finance.receivable > 0) actions.push('追蹤未收款與可請款金額，確認核定與請款狀態。');
  if (taskRows.some(function(r){ return String(r.任務狀態 || '') === '異常'; })) actions.push('立即處理異常任務。');
  return actions.join('\n') || '目前營運狀況穩定，持續追蹤標案池與每日智慧分析。';
}

function GovOpsTenderReport_defaultPeriod(type) {
  var now = new Date();
  if (type === '月報') return Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM');
  return Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd') + ' 週期';
}

function GovOpsTenderReport_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderReport_Generate() { return GovOpsTenderReport_generate({ tenantId: 'TENANT-DEMO', 報告類型: '週報' }); }
