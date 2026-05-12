/* GovOps OS｜Tender Decision Engine v1
 * 目的：依標案池、歷史分析、廠商知識庫產生投標分數、風險等級與投標建議。
 */

function handleGovOpsTenderDecisionAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.decision.score' || action === '標案投標評分') return GovOpsTenderDecision_score(data);
    if (action === 'tender.decision.query' || action === '查詢投標評分') return GovOpsTenderDecision_query(data);
    return null;
  } catch (err) {
    GovOpsTenderDecision_logError('handleGovOpsTenderDecisionAction', err, data);
    return GovOpsTenderDecision_fail('標案決策功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DECISION = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderDecisionAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DECISION(action, data);
  };
}

function GovOpsTenderDecision_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderDecision_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderDecision_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderDecision_sheetName() { return '31_投標決策評分'; }

function GovOpsTenderDecision_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderDecision_sheetName(), ['評分ID','tenantId','標案ID','標案名稱','機關名稱','預算金額','歷史相似案分數','競爭風險分數','能力匹配分數','利潤潛力分數','時程壓力分數','總分','風險等級','投標建議','判斷摘要','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderDecision_score(data) {
  data = data || {};
  GovOpsTenderDecision_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var tender = GovOpsTenderDecision_findTender(tenderId, tenantId) || {};
  var title = data.標案名稱 || tender.標案名稱 || data.keyword || '';
  if (!title && !tenderId) return GovOpsTenderDecision_fail('請提供標案ID或標案名稱。');
  var history = GovOpsTenderDecision_getHistory(tenantId, tenderId, title);
  var vendor = GovOpsTenderDecision_getVendorSummary(tenantId, title);
  var budget = Number(String(data.預算金額 || tender.預算金額 || '').replace(/[^0-9.]/g, '')) || 0;
  var scores = GovOpsTenderDecision_calcScores({ title: title, tender: tender, history: history, vendor: vendor, budget: budget });
  var row = {
    評分ID: 'TDS-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    機關名稱: data.機關名稱 || tender.機關名稱 || '',
    預算金額: budget || data.預算金額 || tender.預算金額 || '',
    歷史相似案分數: scores.historyScore,
    競爭風險分數: scores.competitionScore,
    能力匹配分數: scores.fitScore,
    利潤潛力分數: scores.profitScore,
    時程壓力分數: scores.timeScore,
    總分: scores.total,
    風險等級: scores.risk,
    投標建議: scores.recommendation,
    判斷摘要: scores.summary,
    建立時間: GovOpsTenderDecision_now(),
    更新時間: GovOpsTenderDecision_now(),
    userId: data.userId || '',
    備註: '自動評分僅供決策輔助，仍需人工覆核招標文件。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderDecision_sheetName(), row);
  GovOpsTenderDecision_writeBack(tenderId, tenantId, row);
  return GovOpsTenderDecision_success('投標決策評分完成。', row);
}

function GovOpsTenderDecision_query(data) {
  data = data || {};
  GovOpsTenderDecision_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderDecision_sheetName()) : [];
  rows = rows.filter(function(row) {
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderDecision_success('投標決策評分查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderDecision_calcScores(ctx) {
  var h = ctx.history || {};
  var v = ctx.vendor || {};
  var historyTotal = Number(h.歷史相似案數 || h.total || 0);
  var winners = v.winners || [];
  var bidders = v.bidders || [];
  var budget = ctx.budget || 0;
  var historyScore = historyTotal === 0 ? 75 : Math.max(35, 85 - historyTotal * 8);
  var competitionScore = winners.length <= 1 ? 45 : winners.length <= 3 ? 60 : 75;
  var fitScore = GovOpsTenderDecision_keywordFit(ctx.title);
  var profitScore = budget >= 1000000 ? 80 : budget >= 300000 ? 65 : 50;
  var timeScore = 70;
  var total = Math.round(historyScore * 0.2 + competitionScore * 0.2 + fitScore * 0.25 + profitScore * 0.2 + timeScore * 0.15);
  var risk = total >= 75 ? '低' : total >= 60 ? '中' : '高';
  var recommendation = total >= 75 ? '建議優先投標' : total >= 60 ? '可評估投標' : '建議審慎或不投標';
  var summary = '總分 ' + total + '。歷史相似案 ' + historyTotal + ' 筆，歷史得標廠商 ' + winners.length + ' 家，歷史投標廠商 ' + bidders.length + ' 家。';
  return { historyScore: historyScore, competitionScore: competitionScore, fitScore: fitScore, profitScore: profitScore, timeScore: timeScore, total: total, risk: risk, recommendation: recommendation, summary: summary };
}

function GovOpsTenderDecision_keywordFit(title) {
  title = String(title || '');
  var strong = ['就業','職涯','訓練','課程','講座','活動','公會','農糧','米食','AI','婦女','中高齡','銀髮'];
  var hits = strong.filter(function(k){ return title.indexOf(k) >= 0; }).length;
  return Math.min(95, 55 + hits * 10);
}

function GovOpsTenderDecision_findTender(tenderId, tenantId) {
  if (!tenderId || typeof GovOpsProduct_readRows !== 'function') return null;
  var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
  return rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId); }) || null;
}

function GovOpsTenderDecision_getHistory(tenantId, tenderId, title) {
  try {
    if (typeof GovOpsTenderHistory_query !== 'function') return {};
    var r = GovOpsTenderHistory_query({ tenantId: tenantId, keyword: tenderId || title });
    var row = r.data && r.data.rows && r.data.rows[0] || {};
    return row;
  } catch (err) { return {}; }
}

function GovOpsTenderDecision_getVendorSummary(tenantId, title) {
  try {
    if (typeof GovOpsTenderVendorKB_summary !== 'function') return { bidders: [], winners: [] };
    var r = GovOpsTenderVendorKB_summary({ tenantId: tenantId, keyword: title });
    return r.data || { bidders: [], winners: [] };
  } catch (err) { return { bidders: [], winners: [] }; }
}

function GovOpsTenderDecision_writeBack(tenderId, tenantId, row) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
    if (found) GovOpsProduct_update(sheetName, found._row, { 投標建議: row.投標建議 + '｜分數：' + row.總分, 更新時間: GovOpsTenderDecision_now() });
  } catch (err) {}
}

function GovOpsTenderDecision_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderDecision_Score() { return GovOpsTenderDecision_score({ tenantId: 'TENANT-DEMO', 標案名稱: '中高齡就業促進課程計畫', 預算金額: '1200000' }); }
