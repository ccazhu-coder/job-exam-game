/* GovOps OS｜Tender History Analyzer v1
 * 目的：依使用者查詢標案資料，進行近5年全文檢索、歷史投標/得標分析與新舊案判斷。
 */

function handleGovOpsTenderHistoryAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.history.analyze' || action === '分析標案歷史') return GovOpsTenderHistory_analyze(data);
    if (action === 'tender.history.query' || action === '查詢標案歷史') return GovOpsTenderHistory_query(data);
    if (action === 'tender.history.daily' || action === '每日標案歷史分析') return GovOpsTenderHistory_daily(data);
    return null;
  } catch (err) {
    GovOpsTenderHistory_logError('handleGovOpsTenderHistoryAction', err, data);
    return GovOpsTenderHistory_fail('標案歷史分析暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_HISTORY = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderHistoryAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_HISTORY(action, data);
  };
}

function GovOpsTenderHistory_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderHistory_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderHistory_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderHistory_sheetName() { return '29_標案歷史分析'; }

function GovOpsTenderHistory_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderHistory_sheetName(), ['分析ID','tenantId','標案ID','標案名稱','機關名稱','查詢關鍵字','查詢年度起','查詢年度迄','是否疑似新標案','歷史相似案數','過往投標廠商','過往得標廠商','最近得標廠商','最近決標金額','歷史摘要','投標建議','風險等級','資料來源','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderHistory_analyze(data) {
  data = data || {};
  GovOpsTenderHistory_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var tender = GovOpsTenderHistory_findTender(tenderId, tenantId) || {};
  var title = data.標案名稱 || tender.標案名稱 || data.keyword || data.關鍵字 || '';
  var agency = data.機關名稱 || tender.機關名稱 || '';
  var keyword = GovOpsTenderHistory_buildKeyword(title, data);
  if (!keyword) return GovOpsTenderHistory_fail('請提供標案名稱、標案ID或查詢關鍵字。');
  var yearTo = Number(data.yearTo || data.年度迄 || new Date().getFullYear());
  var yearFrom = Number(data.yearFrom || data.年度起 || (yearTo - 5));
  var historyRows = GovOpsTenderHistory_collectHistory({ tenantId: tenantId, keyword: keyword, agency: agency, yearFrom: yearFrom, yearTo: yearTo });
  var summary = GovOpsTenderHistory_summarize(historyRows);
  var row = {
    分析ID: 'THA-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    機關名稱: agency,
    查詢關鍵字: keyword,
    查詢年度起: yearFrom,
    查詢年度迄: yearTo,
    是否疑似新標案: summary.isNew ? '是' : '否',
    歷史相似案數: summary.total,
    過往投標廠商: summary.bidders.join('、'),
    過往得標廠商: summary.winners.join('、'),
    最近得標廠商: summary.latestWinner || '',
    最近決標金額: summary.latestAmount || '',
    歷史摘要: summary.summary,
    投標建議: summary.suggestion,
    風險等級: summary.risk,
    資料來源: '標案池＋政府採購網全文檢索入口',
    建立時間: GovOpsTenderHistory_now(),
    更新時間: GovOpsTenderHistory_now(),
    userId: data.userId || '',
    備註: '需依政府採購網實際全文結果覆核'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderHistory_sheetName(), row);
  GovOpsTenderHistory_writeBackTender(tenderId, tenantId, row);
  return GovOpsTenderHistory_success('標案歷史分析完成。', row);
}

function GovOpsTenderHistory_query(data) {
  data = data || {};
  GovOpsTenderHistory_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderHistory_sheetName()) : [];
  rows = rows.filter(function(row) {
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderHistory_success('標案歷史分析查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderHistory_daily(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenders = [];
  try {
    tenders = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池').filter(function(row) {
      return String(row.tenantId || '') === String(tenantId) && String(row.是否追蹤 || '') === '是' && ['新標案','評估中','決定投標'].indexOf(String(row.標案狀態 || '')) >= 0;
    });
  } catch (err) {}
  var results = [];
  tenders.slice(0, Number(data.limit || 20)).forEach(function(tender) {
    var result = GovOpsTenderHistory_analyze({ tenantId: tenantId, userId: 'SYSTEM-HISTORY', 標案ID: tender.標案ID, 標案名稱: tender.標案名稱, 機關名稱: tender.機關名稱 });
    results.push({ 標案ID: tender.標案ID, success: result.success, message: result.message, data: result.data || {} });
  });
  return GovOpsTenderHistory_success('每日標案歷史分析完成。', { total: results.length, results: results });
}

