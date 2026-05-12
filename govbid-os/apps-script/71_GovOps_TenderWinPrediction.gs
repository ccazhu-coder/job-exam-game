/* GovOps OS｜Tender Win Prediction v1
 * 目的：依投標決策、歷史分析、競爭廠商、財務風險，產生得標機率與策略建議。
 */

function handleGovOpsTenderWinPredictionAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.win.predict' || action === '標案得標預測') return GovOpsTenderWin_predict(data);
    if (action === 'tender.win.query' || action === '查詢得標預測') return GovOpsTenderWin_query(data);
    return null;
  } catch (err) {
    GovOpsTenderWin_logError('handleGovOpsTenderWinPredictionAction', err, data);
    return GovOpsTenderWin_fail('標案得標預測暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_WIN = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderWinPredictionAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_WIN(action, data);
  };
}

function GovOpsTenderWin_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderWin_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderWin_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderWin_sheetName() { return '39_標案得標預測'; }
function GovOpsTenderWin_num(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }

function GovOpsTenderWin_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderWin_sheetName(), ['預測ID','tenantId','標案ID','標案名稱','投標決策分數','歷史競爭分數','能力匹配分數','財務風險分數','CRM關係分數','得標機率','信心等級','策略建議','主要風險','加分策略','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderWin_predict(data) {
  data = data || {};
  GovOpsTenderWin_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var keyword = data.keyword || data.關鍵字 || tenderId || data.標案名稱 || '';
  var tender = GovOpsTenderWin_findTender(tenantId, tenderId, keyword) || {};
  var title = data.標案名稱 || tender.標案名稱 || keyword;
  var decision = GovOpsTenderWin_latest('31_投標決策評分', tenantId, tenderId, title);
  var history = GovOpsTenderWin_latest('29_標案歷史分析', tenantId, tenderId, title);
  var finance = GovOpsTenderWin_latest('38_標案財務摘要', tenantId, tenderId, title);
  var crm = GovOpsTenderWin_crmScore(tenantId, tender.機關名稱 || data.機關名稱 || '');
  var decisionScore = GovOpsTenderWin_num(decision.總分) || 55;
  var competitionScore = GovOpsTenderWin_competitionScore(history);
  var fitScore = GovOpsTenderWin_fitScore(title);
  var financeScore = GovOpsTenderWin_financeScore(finance);
  var crmScore = crm.score;
  var probability = Math.round(decisionScore * 0.35 + competitionScore * 0.2 + fitScore * 0.2 + financeScore * 0.15 + crmScore * 0.1);
  probability = Math.max(5, Math.min(95, probability));
  var row = {
    預測ID: 'TWP-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId || tender.標案ID || '',
    標案名稱: title,
    投標決策分數: decisionScore,
    歷史競爭分數: competitionScore,
    能力匹配分數: fitScore,
    財務風險分數: financeScore,
    CRM關係分數: crmScore,
    得標機率: probability + '%',
    信心等級: probability >= 75 ? '高' : probability >= 55 ? '中' : '低',
    策略建議: GovOpsTenderWin_strategy(probability, title),
    主要風險: GovOpsTenderWin_risk(history, finance, crm),
    加分策略: GovOpsTenderWin_bonus(title, crm),
    建立時間: GovOpsTenderWin_now(),
    更新時間: GovOpsTenderWin_now(),
    userId: data.userId || '',
    備註: 'AI預測僅供投標決策輔助，仍需人工檢視招標文件與評選標準。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderWin_sheetName(), row);
  GovOpsTenderWin_writeBackTender(row.標案ID, tenantId, row);
  return GovOpsTenderWin_success('標案得標預測完成。', row);
}

function GovOpsTenderWin_query(data) {
  data = data || {};
  GovOpsTenderWin_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderWin_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderWin_success('標案得標預測查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderWin_findTender(tenantId, tenderId, keyword) {
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

function GovOpsTenderWin_latest(sheetName, tenantId, tenderId, title) {
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

function GovOpsTenderWin_competitionScore(history) {
  var similar = GovOpsTenderWin_num(history.歷史相似案數);
  var winners = String(history.過往得標廠商 || '').split(/[、,，;；]/).filter(Boolean).length;
  if (!similar) return 72;
  if (winners <= 1) return 45;
  if (winners <= 3) return 60;
  return 70;
}

function GovOpsTenderWin_fitScore(title) {
  title = String(title || '');
  var strong = ['就業','職涯','訓練','課程','講座','活動','公會','農糧','米食','AI','婦女','中高齡','銀髮'];
  var hits = strong.filter(function(k){ return title.indexOf(k) >= 0; }).length;
  return Math.min(95, 55 + hits * 10);
}

function GovOpsTenderWin_financeScore(finance) {
  if (!finance || !finance.毛利率) return 65;
  var margin = GovOpsTenderWin_num(finance.毛利率);
  if (margin >= 35) return 85;
  if (margin >= 20) return 70;
  if (margin >= 10) return 55;
  return 40;
}

function GovOpsTenderWin_crmScore(tenantId, agency) {
  try {
    if (!agency) return { score: 50, note: '無機關CRM資料' };
    var rows = GovOpsProduct_readRows('35_標案CRM').filter(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.單位名稱 || '').indexOf(agency) >= 0; });
    if (!rows.length) return { score: 50, note: '無機關CRM資料' };
    var trusted = rows.some(function(r){ return ['高','良好','已合作'].indexOf(String(r.信任等級 || '')) >= 0; });
    return { score: trusted ? 80 : 65, note: '已有CRM關係資料' };
  } catch (err) { return { score: 50, note: 'CRM讀取失敗' }; }
}

function GovOpsTenderWin_strategy(p, title) {
  if (p >= 75) return '建議積極投標，主打實績、執行穩定度與差異化加值服務。';
  if (p >= 55) return '可投標，但需補強企劃亮點、合作資源與評選加分項。';
  return '建議審慎評估，若投標需降低成本風險並確認資格與評分優勢。';
}

function GovOpsTenderWin_risk(history, finance, crm) {
  var risks = [];
  if (GovOpsTenderWin_num(history.歷史相似案數) > 3) risks.push('歷史相似案多，可能已有固定競爭者。');
  if (GovOpsTenderWin_num(finance.毛利率) > 0 && GovOpsTenderWin_num(finance.毛利率) < 15) risks.push('毛利率偏低。');
  if (crm.score <= 50) risks.push('與機關關係資料不足。');
  return risks.join(' ') || '目前未見重大風險，但仍需人工檢視招標文件。';
}

function GovOpsTenderWin_bonus(title, crm) {
  return '建議補強：過往實績、在地連結、量化KPI、風險控管、創新加值服務、執行團隊履歷。';
}

function GovOpsTenderWin_writeBackTender(tenderId, tenantId, row) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
    if (found) GovOpsProduct_update(sheetName, found._row, { 投標建議: row.策略建議 + '｜得標機率：' + row.得標機率, 更新時間: GovOpsTenderWin_now() });
  } catch (err) {}
}

function GovOpsTenderWin_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderWin_Predict() { return GovOpsTenderWin_predict({ tenantId: 'TENANT-DEMO', 標案名稱: '中高齡就業促進課程計畫' }); }
