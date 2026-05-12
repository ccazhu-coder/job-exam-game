/* GovOps OS｜File Center Core v1
 * 正式上線營運級骨架：統一檔案中心。
 * 目的：集中管理標案、場次、履約、核銷、結案文件與 Google Drive 檔案關聯。
 */

function handleGovOpsFileCenterAction(action, data) {
  data = data || {};
  try {
    if (action === 'file.center.register' || action === '登錄檔案中心') return GovOpsFileCenter_register(data);
    if (action === 'file.center.query' || action === '查詢檔案中心') return GovOpsFileCenter_query(data);
    if (action === 'file.center.folderPlan' || action === '產生檔案資料夾規劃') return GovOpsFileCenter_folderPlan(data);
    if (action === 'file.center.renamePlan' || action === '產生檔案命名規則') return GovOpsFileCenter_renamePlan(data);
    if (action === 'file.center.status' || action === '檔案中心狀態') return GovOpsFileCenter_status(data);
    return null;
  } catch (err) {
    if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write('FILE_CENTER_ERROR', action, data, 'fail', String(err));
    return GovOpsFileCenter_fail('檔案中心暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_FILE_CENTER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsFileCenterAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_FILE_CENTER(action, data);
  };
}

function GovOpsFileCenter_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsFileCenter_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsFileCenter_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsFileCenter_sheetFile() { return '96_檔案中心'; }
function GovOpsFileCenter_sheetFolder() { return '97_檔案資料夾規劃'; }

function GovOpsFileCenter_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsFileCenter_sheetFile(), ['檔案ID','tenantId','標案ID','標案名稱','場次ID','活動名稱','活動日期','檔案類別','檔案子類別','原始檔名','標準檔名','DriveFileID','DriveURL','FolderID','FolderURL','檔案狀態','權限狀態','是否納入結案','是否納入核銷','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsFileCenter_sheetFolder(), ['資料夾ID','tenantId','標案ID','標案名稱','場次ID','活動名稱','資料夾層級','資料夾類型','建議路徑','DriveFolderID','DriveFolderURL','建立狀態','建立時間','更新時間','userId','備註']);
}

function GovOpsFileCenter_register(data) {
  data = data || {};
  GovOpsFileCenter_ensureSheets();
  var guard = typeof GovOpsSaaS_Tenant_guard === 'function' ? GovOpsSaaS_Tenant_guard(data, data.tenantId) : { allow: true };
  if (!guard.allow) return GovOpsFileCenter_fail(guard.reason);
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var originalName = data.原始檔名 || data.fileName || data.name || '';
  var category = data.檔案類別 || data.category || GovOpsFileCenter_guessCategory(originalName + ' ' + JSON.stringify(data));
  var standardName = data.標準檔名 || GovOpsFileCenter_standardName(Object.assign({}, data, { 檔案類別: category, 原始檔名: originalName }));
  var driveUrl = data.DriveURL || data.driveUrl || data.url || '';
  var row = {
    檔案ID: data.檔案ID || data.fileCenterId || 'FC-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || data.tenderName || '',
    場次ID: data.場次ID || data.eventId || data.活動ID || '',
    活動名稱: data.活動名稱 || data.eventName || '',
    活動日期: data.活動日期 || data.eventDate || '',
    檔案類別: category,
    檔案子類別: data.檔案子類別 || data.subCategory || GovOpsFileCenter_subCategory(category),
    原始檔名: originalName,
    標準檔名: standardName,
    DriveFileID: data.DriveFileID || data.fileId || GovOpsFileCenter_extractDriveId(driveUrl),
    DriveURL: driveUrl,
    FolderID: data.FolderID || data.folderId || '',
    FolderURL: data.FolderURL || data.folderUrl || '',
    檔案狀態: data.檔案狀態 || '已登錄',
    權限狀態: data.權限狀態 || '待確認',
    是否納入結案: data.是否納入結案 || GovOpsFileCenter_closingFlag(category),
    是否納入核銷: data.是否納入核銷 || (category === '核銷憑證' ? '是' : '否'),
    建立時間: data.建立時間 || GovOpsFileCenter_now(),
    更新時間: GovOpsFileCenter_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  var existing = GovOpsFileCenter_findExisting(tenantId, row.DriveFileID, row.DriveURL, row.標準檔名);
  if (existing) {
    GovOpsProduct_update(GovOpsFileCenter_sheetFile(), existing._row, Object.assign({}, row, { 檔案ID: existing.檔案ID, 建立時間: existing.建立時間 || row.建立時間 }));
    row.檔案ID = existing.檔案ID;
  } else {
    GovOpsProduct_append(GovOpsFileCenter_sheetFile(), row);
  }
  if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write('FILE_REGISTER', 'file.center.register', row, 'success', '檔案已登錄');
  return GovOpsFileCenter_success(existing ? '檔案中心資料已更新。' : '檔案已登錄檔案中心。', row);
}

function GovOpsFileCenter_query(data) {
  data = data || {};
  GovOpsFileCenter_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || data.場次ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsFileCenter_sheetFile()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsFileCenter_success('檔案中心查詢完成。', { total: rows.length, summary: GovOpsFileCenter_count(rows), rows: rows.slice(0, 1000) });
}

function GovOpsFileCenter_folderPlan(data) {
  data = data || {};
  GovOpsFileCenter_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var tenderName = data.標案名稱 || data.tenderName || '未命名標案';
  var eventId = data.場次ID || data.eventId || '';
  var eventName = data.活動名稱 || data.eventName || '';
  var base = data.basePath || 'GovOps OS';
  var folders = [
    ['標案根目錄', base + '/' + GovOpsFileCenter_safeName(tenderName)],
    ['01_招標文件', base + '/' + GovOpsFileCenter_safeName(tenderName) + '/01_招標文件'],
    ['02_投標文件', base + '/' + GovOpsFileCenter_safeName(tenderName) + '/02_投標文件'],
    ['03_履約執行', base + '/' + GovOpsFileCenter_safeName(tenderName) + '/03_履約執行'],
    ['04_核銷憑證', base + '/' + GovOpsFileCenter_safeName(tenderName) + '/04_核銷憑證'],
    ['05_結案報告', base + '/' + GovOpsFileCenter_safeName(tenderName) + '/05_結案報告'],
    ['06_交付包', base + '/' + GovOpsFileCenter_safeName(tenderName) + '/06_交付包']
  ];
  if (eventId || eventName) folders.push(['場次資料夾', base + '/' + GovOpsFileCenter_safeName(tenderName) + '/03_履約執行/' + GovOpsFileCenter_safeName((data.活動日期 || '') + '_' + eventName)]);
  var rows = folders.map(function(f, idx){ return {
    資料夾ID: 'FCP-' + Utilities.getUuid().slice(0, 8), tenantId: tenantId, 標案ID: tenderId, 標案名稱: tenderName, 場次ID: eventId, 活動名稱: eventName, 資料夾層級: idx + 1, 資料夾類型: f[0], 建議路徑: f[1], DriveFolderID: '', DriveFolderURL: '', 建立狀態: '待建立', 建立時間: GovOpsFileCenter_now(), 更新時間: GovOpsFileCenter_now(), userId: data.userId || '', 備註: ''
  }; });
  rows.forEach(function(r){ GovOpsProduct_append(GovOpsFileCenter_sheetFolder(), r); });
  return GovOpsFileCenter_success('檔案資料夾規劃已產生。', { total: rows.length, rows: rows });
}

function GovOpsFileCenter_renamePlan(data) {
  data = data || {};
  var standardName = GovOpsFileCenter_standardName(data);
  return GovOpsFileCenter_success('檔案命名規則已產生。', { standardName: standardName, rule: '日期_場次_檔案類別_原始檔名' });
}

function GovOpsFileCenter_status(data) {
  var q = GovOpsFileCenter_query(data).data;
  return GovOpsFileCenter_success('檔案中心狀態完成。', q.summary || {});
}

function GovOpsFileCenter_standardName(data) {
  var date = String(data.活動日期 || data.eventDate || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd')).replace(/[\/\-\.]/g, '');
  var event = GovOpsFileCenter_safeName(data.活動名稱 || data.eventName || data.場次ID || data.eventId || '標案');
  var cat = GovOpsFileCenter_safeName(data.檔案類別 || data.category || '附件');
  var original = GovOpsFileCenter_safeName(data.原始檔名 || data.fileName || '未命名');
  return [date, event, cat, original].filter(Boolean).join('_');
}

function GovOpsFileCenter_guessCategory(text) {
  text = String(text || '').toLowerCase();
  if (/照片|photo|jpg|jpeg|png|image/.test(text)) return '成果照片';
  if (/簽到|名冊|attendance|signin/.test(text)) return '簽到表/名冊';
  if (/滿意度|問卷|survey/.test(text)) return '滿意度調查';
  if (/發票|收據|憑證|invoice|receipt|核銷/.test(text)) return '核銷憑證';
  if (/契約|合約|contract/.test(text)) return '契約文件';
  if (/結案|成果報告|closing/.test(text)) return '結案報告';
  return '其他附件';
}
function GovOpsFileCenter_subCategory(category) { return category === '核銷憑證' ? '費用憑證' : category; }
function GovOpsFileCenter_closingFlag(category) { return ['成果照片','簽到表/名冊','滿意度調查','結案報告','核銷憑證'].indexOf(category) >= 0 ? '是' : '否'; }
function GovOpsFileCenter_safeName(s) { return String(s || '').replace(/[\\\/\:\*\?\"\<\>\|#%{}~&]/g, '-').slice(0, 80); }
function GovOpsFileCenter_extractDriveId(url) { url = String(url || ''); var m = url.match(/\/d\/([^\/]+)/) || url.match(/[?&]id=([^&]+)/); return m ? m[1] : ''; }
function GovOpsFileCenter_findExisting(tenantId, fileId, url, name) { try { return GovOpsProduct_readRows(GovOpsFileCenter_sheetFile()).find(function(r){ return String(r.tenantId || '') === String(tenantId) && ((fileId && String(r.DriveFileID || '') === String(fileId)) || (url && String(r.DriveURL || '') === String(url)) || (name && String(r.標準檔名 || '') === String(name))); }) || null; } catch (err) { return null; } }
function GovOpsFileCenter_count(rows) { var out = { total: rows.length, closing: 0, reimbursement: 0, photos: 0, missingPermission: 0 }; rows.forEach(function(r){ if (r.是否納入結案 === '是') out.closing++; if (r.是否納入核銷 === '是') out.reimbursement++; if (r.檔案類別 === '成果照片') out.photos++; if (String(r.權限狀態 || '').indexOf('確認') >= 0) out.missingPermission++; }); return out; }
