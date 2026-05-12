/* GovOps OS｜Tender Acceptance ↔ Closing Report Sync v1
 * 目的：將驗收條款同步對應到結案報告資料需求，包含成果章節、佐證資料、照片、簽到、滿意度、核銷附件與補正風險。
 */

function handleGovOpsTenderAcceptanceClosingAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.acceptanceClosing.sync' || action === '同步驗收結案報告') return GovOpsTenderAcceptanceClosing_sync(data);
    if (action === 'tender.acceptanceClosing.query' || action === '查詢驗收結案報告同步') return GovOpsTenderAcceptanceClosing_query(data);
    if (action === 'tender.acceptanceClosing.checklist' || action === '產生結案報告檢查清單') return GovOpsTenderAcceptanceClosing_checklist(data);
    return null;
  } catch (err) {
    GovOpsTenderAcceptanceClosing_logError('handleGovOpsTenderAcceptanceClosingAction', err, data);
    return GovOpsTenderAcceptanceClosing_fail('驗收與結案報告同步功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_ACCEPTANCE_CLOSING = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderAcceptanceClosingAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_ACCEPTANCE_CLOSING(action, data);
  };
}

function GovOpsTenderAcceptanceClosing_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderAcceptanceClosing_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderAcceptanceClosing_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderAcceptanceClosing_sheetName() { return '64_標案驗收結案報告同步'; }
function GovOpsTenderClosingChecklist_sheetName() { return '65_標案結案報告檢查清單'; }

