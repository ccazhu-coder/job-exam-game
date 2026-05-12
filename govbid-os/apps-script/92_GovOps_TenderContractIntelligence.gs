/* GovOps OS｜Tender Contract Intelligence v1
 * 目的：從契約草案/招標文件解析結果中整理履約期間、保證金、驗收、請款、扣款、違約、保固與風險條款。
 */

function handleGovOpsTenderContractIntelAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.contract.analyze' || action === '分析標案契約') return GovOpsTenderContractIntel_analyze(data);
    if (action === 'tender.contract.query' || action === '查詢標案契約分析') return GovOpsTenderContractIntel_query(data);
    if (action === 'tender.contract.apply' || action === '套用標案契約分析') return GovOpsTenderContractIntel_apply(data);
    return null;
  } catch (err) {
    GovOpsTenderContractIntel_logError('handleGovOpsTenderContractIntelAction', err, data);
    return GovOpsTenderContractIntel_fail('標案契約智慧分析暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_CONTRACT_INTEL = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderContractIntelAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_CONTRACT_INTEL(action, data);
  };
}

function GovOpsTenderContractIntel_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderContractIntel_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderContractIntel_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderContractIntel_sheetName() { return '63_標案契約智慧分析'; }

function GovOpsTenderContractIntel_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderContractIntel_sheetName(), ['契約分析ID','tenantId','標案ID','標案名稱','履約期間摘要','履約起日','履約迄日','驗收條款摘要','請款條款摘要','押標金條款','履約保證金條款','保固條款','違約扣款條款','終止契約條款','展延條款','主要風險','建議動作','資料信心','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderContractIntel_analyze(data) {
  data = data || {};
  GovOpsTenderContractIntel_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var tender = GovOpsTenderContractIntel_findTender(tenantId, data.標案ID || data.tenderId || '', keyword) || {};
  var tenderId = data.標案ID || data.tenderId || tender.標案ID || '';
  var title = data.標案名稱 || tender.標案名稱 || keyword || '未命名標案';
  var docs = GovOpsTenderContractIntel_sourceRows(tenantId, tenderId || title);
  if (!docs.length) return GovOpsTenderContractIntel_fail('找不到文件解析結果，請先完成契約/文件解析。');
  var text = GovOpsTenderContractIntel_fullText(tender, docs, data);
  var row = {
    契約分析ID: 'TCI-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    履約期間摘要: GovOpsTenderContractIntel_extractSection(text, ['履約期間','履約期限','契約期間','執行期間']) || '待人工確認',
    履約起日: data.履約起日 || '',
    履約迄日: data.履約迄日 || '',
    驗收條款摘要: GovOpsTenderContractIntel_extractSection(text, ['驗收','審查','補正']) || '待人工確認',
    請款條款摘要: GovOpsTenderContractIntel_extractSection(text, ['請款','付款','撥款','核銷']) || '待人工確認',
    押標金條款: GovOpsTenderContractIntel_extractSection(text, ['押標金','投標保證金']) || '未明確解析',
    履約保證金條款: GovOpsTenderContractIntel_extractSection(text, ['履約保證金','履保金','履約保證']) || '未明確解析',
    保固條款: GovOpsTenderContractIntel_extractSection(text, ['保固','保固保證金','保固期間']) || '未明確解析',
    違約扣款條款: GovOpsTenderContractIntel_extractSection(text, ['違約','逾期','扣款','罰款','罰則','不予發還']) || '待人工確認',
    終止契約條款: GovOpsTenderContractIntel_extractSection(text, ['終止契約','解除契約','停止履約']) || '待人工確認',
    展延條款: GovOpsTenderContractIntel_extractSection(text, ['展延','延期','延長履約']) || '待人工確認',
    主要風險: GovOpsTenderContractIntel_risks(text),
    建議動作: GovOpsTenderContractIntel_actions(text),
    資料信心: GovOpsTenderContractIntel_confidence(docs),
    建立時間: GovOpsTenderContractIntel_now(),
    更新時間: GovOpsTenderContractIntel_now(),
    userId: data.userId || '',
    備註: '本分析由契約/文件解析結果彙整；正式投標與履約前仍需人工確認原始文件。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderContractIntel_sheetName(), row);
  return GovOpsTenderContractIntel_success('標案契約智慧分析完成。', row);
}

function GovOpsTenderContractIntel_query(data) {
  data = data || {};
  GovOpsTenderContractIntel_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderContractIntel_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderContractIntel_success('標案契約智慧分析查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderContractIntel_apply(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || '';
  var rows = GovOpsTenderContractIntel_query({ tenantId: tenantId, keyword: keyword }).data.rows || [];
  var latest = rows[rows.length - 1];
  if (!latest) return GovOpsTenderContractIntel_fail('找不到契約分析結果，請先分析。');
  var results = [];
  if (typeof GovOpsTenderBondReq_analyze === 'function') {
    results.push(GovOpsTenderBondReq_analyze({ tenantId: tenantId, userId: data.userId || '', 標案ID: latest.標案ID, 標案名稱: latest.標案名稱 }));
  }
  if (typeof GovOpsTenderTimeline_generate === 'function') {
    results.push(GovOpsTenderTimeline_generate({ tenantId: tenantId, userId: data.userId || '', 標案ID: latest.標案ID, 標案名稱: latest.標案名稱, 合約起日: latest.履約起日 || '', 合約迄日: latest.履約迄日 || '' }));
  }
  return GovOpsTenderContractIntel_success('契約分析已套用至保證金需求與履約時程。', { applied: results.length, results: results });
}

function GovOpsTenderContractIntel_extractSection(text, keywords) {
  text = String(text || '');
  for (var i = 0; i < keywords.length; i++) {
    var k = keywords[i];
    var idx = text.indexOf(k);
    if (idx >= 0) return text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + 220));
  }
  return '';
}

