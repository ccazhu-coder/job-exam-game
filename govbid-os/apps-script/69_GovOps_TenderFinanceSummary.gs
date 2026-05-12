/* GovOps OS｜Tender Finance Summary v1
 * 目的：整合合約金額、可請款、核定、扣款、實收、成本與毛利。
 */

function handleGovOpsTenderFinanceSummaryAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.finance.summary' || action === '標案財務摘要') return GovOpsTenderFinance_summary(data);
    if (action === 'tender.finance.query' || action === '查詢標案財務摘要') return GovOpsTenderFinance_query(data);
    return null;
  } catch (err) {
    GovOpsTenderFinance_logError('handleGovOpsTenderFinanceSummaryAction', err, data);
    return GovOpsTenderFinance_fail('標案財務摘要暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_FINANCE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderFinanceSummaryAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_FINANCE(action, data);
  };
}

function GovOpsTenderFinance_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderFinance_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderFinance_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderFinance_sheetName() { return '38_標案財務摘要'; }
function GovOpsTenderFinance_money(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }

function GovOpsTenderFinance_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderFinance_sheetName(), ['摘要ID','tenantId','標案ID','標案名稱','簽約金額','可請款金額','核定金額','扣款金額','不可請款金額','已請款金額','已收款金額','未收款金額','總成本','毛利','毛利率','缺憑證數','未付款金額','收入認列基準','不可請款原因','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderFinance_summary(data) {
  data = data || {};
  GovOpsTenderFinance_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var contract = GovOpsTenderFinance_findContract(tenantId, tenderId, data.keyword || data.關鍵字 || '');
  if (!contract) return GovOpsTenderFinance_fail('找不到標案合約資料，請先建立簽約金額。');
  var costs = GovOpsTenderFinance_collectCosts(tenantId, contract.標案ID || tenderId, contract.標案名稱 || '');
  var signAmount = GovOpsTenderFinance_money(contract.簽約金額);
  var deducted = GovOpsTenderFinance_money(contract.扣款金額 || data.扣款金額);
  var unclaimable = GovOpsTenderFinance_money(contract.不可請款金額 || data.不可請款金額);
  var claimable = GovOpsTenderFinance_money(contract.可請款金額 || data.可請款金額);
  if (!claimable) claimable = Math.max(0, signAmount - deducted - unclaimable);
  var approved = GovOpsTenderFinance_money(contract.核定金額 || data.核定金額);
  var revenueBase = approved || claimable || signAmount;
  var invoiced = GovOpsTenderFinance_money(contract.已請款金額);
  var received = GovOpsTenderFinance_money(contract.已收款金額);
  var receivable = Math.max(0, revenueBase - received);
  var grossProfit = revenueBase - costs.totalCost;
  var grossMargin = revenueBase ? Math.round((grossProfit / revenueBase) * 10000) / 100 : 0;
  var row = {
    摘要ID: 'TFS-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: contract.標案ID || tenderId,
    標案名稱: contract.標案名稱 || '',
    簽約金額: signAmount,
    可請款金額: claimable,
    核定金額: approved,
    扣款金額: deducted,
    不可請款金額: unclaimable,
    已請款金額: invoiced,
    已收款金額: received,
    未收款金額: receivable,
    總成本: costs.totalCost,
    毛利: grossProfit,
    毛利率: grossMargin + '%',
    缺憑證數: costs.missingReceipt,
    未付款金額: costs.unpaid,
    收入認列基準: approved ? '核定金額' : (claimable ? '可請款金額' : '簽約金額'),
    不可請款原因: contract.不可請款原因 || data.不可請款原因 || '',
    建立時間: GovOpsTenderFinance_now(),
    更新時間: GovOpsTenderFinance_now(),
    userId: data.userId || '',
    備註: '簽約金額不等於實際可收款；本摘要以核定/可請款優先計算。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderFinance_sheetName(), row);
  return GovOpsTenderFinance_success('標案財務摘要完成。', row);
}

function GovOpsTenderFinance_query(data) {
  data = data || {};
  GovOpsTenderFinance_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderFinance_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderFinance_success('標案財務摘要查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderFinance_findContract(tenantId, tenderId, keyword) {
  try {
    var rows = GovOpsProduct_readRows('37_標案合約金額').filter(function(row){ return String(row.tenantId || '') === String(tenantId); });
    if (tenderId) {
      var byId = rows.find(function(row){ return String(row.標案ID || '') === String(tenderId); });
      if (byId) return byId;
    }
    if (keyword) return rows.find(function(row){ return JSON.stringify(row).indexOf(keyword) >= 0; }) || null;
    return rows[0] || null;
  } catch (err) { return null; }
}

function GovOpsTenderFinance_collectCosts(tenantId, tenderId, title) {
  var totalCost = 0, unpaid = 0, missingReceipt = 0;
  try {
    var rows = GovOpsProduct_readRows('36_標案費用核銷').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (tenderId && String(row.標案ID || '') === String(tenderId)) return true;
      if (title && String(row.標案名稱 || '') === String(title)) return true;
      return false;
    });
    rows.forEach(function(row){
      var amount = GovOpsTenderFinance_money(row.金額);
      if (String(row.費用類型 || '') !== '收入') totalCost += amount;
      if (String(row.付款狀態 || '') !== '已付款' && String(row.費用類型 || '') !== '收入') unpaid += amount;
      if (String(row.憑證狀態 || '') !== '已取得' && String(row.費用類型 || '') !== '收入') missingReceipt++;
    });
  } catch (err) {}
  return { totalCost: totalCost, unpaid: unpaid, missingReceipt: missingReceipt };
}

function GovOpsTenderFinance_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderFinance_Summary() { return GovOpsTenderFinance_summary({ tenantId: 'TENANT-DEMO' }); }