function GovOpsTenderAcceptanceClosing_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderAcceptanceClosing_sheetName(), ['同步ID','tenantId','標案ID','標案名稱','驗收條款摘要','結案報告章節','必要佐證資料','照片需求','簽到需求','滿意度需求','成果數據需求','核銷附件需求','補正風險','驗收狀態','結案報告狀態','建立時間','更新時間','userId','備註']);
    GovOpsProduct_ensureSheet(GovOpsTenderClosingChecklist_sheetName(), ['檢查ID','tenantId','標案ID','標案名稱','資料類型','檢查項目','必要性','資料狀態','負責人','截止日期','關聯驗收條款','關聯報告章節','缺件風險','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderAcceptanceClosing_sync(data) {
  data = data || {};
  GovOpsTenderAcceptanceClosing_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var tender = GovOpsTenderAcceptanceClosing_findTender(tenantId, data.標案ID || data.tenderId || '', keyword) || {};
  var tenderId = data.標案ID || data.tenderId || tender.標案ID || '';
  var title = data.標案名稱 || tender.標案名稱 || keyword || '未命名標案';
  var contractRows = GovOpsTenderAcceptanceClosing_contractRows(tenantId, tenderId || title);
  var parserRows = GovOpsTenderAcceptanceClosing_parserRows(tenantId, tenderId || title);
  var acceptanceText = GovOpsTenderAcceptanceClosing_text(contractRows, parserRows, data);
  if (!acceptanceText) return GovOpsTenderAcceptanceClosing_fail('找不到驗收或結案相關資料，請先完成契約/文件解析。');
  var row = {
    同步ID: 'TACR-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    驗收條款摘要: GovOpsTenderAcceptanceClosing_extract(acceptanceText, ['驗收','審查','補正','成果報告']) || '待人工確認',
    結案報告章節: GovOpsTenderAcceptanceClosing_sections(acceptanceText),
    必要佐證資料: GovOpsTenderAcceptanceClosing_evidence(acceptanceText),
    照片需求: GovOpsTenderAcceptanceClosing_photo(acceptanceText),
    簽到需求: GovOpsTenderAcceptanceClosing_signin(acceptanceText),
    滿意度需求: GovOpsTenderAcceptanceClosing_satisfaction(acceptanceText),
    成果數據需求: GovOpsTenderAcceptanceClosing_metrics(acceptanceText),
    核銷附件需求: GovOpsTenderAcceptanceClosing_reimbursement(acceptanceText),
    補正風險: GovOpsTenderAcceptanceClosing_risk(acceptanceText),
    驗收狀態: data.驗收狀態 || '待驗收',
    結案報告狀態: data.結案報告狀態 || '待製作',
    建立時間: GovOpsTenderAcceptanceClosing_now(),
    更新時間: GovOpsTenderAcceptanceClosing_now(),
    userId: data.userId || '',
    備註: '由契約驗收條款與文件解析結果同步建立結案報告需求。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderAcceptanceClosing_sheetName(), row);
  var checklist = GovOpsTenderAcceptanceClosing_checklist(Object.assign({}, data, { 標案ID: tenderId, 標案名稱: title, 同步ID: row.同步ID, sourceRow: row }));
  return GovOpsTenderAcceptanceClosing_success('驗收與結案報告資料已同步。', { sync: row, checklist: checklist.data || {} });
}

function GovOpsTenderAcceptanceClosing_query(data) {
  data = data || {};
  GovOpsTenderAcceptanceClosing_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderAcceptanceClosing_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderAcceptanceClosing_success('驗收與結案報告同步查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderAcceptanceClosing_checklist(data) {
  data = data || {};
  GovOpsTenderAcceptanceClosing_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var source = data.sourceRow;
  if (!source) {
    var rows = GovOpsTenderAcceptanceClosing_query(data).data.rows || [];
    source = rows[rows.length - 1];
  }
  if (!source) return GovOpsTenderAcceptanceClosing_fail('找不到同步資料，請先執行同步驗收結案報告。');
  var items = GovOpsTenderAcceptanceClosing_checkItems(source);
  var created = 0, skipped = 0;
  items.forEach(function(item){
    if (GovOpsTenderAcceptanceClosing_checkExists(tenantId, source.標案ID, item.檢查項目)) { skipped++; return; }
    var row = {
      檢查ID: 'TCCK-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      標案ID: source.標案ID || data.標案ID || '',
      標案名稱: source.標案名稱 || data.標案名稱 || '',
      資料類型: item.資料類型,
      檢查項目: item.檢查項目,
      必要性: item.必要性,
      資料狀態: '待準備',
      負責人: data.負責人 || data.userId || '',
      截止日期: data.截止日期 || '',
      關聯驗收條款: source.驗收條款摘要 || '',
      關聯報告章節: item.關聯報告章節 || '',
      缺件風險: item.缺件風險 || '缺件可能影響驗收或請款。',
      建立時間: GovOpsTenderAcceptanceClosing_now(),
      更新時間: GovOpsTenderAcceptanceClosing_now(),
      userId: data.userId || '',
      備註: data.備註 || '由驗收結案報告同步引擎建立。'
    };
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderClosingChecklist_sheetName(), row);
    created++;
  });
  return GovOpsTenderAcceptanceClosing_success('結案報告檢查清單已產生。', { created: created, skipped: skipped, total: items.length });
}

function GovOpsTenderAcceptanceClosing_checkItems(source) {
  var base = [
    ['結案報告','封面與目錄','必要','結案報告基本章節','缺少封面與目錄會影響正式送審格式。'],
    ['結案報告','計畫執行摘要','必要','執行摘要','缺少摘要會影響審查理解。'],
    ['結案報告','執行成果說明','必要','成果說明','缺少成果說明會影響驗收。'],
    ['佐證資料','成果照片','必要','成果佐證','缺少照片可能造成補正。'],
    ['佐證資料','簽到表/名冊','必要','服務紀錄','缺少簽到表可能影響人次認列。'],
    ['佐證資料','滿意度問卷或統計','視標案需求','滿意度成果','缺少滿意度資料可能影響成果完整性。'],
    ['成果數據','服務人次/場次/完成率','必要','量化成果','缺少數據可能影響KPI驗收。'],
    ['核銷附件','發票/收據/憑證','必要','核銷附件','缺少憑證可能影響請款。'],
    ['核銷附件','經費支出明細','必要','經費核銷','缺少支出明細可能造成請款延誤。'],
    ['驗收資料','驗收對照表','必要','驗收對照','未對應驗收條款可能造成補正。']
  ];
  var text = JSON.stringify(source || {});
  if (/教材|講義/.test(text)) base.push(['佐證資料','教材/講義電子檔','視標案需求','教材成果','缺少教材可能影響成果認定。']);
  if (/影片|影音/.test(text)) base.push(['佐證資料','影音成果檔/連結','視標案需求','影音成果','缺少影音檔可能影響驗收。']);
  if (/新聞|媒體|社群/.test(text)) base.push(['佐證資料','媒體露出/社群截圖','視標案需求','推廣成果','缺少推廣佐證可能影響加值成果。']);
  return base.map(function(x){ return { 資料類型: x[0], 檢查項目: x[1], 必要性: x[2], 關聯報告章節: x[3], 缺件風險: x[4] }; });
}

function GovOpsTenderAcceptanceClosing_sections(text) {
  var sections = ['一、計畫概述','二、執行內容與期程','三、量化成果統計','四、成果照片與佐證','五、經費執行與核銷','六、驗收對照表','七、問題檢討與改善建議'];
  if (/滿意度|問卷/.test(text)) sections.splice(4, 0, '五、滿意度分析');
  if (/媒體|社群|宣傳/.test(text)) sections.splice(5, 0, '六、宣傳推廣成果');
  return sections.join('\n');
}

function GovOpsTenderAcceptanceClosing_evidence(text) {
  var items = ['成果照片','簽到表/名冊','執行紀錄','成果報告','經費憑證'];
  if (/教材|講義/.test(text)) items.push('教材/講義');
  if (/問卷|滿意度/.test(text)) items.push('滿意度問卷與統計');
  if (/影片|影音/.test(text)) items.push('影音成果');
  if (/媒體|社群|宣傳/.test(text)) items.push('媒體/社群露出截圖');
  return items.join('、');
}

function GovOpsTenderAcceptanceClosing_photo(text) { return /照片|影像|活動紀錄|佐證/.test(text) ? '需要：依活動/場次/成果分類保存照片。' : '建議準備：成果照片通常為驗收重要佐證。'; }
function GovOpsTenderAcceptanceClosing_signin(text) { return /簽到|名冊|人次|參與/.test(text) ? '需要：簽到表、名冊或人次證明。' : '視服務型態準備簽到/名冊。'; }
function GovOpsTenderAcceptanceClosing_satisfaction(text) { return /滿意度|問卷|回饋/.test(text) ? '需要：問卷原始資料與統計分析。' : '視標案需求準備滿意度或回饋資料。'; }
function GovOpsTenderAcceptanceClosing_metrics(text) { return /KPI|指標|人次|場次|完成率|成效/.test(text) ? '需要：KPI、場次、人次、完成率、成效統計。' : '建議建立量化成果表。'; }
function GovOpsTenderAcceptanceClosing_reimbursement(text) { return /請款|核銷|發票|收據|憑證|支出/.test(text) ? '需要：發票、收據、憑證、支出明細、請款文件。' : '建議保留完整經費憑證。'; }
function GovOpsTenderAcceptanceClosing_risk(text) {
  var risks = [];
  if (/補正|限期改善/.test(text)) risks.push('驗收可能要求補正或限期改善');
  if (/請款|核銷/.test(text)) risks.push('資料缺漏可能影響請款');
  if (/扣款|罰款|逾期/.test(text)) risks.push('逾期或驗收未過可能扣款');
  return risks.join('；') || '缺少佐證資料可能造成驗收補正。';
}

function GovOpsTenderAcceptanceClosing_extract(text, keywords) {
  text = String(text || '');
  for (var i = 0; i < keywords.length; i++) {
    var idx = text.indexOf(keywords[i]);
    if (idx >= 0) return text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 220));
  }
  return '';
}

