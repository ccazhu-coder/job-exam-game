/* GovOps OS｜Tender Execution Attendance Engine v1
 * 目的：管理每個履約場次的應出席人數、實際出席人數、出席率、缺席數與結案/KPI同步。
 */

function handleGovOpsTenderExecutionAttendanceAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.executionAttendance.update' || action === '更新場次出席人數') return GovOpsTenderExecutionAttendance_update(data);
    if (action === 'tender.executionAttendance.query' || action === '查詢場次出席人數') return GovOpsTenderExecutionAttendance_query(data);
    if (action === 'tender.executionAttendance.summary' || action === '場次出席統計') return GovOpsTenderExecutionAttendance_summary(data);
    if (action === 'tender.executionAttendance.syncClosing' || action === '同步出席統計到結案') return GovOpsTenderExecutionAttendance_syncClosing(data);
    return null;
  } catch (err) {
    GovOpsTenderExecutionAttendance_logError('handleGovOpsTenderExecutionAttendanceAction', err, data);
    return GovOpsTenderExecutionAttendance_fail('場次出席人數管理功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_ATTENDANCE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderExecutionAttendanceAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_ATTENDANCE(action, data);
  };
}

function GovOpsTenderExecutionAttendance_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderExecutionAttendance_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderExecutionAttendance_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderExecutionAttendance_sheetName() { return '75_履約場次出席統計'; }

function GovOpsTenderExecutionAttendance_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderExecutionAttendance_sheetName(), ['出席ID','tenantId','標案ID','標案名稱','場次ID','活動名稱','活動日期','應出席人數','實際出席人數','缺席人數','出席率','是否達標','達標標準','資料來源','簽到表附件ID','同步狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderExecutionAttendance_update(data) {
  data = data || {};
  GovOpsTenderExecutionAttendance_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var event = GovOpsTenderExecutionAttendance_findEvent(tenantId, data) || {};
  var expected = Number(data.應出席人數 || data.expectedAttendance || event.應出席人數 || event.預計人數 || 0);
  var actual = Number(data.實際出席人數 || data.actualAttendance || event.實際人數 || 0);
  var absent = Math.max(0, expected - actual);
  var rate = expected > 0 ? Math.round((actual / expected) * 10000) / 100 : 0;
  var standard = Number(data.達標標準 || data.targetRate || 80);
  var passed = expected > 0 ? (rate >= standard ? '是' : '否') : '待確認';
  var existing = GovOpsTenderExecutionAttendance_findAttendance(tenantId, data.場次ID || data.eventId || event.場次ID || '', data.標案ID || data.tenderId || event.標案ID || '', data.活動日期 || data.eventDate || event.活動日期 || '', data.活動名稱 || data.eventName || event.活動名稱 || '');
  var row = {
    出席ID: existing && existing.出席ID || 'TEAT-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || event.標案ID || '',
    標案名稱: data.標案名稱 || event.標案名稱 || '',
    場次ID: data.場次ID || data.eventId || event.場次ID || '',
    活動名稱: data.活動名稱 || data.eventName || event.活動名稱 || '',
    活動日期: data.活動日期 || data.eventDate || event.活動日期 || '',
    應出席人數: expected,
    實際出席人數: actual,
    缺席人數: absent,
    出席率: rate + '%',
    是否達標: passed,
    達標標準: standard + '%',
    資料來源: data.資料來源 || '人工輸入/簽到表',
    簽到表附件ID: data.簽到表附件ID || data.signinArtifactId || '',
    同步狀態: '已更新',
    建立時間: existing && existing.建立時間 || GovOpsTenderExecutionAttendance_now(),
    更新時間: GovOpsTenderExecutionAttendance_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (existing && typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderExecutionAttendance_sheetName(), existing._row, row);
  else if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderExecutionAttendance_sheetName(), row);
  GovOpsTenderExecutionAttendance_updateEvent(row);
  GovOpsTenderExecutionAttendance_syncClosing({ tenantId: tenantId, 標案ID: row.標案ID, 場次ID: row.場次ID, userId: data.userId || '' });
  return GovOpsTenderExecutionAttendance_success('場次出席人數已更新。', row);
}

function GovOpsTenderExecutionAttendance_query(data) {
  data = data || {};
  GovOpsTenderExecutionAttendance_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || data.場次ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderExecutionAttendance_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderExecutionAttendance_success('場次出席人數查詢完成。', { total: rows.length, summary: GovOpsTenderExecutionAttendance_count(rows), rows: rows.slice(0, 500) });
}

function GovOpsTenderExecutionAttendance_summary(data) {
  var q = GovOpsTenderExecutionAttendance_query(data);
  return GovOpsTenderExecutionAttendance_success('場次出席統計完成。', q.data.summary || {});
}

