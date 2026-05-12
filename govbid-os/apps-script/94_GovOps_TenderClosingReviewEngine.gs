/* GovOps OS｜Tender Closing Review Engine v1
 * 目的：建立結案報告中的「檢討與建議」資料，來源包含驗收補正、缺件、KPI落差、核銷問題、時程風險與履約異常。
 */

function handleGovOpsTenderClosingReviewAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.closingReview.generate' || action === '產生結案檢討建議') return GovOpsTenderClosingReview_generate(data);
    if (action === 'tender.closingReview.query' || action === '查詢結案檢討建議') return GovOpsTenderClosingReview_query(data);
    if (action === 'tender.closingReview.section' || action === '產生檢討建議章節') return GovOpsTenderClosingReview_section(data);
    return null;
  } catch (err) {
    GovOpsTenderClosingReview_logError('handleGovOpsTenderClosingReviewAction', err, data);
    return GovOpsTenderClosingReview_fail('結案檢討建議功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_REVIEW = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderClosingReviewAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_REVIEW(action, data);
  };
}

function GovOpsTenderClosingReview_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderClosingReview_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderClosingReview_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderClosingReview_sheetName() { return '66_標案結案檢討建議'; }

function GovOpsTenderClosingReview_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderClosingReview_sheetName(), ['檢討ID','tenantId','標案ID','標案名稱','檢討類型','問題摘要','原因分析','影響層面','改善建議','後續追蹤事項','責任歸屬','風險等級','是否納入結案報告','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderClosingReview_generate(data) {
  data = data || {};
  GovOpsTenderClosingReview_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var title = data.標案名稱 || keyword || '未命名標案';
  var tenderId = data.標案ID || data.tenderId || keyword || '';
  var sources = GovOpsTenderClosingReview_sources(tenantId, keyword);
  var items = GovOpsTenderClosingReview_buildItems(tenantId, tenderId, title, sources, data);
  var created = 0;
  items.forEach(function(item){
    if (GovOpsTenderClosingReview_exists(tenantId, tenderId, item.檢討類型, item.問題摘要)) return;
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderClosingReview_sheetName(), item);
    created++;
  });
  return GovOpsTenderClosingReview_success('結案檢討建議已產生。', { created: created, total: items.length, rows: items });
}