function GovOpsTenderAcceptanceClosing_text(contractRows, parserRows, data) {
  return [JSON.stringify(data || {}), contractRows.map(function(r){ return [r.驗收條款摘要, r.請款條款摘要, r.違約扣款條款, r.主要風險].join(' '); }).join(' '), parserRows.map(function(r){ return [r.驗收方式, r.交付成果, r.請款條件, r.風險提醒, r.原文摘要].join(' '); }).join(' ')].join(' ');
}

function GovOpsTenderAcceptanceClosing_contractRows(tenantId, keyword) { try { return GovOpsProduct_readRows('63_標案契約智慧分析').filter(function(r){ return String(r.tenantId || '') === String(tenantId) && (!keyword || JSON.stringify(r).indexOf(keyword) >= 0); }); } catch (err) { return []; } }
function GovOpsTenderAcceptanceClosing_parserRows(tenantId, keyword) { try { return GovOpsProduct_readRows('49_標案文件解析結果').filter(function(r){ return String(r.tenantId || '') === String(tenantId) && (!keyword || JSON.stringify(r).indexOf(keyword) >= 0); }); } catch (err) { return []; } }

function GovOpsTenderAcceptanceClosing_findTender(tenantId, tenderId, keyword) {
  try {
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池').filter(function(r){ return String(r.tenantId || '') === String(tenantId); });
    if (tenderId) { var byId = rows.find(function(r){ return String(r.標案ID || '') === String(tenderId); }); if (byId) return byId; }
    if (keyword) return rows.find(function(r){ return JSON.stringify(r).indexOf(keyword) >= 0; }) || null;
  } catch (err) {}
  return null;
}

function GovOpsTenderAcceptanceClosing_checkExists(tenantId, tenderId, item) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderClosingChecklist_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId) && String(r.檢查項目 || '') === String(item); });
  } catch (err) { return false; }
}

function GovOpsTenderAcceptanceClosing_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderAcceptanceClosing_Sync() { return GovOpsTenderAcceptanceClosing_sync({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案' }); }
