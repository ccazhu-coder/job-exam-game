/* GovOps OS｜Tender Performance Bond Engine v1
 * 目的：管理履約保證金，包含得標後繳納、押標金轉入、退還、扣款、保固保證金與現金流占用。
 */

function handleGovOpsTenderPerformanceBondAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.performanceBond.create' || action === '建立履約保證金') return GovOpsTenderPerformanceBond_create(data);
    if (action === 'tender.performanceBond.query' || action === '查詢履約保證金') return GovOpsTenderPerformanceBond_query(data);
    if (action === 'tender.performanceBond.update' || action === '更新履約保證金') return GovOpsTenderPerformanceBond_update(data);
    if (action === 'tender.performanceBond.summary' || action === '履約保證金摘要') return GovOpsTenderPerformanceBond_summary(data);
    if (action === 'tender.performanceBond.fromBidBond' || action === '由押標金轉履約保證金') return GovOpsTenderPerformanceBond_fromBidBond(data);
    return null;
  } catch (err) {
    GovOpsTenderPerformanceBond_logError('handleGovOpsTenderPerformanceBondAction', err, data);
    return GovOpsTenderPerformanceBond_fail('履約保證金功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_PERFORMANCE_BOND = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderPerformanceBondAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_PERFORMANCE_BOND(action, data);
  };
}

function GovOpsTenderPerformanceBond_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderPerformanceBond_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderPerformanceBond_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderPerformanceBond_sheetName() { return '61_標案履約保證金'; }
function GovOpsTenderPerformanceBond_money(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }

function GovOpsTenderPerformanceBond_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderPerformanceBond_sheetName(), ['履保ID','tenantId','標案ID','標案名稱','是否需要履保金','履保金額','履保比例','繳納方式','繳納期限','繳納狀態','繳納日期','押標金轉入金額','應退還日期','退還條件','退還狀態','退還日期','扣款金額','扣款原因','保固保證金金額','保固到期日','現金流狀態','風險狀態','提醒狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderPerformanceBond_create(data) {
  data = data || {};
  GovOpsTenderPerformanceBond_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var amount = GovOpsTenderPerformanceBond_money(data.履保金額 || data.amount || 0);
  var bidTransfer = GovOpsTenderPerformanceBond_money(data.押標金轉入金額 || 0);
  var row = {
    履保ID: 'TPB-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || '',
    是否需要履保金: data.是否需要履保金 || (amount > 0 ? '是' : '待確認'),
    履保金額: amount,
    履保比例: data.履保比例 || data.rate || '待確認',
    繳納方式: data.繳納方式 || data.paymentMethod || '待確認',
    繳納期限: data.繳納期限 || data.deadline || '',
    繳納狀態: data.繳納狀態 || '未繳納',
    繳納日期: data.繳納日期 || '',
    押標金轉入金額: bidTransfer,
    應退還日期: data.應退還日期 || '',
    退還條件: data.退還條件 || '待確認',
    退還狀態: data.退還狀態 || '待退還',
    退還日期: data.退還日期 || '',
    扣款金額: GovOpsTenderPerformanceBond_money(data.扣款金額 || 0),
    扣款原因: data.扣款原因 || '',
    保固保證金金額: GovOpsTenderPerformanceBond_money(data.保固保證金金額 || 0),
    保固到期日: data.保固到期日 || '',
    現金流狀態: data.現金流狀態 || GovOpsTenderPerformanceBond_cashflowStatus(amount, data.繳納狀態, data.退還狀態),
    風險狀態: data.風險狀態 || GovOpsTenderPerformanceBond_riskStatus(data),
    提醒狀態: data.提醒狀態 || '未建立提醒',
    建立時間: GovOpsTenderPerformanceBond_now(),
    更新時間: GovOpsTenderPerformanceBond_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (GovOpsTenderPerformanceBond_exists(tenantId, row.標案ID)) return GovOpsTenderPerformanceBond_update(Object.assign({}, data, { 標案ID: row.標案ID }));
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderPerformanceBond_sheetName(), row);
  GovOpsTenderPerformanceBond_writeToReimbursement(row);
  return GovOpsTenderPerformanceBond_success('履約保證金已建立。', row);
}