function GovOpsTenderExecutionAttendance_syncClosing(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var q = GovOpsTenderExecutionAttendance_query({ tenantId: tenantId, keyword: data.場次ID || data.eventId || data.標案ID || data.tenderId || data.keyword || '' });
  var rows = q.data.rows || [];
  if (!rows.length) return GovOpsTenderExecutionAttendance_fail('找不到可同步的出席統計。');
  var text = GovOpsTenderExecutionAttendance_reportText(rows);
  try {
    var drafts = GovOpsProduct_readRows('67_標案結案報告草稿').filter(function(r){ return String(r.tenantId || '') === String(tenantId) && (!data.標案ID || String(r.標案ID || '') === String(data.標案ID)); });
    if (drafts.length) {
      var draft = drafts[drafts.length - 1];
      GovOpsProduct_update('67_標案結案報告草稿', draft._row, { 報告內容: String(draft.報告內容 || '') + '\n\n【場次出席統計】\n' + text, 更新時間: GovOpsTenderExecutionAttendance_now(), 備註: '已同步場次出席統計。' });
    }
  } catch (err) {}
  return GovOpsTenderExecutionAttendance_success('場次出席統計已同步到結案資料。', { rows: rows.length, summary: q.data.summary, reportText: text });
}

function GovOpsTenderExecutionAttendance_updateEvent(att) {
  try {
    if (typeof GovOpsTenderExecutionEvent_update === 'function') {
      GovOpsTenderExecutionEvent_update({
        tenantId: att.tenantId,
        場次ID: att.場次ID,
        標案ID: att.標案ID,
        活動日期: att.活動日期,
        活動名稱: att.活動名稱,
        預計人數: att.應出席人數,
        實際人數: att.實際出席人數,
        簽到狀態: att.實際出席人數 > 0 ? '已登錄' : '待上傳',
        活動狀態: '已完成',
        備註: '出席率：' + att.出席率 + '；是否達標：' + att.是否達標
      });
    }
  } catch (err) {}
}

function GovOpsTenderExecutionAttendance_findEvent(tenantId, data) {
  try {
    var rows = GovOpsProduct_readRows('74_履約活動場次').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (data.場次ID && String(row.場次ID || '') === String(data.場次ID)) return true;
      if (data.eventId && String(row.場次ID || '') === String(data.eventId)) return true;
      return String(row.標案ID || '') === String(data.標案ID || data.tenderId || '') && String(row.活動日期 || '') === String(data.活動日期 || data.eventDate || '') && String(row.活動名稱 || '') === String(data.活動名稱 || data.eventName || '');
    });
    return rows[0] || null;
  } catch (err) { return null; }
}

function GovOpsTenderExecutionAttendance_findAttendance(tenantId, eventId, tenderId, eventDate, eventName) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderExecutionAttendance_sheetName());
    return rows.find(function(r){
      if (String(r.tenantId || '') !== String(tenantId)) return false;
      if (eventId && String(r.場次ID || '') === String(eventId)) return true;
      return String(r.標案ID || '') === String(tenderId || '') && String(r.活動日期 || '') === String(eventDate || '') && String(r.活動名稱 || '') === String(eventName || '');
    }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderExecutionAttendance_count(rows) {
  var out = { totalEvents: rows.length, expectedTotal: 0, actualTotal: 0, absentTotal: 0, averageAttendanceRate: '0%', passedEvents: 0, failedEvents: 0 };
  rows.forEach(function(r){
    var expected = Number(r.應出席人數 || 0), actual = Number(r.實際出席人數 || 0), absent = Number(r.缺席人數 || 0);
    out.expectedTotal += expected;
    out.actualTotal += actual;
    out.absentTotal += absent;
    if (String(r.是否達標 || '') === '是') out.passedEvents++;
    if (String(r.是否達標 || '') === '否') out.failedEvents++;
  });
  out.averageAttendanceRate = out.expectedTotal > 0 ? (Math.round((out.actualTotal / out.expectedTotal) * 10000) / 100) + '%' : '0%';
  return out;
}

function GovOpsTenderExecutionAttendance_reportText(rows) {
  var s = GovOpsTenderExecutionAttendance_count(rows);
  var lines = [];
  lines.push('本案場次出席統計：應出席人數共 ' + s.expectedTotal + ' 人，實際出席人數共 ' + s.actualTotal + ' 人，缺席 ' + s.absentTotal + ' 人，平均出席率 ' + s.averageAttendanceRate + '。');
  rows.forEach(function(r){ lines.push('- ' + (r.活動日期 || '') + '｜' + (r.活動名稱 || '') + '｜應出席 ' + (r.應出席人數 || 0) + ' 人｜實際出席 ' + (r.實際出席人數 || 0) + ' 人｜出席率 ' + (r.出席率 || '0%') + '｜是否達標：' + (r.是否達標 || '待確認')); });
  return lines.join('\n');
}

function GovOpsTenderExecutionAttendance_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderExecutionAttendance_Update() { return GovOpsTenderExecutionAttendance_update({ tenantId: 'TENANT-DEMO', 標案ID: 'TEST', 活動名稱: '測試課程', 活動日期: '2026/01/01', 應出席人數: 30, 實際出席人數: 27 }); }
