/* GovOps OS｜Tender Recommendation Engine v1
 * 目的：整合得標預測、競爭分析、知識庫、財務摘要，產生正式投標推薦。
 */

function handleGovOpsTenderRecommendationAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.recommend.generate' || action === '產生標案推薦') return GovOpsTenderRecommend_generate(data);
    if (action === 'tender.recommend.query' || action === '查詢標案推薦') return GovOpsTenderRecommend_query(data);
    return null;
  } catch (err) {
    GovOpsTenderRecommend_logError('handleGovOpsTenderRecommendationAction', err, data);
    return GovOpsTenderRecommend_fail('標案推薦功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_RECOMMEND = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderRecommendationAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_RECOMMEND(action, data);
  };
}

function GovOpsTenderRecommend_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderRecommend_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderRecommend_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderRecommend_sheetName() { return '42_標案AI推薦'; }
function GovOpsTenderRecommend_num(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }

function GovOpsTenderRecommend_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderRecommend_sheetName(), ['推薦ID','tenantId','標案ID','標案名稱','推薦等級','推薦結論','得標機率','競爭強度','毛利率','主要理由','主要風險','建議行動','下一步任務','知識推薦摘要','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderRecommend_generate(data) {
  data = data || {};
  GovOpsTenderRecommend_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var keyword = data.keyword || data.關鍵字 || tenderId || data.標案名稱 || '';
  var tender = GovOpsTenderRecommend_findTender(tenantId, tenderId, keyword) || {};
  var title = data.標案名稱 || tender.標案名稱 || keyword;
  var win = GovOpsTenderRecommend_latest('39_標案得標預測', tenantId, tenderId, title);
  var competition = GovOpsTenderRecommend_latest('40_標案競爭分析', tenantId, tenderId, title);
  var finance = GovOpsTenderRecommend_latest('38_標案財務摘要', tenantId, tenderId, title);
  var decision = GovOpsTenderRecommend_latest('31_投標決策評分', tenantId, tenderId, title);
  var kb = GovOpsTenderRecommend_kb(tenantId, title);
  var score = GovOpsTenderRecommend_calcScore(win, competition, finance, decision);
  var row = {
    推薦ID: 'TRE-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId || tender.標案ID || '',
    標案名稱: title,
    推薦等級: GovOpsTenderRecommend_level(score),
    推薦結論: GovOpsTenderRecommend_conclusion(score),
    得標機率: win.得標機率 || '',
    競爭強度: competition.競爭強度 || '',
    毛利率: finance.毛利率 || '',
    主要理由: GovOpsTenderRecommend_reason(score, win, finance, decision),
    主要風險: competition.競爭風險 || win.主要風險 || '尚無明顯風險，仍需人工檢視招標文件。',
    建議行動: GovOpsTenderRecommend_action(score),
    下一步任務: GovOpsTenderRecommend_nextTask(score),
    知識推薦摘要: kb,
    建立時間: GovOpsTenderRecommend_now(),
    更新時間: GovOpsTenderRecommend_now(),
    userId: data.userId || '',
    備註: '推薦結果為決策輔助，仍需人工確認招標文件、資格與成本。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderRecommend_sheetName(), row);
  GovOpsTenderRecommend_writeBackTender(row.標案ID, tenantId, row);
  return GovOpsTenderRecommend_success('標案AI推薦已產生。', row);
}

function GovOpsTenderRecommend_query(data) {
  data = data || {};
  GovOpsTenderRecommend_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderRecommend_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderRecommend_success('標案AI推薦查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderRecommend_calcScore(win, competition, finance, decision) {
  var winRate = GovOpsTenderRecommend_num(win.得標機率 || 0);
  var decisionScore = GovOpsTenderRecommend_num(decision.總分 || 0);
  var margin = GovOpsTenderRecommend_num(finance.毛利率 || 0);
  var competitionPenalty = competition.競爭強度 === '高' ? 15 : competition.競爭強度 === '中' ? 8 : 0;
  var score = (winRate || 50) * 0.4 + (decisionScore || 55) * 0.3 + Math.min(90, Math.max(30, margin * 2)) * 0.3 - competitionPenalty;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function GovOpsTenderRecommend_level(score) {
  if (score >= 78) return 'A｜優先投標';
  if (score >= 62) return 'B｜可投標但需補強';
  if (score >= 45) return 'C｜審慎評估';
  return 'D｜不建議投標';
}

function GovOpsTenderRecommend_conclusion(score) {
  if (score >= 78) return '建議優先投入，具備得標與收益潛力。';
  if (score >= 62) return '可投標，但需補強競爭策略、企劃亮點與成本控管。';
  if (score >= 45) return '需審慎評估資格、成本、競爭廠商與履約風險。';
  return '目前不建議投入，除非有明確策略或關係優勢。';
}

function GovOpsTenderRecommend_reason(score, win, finance, decision) {
  var parts = [];
  if (win.得標機率) parts.push('得標機率 ' + win.得標機率);
  if (decision.總分) parts.push('投標評分 ' + decision.總分);
  if (finance.毛利率) parts.push('毛利率 ' + finance.毛利率);
  if (!parts.length) parts.push('資料不足，建議先完成歷史分析、投標評分與財務摘要。');
  return parts.join('；');
}

function GovOpsTenderRecommend_action(score) {
  if (score >= 78) return '立即建立備標任務、時程、文件清單與企劃分工。';
  if (score >= 62) return '先補強差異化策略、歷史實績、加值服務與成本估算。';
  if (score >= 45) return '先完成資格檢查、風險盤點、成本試算與競爭廠商分析。';
  return '暫緩投標，改列觀察或建立知識紀錄。';
}

function GovOpsTenderRecommend_nextTask(score) {
  if (score >= 78) return '建立標案流程並生成備標任務。';
  if (score >= 62) return '補齊投標決策評分、競爭分析與財務摘要。';
  if (score >= 45) return '進行人工檢核：資格、履約能力、成本與時間。';
  return '歸檔為不投標原因，保留未來分析資料。';
}

function GovOpsTenderRecommend_kb(tenantId, title) {
  try {
    if (typeof GovOpsTenderKB_recommend === 'function') {
      var r = GovOpsTenderKB_recommend({ tenantId: tenantId, keyword: title });
      var rows = r.data && r.data.recommendations || [];
      return rows.slice(0, 3).map(function(x){ return x.主題 || x.內容摘要 || ''; }).filter(Boolean).join('；');
    }
  } catch (err) {}
  return '';
}

function GovOpsTenderRecommend_latest(sheetName, tenantId, tenderId, title) {
  try {
    var rows = GovOpsProduct_readRows(sheetName).filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (tenderId && String(row.標案ID || '') === String(tenderId)) return true;
      if (title && String(row.標案名稱 || '') === String(title)) return true;
      return false;
    });
    return rows[rows.length - 1] || {};
  } catch (err) { return {}; }
}

function GovOpsTenderRecommend_findTender(tenantId, tenderId, keyword) {
  try {
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池').filter(function(r){ return String(r.tenantId || '') === String(tenantId); });
    if (tenderId) {
      var byId = rows.find(function(r){ return String(r.標案ID || '') === String(tenderId); });
      if (byId) return byId;
    }
    if (keyword) return rows.find(function(r){ return JSON.stringify(r).indexOf(keyword) >= 0; }) || null;
    return null;
  } catch (err) { return null; }
}

function GovOpsTenderRecommend_writeBackTender(tenderId, tenantId, row) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
    if (found) GovOpsProduct_update(sheetName, found._row, { 投標建議: row.推薦等級 + '｜' + row.推薦結論, AI判讀摘要: row.主要理由, 更新時間: GovOpsTenderRecommend_now() });
  } catch (err) {}
}

function GovOpsTenderRecommend_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderRecommend_Generate() { return GovOpsTenderRecommend_generate({ tenantId: 'TENANT-DEMO', 標案名稱: '中高齡就業促進課程計畫' }); }