function GovOpsTenderPerformanceBond_query(data) {
  data = data || {};
  GovOpsTenderPerformanceBond_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderPerformanceBond_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderPerformanceBond_success('履約保證金查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderPerformanceBond_update(data) {
  data = data || {};
  GovOpsTenderPerformanceBond_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.履保ID || data.performanceBondId || '';
  var tenderId = data.標案ID || data.tenderId || '';
  var rows = GovOpsProduct_readRows(GovOpsTenderPerformanceBond_sheetName());
  var found = rows.find(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (id && String(row.履保ID || '') === String(id)) return true;
    return tenderId && String(row.標案ID || '') === String(tenderId);
  });
  if (!found) return GovOpsTenderPerformanceBond_fail('找不到履約保證金資料。');
  var patch = { 更新時間: GovOpsTenderPerformanceBond_now() };
  ['標案名稱','是否需要履保金','履保金額','履保比例','繳納方式','繳納期限','繳納狀態','繳納日期','押標金轉入金額','應退還日期','退還條件','退還狀態','退還日期','扣款金額','扣款原因','保固保證金金額','保固到期日','提醒狀態','備註'].forEach(function(k){
    if (data[k] !== undefined) patch[k] = /金額/.test(k) ? GovOpsTenderPerformanceBond_money(data[k]) : data[k];
  });
  var amount = patch.履保金額 !== undefined ? patch.履保金額 : GovOpsTenderPerformanceBond_money(found.履保金額);
  patch.現金流狀態 = GovOpsTenderPerformanceBond_cashflowStatus(amount, patch.繳納狀態 || found.繳納狀態, patch.退還狀態 || found.退還狀態);
  patch.風險狀態 = GovOpsTenderPerformanceBond_riskStatus(Object.assign({}, found, patch));
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderPerformanceBond_sheetName(), found._row, patch);
  return GovOpsTenderPerformanceBond_success('履約保證金已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderPerformanceBond_summary(data) {
  var rows = GovOpsTenderPerformanceBond_query(data).data.rows || [];
  var required = 0, paid = 0, returned = 0, notReturned = 0, deducted = 0, warranty = 0, transfer = 0;
  rows.forEach(function(r){
    var amount = GovOpsTenderPerformanceBond_money(r.履保金額);
    if (String(r.是否需要履保金 || '') === '是') required += amount;
    if (String(r.繳納狀態 || '') === '已繳納') paid += amount;
    if (String(r.退還狀態 || '') === '已退還') returned += amount;
    if (String(r.退還狀態 || '') !== '已退還' && String(r.繳納狀態 || '') === '已繳納') notReturned += amount;
    deducted += GovOpsTenderPerformanceBond_money(r.扣款金額);
    warranty += GovOpsTenderPerformanceBond_money(r.保固保證金金額);
    transfer += GovOpsTenderPerformanceBond_money(r.押標金轉入金額);
  });
  return GovOpsTenderPerformanceBond_success('履約保證金摘要完成。', { total: rows.length, requiredAmount: required, paidAmount: paid, returnedAmount: returned, notReturnedAmount: notReturned, deductedAmount: deducted, warrantyBondAmount: warranty, bidBondTransferAmount: transfer });
}

function GovOpsTenderPerformanceBond_fromBidBond(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || data.keyword || '';
  var bidRows = typeof GovOpsTenderBidBond_query === 'function' ? GovOpsTenderBidBond_query({ tenantId: tenantId, keyword: tenderId }).data.rows || [] : [];
  var bid = bidRows[0] || {};
  var transferAmount = GovOpsTenderPerformanceBond_money(data.押標金轉入金額 || bid.轉入金額 || bid.押標金金額 || 0);
  var result = GovOpsTenderPerformanceBond_create({
    tenantId: tenantId,
    userId: data.userId || '',
    標案ID: tenderId || bid.標案ID || '',
    標案名稱: data.標案名稱 || bid.標案名稱 || '',
    是否需要履保金: '是',
    履保金額: GovOpsTenderPerformanceBond_money(data.履保金額 || transferAmount),
    押標金轉入金額: transferAmount,
    繳納狀態: transferAmount > 0 ? '部分轉入' : '未繳納',
    退還條件: data.退還條件 || '依契約履約完成與驗收後退還',
    備註: '由押標金轉入建立。'
  });
  if (typeof GovOpsTenderBidBond_update === 'function' && bid.標案ID) {
    GovOpsTenderBidBond_update({ tenantId: tenantId, 標案ID: bid.標案ID, 是否轉履約保證金: '是', 轉入金額: transferAmount });
  }
  return result;
}

function GovOpsTenderPerformanceBond_writeToReimbursement(row) {
  try {
    if (!row || GovOpsTenderPerformanceBond_money(row.履保金額) <= 0 || typeof GovOpsTenderReimb_create !== 'function') return;
    GovOpsTenderReimb_create({
      tenantId: row.tenantId,
      userId: row.userId,
      標案ID: row.標案ID,
      標案名稱: row.標案名稱,
      費用階段: '履約中',
      科目: '履約保證金',
      金額: row.履保金額,
      付款狀態: row.繳納狀態 === '已繳納' ? '已付款' : '未付款',
      憑證狀態: '不適用',
      備註: '由履約保證金模組同步建立。'
    });
  } catch (err) {}
}

function GovOpsTenderPerformanceBond_cashflowStatus(amount, paidStatus, returnStatus) {
  amount = GovOpsTenderPerformanceBond_money(amount);
  if (!amount) return '無履保金現金流';
  if (String(returnStatus || '') === '已退還') return '已回收';
  if (String(paidStatus || '') === '已繳納' || String(paidStatus || '') === '部分轉入') return '資金占用中';
  return '尚未支出';
}

function GovOpsTenderPerformanceBond_riskStatus(data) {
  if (GovOpsTenderPerformanceBond_money((data || {}).扣款金額) > 0) return '高：已發生扣款';
  if (String((data || {}).退還狀態 || '') === '可能沒收') return '高：可能沒收';
  if (String((data || {}).退還狀態 || '') !== '已退還' && String((data || {}).繳納狀態 || '') === '已繳納') return '中：資金占用中';
  return '待確認';
}

function GovOpsTenderPerformanceBond_exists(tenantId, tenderId) {
  try {
    if (!tenderId) return false;
    var rows = GovOpsProduct_readRows(GovOpsTenderPerformanceBond_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
  } catch (err) { return false; }
}

function GovOpsTenderPerformanceBond_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderPerformanceBond_Create() { return GovOpsTenderPerformanceBond_create({ tenantId: 'TENANT-DEMO', 標案ID: 'TEST', 標案名稱: '測試標案', 履保金額: 50000 }); }
