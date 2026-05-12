/* GovOps OS｜Tender Execution Artifact Intake v1
 * 目的：履約執行期間/活動結束後，上傳照片、簽到表、滿意度、核銷憑證等成果資料；系統分類管理，並同步至結案報告與交付包。
 */

function handleGovOpsTenderExecutionArtifactAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.executionArtifact.create' || action === '建立履約成果附件') return GovOpsTenderExecutionArtifact_create(data);
    if (action === 'tender.executionArtifact.batchCreate' || action === '批次建立履約成果附件') return GovOpsTenderExecutionArtifact_batchCreate(data);
    if (action === 'tender.executionArtifact.query' || action === '查詢履約成果附件') return GovOpsTenderExecutionArtifact_query(data);
    if (action === 'tender.executionArtifact.syncClosing' || action === '同步履約成果到結案') return GovOpsTenderExecutionArtifact_syncClosing(data);
    if (action === 'tender.executionArtifact.summary' || action === '履約成果附件摘要') return GovOpsTenderExecutionArtifact_summary(data);
    return null;
  } catch (err) {
    GovOpsTenderExecutionArtifact_logError('handleGovOpsTenderExecutionArtifactAction', err, data);
    return GovOpsTenderExecutionArtifact_fail('履約成果附件管理功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_ARTIFACT = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderExecutionArtifactAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_ARTIFACT(action, data);
  };
}

function GovOpsTenderExecutionArtifact_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderExecutionArtifact_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderExecutionArtifact_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderExecutionArtifact_sheetName() { return '72_履約成果附件資料庫'; }
function GovOpsTenderExecutionArtifactReport_sheetName() { return '73_履約成果結案同步'; }

function GovOpsTenderExecutionArtifact_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderExecutionArtifact_sheetName(), ['附件ID','tenantId','標案ID','標案名稱','活動ID','活動名稱','活動日期','履約階段','資料類型','資料子類型','檔案名稱','DriveFileID','DriveURL','檔案狀態','是否納入結案報告','對應報告章節','對應檢查項目','數量','說明文字','上傳者','建立時間','更新時間','userId','備註']);
    GovOpsProduct_ensureSheet(GovOpsTenderExecutionArtifactReport_sheetName(), ['同步ID','tenantId','標案ID','標案名稱','報告章節','同步內容','附件數','照片數','簽到數','滿意度數','核銷數','同步狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderExecutionArtifact_create(data) {
  data = data || {};
  GovOpsTenderExecutionArtifact_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var fileName = data.檔案名稱 || data.fileName || '';
  var driveUrl = data.DriveURL || data.driveUrl || data.url || '';
  var type = data.資料類型 || data.type || GovOpsTenderExecutionArtifact_guessType(fileName + ' ' + driveUrl + ' ' + (data.備註 || ''));
  var row = {
    附件ID: 'TEA-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || '',
    活動ID: data.活動ID || data.eventId || '',
    活動名稱: data.活動名稱 || data.eventName || '',
    活動日期: data.活動日期 || data.eventDate || '',
    履約階段: data.履約階段 || '履約執行',
    資料類型: type,
    資料子類型: data.資料子類型 || GovOpsTenderExecutionArtifact_subType(type, fileName),
    檔案名稱: fileName,
    DriveFileID: data.DriveFileID || data.fileId || GovOpsTenderExecutionArtifact_extractDriveId(driveUrl),
    DriveURL: driveUrl,
    檔案狀態: data.檔案狀態 || '已上傳',
    是否納入結案報告: data.是否納入結案報告 || '是',
    對應報告章節: data.對應報告章節 || GovOpsTenderExecutionArtifact_section(type),
    對應檢查項目: data.對應檢查項目 || GovOpsTenderExecutionArtifact_checkItem(type),
    數量: Number(data.數量 || 1),
    說明文字: data.說明文字 || GovOpsTenderExecutionArtifact_description(type, data),
    上傳者: data.上傳者 || data.userId || '',
    建立時間: GovOpsTenderExecutionArtifact_now(),
    更新時間: GovOpsTenderExecutionArtifact_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (GovOpsTenderExecutionArtifact_exists(tenantId, row.標案ID, row.DriveFileID, row.DriveURL, row.檔案名稱)) return GovOpsTenderExecutionArtifact_success('此履約成果附件已存在，略過重複建立。', row);
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderExecutionArtifact_sheetName(), row);
  GovOpsTenderExecutionArtifact_updateChecklist(row);
  return GovOpsTenderExecutionArtifact_success('履約成果附件已建立。', row);
}

function GovOpsTenderExecutionArtifact_batchCreate(data) {
  data = data || {};
  var files = GovOpsTenderExecutionArtifact_normalizeFiles(data.files || data.檔案清單 || []);
  if (!files.length) return GovOpsTenderExecutionArtifact_fail('請提供 files 檔案清單。');
  var created = 0, skipped = 0, rows = [];
  files.forEach(function(file){
    var result = GovOpsTenderExecutionArtifact_create(Object.assign({}, data, file));
    if (result && result.success) {
      if (String(result.message || '').indexOf('略過') >= 0) skipped++; else created++;
      rows.push(result.data);
    }
  });
  var sync = GovOpsTenderExecutionArtifact_syncClosing(data);
  return GovOpsTenderExecutionArtifact_success('履約成果附件批次建立完成。', { created: created, skipped: skipped, rows: rows, sync: sync.data || {} });
}

function GovOpsTenderExecutionArtifact_query(data) {
  data = data || {};
  GovOpsTenderExecutionArtifact_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || data.活動ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderExecutionArtifact_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderExecutionArtifact_success('履約成果附件查詢完成。', { total: rows.length, summary: GovOpsTenderExecutionArtifact_count(rows), rows: rows.slice(0, 500) });
}

function GovOpsTenderExecutionArtifact_syncClosing(data) {
  data = data || {};
  GovOpsTenderExecutionArtifact_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var q = GovOpsTenderExecutionArtifact_query({ tenantId: tenantId, keyword: keyword });
  var rows = q.data.rows || [];
  if (!rows.length) return GovOpsTenderExecutionArtifact_fail('找不到可同步的履約成果附件。');
  var tenderId = data.標案ID || rows[0].標案ID || keyword || '';
  var title = data.標案名稱 || rows[0].標案名稱 || keyword || '未命名標案';
  var grouped = GovOpsTenderExecutionArtifact_groupBySection(rows);
  var created = 0;
  Object.keys(grouped).forEach(function(section){
    var sectionRows = grouped[section];
    var c = GovOpsTenderExecutionArtifact_count(sectionRows);
    var syncRow = {
      同步ID: 'TEAS-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      標案ID: tenderId,
      標案名稱: title,
      報告章節: section,
      同步內容: GovOpsTenderExecutionArtifact_sectionText(section, sectionRows),
      附件數: sectionRows.length,
      照片數: c.photo || 0,
      簽到數: c.signin || 0,
      滿意度數: c.satisfaction || 0,
      核銷數: c.reimbursement || 0,
      同步狀態: '已同步',
      建立時間: GovOpsTenderExecutionArtifact_now(),
      更新時間: GovOpsTenderExecutionArtifact_now(),
      userId: data.userId || '',
      備註: '履約成果附件已依章節同步，可寫入結案報告。'
    };
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderExecutionArtifactReport_sheetName(), syncRow);
    created++;
  });
  GovOpsTenderExecutionArtifact_updateClosingReportDraft(tenantId, tenderId, title, rows);
  return GovOpsTenderExecutionArtifact_success('履約成果附件已同步到結案資料。', { sections: created, summary: q.data.summary });
}

