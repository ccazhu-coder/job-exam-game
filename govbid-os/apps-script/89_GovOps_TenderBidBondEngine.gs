/* GovOps OS｜Tender Bid Bond Engine v1
 * 目的：管理押標金，包含是否需繳、金額、繳納方式、繳納期限、退還、沒收、轉履約保證金與現金流風險。
 */

function handleGovOpsTenderBidBondAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.bidbond.create' || action === '建立押標金') return GovOpsTenderBidBond_create(data);
    if (action === 'tender.bidbond.query' || action === '查詢押標金') return GovOpsTenderBidBond_query(data);
    if (action === 'tender.bidbond.update' || action === '更新押標金') return GovOpsTenderBidBond_update(data);
    if (action === 'tender.bidbond.summary' || action === '押標金摘要') return GovOpsTenderBidBond_summary(data);
    if (action === 'tender.bidbond.fromDocument' || action === '由文件建立押標金') return GovOpsTenderBidBond_fromDocument(data);
    return null;
  } catch (err) {
    GovOpsTenderBidBond_logError('handleGovOpsTenderBidBondAction', err, data);
    return GovOpsTenderBidBond_fail('押標金功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_BID_BOND = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderBidBondAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_BID_BOND(action, data);
  };
}

function GovOpsTenderBidBond_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderBidBond_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderBidBond_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderBidBond_sheetName() { return '60_標案押標金'; }
function GovOpsTenderBidBond_money(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }

function GovOpsTenderBidBond_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderBidBond_sheetName(), ['押標金ID','tenantId','標案ID','標案名稱','是否需要押標金','押標金金額','繳納方式','繳納期限','繳納狀態','繳納日期','退還條件','應退還日期','退還狀態','退還日期','沒收風險','是否轉履約保證金','轉入金額','現金流狀態','提醒狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderBidBond_create(data) {
  data = data || {};
  GovOpsTenderBidBond_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var amount = GovOpsTenderBidBond_money(data.押標金金額 || data.amount || 0);
  var row = {
    押標金ID: 'TBB-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || '',
    是否需要押標金: data.是否需要押標金 || (amount > 0 ? '是' : '待確認'),
    押標金金額: amount,
    繳納方式: data.繳納方式 || data.paymentMethod || '待確認',
    繳納期限: data.繳納期限 || data.deadline || '',
    繳納狀態: data.繳納狀態 || '未繳納',
    繳納日期: data.繳納日期 || '',
    退還條件: data.退還條件 || '待確認',
    應退還日期: data.應退還日期 || '',
    退還狀態: data.退還狀態 || '待退還',
    退還日期: data.退還日期 || '',
    沒收風險: data.沒收風險 || GovOpsTenderBidBond_riskText(data),
    是否轉履約保證金: data.是否轉履約保證金 || '否',
    轉入金額: GovOpsTenderBidBond_money(data.轉入金額 || 0),
    現金流狀態: data.現金流狀態 || GovOpsTenderBidBond_cashflowStatus(amount, data.繳納狀態, data.退還狀態),
    提醒狀態: data.提醒狀態 || '未建立提醒',
    建立時間: GovOpsTenderBidBond_now(),
    更新時間: GovOpsTenderBidBond_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (GovOpsTenderBidBond_exists(tenantId, row.標案ID)) return GovOpsTenderBidBond_update(Object.assign({}, data, { 標案ID: row.標案ID }));
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderBidBond_sheetName(), row);
  GovOpsTenderBidBond_writeToReimbursement(row);
  return GovOpsTenderBidBond_success('押標金已建立。', row);
}

