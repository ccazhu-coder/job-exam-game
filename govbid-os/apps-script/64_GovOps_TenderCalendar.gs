/* GovOps OS｜Tender Calendar v1
 * 目的：將標案截止投標日、開標日、備標節點建立到 Google Calendar，並回寫 CalendarID。
 */

function handleGovOpsTenderCalendarAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.calendar.create' || action === '建立標案日曆') return GovOpsTenderCalendar_create(data);
    if (action === 'tender.calendar.query' || action === '查詢標案日曆') return GovOpsTenderCalendar_query(data);
    if (action === 'tender.calendar.delete' || action === '刪除標案日曆') return GovOpsTenderCalendar_delete(data);
    return null;
  } catch (err) {
    GovOpsTenderCalendar_logError('handleGovOpsTenderCalendarAction', err, data);
    return GovOpsTenderCalendar_fail('標案日曆功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_CALENDAR = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderCalendarAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_CALENDAR(action, data);
  };
}

function GovOpsTenderCalendar_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderCalendar_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderCalendar_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderCalendar_sheetName() { return '34_標案日曆紀錄'; }

function GovOpsTenderCalendar_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderCalendar_sheetName(), ['日曆ID','tenantId','標案ID','標案名稱','事件類型','事件名稱','事件日期','開始時間','結束時間','GoogleCalendarEventID','日曆狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderCalendar_create(data) {
  data = data || {};
  GovOpsTenderCalendar_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var tender = GovOpsTenderCalendar_findTender(tenderId, tenantId) || {};
  var title = data.標案名稱 || tender.標案名稱 || tenderId || '未命名標案';
  var events = GovOpsTenderCalendar_buildEvents(Object.assign({}, tender, data, { 標案ID: tenderId, 標案名稱: title }));
  var calendar = CalendarApp.getDefaultCalendar();
  var created = [];
  events.forEach(function(ev) {
    if (!ev.date) return;
    if (GovOpsTenderCalendar_exists(tenantId, tenderId, ev.type, ev.date)) return;
    var start = GovOpsTenderCalendar_parseDateTime(ev.date, ev.start || '09:00');
    var end = GovOpsTenderCalendar_parseDateTime(ev.date, ev.end || '10:00');
    var event = calendar.createEvent(ev.name, start, end, { description: ev.desc || '', location: data.履約地點 || tender.履約地點 || '' });
    var row = {
      日曆ID: 'TCL-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      標案ID: tenderId,
      標案名稱: title,
      事件類型: ev.type,
      事件名稱: ev.name,
      事件日期: ev.date,
      開始時間: ev.start || '09:00',
      結束時間: ev.end || '10:00',
      GoogleCalendarEventID: event.getId(),
      日曆狀態: '已建立',
      建立時間: GovOpsTenderCalendar_now(),
      更新時間: GovOpsTenderCalendar_now(),
      userId: data.userId || '',
      備註: ev.desc || ''
    };
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderCalendar_sheetName(), row);
    created.push(row);
  });
  return GovOpsTenderCalendar_success('標案日曆已建立。', { created: created.length, rows: created });
}

function GovOpsTenderCalendar_query(data) {
  data = data || {};
  GovOpsTenderCalendar_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderCalendar_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderCalendar_success('標案日曆查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderCalendar_delete(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = GovOpsTenderCalendar_query({ tenantId: tenantId, keyword: keyword }).data.rows || [];
  var calendar = CalendarApp.getDefaultCalendar();
  var deleted = 0;
  rows.forEach(function(row){
    try {
      var ev = calendar.getEventById(row.GoogleCalendarEventID);
      if (ev) ev.deleteEvent();
      if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderCalendar_sheetName(), row._row, { 日曆狀態: '已刪除', 更新時間: GovOpsTenderCalendar_now() });
      deleted++;
    } catch (err) {}
  });
  return GovOpsTenderCalendar_success('標案日曆已刪除。', { deleted: deleted });
}

function GovOpsTenderCalendar_buildEvents(data) {
  var rows = [];
  var tenderId = data.標案ID || '';
  var title = data.標案名稱 || '未命名標案';
  var deadline = data.截止投標日 || data.投標截止日 || '';
  var openDate = data.開標日期 || '';
  if (deadline) {
    rows.push({ type: '投標截止', name: '【標案投標截止】' + title, date: deadline, start: '09:00', end: '10:00', desc: '標案ID：' + tenderId + '\n請確認投標文件、封裝、用印與送件。' });
    rows.push({ type: '投標前3日', name: '【備標檢查】' + title, date: GovOpsTenderCalendar_addDays(deadline, -3), start: '09:00', end: '10:00', desc: '投標前三日檢查：資格文件、企劃書、標價清單、附件。' });
    rows.push({ type: '投標前1日', name: '【投標前最終檢查】' + title, date: GovOpsTenderCalendar_addDays(deadline, -1), start: '16:00', end: '17:00', desc: '投標前一日最終檢查：份數、用印、封套、送件方式。' });
  }
  if (openDate) rows.push({ type: '開標日', name: '【標案開標】' + title, date: openDate, start: '09:00', end: '10:00', desc: '追蹤開標結果、得標廠商與後續評選/議價通知。' });
  return rows.filter(function(x){ return x.date; });
}

function GovOpsTenderCalendar_parseDateTime(dateText, timeText) {
  var d = String(dateText || '').replace(/-/g, '/');
  var t = String(timeText || '09:00');
  return new Date(d + ' ' + t + ':00');
}

function GovOpsTenderCalendar_addDays(dateText, days) {
  var d = new Date(String(dateText || '').replace(/-/g, '/'));
  if (isNaN(d.getTime())) return dateText;
  d.setDate(d.getDate() + Number(days || 0));
  return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/MM/dd');
}

function GovOpsTenderCalendar_exists(tenantId, tenderId, type, date) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderCalendar_sheetName());
    return rows.some(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId) && String(row.事件類型 || '') === String(type) && String(row.事件日期 || '') === String(date) && String(row.日曆狀態 || '') !== '已刪除'; });
  } catch (err) { return false; }
}

function GovOpsTenderCalendar_findTender(tenderId, tenantId) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function') return null;
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
    return rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId); }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderCalendar_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderCalendar_Create() { return GovOpsTenderCalendar_create({ tenantId: 'TENANT-DEMO', 標案ID: 'TEST', 標案名稱: '測試標案', 截止投標日: '2026/06/01', 開標日期: '2026/06/03' }); }
