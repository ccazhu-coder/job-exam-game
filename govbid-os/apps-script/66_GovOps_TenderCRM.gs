/* GovOps OS｜Tender CRM v1
 * 目的：建立標案相關機關、窗口、廠商、合作夥伴的關係管理資料庫。
 */

function handleGovOpsTenderCrmAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.crm.create' || action === '新增標案CRM') return GovOpsTenderCRM_create(data);
    if (action === 'tender.crm.query' || action === '查詢標案CRM') return GovOpsTenderCRM_query(data);
    if (action === 'tender.crm.update' || action === '更新標案CRM') return GovOpsTenderCRM_update(data);
    if (action === 'tender.crm.fromTender' || action === '由標案建立CRM') return GovOpsTenderCRM_fromTender(data);
    return null;
  } catch (err) {
    GovOpsTenderCRM_logError('handleGovOpsTenderCrmAction', err, data);
    return GovOpsTenderCRM_fail('標案CRM功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_CRM = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderCrmAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_CRM(action, data);
  };
}

function GovOpsTenderCRM_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderCRM_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderCRM_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderCRM_sheetName() { return '35_標案CRM'; }

function GovOpsTenderCRM_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderCRM_sheetName(), ['CRMID','tenantId','關係類型','單位名稱','窗口姓名','職稱','電話','Email','地址','標案ID','標案名稱','角色標籤','互動狀態','最後互動日期','下次追蹤日期','信任等級','合作潛力','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderCRM_create(data) {
  data = data || {};
  GovOpsTenderCRM_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var unit = data.單位名稱 || data.機關名稱 || data.vendorName || data.廠商名稱 || '';
  if (!unit) return GovOpsTenderCRM_fail('請提供單位名稱。');
  var existed = GovOpsTenderCRM_findExisting(tenantId, unit, data.Email || '', data.電話 || '');
  if (existed) return GovOpsTenderCRM_success('CRM資料已存在。', existed);
  var row = {
    CRMID: 'TCRM-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    關係類型: data.關係類型 || '機關',
    單位名稱: unit,
    窗口姓名: data.窗口姓名 || data.承辦人 || '',
    職稱: data.職稱 || '',
    電話: data.電話 || '',
    Email: data.Email || data.email || '',
    地址: data.地址 || '',
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || '',
    角色標籤: data.角色標籤 || '',
    互動狀態: data.互動狀態 || '待追蹤',
    最後互動日期: data.最後互動日期 || '',
    下次追蹤日期: data.下次追蹤日期 || '',
    信任等級: data.信任等級 || '未評估',
    合作潛力: data.合作潛力 || '未評估',
    建立時間: GovOpsTenderCRM_now(),
    更新時間: GovOpsTenderCRM_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderCRM_sheetName(), row);
  return GovOpsTenderCRM_success('標案CRM已建立。', row);
}

function GovOpsTenderCRM_query(data) {
  data = data || {};
  GovOpsTenderCRM_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.單位名稱 || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderCRM_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderCRM_success('標案CRM查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderCRM_update(data) {
  data = data || {};
  GovOpsTenderCRM_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.CRMID || data.crmId || '';
  if (!id) return GovOpsTenderCRM_fail('請提供 CRMID。');
  var rows = GovOpsProduct_readRows(GovOpsTenderCRM_sheetName());
  var found = rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.CRMID || '') === String(id); });
  if (!found) return GovOpsTenderCRM_fail('找不到CRM資料。');
  var patch = { 更新時間: GovOpsTenderCRM_now() };
  ['關係類型','單位名稱','窗口姓名','職稱','電話','Email','地址','角色標籤','互動狀態','最後互動日期','下次追蹤日期','信任等級','合作潛力','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = data[k]; });
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderCRM_sheetName(), found._row, patch);
  return GovOpsTenderCRM_success('標案CRM已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderCRM_fromTender(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var tender = GovOpsTenderCRM_findTender(tenderId, tenantId);
  if (!tender) return GovOpsTenderCRM_fail('找不到標案資料。');
  return GovOpsTenderCRM_create({ tenantId: tenantId, userId: data.userId || '', 關係類型: '機關', 單位名稱: tender.機關名稱 || '', 標案ID: tender.標案ID || '', 標案名稱: tender.標案名稱 || '', 角色標籤: '招標機關', 備註: '由標案池自動建立' });
}

function GovOpsTenderCRM_findExisting(tenantId, unit, email, phone) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderCRM_sheetName());
    return rows.find(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (unit && String(row.單位名稱 || '') === String(unit)) return true;
      if (email && String(row.Email || '') === String(email)) return true;
      if (phone && String(row.電話 || '') === String(phone)) return true;
      return false;
    }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderCRM_findTender(tenderId, tenantId) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function') return null;
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
    return rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId); }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderCRM_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderCRM_Create() { return GovOpsTenderCRM_create({ tenantId: 'TENANT-DEMO', 關係類型: '機關', 單位名稱: '測試機關' }); }
