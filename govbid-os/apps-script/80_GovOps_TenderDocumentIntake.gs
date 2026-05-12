/* GovOps OS｜Tender Document Intake v1
 * 目的：登錄與管理領標文件，支援後續文件解析、評選分析與客製化企劃生成。
 */

function handleGovOpsTenderDocumentIntakeAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.document.register' || action === '登錄標案文件') return GovOpsTenderDocument_register(data);
    if (action === 'tender.document.query' || action === '查詢標案文件') return GovOpsTenderDocument_query(data);
    if (action === 'tender.document.updateStatus' || action === '更新標案文件狀態') return GovOpsTenderDocument_updateStatus(data);
    if (action === 'tender.document.checkRequired' || action === '檢查領標文件完整性') return GovOpsTenderDocument_checkRequired(data);
    return null;
  } catch (err) {
    GovOpsTenderDocument_logError('handleGovOpsTenderDocumentIntakeAction', err, data);
    return GovOpsTenderDocument_fail('標案文件登錄功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DOCUMENT = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderDocumentIntakeAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_DOCUMENT(action, data);
  };
}

function GovOpsTenderDocument_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderDocument_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderDocument_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderDocument_sheetName() { return '48_標案領標文件'; }

function GovOpsTenderDocument_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderDocument_sheetName(), ['文件ID','tenantId','標案ID','標案名稱','文件類型','檔案名稱','DriveFileID','DriveURL','MIMEType','上傳日期','文件狀態','解析狀態','OCR狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderDocument_register(data) {
  data = data || {};
  GovOpsTenderDocument_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var fileUrl = data.DriveURL || data.fileUrl || data.檔案連結 || '';
  var fileId = data.DriveFileID || data.fileId || GovOpsTenderDocument_extractDriveId(fileUrl);
  var fileName = data.檔案名稱 || data.fileName || '';
  if (!fileUrl && !fileId && !fileName) return GovOpsTenderDocument_fail('請提供 Drive 檔案連結、File ID 或檔案名稱。');
  var row = {
    文件ID: 'TDOC-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || '',
    文件類型: data.文件類型 || data.documentType || GovOpsTenderDocument_guessType(fileName || fileUrl),
    檔案名稱: fileName,
    DriveFileID: fileId,
    DriveURL: fileUrl,
    MIMEType: data.MIMEType || data.mimeType || '',
    上傳日期: data.上傳日期 || GovOpsTenderDocument_now(),
    文件狀態: data.文件狀態 || '已登錄',
    解析狀態: data.解析狀態 || '待解析',
    OCR狀態: data.OCR狀態 || '未執行',
    建立時間: GovOpsTenderDocument_now(),
    更新時間: GovOpsTenderDocument_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (GovOpsTenderDocument_exists(row)) return GovOpsTenderDocument_success('文件已存在，略過重複登錄。', row);
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderDocument_sheetName(), row);
  return GovOpsTenderDocument_success('標案文件已登錄。', row);
}

function GovOpsTenderDocument_query(data) {
  data = data || {};
  GovOpsTenderDocument_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderDocument_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderDocument_success('標案文件查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderDocument_updateStatus(data) {
  data = data || {};
  GovOpsTenderDocument_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.文件ID || data.documentId || '';
  if (!id) return GovOpsTenderDocument_fail('請提供文件ID。');
  var rows = GovOpsProduct_readRows(GovOpsTenderDocument_sheetName());
  var found = rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.文件ID || '') === String(id); });
  if (!found) return GovOpsTenderDocument_fail('找不到標案文件。');
  var patch = { 更新時間: GovOpsTenderDocument_now() };
  ['文件狀態','解析狀態','OCR狀態','文件類型','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = data[k]; });
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderDocument_sheetName(), found._row, patch);
  return GovOpsTenderDocument_success('標案文件狀態已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderDocument_checkRequired(data) {
  data = data || {};
  var rows = GovOpsTenderDocument_query(data).data.rows || [];
  var required = ['招標公告','投標須知','評選須知','工作說明書','契約草案','標價清單'];
  var existingTypes = rows.map(function(r){ return String(r.文件類型 || ''); });
  var missing = required.filter(function(type){ return existingTypes.indexOf(type) < 0; });
  return GovOpsTenderDocument_success('領標文件完整性檢查完成。', {
    required: required,
    uploadedTypes: existingTypes,
    missingTypes: missing,
    status: missing.length ? '文件不足' : '基本文件齊備',
    total: rows.length
  });
}

function GovOpsTenderDocument_guessType(text) {
  text = String(text || '');
  if (/公告/.test(text)) return '招標公告';
  if (/投標須知/.test(text)) return '投標須知';
  if (/評選/.test(text)) return '評選須知';
  if (/工作說明|需求|規格/.test(text)) return '工作說明書';
  if (/契約/.test(text)) return '契約草案';
  if (/標價|經費|預算/.test(text)) return '標價清單';
  if (/補充|更正/.test(text)) return '補充公告';
  if (/答疑|問答|釋疑/.test(text)) return '答疑紀錄';
  return '其他文件';
}

function GovOpsTenderDocument_extractDriveId(url) {
  var text = String(url || '');
  var m = text.match(/\/d\/([a-zA-Z0-9_-]+)/) || text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

function GovOpsTenderDocument_exists(row) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderDocument_sheetName());
    return rows.some(function(r){
      if (String(r.tenantId || '') !== String(row.tenantId)) return false;
      if (row.DriveFileID && String(r.DriveFileID || '') === String(row.DriveFileID)) return true;
      if (row.DriveURL && String(r.DriveURL || '') === String(row.DriveURL)) return true;
      return false;
    });
  } catch (err) { return false; }
}

function GovOpsTenderDocument_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderDocument_Register() { return GovOpsTenderDocument_register({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案', 檔案名稱: '工作說明書.pdf' }); }
