/* GovOps OS｜Calendar Router Patch v1 */

function handleGovOpsCalendarAction(action, data) {
  data = data || {};
  try {
    if (action === 'calendar.createEvent' || action === '建立活動日曆') return GovOpsCalendar_createEvent(data);
    if (action === 'calendar.updateEvent' || action === '更新活動日曆') return GovOpsCalendar_updateEvent(data);
    if (action === 'calendar.deleteEvent' || action === '刪除活動日曆') return GovOpsCalendar_deleteEvent(data);
    if (action === 'calendar.syncActivity' || action === '同步活動日曆') return GovOpsCalendar_syncActivity(data);
    return null;
  } catch (err) {
    GovOpsCalendar_logError('handleGovOpsCalendarAction', err, data);
    return GovOpsCalendar_fail('日曆功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CALENDAR = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsCalendarAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CALENDAR(action, data);
  };
}

function GovOpsCalendar_createEvent(data) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return GovOpsCalendar_fail('系統正在處理日曆，請稍後再試。');
  try {
    var built = GovOpsCalendar_buildEventData(data || {});
    var cal = GovOpsCalendar_getCalendar(data || {});
    var event = cal.createEvent(built.title, built.start, built.end, {
      location: built.location,
      description: built.description
    });
    GovOpsCalendar_writeBack(built.activityId, data.tenantId, event.getId());
    return GovOpsCalendar_success('活動日曆已建立。', {
      活動ID: built.activityId,
      CalendarID: event.getId(),
      標題: built.title
    });
  } finally {
    lock.releaseLock();
  }
}

function GovOpsCalendar_updateEvent(data) {
  data = data || {};
  var built = GovOpsCalendar_buildEventData(data);
  var eventId = data.CalendarID || data.calendarEventId || (built.activity && built.activity.CalendarID);
  if (!eventId) return GovOpsCalendar_createEvent(data);
  var cal = GovOpsCalendar_getCalendar(data);
  var event = cal.getEventById(eventId);
  if (!event) return GovOpsCalendar_createEvent(data);
  event.setTitle(built.title);
  event.setTime(built.start, built.end);
  event.setLocation(built.location || '');
  event.setDescription(built.description || '');
  GovOpsCalendar_writeBack(built.activityId, data.tenantId, event.getId());
  return GovOpsCalendar_success('活動日曆已更新。', {
    活動ID: built.activityId,
    CalendarID: event.getId()
  });
}

function GovOpsCalendar_deleteEvent(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var activity = GovOpsCalendar_findActivity(data.活動ID || data.activityId, tenantId) || {};
  var eventId = data.CalendarID || data.calendarEventId || activity.CalendarID;
  if (!eventId) return GovOpsCalendar_fail('找不到 CalendarID。');
  var cal = GovOpsCalendar_getCalendar(data);
  var event = cal.getEventById(eventId);
  if (event) event.deleteEvent();
  GovOpsCalendar_writeBack(data.活動ID || data.activityId, tenantId, '');
  return GovOpsCalendar_success('活動日曆已刪除。', {
    活動ID: data.活動ID || data.activityId
  });
}

function GovOpsCalendar_syncActivity(data) {
  data = data || {};
  var status = data.活動狀態 || data.status || '';
  if (status === '已取消') return GovOpsCalendar_deleteEvent(data);
  return GovOpsCalendar_updateEvent(data);
}
