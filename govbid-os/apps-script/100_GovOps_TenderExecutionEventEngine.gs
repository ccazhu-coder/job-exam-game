/* GovOps OS｜Tender Execution Event Engine v1
 * 目的：建立每個標案底下的場次/活動/課程資料，作為履約成果附件、照片、簽到表、滿意度與核銷資料的父層。
 */

function handleGovOpsTenderExecutionEventAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.executionEvent.create' || action === '建立履約場次') return GovOpsTenderExecutionEvent_create(data);
    if (action === 'tender.executionEvent.batchCreate' || action === '批次建立履約場次') return GovOpsTenderExecutionEvent_batchCreate(data);
    if (action === 'tender.executionEvent.query' || action === '查詢履約場次') return GovOpsTenderExecutionEvent_query(data);
    if (action === 'tender.executionEvent.update' || action === '更新履約場次') return GovOpsTenderExecutionEvent_update(data);
    if (action === 'tender.executionEvent.summary' || action === '履約場次摘要') return GovOpsTenderExecutionEvent_summary(data);
    return null;
  } catch (err) {
    GovOpsTenderExecutionEvent_logError('handleGovOpsTenderExecutionEventAction', err, data);
    return GovOpsTenderExecutionEvent_fail('履約場次管理功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_EVENT = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderExecutionEventAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_EVENT(action, data);
  };
}

function GovOpsTenderExecutionEvent_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderExecutionEvent_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderExecutionEvent_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderExecutionEvent_sheetName() { return '74_履約活動場次'; }

function GovOpsTenderExecutionEvent_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderExecutionEvent_sheetName(), ['場次ID','tenantId','標案ID','標案名稱','活動類型','活動名稱','活動日期','開始時間','結束時間','地點','講師/主持人','服務對象','預計人數','實際人數','活動狀態','照片狀態','簽到狀態','滿意度狀態','核銷狀態','結案資料狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderExecutionEvent_create(data) {
  data = data || {};
  GovOpsTenderExecutionEvent_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var row = {
    場次ID: data.場次ID || data.eventId || 'TEE-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || '',
    標案名稱: data.標案名稱 || '',
    活動類型: data.活動類型 || data.eventType || '課程/活動',
    活動名稱: data.活動名稱 || data.eventName || '',
    活動日期: data.活動日期 || data.eventDate || '',
    開始時間: data.開始時間 || data.startTime || '',
    結束時間: data.結束時間 || data.endTime || '',
    地點: data.地點 || data.location || '',
    '講師/主持人': data['講師/主持人'] || data.講師 || data.host || '',
    服務對象: data.服務對象 || data.target || '',
    預計人數: Number(data.預計人數 || 0),
    實際人數: Number(data.實際人數 || 0),
    活動狀態: data.活動狀態 || '未開始',
    照片狀態: data.照片狀態 || '待上傳',
    簽到狀態: data.簽到狀態 || '待上傳',
    滿意度狀態: data.滿意度狀態 || '待上傳',
    核銷狀態: data.核銷狀態 || '待上傳',
    結案資料狀態: data.結案資料狀態 || '待補件',
    建立時間: GovOpsTenderExecutionEvent_now(),
    更新時間: GovOpsTenderExecutionEvent_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (GovOpsTenderExecutionEvent_exists(tenantId, row.標案ID, row.活動日期, row.活動名稱)) return GovOpsTenderExecutionEvent_update(Object.assign({}, data, { 標案ID: row.標案ID, 活動日期: row.活動日期, 活動名稱: row.活動名稱 }));
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderExecutionEvent_sheetName(), row);
  return GovOpsTenderExecutionEvent_success('履約場次已建立。', row);
}

function GovOpsTenderExecutionEvent_batchCreate(data) {
  data = data || {};
  var events = data.events || data.場次清單 || [];
  if (typeof events === 'string') { try { events = JSON.parse(events); } catch (e) { events = []; } }
  if (!Array.isArray(events) || !events.length) return GovOpsTenderExecutionEvent_fail('請提供 events 場次清單。');
  var created = 0, rows = [];
  events.forEach(function(ev){
    var r = GovOpsTenderExecutionEvent_create(Object.assign({}, data, ev));
    if (r && r.success) { created++; rows.push(r.data); }
  });
  return GovOpsTenderExecutionEvent_success('履約場次批次建立完成。', { created: created, rows: rows });
}

