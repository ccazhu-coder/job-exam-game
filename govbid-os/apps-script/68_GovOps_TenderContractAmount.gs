/* GovOps OS｜Tender Contract Amount v1
 * 目的：管理標案簽約金額，作為請款、成本、毛利、履約核銷的核心依據。
 */

function handleGovOpsTenderContractAmountAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.contract.create' || action === '建立標案合約') return GovOpsTenderContract_create(data);
    if (action === 'tender.contract.query' || action === '查詢標案合約') return GovOpsTenderContract_query(data);
    if (action === 'tender.contract.update' || action === '更新標案合約') return GovOpsTenderContract_update(data);
    if (action === 'tender.contract.summary' || action === '標案合約摘要') return GovOpsTenderContract_summary(data);
    return null;
  } catch (err) {
    GovOpsTenderContract_logError('handleGovOpsTenderContractAmountAction', err, data);
    return GovOpsTenderContract_fail('標案合約金額功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_CONTRACT = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderContractAmountAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_CONTRACT(action, data);
  };
}

function GovOpsTenderContract_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderContract_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderContract_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderContract_sheetName() { return '37_標案合約金額'; }

function GovOpsTenderContract_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderContract_sheetName(), ['合約ID','tenantId','標案ID','標案名稱','機關名稱','得標日期','簽約日期','合約起日','合約迄日','預算金額','決標金額','簽約金額','已請款金額','已收款金額','未收款金額','履約保證金','保固保證金','合約狀態','請款狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderContract_create(data) {
  data = data || {};
  GovOpsTenderContract_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var tender = GovOpsTenderContract_findTender(tenderId, tenantId) || {};
  var contractAmount = GovOpsTenderContract_money(data.簽約金額 || data.contractAmount || data.決標金額 || tender.決標金額 || tender.預算金額 || 0);
  var row = {
    合約ID: 'TCT-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: data.標案名稱 || tender.標案名稱 || '',
    機關名稱: data.機關名稱 || tender.機關名稱 || '',
    得標日期: data.得標日期 || '',
    簽約日期: data.簽約日期 || '',
    合約起日: data.合約起日 || '',
    合約迄日: data.合約迄日 || '',
    預算金額: GovOpsTenderContract_money(data.預算金額 || tender.預算金額 || 0),
    決標金額: GovOpsTenderContract_money(data.決標金額 || tender.決標金額 || 0),
    簽約金額: contractAmount,
    已請款金額: GovOpsTenderContract_money(data.已請款金額 || 0),
    已收款金額: GovOpsTenderContract_money(data.已收款金額 || 0),
    未收款金額: contractAmount - GovOpsTenderContract_money(data.已收款金額 || 0),
    履約保證金: GovOpsTenderContract_money(data.履約保證金 || 0),
    保固保證金: GovOpsTenderContract_money(data.保固保證金 || 0),
    合約狀態: data.合約狀態 || '已得標待簽約',
    請款狀態: data.請款狀態 || '未請款',
    建立時間: GovOpsTenderContract_now(),
    更新時間: GovOpsTenderContract_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderContract_sheetName(), row);
  GovOpsTenderContract_writeBackTender(tenderId, tenantId, row);
  return GovOpsTenderContract_success('標案合約金額已建立。', row);
}

function GovOpsTenderContract_query(data) {
  data = data || {};
  GovOpsTenderContract_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderContract_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderContract_success('標案合約查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderContract_update(data) {
  data = data || {};
  GovOpsTenderContract_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.合約ID || data.contractId || '';
  var tenderId = data.標案ID || data.tenderId || '';
  var rows = GovOpsProduct_readRows(GovOpsTenderContract_sheetName());
  var found = rows.find(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (id && String(row.合約ID || '') === String(id)) return true;
    return tenderId && String(row.標案ID || '') === String(tenderId);
  });
  if (!found) return GovOpsTenderContract_fail('找不到標案合約。');
  var patch = { 更新時間: GovOpsTenderContract_now() };
  ['得標日期','簽約日期','合約起日','合約迄日','預算金額','決標金額','簽約金額','已請款金額','已收款金額','履約保證金','保固保證金','合約狀態','請款狀態','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = k.indexOf('金額') >= 0 || k.indexOf('保證金') >= 0 ? GovOpsTenderContract_money(data[k]) : data[k]; });
  var signAmount = patch.簽約金額 !== undefined ? patch.簽約金額 : GovOpsTenderContract_money(found.簽約金額 || 0);
  var paid = patch.已收款金額 !== undefined ? patch.已收款金額 : GovOpsTenderContract_money(found.已收款金額 || 0);
  patch.未收款金額 = signAmount - paid;
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderContract_sheetName(), found._row, patch);
  GovOpsTenderContract_writeBackTender(found.標案ID || tenderId, tenantId, Object.assign({}, found, patch));
  return GovOpsTenderContract_success('標案合約已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderContract_summary(data) {
  var rows = GovOpsTenderContract_query(data).data.rows || [];
  var signed = 0, received = 0, receivable = 0, bond = 0;
  rows.forEach(function(row){
    signed += GovOpsTenderContract_money(row.簽約金額 || 0);
    received += GovOpsTenderContract_money(row.已收款金額 || 0);
    receivable += GovOpsTenderContract_money(row.未收款金額 || 0);
    bond += GovOpsTenderContract_money(row.履約保證金 || 0) + GovOpsTenderContract_money(row.保固保證金 || 0);
  });
  return GovOpsTenderContract_success('標案合約摘要完成。', { total: rows.length, totalContractAmount: signed, receivedAmount: received, receivableAmount: receivable, guaranteeAmount: bond });
}

function GovOpsTenderContract_money(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }

function GovOpsTenderContract_findTender(tenderId, tenantId) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function') return null;
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
    return rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId); }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderContract_writeBackTender(tenderId, tenantId, row) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
    if (found) GovOpsProduct_update(sheetName, found._row, { 決標金額: row.決標金額 || '', 簽約金額: row.簽約金額 || '', 標案狀態: row.合約狀態 || found.標案狀態 || '', 更新時間: GovOpsTenderContract_now() });
  } catch (err) {}
}

function GovOpsTenderContract_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderContract_Create() { return GovOpsTenderContract_create({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案', 簽約金額: 1000000 }); }