function GovOpsTenderContractIntel_risks(text) {
  var risks = [];
  if (/逾期|扣款|罰款|違約/.test(text)) risks.push('存在逾期/扣款/違約風險');
  if (/不予發還|沒收|不退還/.test(text)) risks.push('存在保證金不予發還或沒收風險');
  if (/補正|限期改善/.test(text)) risks.push('存在驗收補正或限期改善要求');
  if (/保固/.test(text)) risks.push('存在保固期後續責任');
  return risks.join('；') || '未解析出明確高風險條款，仍需人工確認契約。';
}

function GovOpsTenderContractIntel_actions(text) {
  var actions = [];
  if (/押標金|投標保證金|履約保證金|履保金/.test(text)) actions.push('執行保證金需求判斷並建立必要資金控管。');
  if (/履約期間|履約期限|契約期間|執行期間/.test(text)) actions.push('建立履約時程與提醒。');
  if (/驗收|補正/.test(text)) actions.push('建立驗收與補正任務。');
  if (/請款|付款|核銷/.test(text)) actions.push('建立請款與核銷檢查清單。');
  if (/逾期|扣款|違約/.test(text)) actions.push('建立逾期與扣款風險預警。');
  return actions.join('\n') || '請人工檢查契約草案，補齊履約、請款、保證金與罰則資訊。';
}

function GovOpsTenderContractIntel_confidence(docs) {
  var hasContract = docs.some(function(r){ return /契約/.test(String(r.文件類型 || '')); });
  var hasWork = docs.some(function(r){ return /工作說明|需求|規格/.test(String(r.文件類型 || '')); });
  if (hasContract) return '高';
  if (hasWork) return '中';
  return '低';
}

function GovOpsTenderContractIntel_sourceRows(tenantId, keyword) {
  try { return GovOpsProduct_readRows('49_標案文件解析結果').filter(function(row){ return String(row.tenantId || '') === String(tenantId) && (!keyword || JSON.stringify(row).indexOf(keyword) >= 0); }); } catch (err) { return []; }
}

function GovOpsTenderContractIntel_fullText(tender, docs, data) {
  return [JSON.stringify(tender || {}), JSON.stringify(data || {}), docs.map(function(r){ return [r.文件類型, r.原文摘要, r.關鍵條款, r.資格條件, r.評選標準, r.工作項目, r.交付成果, r.驗收方式, r.請款條件, r.罰則條款, r.風險提醒].join(' '); }).join(' ')].join(' ');
}

function GovOpsTenderContractIntel_findTender(tenantId, tenderId, keyword) {
  try {
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池').filter(function(r){ return String(r.tenantId || '') === String(tenantId); });
    if (tenderId) { var byId = rows.find(function(r){ return String(r.標案ID || '') === String(tenderId); }); if (byId) return byId; }
    if (keyword) return rows.find(function(r){ return JSON.stringify(r).indexOf(keyword) >= 0; }) || null;
  } catch (err) {}
  return null;
}

function GovOpsTenderContractIntel_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderContractIntel_Analyze() { return GovOpsTenderContractIntel_analyze({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案' }); }
