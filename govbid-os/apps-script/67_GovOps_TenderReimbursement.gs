/* GovOps OS｜Tender Reimbursement v1
 * 目的：追蹤標案投標成本、押標金、履約費用、請款與核銷。
 */

function handleGovOpsTenderReimbursementAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.reimb.create' || action === '新增標案費用') return GovOpsTenderReimb_create(data);
    if (action === 'tender.reimb.query' || action === '查詢標案費用') return GovOpsTenderReimb_query(data);
    if (action === 'tender.reimb.update' || action === '更新標案費用') return GovOpsTenderReimb_update(data);
    if (action === 'tender.reimb.summary' || action === '標案費用摘要') return GovOpsTenderReimb_summary(data);
    return null;
  } catch (err) {
    GovOpsTenderReimb_logError('handleGovOpsTenderReimbursementAction', err, data);
    return GovOpsTenderReimb_fail('標案費用功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_REIMB = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderReimbursementAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_REIMB(action, data);
  };
}

function GovOpsTenderReimb_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderReimb_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderReimb_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderReimb_sheetName() { return '36_標案費用核銷'; }

function GovOpsTenderReimb_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderReimb_sheetName(), ['費用ID','tenantId','標案ID','標案名稱','費用階段','費用類型','科目','金額','付款狀態','憑證狀態','請款狀態','發生日期','付款日期','供應商','憑證號碼','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderReimb_create(data) {
  data = data || {};
  GovOpsTenderReimb_ensureSheet();
  var amount = Number(String(data.金額 || data.amount || 0).replace(/[^0-9.-]/g, '')) || 0;
  var row = {
    費用ID: 'TRB-' + Utilities.getUuid().slice(0, 8),
    tenantId: data.tenantId || 'TENANT-DEMO',
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || '',
    費用階段: data.費用階段 || '投標前',
    費用類型: data.費用類型 || '支出',
    科目: data.科目 || '其他費用',
    金額: amount,
    付款狀態: data.付款狀態 || '未付款',
    憑證狀態: data.憑證狀態 || '未取得',
    請款狀態: data.請款狀態 || '未請款',
    發生日期: data.發生日期 || '',
    付款日期: data.付款日期 || '',
    供應商: data.供應商 || '',
    憑證號碼: data.憑證號碼 || '',
    建立時間: GovOpsTenderReimb_now(),
    更新時間: GovOpsTenderReimb_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderReimb_sheetName(), row);
  return GovOpsTenderReimb_success('標案費用已新增。', row);
}

function GovOpsTenderReimb_query(data) {
  data = data || {};
  GovOpsTenderReimb_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderReimb_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderReimb_success('標案費用查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderReimb_update(data) {
  data = data || {};
  GovOpsTenderReimb_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.費用ID || data.reimbId || '';
  if (!id) return GovOpsTenderReimb_fail('請提供費用ID。');
  var rows = GovOpsProduct_readRows(GovOpsTenderReimb_sheetName());
  var found = rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.費用ID || '') === String(id); });
  if (!found) return GovOpsTenderReimb_fail('找不到標案費用。');
  var patch = { 更新時間: GovOpsTenderReimb_now() };
  ['費用階段','費用類型','科目','金額','付款狀態','憑證狀態','請款狀態','發生日期','付款日期','供應商','憑證號碼','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = data[k]; });
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderReimb_sheetName(), found._row, patch);
  return GovOpsTenderReimb_success('標案費用已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderReimb_summary(data) {
  var rows = GovOpsTenderReimb_query(data).data.rows || [];
  var totalExpense = 0;
  var totalIncome = 0;
  var unpaid = 0;
  var missingReceipt = 0;
  rows.forEach(function(row){
    var amount = Number(row.金額 || 0) || 0;
    if (String(row.費用類型 || '') === '收入') totalIncome += amount; else totalExpense += amount;
    if (String(row.付款狀態 || '') !== '已付款') unpaid += amount;
    if (String(row.憑證狀態 || '') !== '已取得') missingReceipt++;
  });
  return GovOpsTenderReimb_success('標案費用摘要完成。', { total: rows.length, totalExpense: totalExpense, totalIncome: totalIncome, grossProfit: totalIncome - totalExpense, unpaidAmount: unpaid, missingReceiptCount: missingReceipt });
}

function GovOpsTenderReimb_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderReimb_Create() { return GovOpsTenderReimb_create({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案', 科目: '印刷費', 金額: 1000 }); }
