/* GovOps OS｜Tender Bond Requirement Engine v1
 * 目的：依標案計畫、招標文件解析結果與標案狀態，判斷是否需要押標金與履約保證金。
 * 原則：不得預設每案都需要押標金/履約保證金；必須先判斷 need / not_required / unknown。
 */

function handleGovOpsTenderBondRequirementAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.bondRequirement.analyze' || action === '分析保證金需求') return GovOpsTenderBondReq_analyze(data);
    if (action === 'tender.bondRequirement.query' || action === '查詢保證金需求') return GovOpsTenderBondReq_query(data);
    if (action === 'tender.bondRequirement.apply' || action === '套用保證金需求') return GovOpsTenderBondReq_apply(data);
    return null;
  } catch (err) {
    GovOpsTenderBondReq_logError('handleGovOpsTenderBondRequirementAction', err, data);
    return GovOpsTenderBondReq_fail('保證金需求判斷功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_BOND_REQUIREMENT = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderBondRequirementAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_BOND_REQUIREMENT(action, data);
  };
}

function GovOpsTenderBondReq_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderBondReq_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderBondReq_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderBondReq_sheetName() { return '62_標案保證金需求判斷'; }

function GovOpsTenderBondReq_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderBondReq_sheetName(), ['需求ID','tenantId','標案ID','標案名稱','標案階段','押標金需求','押標金判斷依據','押標金金額','履約保證金需求','履保判斷依據','履保金額','保固保證金需求','保固判斷依據','資料信心','人工確認狀態','建議動作','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderBondReq_analyze(data) {
  data = data || {};
  GovOpsTenderBondReq_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var tender = GovOpsTenderBondReq_findTender(tenantId, data.標案ID || data.tenderId || '', keyword) || {};
  var tenderId = data.標案ID || data.tenderId || tender.標案ID || '';
  var title = data.標案名稱 || tender.標案名稱 || keyword || '未命名標案';
  var docs = GovOpsTenderBondReq_sourceRows(tenantId, tenderId || title);
  var fullText = GovOpsTenderBondReq_fullText(tender, docs, data);
  var bid = GovOpsTenderBondReq_judgeBidBond(fullText, data);
  var perf = GovOpsTenderBondReq_judgePerformanceBond(fullText, data);
  var warranty = GovOpsTenderBondReq_judgeWarrantyBond(fullText, data);
  var confidence = GovOpsTenderBondReq_confidence(docs, bid, perf, warranty);
  var row = {
    需求ID: 'TBR-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    標案階段: data.標案階段 || tender.標案狀態 || '待確認',
    押標金需求: bid.status,
    押標金判斷依據: bid.reason,
    押標金金額: bid.amount,
    履約保證金需求: perf.status,
    履保判斷依據: perf.reason,
    履保金額: perf.amount,
    保固保證金需求: warranty.status,
    保固判斷依據: warranty.reason,
    資料信心: confidence,
    人工確認狀態: '待確認',
    建議動作: GovOpsTenderBondReq_action(bid, perf, warranty, confidence),
    建立時間: GovOpsTenderBondReq_now(),
    更新時間: GovOpsTenderBondReq_now(),
    userId: data.userId || '',
    備註: '本模組只判斷是否需要保證金；不應在未確認前自動假設每案都需繳。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderBondReq_sheetName(), row);
  return GovOpsTenderBondReq_success('保證金需求判斷完成。', row);
}

function GovOpsTenderBondReq_query(data) {
  data = data || {};
  GovOpsTenderBondReq_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderBondReq_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderBondReq_success('保證金需求查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderBondReq_apply(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || '';
  var rows = GovOpsTenderBondReq_query({ tenantId: tenantId, keyword: keyword }).data.rows || [];
  var latest = rows[rows.length - 1];
  if (!latest) return GovOpsTenderBondReq_fail('找不到保證金需求判斷結果，請先分析。');
  var created = [];
  if (latest.押標金需求 === '需要') {
    if (typeof GovOpsTenderBidBond_create === 'function') created.push(GovOpsTenderBidBond_create({ tenantId: tenantId, userId: data.userId || '', 標案ID: latest.標案ID, 標案名稱: latest.標案名稱, 是否需要押標金: '是', 押標金金額: latest.押標金金額 || 0, 備註: '由保證金需求判斷套用建立。' }));
  }
  if (latest.履約保證金需求 === '需要') {
    if (typeof GovOpsTenderPerformanceBond_create === 'function') created.push(GovOpsTenderPerformanceBond_create({ tenantId: tenantId, userId: data.userId || '', 標案ID: latest.標案ID, 標案名稱: latest.標案名稱, 是否需要履保金: '是', 履保金額: latest.履保金額 || 0, 備註: '由保證金需求判斷套用建立。' }));
  }
  return GovOpsTenderBondReq_success('保證金需求已套用。', { applied: created.length, note: '只有判斷為「需要」才建立押標金/履保金；不需要與待確認不建立金額資料。', results: created });
}

function GovOpsTenderBondReq_judgeBidBond(text, data) {
  var explicitNo = /免押標金|免收押標金|無須押標金|不收押標金|免繳押標金|免繳投標保證金|無須投標保證金|不收投標保證金/.test(text);
  var explicitYes = /押標金|投標保證金/.test(text);
  if (data.是否需要押標金 === '否' || explicitNo) return { status: '不需要', reason: '文件或人工資料明確標示免押標金/無須投標保證金。', amount: 0 };
  if (data.是否需要押標金 === '是' || explicitYes) return { status: '需要', reason: '文件或人工資料出現押標金/投標保證金條款。', amount: GovOpsTenderBondReq_extractAmount(text, '押標金') || GovOpsTenderBondReq_extractAmount(text, '投標保證金') || GovOpsTenderBondReq_money(data.押標金金額) };
  return { status: '待確認', reason: '目前解析資料未明確顯示是否需要押標金。', amount: 0 };
}

function GovOpsTenderBondReq_judgePerformanceBond(text, data) {
  var explicitNo = /免履約保證金|免收履約保證金|無須履約保證金|不收履約保證金|免繳履約保證金/.test(text);
  var explicitYes = /履約保證金|履保金|履約保證/.test(text);
  if (data.是否需要履保金 === '否' || explicitNo) return { status: '不需要', reason: '文件或人工資料明確標示免履約保證金。', amount: 0 };
  if (data.是否需要履保金 === '是' || explicitYes) return { status: '需要', reason: '文件或人工資料出現履約保證金條款。', amount: GovOpsTenderBondReq_extractAmount(text, '履約保證金') || GovOpsTenderBondReq_money(data.履保金額) };
  return { status: '待確認', reason: '目前解析資料未明確顯示是否需要履約保證金。', amount: 0 };
}

function GovOpsTenderBondReq_judgeWarrantyBond(text, data) {
  var explicitNo = /免保固保證金|無須保固保證金|不收保固保證金/.test(text);
  var explicitYes = /保固保證金|保固金|保固期間/.test(text);
  if (data.是否需要保固保證金 === '否' || explicitNo) return { status: '不需要', reason: '文件或人工資料明確標示免保固保證金。', amount: 0 };
  if (data.是否需要保固保證金 === '是' || explicitYes) return { status: '可能需要', reason: '文件出現保固/保固保證金相關文字，需人工確認是否涉及保證金。', amount: GovOpsTenderBondReq_extractAmount(text, '保固保證金') || GovOpsTenderBondReq_money(data.保固保證金金額) };
  return { status: '待確認', reason: '目前解析資料未明確顯示是否需要保固保證金。', amount: 0 };
}

function GovOpsTenderBondReq_action(bid, perf, warranty, confidence) {
  var actions = [];
  if (bid.status === '需要') actions.push('建立押標金資料並追蹤繳納/退還。');
  if (perf.status === '需要') actions.push('建立履約保證金資料並追蹤得標後繳納/退還。');
  if (warranty.status === '可能需要') actions.push('人工確認是否有保固保證金或保固期資金占用。');
  if (bid.status === '不需要') actions.push('此案押標金標示為不需要，不建立押標金金額資料。');
  if (perf.status === '不需要') actions.push('此案履約保證金標示為不需要，不建立履保金金額資料。');
  if (confidence !== '高') actions.push('資料信心不足，請人工檢查投標須知/契約草案。');
  return actions.join('\n') || '目前皆待確認，請補上投標須知、契約草案或人工確認。';
}

function GovOpsTenderBondReq_confidence(docs, bid, perf, warranty) {
  var hasCriticalDocs = docs.some(function(r){ return /投標須知|招標公告|契約/.test(String(r.文件類型 || '')); });
  if (hasCriticalDocs && (bid.status !== '待確認' || perf.status !== '待確認')) return '高';
  if (docs.length > 0) return '中';
  return '低';
}

function GovOpsTenderBondReq_fullText(tender, docs, data) {
  return [JSON.stringify(tender || {}), JSON.stringify(data || {}), docs.map(function(r){ return [r.原文摘要, r.關鍵條款, r.資格條件, r.請款條件, r.罰則條款, r.風險提醒, r.備註].join(' '); }).join(' ')].join(' ');
}

function GovOpsTenderBondReq_sourceRows(tenantId, keyword) {
  try { return GovOpsProduct_readRows('49_標案文件解析結果').filter(function(row){ return String(row.tenantId || '') === String(tenantId) && (!keyword || JSON.stringify(row).indexOf(keyword) >= 0); }); } catch (err) { return []; }
}

function GovOpsTenderBondReq_findTender(tenantId, tenderId, keyword) {
  try {
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池').filter(function(r){ return String(r.tenantId || '') === String(tenantId); });
    if (tenderId) {
      var byId = rows.find(function(r){ return String(r.標案ID || '') === String(tenderId); });
      if (byId) return byId;
    }
    if (keyword) return rows.find(function(r){ return JSON.stringify(r).indexOf(keyword) >= 0; }) || null;
  } catch (err) {}
  return null;
}

function GovOpsTenderBondReq_extractAmount(text, keyword) {
  text = String(text || '');
  var re = new RegExp(keyword + '[^0-9]{0,20}([0-9,]+)\\s*元');
  var m = text.match(re);
  return m ? GovOpsTenderBondReq_money(m[1]) : 0;
}

function GovOpsTenderBondReq_money(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }
function GovOpsTenderBondReq_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderBondReq_Analyze() { return GovOpsTenderBondReq_analyze({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案' }); }
