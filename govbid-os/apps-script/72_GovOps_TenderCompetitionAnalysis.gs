/* GovOps OS｜Tender Competition Analysis v1
 * 目的：分析歷史投標/得標廠商、重複得標、機關關係與競爭強度，產生競爭對策。
 */

function handleGovOpsTenderCompetitionAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.competition.analyze' || action === '標案競爭分析') return GovOpsTenderCompetition_analyze(data);
    if (action === 'tender.competition.query' || action === '查詢標案競爭分析') return GovOpsTenderCompetition_query(data);
    return null;
  } catch (err) {
    GovOpsTenderCompetition_logError('handleGovOpsTenderCompetitionAction', err, data);
    return GovOpsTenderCompetition_fail('標案競爭分析暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_COMPETITION = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderCompetitionAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_COMPETITION(action, data);
  };
}

function GovOpsTenderCompetition_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderCompetition_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderCompetition_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderCompetition_sheetName() { return '40_標案競爭分析'; }

function GovOpsTenderCompetition_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderCompetition_sheetName(), ['分析ID','tenantId','標案ID','標案名稱','主要競爭廠商','歷史投標廠商數','歷史得標廠商數','重複得標廠商','競爭強度','競爭風險','差異化策略','價格策略','關係策略','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderCompetition_analyze(data) {
  data = data || {};
  GovOpsTenderCompetition_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var keyword = data.keyword || data.關鍵字 || tenderId || data.標案名稱 || '';
  var tender = GovOpsTenderCompetition_findTender(tenantId, tenderId, keyword) || {};
  var title = data.標案名稱 || tender.標案名稱 || keyword;
  var vendors = GovOpsTenderCompetition_collectVendors(tenantId, tenderId, title, tender.機關名稱 || data.機關名稱 || '');
  var repeatWinners = GovOpsTenderCompetition_repeatWinners(vendors.winners);
  var intensity = GovOpsTenderCompetition_intensity(vendors.bidders.length, vendors.winners.length, repeatWinners.length);
  var row = {
    分析ID: 'TCA-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId || tender.標案ID || '',
    標案名稱: title,
    主要競爭廠商: GovOpsTenderCompetition_top(vendors.winners.concat(vendors.bidders)).join('、'),
    歷史投標廠商數: vendors.bidders.length,
    歷史得標廠商數: vendors.winners.length,
    重複得標廠商: repeatWinners.join('、'),
    競爭強度: intensity.level,
    競爭風險: intensity.risk,
    差異化策略: GovOpsTenderCompetition_diffStrategy(title, intensity.level),
    價格策略: GovOpsTenderCompetition_priceStrategy(intensity.level),
    關係策略: GovOpsTenderCompetition_relationStrategy(vendors.crmCount),
    建立時間: GovOpsTenderCompetition_now(),
    更新時間: GovOpsTenderCompetition_now(),
    userId: data.userId || '',
    備註: '競爭分析依歷史資料與CRM資料推估，仍需人工覆核實際投標文件。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderCompetition_sheetName(), row);
  GovOpsTenderCompetition_writeBackTender(row.標案ID, tenantId, row);
  return GovOpsTenderCompetition_success('標案競爭分析完成。', row);
}

function GovOpsTenderCompetition_query(data) {
  data = data || {};
  GovOpsTenderCompetition_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderCompetition_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderCompetition_success('標案競爭分析查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderCompetition_collectVendors(tenantId, tenderId, title, agency) {
  var bidders = [], winners = [], crmCount = 0;
  try {
    var vk = GovOpsProduct_readRows('30_標案廠商知識庫').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (tenderId && String(row.標案ID || '') === String(tenderId)) return true;
      if (title && String(row.標案名稱 || '').indexOf(title) >= 0) return true;
      if (agency && String(row.機關名稱 || '').indexOf(agency) >= 0) return true;
      return false;
    });
    vk.forEach(function(row){
      var name = String(row.廠商名稱 || '').trim();
      if (!name) return;
      if (String(row.廠商角色 || '') === '投標廠商' && bidders.indexOf(name) < 0) bidders.push(name);
      if (String(row.是否得標 || '') === '是' && winners.indexOf(name) < 0) winners.push(name);
    });
  } catch (err) {}
  try {
    var crm = GovOpsProduct_readRows('35_標案CRM').filter(function(row){
      return String(row.tenantId || '') === String(tenantId) && ['競爭廠商','合作夥伴','機關'].indexOf(String(row.關係類型 || '')) >= 0;
    });
    crmCount = crm.length;
  } catch (err2) {}
  return { bidders: bidders, winners: winners, crmCount: crmCount };
}

function GovOpsTenderCompetition_repeatWinners(winners) {
  var count = {};
  winners.forEach(function(x){ count[x] = (count[x] || 0) + 1; });
  return Object.keys(count).filter(function(k){ return count[k] >= 1; });
}

function GovOpsTenderCompetition_intensity(bidders, winners, repeats) {
  var score = bidders * 8 + winners * 10 + repeats * 12;
  if (score >= 70) return { level: '高', risk: '競爭者多或歷史得標廠商明顯，需以差異化與加值服務取勝。' };
  if (score >= 35) return { level: '中', risk: '有一定競爭，需補強實績、價格合理性與執行可信度。' };
  return { level: '低', risk: '歷史競爭資料較少，可能是新案或資料不足，需先確認資格與需求。' };
}

function GovOpsTenderCompetition_top(list) {
  var count = {};
  list.forEach(function(x){ if (x) count[x] = (count[x] || 0) + 1; });
  return Object.keys(count).sort(function(a,b){ return count[b] - count[a]; }).slice(0, 5);
}

function GovOpsTenderCompetition_diffStrategy(title, level) {
  var base = '建議強化：實績證明、量化KPI、執行SOP、風險控管、成果報告品質。';
  if (String(title || '').indexOf('AI') >= 0) base += ' AI標案需加入資料安全、工具流程與可驗收成果。';
  if (level === '高') base += ' 高競爭案需提出明確差異化與創新加值。';
  return base;
}

function GovOpsTenderCompetition_priceStrategy(level) {
  if (level === '高') return '價格需保守且具成本說明，避免高於歷史行情過多。';
  if (level === '中') return '價格可採合理利潤，並以服務內容完整度支撐報價。';
  return '可依成本與利潤目標報價，但仍需檢查預算與市場行情。';
}

function GovOpsTenderCompetition_relationStrategy(crmCount) {
  if (crmCount > 0) return '已有CRM資料，建議追蹤機關需求、過往互動與合作夥伴資源。';
  return 'CRM資料不足，建議建立機關、承辦窗口與潛在合作夥伴資料。';
}

function GovOpsTenderCompetition_findTender(tenantId, tenderId, keyword) {
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

function GovOpsTenderCompetition_writeBackTender(tenderId, tenantId, row) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
    if (found) GovOpsProduct_update(sheetName, found._row, { AI判讀摘要: row.競爭風險, 更新時間: GovOpsTenderCompetition_now() });
  } catch (err) {}
}

function GovOpsTenderCompetition_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderCompetition_Analyze() { return GovOpsTenderCompetition_analyze({ tenantId: 'TENANT-DEMO', 標案名稱: '中高齡就業促進課程計畫' }); }
