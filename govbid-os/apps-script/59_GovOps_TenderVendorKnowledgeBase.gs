/* GovOps OS｜Tender Vendor Knowledge Base v1
 * 目的：累積近5年標案全文檢索後的投標廠商、得標廠商、決標金額與標案關聯。
 */

function handleGovOpsTenderVendorKBAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.vendor.save' || action === '儲存標案廠商紀錄') return GovOpsTenderVendorKB_save(data);
    if (action === 'tender.vendor.query' || action === '查詢標案廠商紀錄') return GovOpsTenderVendorKB_query(data);
    if (action === 'tender.vendor.summary' || action === '標案廠商摘要') return GovOpsTenderVendorKB_summary(data);
    return null;
  } catch (err) {
    GovOpsTenderVendorKB_logError('handleGovOpsTenderVendorKBAction', err, data);
    return GovOpsTenderVendorKB_fail('標案廠商資料暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_VENDOR_KB = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderVendorKBAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_VENDOR_KB(action, data);
  };
}

function GovOpsTenderVendorKB_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderVendorKB_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderVendorKB_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderVendorKB_sheetName() { return '30_標案廠商知識庫'; }

function GovOpsTenderVendorKB_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderVendorKB_sheetName(), ['紀錄ID','tenantId','標案ID','標案名稱','機關名稱','年度','案號','廠商名稱','廠商角色','是否得標','投標金額','決標金額','決標日期','標案網址','來源','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderVendorKB_save(data) {
  data = data || {};
  GovOpsTenderVendorKB_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var vendors = GovOpsTenderVendorKB_normalizeVendors(data);
  var saved = 0;
  var skipped = 0;
  vendors.forEach(function(vendor) {
    var row = {
      紀錄ID: 'TVK-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      標案ID: data.標案ID || data.tenderId || '',
      標案名稱: data.標案名稱 || '',
      機關名稱: data.機關名稱 || '',
      年度: data.年度 || data.year || '',
      案號: data.案號 || '',
      廠商名稱: vendor.name,
      廠商角色: vendor.role,
      是否得標: vendor.winner ? '是' : '否',
      投標金額: vendor.bidAmount || '',
      決標金額: vendor.awardAmount || data.決標金額 || '',
      決標日期: data.決標日期 || '',
      標案網址: data.標案網址 || '',
      來源: data.來源 || '人工/全文檢索匯入',
      建立時間: GovOpsTenderVendorKB_now(),
      更新時間: GovOpsTenderVendorKB_now(),
      userId: data.userId || '',
      備註: data.備註 || ''
    };
    if (GovOpsTenderVendorKB_exists(row)) { skipped++; return; }
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderVendorKB_sheetName(), row);
    saved++;
  });
  return GovOpsTenderVendorKB_success('標案廠商紀錄已儲存。', { saved: saved, skipped: skipped });
}

function GovOpsTenderVendorKB_normalizeVendors(data) {
  var vendors = [];
  function add(name, role, winner, bidAmount, awardAmount) {
    name = String(name || '').trim();
    if (!name) return;
    vendors.push({ name: name, role: role, winner: !!winner, bidAmount: bidAmount || '', awardAmount: awardAmount || '' });
  }
  if (Array.isArray(data.vendors)) {
    data.vendors.forEach(function(v) { add(v.廠商名稱 || v.name, v.廠商角色 || v.role || '投標廠商', v.是否得標 === '是' || v.winner, v.投標金額 || v.bidAmount, v.決標金額 || v.awardAmount); });
  }
  String(data.過往投標廠商 || data.投標廠商 || '').split(/[、,，;；\n]/).forEach(function(x){ add(x, '投標廠商', false); });
  String(data.過往得標廠商 || data.得標廠商 || data.最近得標廠商 || '').split(/[、,，;；\n]/).forEach(function(x){ add(x, '得標廠商', true, '', data.決標金額 || ''); });
  return GovOpsTenderVendorKB_dedupeVendors(vendors);
}

function GovOpsTenderVendorKB_dedupeVendors(vendors) {
  var seen = {};
  return vendors.filter(function(v) {
    var key = v.name + '|' + v.role + '|' + v.winner;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function GovOpsTenderVendorKB_exists(row) {
  try {
    if (typeof GovOpsProduct_readRows !== 'function') return false;
    var rows = GovOpsProduct_readRows(GovOpsTenderVendorKB_sheetName());
    return rows.some(function(r) {
      return String(r.tenantId || '') === String(row.tenantId || '') && String(r.標案名稱 || '') === String(row.標案名稱 || '') && String(r.廠商名稱 || '') === String(row.廠商名稱 || '') && String(r.廠商角色 || '') === String(row.廠商角色 || '');
    });
  } catch (err) { return false; }
}

function GovOpsTenderVendorKB_query(data) {
  data = data || {};
  GovOpsTenderVendorKB_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案名稱 || data.廠商名稱 || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderVendorKB_sheetName()) : [];
  rows = rows.filter(function(row) {
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderVendorKB_success('標案廠商紀錄查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderVendorKB_summary(data) {
  data = data || {};
  var query = GovOpsTenderVendorKB_query(data);
  var rows = query.data.rows || [];
  var bidders = [];
  var winners = [];
  rows.forEach(function(row) {
    if (row.廠商名稱 && row.廠商角色 === '投標廠商' && bidders.indexOf(row.廠商名稱) < 0) bidders.push(row.廠商名稱);
    if (row.廠商名稱 && row.是否得標 === '是' && winners.indexOf(row.廠商名稱) < 0) winners.push(row.廠商名稱);
  });
  return GovOpsTenderVendorKB_success('標案廠商摘要完成。', { total: rows.length, bidders: bidders, winners: winners, isNew: winners.length === 0 && rows.length === 0 });
}

function GovOpsTenderVendorKB_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderVendorKB_Save() {
  return GovOpsTenderVendorKB_save({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案', 投標廠商: '甲公司、乙公司', 得標廠商: '甲公司', 決標金額: '1000000' });
}