function GovOpsTenderClosingReview_query(data) {
  data = data || {};
  GovOpsTenderClosingReview_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderClosingReview_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderClosingReview_success('結案檢討建議查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderClosingReview_section(data) {
  data = data || {};
  var rows = GovOpsTenderClosingReview_query(data).data.rows || [];
  if (!rows.length) return GovOpsTenderClosingReview_fail('找不到檢討建議資料，請先產生結案檢討建議。');
  var text = '七、檢討與改進建議\n\n';
  var groups = {};
  rows.forEach(function(r){
    var type = r.檢討類型 || '其他';
    if (!groups[type]) groups[type] = [];
    groups[type].push(r);
  });
  Object.keys(groups).forEach(function(type, idx){
    text += (idx + 1) + '. ' + type + '\n';
    groups[type].forEach(function(r, i){
      text += '（' + (i + 1) + '）問題摘要：' + (r.問題摘要 || '') + '\n';
      text += '　原因分析：' + (r.原因分析 || '') + '\n';
      text += '　改善建議：' + (r.改善建議 || '') + '\n';
      text += '　後續追蹤：' + (r.後續追蹤事項 || '') + '\n\n';
    });
  });
  return GovOpsTenderClosingReview_success('檢討建議章節已產生。', { sectionTitle: '七、檢討與改進建議', content: text });
}

function GovOpsTenderClosingReview_buildItems(tenantId, tenderId, title, sources, data) {
  var items = [];
  var allText = JSON.stringify(sources || {}) + ' ' + JSON.stringify(data || {});
  if (/補正|限期改善|驗收未通過/.test(allText)) {
    items.push(GovOpsTenderClosingReview_item(tenantId, tenderId, title, '驗收補正', '驗收過程出現補正或限期改善事項。', '部分成果或佐證資料未能一次到位，需於驗收階段補充說明或修正。', '可能延長驗收時程並影響請款進度。', '建立驗收對照表，於執行期間同步蒐集佐證資料，並於結案前進行預審。', '建立下次標案驗收前檢核機制。', '執行團隊/專案管理', '高', data));
  }
  if (/缺件|待準備|成果照片|簽到表|名冊|滿意度/.test(allText)) {
    items.push(GovOpsTenderClosingReview_item(tenantId, tenderId, title, '佐證資料缺件', '結案佐證資料存在缺件或待補事項。', '執行過程未即時將照片、簽到、問卷、名冊等資料完整歸檔。', '可能造成結案報告補件、驗收延遲或成果認定不足。', '建立每場次資料包，包含照片、簽到、問卷、活動紀錄與成果摘要。', '未來每場活動結束後24小時內完成資料歸檔。', '行政/現場執行', '中', data));
  }
  if (/KPI|指標|完成率|人次|場次|成效/.test(allText)) {
    items.push(GovOpsTenderClosingReview_item(tenantId, tenderId, title, 'KPI成效檢討', '需檢視KPI、服務人次、場次、完成率與成效數據。', '部分成效資料需於執行中持續追蹤，避免結案時才回補統計。', '若KPI資料不足，可能影響成果說明與評核表現。', '建立KPI追蹤表，定期回填服務人次、完成率、滿意度與成果數據。', '每週或每月更新KPI Dashboard。', '專案管理/數據統計', '中', data));
  }
  if (/請款|核銷|發票|收據|憑證|支出/.test(allText)) {
    items.push(GovOpsTenderClosingReview_item(tenantId, tenderId, title, '核銷請款檢討', '核銷與請款資料需完整對應契約與驗收條件。', '憑證、支出明細、請款附件若未即時整理，易造成結案後補件。', '可能延後撥款或產生不可請款風險。', '建立核銷檢查清單，將發票、收據、合約、成果與請款文件逐項對應。', '每月盤點未核銷項目與缺件。', '財務/行政', '高', data));
  }
  if (/逾期|延期|時程|履約期限|交付/.test(allText)) {
    items.push(GovOpsTenderClosingReview_item(tenantId, tenderId, title, '時程管理檢討', '履約時程、成果交付或驗收節點需加強控管。', '若未建立清楚提醒與責任分工，容易發生交付延誤。', '可能造成驗收延後、扣款或履約風險。', '將履約時程轉為任務與日曆提醒，並設定提前預警。', '未來標案於簽約後立即建立履約時間軸。', '專案管理', '高', data));
  }
  if (!items.length) {
    items.push(GovOpsTenderClosingReview_item(tenantId, tenderId, title, '整體執行檢討', '本案尚未解析出明確異常事項，仍建議保留標準檢討與改進章節。', '目前資料未顯示重大缺失，但仍需檢視執行流程是否可優化。', '有助於提升後續標案執行品質與評核表現。', '建立標準化結案檢討表，彙整執行亮點、困難、改善建議與後續追蹤。', '納入下一案執行SOP。', '專案團隊', '低', data));
  }
  return items;
}

function GovOpsTenderClosingReview_item(tenantId, tenderId, title, type, problem, cause, impact, suggestion, follow, owner, risk, data) {
  return {
    檢討ID: 'TCR-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    檢討類型: type,
    問題摘要: problem,
    原因分析: cause,
    影響層面: impact,
    改善建議: suggestion,
    後續追蹤事項: follow,
    責任歸屬: owner,
    風險等級: risk,
    是否納入結案報告: '是',
    建立時間: GovOpsTenderClosingReview_now(),
    更新時間: GovOpsTenderClosingReview_now(),
    userId: data.userId || '',
    備註: data.備註 || '由結案檢討建議引擎產生。'
  };
}

function GovOpsTenderClosingReview_sources(tenantId, keyword) {
  return {
    acceptanceClosing: GovOpsTenderClosingReview_read('64_標案驗收結案報告同步', tenantId, keyword),
    checklist: GovOpsTenderClosingReview_read('65_標案結案報告檢查清單', tenantId, keyword),
    timeline: GovOpsTenderClosingReview_read('59_標案履約時程', tenantId, keyword),
    contract: GovOpsTenderClosingReview_read('63_標案契約智慧分析', tenantId, keyword),
    risk: GovOpsTenderClosingReview_read('43_標案風險分析', tenantId, keyword),
    finance: GovOpsTenderClosingReview_read('38_標案財務摘要', tenantId, keyword)
  };
}

function GovOpsTenderClosingReview_read(sheetName, tenantId, keyword) {
  try {
    return GovOpsProduct_readRows(sheetName).filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (!keyword) return true;
      return JSON.stringify(row).indexOf(keyword) >= 0;
    }).slice(0, 100);
  } catch (err) { return []; }
}

function GovOpsTenderClosingReview_exists(tenantId, tenderId, type, problem) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderClosingReview_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId) && String(r.檢討類型 || '') === String(type) && String(r.問題摘要 || '') === String(problem); });
  } catch (err) { return false; }
}

function GovOpsTenderClosingReview_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderClosingReview_Generate() { return GovOpsTenderClosingReview_generate({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案' }); }