function GovOpsTenderBidBond_query(data) {
  data = data || {};
  GovOpsTenderBidBond_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderBidBond_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderBidBond_success('押標金查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderBidBond_update(data) {
  data = data || {};
  GovOpsTenderBidBond_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.押標金ID || data.bidBondId || '';
  var tenderId = data.標案ID || data.tenderId || '';
  var rows = GovOpsProduct_readRows(GovOpsTenderBidBond_sheetName());
  var found = rows.find(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (id && String(row.押標金ID || '') === String(id)) return true;
    return tenderId && String(row.標案ID || '') === String(tenderId);
  });
  if (!found) return GovOpsTenderBidBond_fail('找不到押標金資料。');
  var patch = { 更新時間: GovOpsTenderBidBond_now() };
  ['標案名稱','是否需要押標金','押標金金額','繳納方式','繳納期限','繳納狀態','繳納日期','退還條件','應退還日期','退還狀態','退還日期','沒收風險','是否轉履約保證金','轉入金額','提醒狀態','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = k.indexOf('金額') >= 0 ? GovOpsTenderBidBond_money(data[k]) : data[k]; });
  var amount = patch.押標金金額 !== undefined ? patch.押標金金額 : GovOpsTenderBidBond_money(found.押標金金額);
  patch.現金流狀態 = GovOpsTenderBidBond_cashflowStatus(amount, patch.繳納狀態 || found.繳納狀態, patch.退還狀態 || found.退還狀態);
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderBidBond_sheetName(), found._row, patch);
  return GovOpsTenderBidBond_success('押標金已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderBidBond_summary(data) {
  var rows = GovOpsTenderBidBond_query(data).data.rows || [];
  var required = 0, paid = 0, returned = 0, notReturned = 0, forfeitureRisk = 0, transfer = 0;
  rows.forEach(function(r){
    var amount = GovOpsTenderBidBond_money(r.押標金金額);
    if (String(r.是否需要押標金 || '') === '是') required += amount;
    if (String(r.繳納狀態 || '') === '已繳納') paid += amount;
    if (String(r.退還狀態 || '') === '已退還') returned += amount;
    if (String(r.退還狀態 || '') !== '已退還' && String(r.繳納狀態 || '') === '已繳納') notReturned += amount;
    if (String(r.沒收風險 || '').indexOf('高') >= 0 || String(r.退還狀態 || '') === '可能沒收') forfeitureRisk += amount;
    transfer += GovOpsTenderBidBond_money(r.轉入金額);
  });
  return GovOpsTenderBidBond_success('押標金摘要完成。', { total: rows.length, requiredAmount: required, paidAmount: paid, returnedAmount: returned, notReturnedAmount: notReturned, forfeitureRiskAmount: forfeitureRisk, transferToPerformanceBondAmount: transfer });
}

function GovOpsTenderBidBond_fromDocument(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || '';
  var rows = [];
  try { rows = GovOpsProduct_readRows('49_標案文件解析結果').filter(function(r){ return String(r.tenantId || '') === String(tenantId) && (!keyword || JSON.stringify(r).indexOf(keyword) >= 0); }); } catch (err) {}
  var text = rows.map(function(r){ return [r.關鍵條款, r.資格條件, r.請款條件, r.風險提醒, r.原文摘要].join(' '); }).join(' ');
  var amount = GovOpsTenderBidBond_extractAmount(text);
  var need = /押標金|投標保證金/.test(text) ? '是' : '待確認';
  return GovOpsTenderBidBond_create({
    tenantId: tenantId,
    userId: data.userId || '',
    標案ID: data.標案ID || (rows[0] && rows[0].標案ID) || '',
    標案名稱: data.標案名稱 || '',
    是否需要押標金: need,
    押標金金額: amount,
    繳納方式: /票據|銀行本票/.test(text) ? '銀行本票/票據' : '待確認',
    繳納期限: data.繳納期限 || '',
    退還條件: /退還/.test(text) ? '依招標文件押標金退還規定' : '待確認',
    沒收風險: /不予發還|沒收|不退還/.test(text) ? '高：文件包含不予發還/沒收條款' : '待確認'
  });
}

function GovOpsTenderBidBond_writeToReimbursement(row) {
  try {
    if (!row || GovOpsTenderBidBond_money(row.押標金金額) <= 0 || typeof GovOpsTenderReimb_create !== 'function') return;
    GovOpsTenderReimb_create({
      tenantId: row.tenantId,
      userId: row.userId,
      標案ID: row.標案ID,
      標案名稱: row.標案名稱,
      費用階段: '投標前',
      科目: '押標金',
      金額: row.押標金金額,
      付款狀態: row.繳納狀態 === '已繳納' ? '已付款' : '未付款',
      憑證狀態: '不適用',
      備註: '由押標金模組同步建立。'
    });
  } catch (err) {}
}

function GovOpsTenderBidBond_cashflowStatus(amount, paidStatus, returnStatus) {
  amount = GovOpsTenderBidBond_money(amount);
  if (!amount) return '無押標金現金流';
  if (String(returnStatus || '') === '已退還') return '已回收';
  if (String(paidStatus || '') === '已繳納') return '資金占用中';
  return '尚未支出';
}

function GovOpsTenderBidBond_riskText(data) {
  if (String((data || {}).退還狀態 || '') === '可能沒收') return '高：可能沒收';
  return '待確認';
}

function GovOpsTenderBidBond_extractAmount(text) {
  text = String(text || '');
  var m = text.match(/押標金[^0-9一二三四五六七八九十百千萬億]{0,10}([0-9,]+)\s*元/);
  return m ? GovOpsTenderBidBond_money(m[1]) : 0;
}

function GovOpsTenderBidBond_exists(tenantId, tenderId) {
  try {
    if (!tenderId) return false;
    var rows = GovOpsProduct_readRows(GovOpsTenderBidBond_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
  } catch (err) { return false; }
}

function GovOpsTenderBidBond_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderBidBond_Create() { return GovOpsTenderBidBond_create({ tenantId: 'TENANT-DEMO', 標案ID: 'TEST', 標案名稱: '測試標案', 押標金金額: 30000 }); }