function GovOpsTenderHistory_findTender(tenderId, tenantId) {
  if (!tenderId || typeof GovOpsProduct_readRows !== 'function') return null;
  var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
  return rows.find(function(row) { return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId); }) || null;
}

function GovOpsTenderHistory_buildKeyword(title, data) {
  var keyword = String(data.keyword || data.關鍵字 || title || '').trim();
  keyword = keyword.replace(/[「」『』]/g, '').replace(/\s+/g, ' ');
  if (keyword.length > 60) keyword = keyword.slice(0, 60);
  return keyword;
}

function GovOpsTenderHistory_collectHistory(params) {
  var rows = [];
  rows = rows.concat(GovOpsTenderHistory_collectFromPool(params));
  rows.push({ 標案名稱: params.keyword + '｜政府採購網全文檢索入口', 機關名稱: params.agency || '', 年度: params.yearTo, 投標廠商: [], 得標廠商: '', 決標金額: '', 來源: 'https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic' });
  return GovOpsTenderHistory_dedupe(rows);
}

function GovOpsTenderHistory_collectFromPool(params) {
  var rows = [];
  try {
    if (typeof GovOpsProduct_readRows !== 'function') return rows;
    var all = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
    all.forEach(function(row) {
      if (String(row.tenantId || '') !== String(params.tenantId)) return;
      var text = [row.標案名稱, row.機關名稱, row.案號, row.AI判讀摘要, row.備註].join(' ');
      if (params.keyword && text.indexOf(params.keyword) < 0) return;
      rows.push({ 標案名稱: row.標案名稱 || '', 機關名稱: row.機關名稱 || '', 年度: GovOpsTenderHistory_extractYear(row.公告日期 || row.建立時間), 投標廠商: GovOpsTenderHistory_splitVendors(row.過往投標廠商 || ''), 得標廠商: row.得標廠商 || row.最近得標廠商 || '', 決標金額: row.決標金額 || row.預算金額 || '', 來源: '標案池' });
    });
  } catch (err) {}
  return rows;
}

function GovOpsTenderHistory_dedupe(rows) {
  var seen = {};
  return (rows || []).filter(function(row) {
    var key = [row.標案名稱, row.機關名稱, row.年度].join('|');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function GovOpsTenderHistory_summarize(rows) {
  rows = rows || [];
  var bidders = [], winners = [], latestWinner = '', latestAmount = '';
  rows.forEach(function(row) {
    (row.投標廠商 || []).forEach(function(v){ if (v && bidders.indexOf(v) < 0) bidders.push(v); });
    if (row.得標廠商 && winners.indexOf(row.得標廠商) < 0) winners.push(row.得標廠商);
    if (row.得標廠商 && !latestWinner) latestWinner = row.得標廠商;
    if (row.決標金額 && !latestAmount) latestAmount = row.決標金額;
  });
  var total = rows.filter(function(r){ return String(r.來源 || '') === '標案池'; }).length;
  var isNew = total === 0 || winners.length === 0;
  return { total: total, isNew: isNew, bidders: bidders, winners: winners, latestWinner: latestWinner, latestAmount: latestAmount, risk: isNew ? '中' : '高', suggestion: isNew ? '疑似新標案，建議優先評估需求內容與資格條件。' : '已有歷史相似案，建議分析過往得標廠商、決標金額與評選方向。', summary: isNew ? '近5年系統內尚未找到明確相似歷史案，需以政府採購網全文檢索人工覆核。' : '近5年找到相似案 ' + total + ' 筆；過往得標廠商：' + winners.join('、') };
}

function GovOpsTenderHistory_splitVendors(text) { return String(text || '').split(/[、,，;；\n]/).map(function(x){ return x.trim(); }).filter(Boolean); }
function GovOpsTenderHistory_extractYear(value) { var s = String(value || ''); var m = s.match(/(20\d{2})/); return m ? m[1] : ''; }

function GovOpsTenderHistory_writeBackTender(tenderId, tenantId, analysis) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(row) { return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId); });
    if (found) GovOpsProduct_update(sheetName, found._row, { AI判讀摘要: analysis.歷史摘要, 投標建議: analysis.投標建議, 更新時間: GovOpsTenderHistory_now() });
  } catch (err) {}
}

function GovOpsTenderHistory_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderHistory_Analyze() { return GovOpsTenderHistory_analyze({ tenantId: 'TENANT-DEMO', keyword: '就業服務' }); }
