/* GovOps OS｜Calendar Core v1 */
var GOVOPS_CALENDAR_DEFAULT_ID = 'primary';

function GovOpsCalendar_success(message, data) {
  return { success: true, message: message || '操作完成。', data: data || {} };
}

function GovOpsCalendar_fail(message, data) {
  return { success: false, message: message || '操作失敗。', data: data || {} };
}

function GovOpsCalendar_now() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function GovOpsCalendar_getCalendar(data) {
  data = data || {};
  var calendarId = data.calendarId || data.CalendarID || data.日曆ID || GOVOPS_CALENDAR_DEFAULT_ID;
  return CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar();
}

function GovOpsCalendar_parseDateTime(dateValue, timeValue) {
  var dateText = String(dateValue || '').trim().replace(/-/g, '/');
  var timeText = String(timeValue || '09:00').trim();
  if (!dateText) throw new Error('缺少活動日期。');
  var date = new Date(dateText + ' ' + timeText);
  if (isNaN(date.getTime()) || date.getFullYear() < 2000) throw new Error('活動日期時間格式錯誤。');
  return date;
}

function GovOpsCalendar_findActivity(activityId, tenantId) {
  if (!activityId || typeof GovOpsProduct_readRows !== 'function') return null;
  var sheetName = GOVOPS_PRODUCT_SHEETS && GOVOPS_PRODUCT_SHEETS.活動 ? GOVOPS_PRODUCT_SHEETS.活動 : '06_招生活動管理';
  var rows = GovOpsProduct_readRows(sheetName);
  return rows.find(function(row) {
    return String(row.活動ID || '') === String(activityId) && (!tenantId || String(row.tenantId || '') === String(tenantId));
  }) || null;
}

function GovOpsCalendar_buildEventData(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var activityId = data.活動ID || data.activityId;
  var activity = GovOpsCalendar_findActivity(activityId, tenantId) || {};
  var title = data.活動名稱 || activity.活動名稱 || data.title || 'GovOps 活動';
  var date = data.活動日期 || activity.活動日期 || data.date;
  var startTime = data.開始時間 || activity.開始時間 || data.startTime || '09:00';
  var endTime = data.結束時間 || activity.結束時間 || data.endTime || '12:00';
  var start = GovOpsCalendar_parseDateTime(date, startTime);
  var end = GovOpsCalendar_parseDateTime(date, endTime);
  if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);
  var location = data.活動地點 || activity.活動地點 || data.location || '';
  var description = [
    'GovOps OS 活動',
    '活動ID：' + (activityId || ''),
    '計畫名稱：' + (data.計畫名稱 || activity.計畫名稱 || ''),
    '主辦單位：' + (data.主辦單位 || activity.主辦單位 || ''),
    '講師：' + (data.講師 || activity.講師 || ''),
    '備註：' + (data.備註 || activity.備註 || '')
  ].join('\n');
  return { activity: activity, activityId: activityId, title: title, start: start, end: end, location: location, description: description };
}

function GovOpsCalendar_writeBack(activityId, tenantId, eventId) {
  try {
    if (!activityId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.活動;
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(row) {
      return String(row.活動ID || '') === String(activityId) && (!tenantId || String(row.tenantId || '') === String(tenantId));
    });
    if (found) GovOpsProduct_update(sheetName, found._row, { CalendarID: eventId || '', 更新時間: GovOpsCalendar_now() });
  } catch (err) {
    GovOpsCalendar_logError('GovOpsCalendar_writeBack', err, { 活動ID: activityId });
  }
}

function GovOpsCalendar_logError(module, err, data) {
  try {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {});
    else if (typeof logError === 'function') logError(module, err);
  } catch (e) {}
}