function GovOpsTenderExecutionEvent_query(data) {
  data = data || {};
  GovOpsTenderExecutionEvent_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || data.場次ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderExecutionEvent_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderExecutionEvent_success('履約場次查詢完成。', { total: rows.length, summary: GovOpsTenderExecutionEvent_count(rows), rows: rows.slice(0, 500) });
}

function GovOpsTenderExecutionEvent_update(data) {
  data = data || {};
  GovOpsTenderExecutionEvent_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var eventId = data.場次ID || data.eventId || '';
  var rows = GovOpsProduct_readRows(GovOpsTenderExecutionEvent_sheetName());
  var found = rows.find(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (eventId && String(row.場次ID || '') === String(eventId)) return true;
    return String(row.標案ID || '') === String(data.標案ID || data.tenderId || '') && String(row.活動日期 || '') === String(data.活動日期 || data.eventDate || '') && String(row.活動名稱 || '') === String(data.活動名稱 || data.eventName || '');
  });
  if (!found) return GovOpsTenderExecutionEvent_fail('找不到履約場次資料。');
  var patch = { 更新時間: GovOpsTenderExecutionEvent_now() };
  ['標案名稱','活動類型','活動名稱','活動日期','開始時間','結束時間','地點','講師/主持人','服務對象','預計人數','實際人數','活動狀態','照片狀態','簽到狀態','滿意度狀態','核銷狀態','結案資料狀態','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = /人數/.test(k) ? Number(data[k] || 0) : data[k]; });
  if (data.講師 !== undefined) patch['講師/主持人'] = data.講師;
  if (data.eventName !== undefined) patch.活動名稱 = data.eventName;
  if (data.eventDate !== undefined) patch.活動日期 = data.eventDate;
  if (data.location !== undefined) patch.地點 = data.location;
  GovOpsProduct_update(GovOpsTenderExecutionEvent_sheetName(), found._row, patch);
  return GovOpsTenderExecutionEvent_success('履約場次已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderExecutionEvent_summary(data) {
  var q = GovOpsTenderExecutionEvent_query(data);
  return GovOpsTenderExecutionEvent_success('履約場次摘要完成。', q.data.summary || {});
}

function GovOpsTenderExecutionEvent_updateArtifactStatus(artifact) {
  try {
    var tenantId = artifact.tenantId || 'TENANT-DEMO';
    var eventId = artifact.活動ID || artifact.eventId || '';
    if (!eventId) return;
    var rows = GovOpsProduct_readRows(GovOpsTenderExecutionEvent_sheetName()).filter(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.場次ID || '') === String(eventId); });
    if (!rows.length) return;
    var row = rows[0];
    var patch = { 更新時間: GovOpsTenderExecutionEvent_now() };
    var type = String(artifact.資料類型 || '');
    if (type === '成果照片') patch.照片狀態 = '已上傳';
    if (type === '簽到表/名冊') patch.簽到狀態 = '已上傳';
    if (type === '滿意度調查') patch.滿意度狀態 = '已上傳';
    if (type === '核銷憑證') patch.核銷狀態 = '已上傳';
    var complete = [patch.照片狀態 || row.照片狀態, patch.簽到狀態 || row.簽到狀態, patch.滿意度狀態 || row.滿意度狀態, patch.核銷狀態 || row.核銷狀態].every(function(s){ return String(s || '').indexOf('已') >= 0; });
    patch.結案資料狀態 = complete ? '已齊備' : '待補件';
    GovOpsProduct_update(GovOpsTenderExecutionEvent_sheetName(), row._row, patch);
  } catch (err) {}
}

function GovOpsTenderExecutionEvent_count(rows) {
  var out = { total: rows.length, done: 0, pending: 0, artifactsReady: 0, artifactsMissing: 0 };
  rows.forEach(function(r){
    if (String(r.活動狀態 || '') === '已完成') out.done++; else out.pending++;
    if (String(r.結案資料狀態 || '') === '已齊備') out.artifactsReady++; else out.artifactsMissing++;
  });
  return out;
}

function GovOpsTenderExecutionEvent_exists(tenantId, tenderId, eventDate, eventName) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderExecutionEvent_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId || '') && String(r.活動日期 || '') === String(eventDate || '') && String(r.活動名稱 || '') === String(eventName || ''); });
  } catch (err) { return false; }
}

function GovOpsTenderExecutionEvent_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderExecutionEvent_Query() { return GovOpsTenderExecutionEvent_query({ tenantId: 'TENANT-DEMO' }); }