function GovOpsTenderExecutionArtifact_summary(data) {
  var q = GovOpsTenderExecutionArtifact_query(data);
  return GovOpsTenderExecutionArtifact_success('履約成果附件摘要完成。', q.data.summary || {});
}

function GovOpsTenderExecutionArtifact_updateChecklist(row) {
  try {
    var sheetName = '65_標案結案報告檢查清單';
    var rows = GovOpsProduct_readRows(sheetName).filter(function(r){ return String(r.tenantId || '') === String(row.tenantId || '') && String(r.標案ID || '') === String(row.標案ID || '') && String(r.檢查項目 || '') === String(row.對應檢查項目 || ''); });
    rows.forEach(function(r){ GovOpsProduct_update(sheetName, r._row, { 資料狀態: '已完成', 更新時間: GovOpsTenderExecutionArtifact_now(), 備註: '由履約成果附件上傳自動更新：' + (row.DriveURL || row.檔案名稱 || '') }); });
  } catch (err) {}
}

function GovOpsTenderExecutionArtifact_updateClosingReportDraft(tenantId, tenderId, title, rows) {
  try {
    var drafts = GovOpsProduct_readRows('67_標案結案報告草稿').filter(function(r){ return String(r.tenantId || '') === String(tenantId) && (!tenderId || String(r.標案ID || '') === String(tenderId)); });
    if (!drafts.length) return;
    var draft = drafts[drafts.length - 1];
    var addText = '\n\n【履約成果附件同步】\n' + GovOpsTenderExecutionArtifact_reportText(rows);
    GovOpsProduct_update('67_標案結案報告草稿', draft._row, { 報告內容: String(draft.報告內容 || '') + addText, 更新時間: GovOpsTenderExecutionArtifact_now(), 備註: '已同步履約成果附件。' });
  } catch (err) {}
}

function GovOpsTenderExecutionArtifact_reportText(rows) {
  var c = GovOpsTenderExecutionArtifact_count(rows);
  var lines = [];
  lines.push('本案已上傳履約成果附件共 ' + rows.length + ' 筆，其中成果照片 ' + c.photo + ' 筆、簽到/名冊 ' + c.signin + ' 筆、滿意度資料 ' + c.satisfaction + ' 筆、核銷憑證 ' + c.reimbursement + ' 筆。');
  rows.slice(0, 50).forEach(function(r){ lines.push('- ' + (r.資料類型 || '') + '｜' + (r.活動日期 || '') + '｜' + (r.活動名稱 || '') + '｜' + (r.檔案名稱 || r.DriveURL || '')); });
  return lines.join('\n');
}

function GovOpsTenderExecutionArtifact_sectionText(section, rows) {
  var lines = ['章節：' + section];
  rows.forEach(function(r){ lines.push('- ' + (r.資料類型 || '') + '｜' + (r.活動日期 || '') + '｜' + (r.活動名稱 || '') + '｜' + (r.說明文字 || r.檔案名稱 || r.DriveURL || '')); });
  return lines.join('\n');
}

function GovOpsTenderExecutionArtifact_guessType(text) {
  text = String(text || '').toLowerCase();
  if (/照片|photo|jpg|jpeg|png|image|相片/.test(text)) return '成果照片';
  if (/簽到|簽名|名冊|signin|attendance/.test(text)) return '簽到表/名冊';
  if (/滿意度|問卷|survey|回饋/.test(text)) return '滿意度調查';
  if (/發票|收據|憑證|核銷|invoice|receipt/.test(text)) return '核銷憑證';
  if (/報告|成果|結案/.test(text)) return '成果報告';
  return '其他佐證資料';
}

function GovOpsTenderExecutionArtifact_subType(type, fileName) {
  if (type === '成果照片') return '活動照片';
  if (type === '簽到表/名冊') return '人次佐證';
  if (type === '滿意度調查') return '問卷統計';
  if (type === '核銷憑證') return '費用憑證';
  return '一般附件';
}

function GovOpsTenderExecutionArtifact_section(type) {
  if (type === '成果照片') return '四、成果照片與佐證資料';
  if (type === '簽到表/名冊') return '三、量化成果統計';
  if (type === '滿意度調查') return '三、量化成果統計';
  if (type === '核銷憑證') return '五、經費執行與核銷';
  if (type === '成果報告') return '二、執行內容與期程';
  return '八、附件清單';
}

function GovOpsTenderExecutionArtifact_checkItem(type) {
  if (type === '成果照片') return '成果照片';
  if (type === '簽到表/名冊') return '簽到表/名冊';
  if (type === '滿意度調查') return '滿意度問卷或統計';
  if (type === '核銷憑證') return '發票/收據/憑證';
  return '其他佐證資料';
}

function GovOpsTenderExecutionArtifact_description(type, data) {
  var eventName = data.活動名稱 || data.eventName || '';
  var eventDate = data.活動日期 || data.eventDate || '';
  return (eventDate ? eventDate + ' ' : '') + (eventName ? eventName + ' ' : '') + type;
}

function GovOpsTenderExecutionArtifact_groupBySection(rows) {
  var grouped = {};
  rows.forEach(function(r){ var key = r.對應報告章節 || GovOpsTenderExecutionArtifact_section(r.資料類型 || ''); if (!grouped[key]) grouped[key] = []; grouped[key].push(r); });
  return grouped;
}

function GovOpsTenderExecutionArtifact_count(rows) {
  var out = { total: rows.length, photo: 0, signin: 0, satisfaction: 0, reimbursement: 0, report: 0, other: 0 };
  rows.forEach(function(r){
    var t = String(r.資料類型 || '');
    if (t === '成果照片') out.photo++;
    else if (t === '簽到表/名冊') out.signin++;
    else if (t === '滿意度調查') out.satisfaction++;
    else if (t === '核銷憑證') out.reimbursement++;
    else if (t === '成果報告') out.report++;
    else out.other++;
  });
  return out;
}

function GovOpsTenderExecutionArtifact_normalizeFiles(files) {
  if (typeof files === 'string') { try { files = JSON.parse(files); } catch (e) { files = files.split('\n').map(function(x){ return { DriveURL: x.trim() }; }).filter(function(x){ return x.DriveURL; }); } }
  return Array.isArray(files) ? files : [];
}

function GovOpsTenderExecutionArtifact_extractDriveId(url) {
  url = String(url || '');
  var m = url.match(/\/d\/([^\/]+)/) || url.match(/[?&]id=([^&]+)/);
  return m ? m[1] : '';
}

function GovOpsTenderExecutionArtifact_exists(tenantId, tenderId, fileId, url, fileName) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderExecutionArtifact_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId || '') && ((fileId && String(r.DriveFileID || '') === String(fileId)) || (url && String(r.DriveURL || '') === String(url)) || (fileName && String(r.檔案名稱 || '') === String(fileName))); });
  } catch (err) { return false; }
}

function GovOpsTenderExecutionArtifact_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderExecutionArtifact_Query() { return GovOpsTenderExecutionArtifact_query({ tenantId: 'TENANT-DEMO' }); }
