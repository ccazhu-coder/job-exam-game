/* GovOps OS｜Trigger Center v1
 * 目的：補齊正式產品的 Apps Script 排程中心。
 * 功能：安裝/移除/檢查 Trigger，支援提醒檢查、每日摘要、表單同步排程入口。
 */

var GOVOPS_TRIGGER_NAMES = {
  REMINDER_CHECK: 'GovOpsTrigger_runReminderCheck',
  DAILY_SUMMARY: 'GovOpsTrigger_runDailySummary',
  FORM_SYNC: 'GovOpsTrigger_runFormSync'
};

function handleGovOpsTriggerAction(action, data) {
  data = data || {};
  try {
    if (action === 'trigger.install' || action === '安裝排程') return GovOpsTrigger_install(data);
    if (action === 'trigger.remove' || action === '移除排程') return GovOpsTrigger_remove(data);
    if (action === 'trigger.health' || action === '檢查排程') return GovOpsTrigger_health(data);
    if (action === 'trigger.runReminder' || action === '執行提醒排程') return GovOpsTrigger_runReminderCheck();
    if (action === 'trigger.runDailySummary' || action === '執行每日摘要排程') return GovOpsTrigger_runDailySummary();
    if (action === 'trigger.runFormSync' || action === '執行表單同步排程') return GovOpsTrigger_runFormSync();
    return null;
  } catch (err) {
    GovOpsTrigger_logError('handleGovOpsTriggerAction', err, data);
    return GovOpsTrigger_fail('排程中心暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TRIGGER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTriggerAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TRIGGER(action, data);
  };
}

function GovOpsTrigger_success(message, data) {
  return { success: true, message: message || '操作完成。', data: data || {} };
}

function GovOpsTrigger_fail(message, data) {
  return { success: false, message: message || '操作失敗。', data: data || {} };
}

function GovOpsTrigger_install(data) {
  data = data || {};
  GovOpsTrigger_remove({ silent: true });

  ScriptApp.newTrigger(GOVOPS_TRIGGER_NAMES.REMINDER_CHECK)
    .timeBased()
    .everyHours(Number(data.reminderHours || 1))
    .create();

  ScriptApp.newTrigger(GOVOPS_TRIGGER_NAMES.DAILY_SUMMARY)
    .timeBased()
    .everyDays(1)
    .atHour(Number(data.summaryHour || 8))
    .create();

  ScriptApp.newTrigger(GOVOPS_TRIGGER_NAMES.FORM_SYNC)
    .timeBased()
    .everyHours(Number(data.syncHours || 2))
    .create();

  return GovOpsTrigger_success('GovOps 排程已安裝。', GovOpsTrigger_health({}).data);
}

function GovOpsTrigger_remove(data) {
  data = data || {};
  var names = Object.keys(GOVOPS_TRIGGER_NAMES).map(function(k) { return GOVOPS_TRIGGER_NAMES[k]; });
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (names.indexOf(trigger.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  if (data.silent) return GovOpsTrigger_success('已移除舊排程。', { removed: removed });
  return GovOpsTrigger_success('GovOps 排程已移除。', { removed: removed });
}

function GovOpsTrigger_health(data) {
  var triggers = ScriptApp.getProjectTriggers().map(function(trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      source: String(trigger.getTriggerSource()),
      eventType: String(trigger.getEventType())
    };
  });
  var required = Object.keys(GOVOPS_TRIGGER_NAMES).map(function(k) { return GOVOPS_TRIGGER_NAMES[k]; });
  var missing = required.filter(function(name) {
    return !triggers.some(function(t) { return t.handler === name; });
  });
  return GovOpsTrigger_success('排程中心檢查完成。', {
    ok: missing.length === 0,
    total: triggers.length,
    missing: missing,
    triggers: triggers
  });
}

function GovOpsTrigger_runReminderCheck() {
  try {
    if (typeof 執行提醒檢查 === 'function') return 執行提醒檢查({ tenantId: 'TENANT-DEMO', userId: 'SYSTEM-TRIGGER' });
    return GovOpsTrigger_success('提醒檢查入口尚未載入，已略過。');
  } catch (err) {
    GovOpsTrigger_logError('GovOpsTrigger_runReminderCheck', err, {});
    return GovOpsTrigger_fail('提醒排程執行失敗。');
  }
}

function GovOpsTrigger_runDailySummary() {
  try {
    if (typeof 產生秘書摘要 === 'function') return 產生秘書摘要({ tenantId: 'TENANT-DEMO', userId: 'SYSTEM-TRIGGER' });
    return GovOpsTrigger_success('每日摘要入口尚未載入，已略過。');
  } catch (err) {
    GovOpsTrigger_logError('GovOpsTrigger_runDailySummary', err, {});
    return GovOpsTrigger_fail('每日摘要排程執行失敗。');
  }
}

function GovOpsTrigger_runFormSync() {
  try {
    if (typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_syncRegistrationFast !== 'function') {
      return GovOpsTrigger_success('表單同步入口尚未載入，已略過。');
    }
    var activitySheet = GOVOPS_PRODUCT_SHEETS.活動 || '06_招生活動管理';
    var activities = GovOpsProduct_readRows(activitySheet).filter(function(row) {
      return row.活動ID && row.表單回覆試算表ID && String(row.活動狀態 || '') !== '已取消' && String(row.活動狀態 || '') !== '已完成';
    });
    var results = [];
    activities.slice(0, 20).forEach(function(row) {
      var result = GovOpsProduct_syncRegistrationFast({
        tenantId: row.tenantId || 'TENANT-DEMO',
        userId: 'SYSTEM-TRIGGER',
        活動ID: row.活動ID,
        表單回覆試算表ID: row.表單回覆試算表ID,
        表單回覆分頁名稱: row.表單回覆分頁名稱 || ''
      });
      results.push({ 活動ID: row.活動ID, success: !!result.success, message: result.message, data: result.data || {} });
    });
    return GovOpsTrigger_success('表單同步排程執行完成。', { total: results.length, results: results });
  } catch (err) {
    GovOpsTrigger_logError('GovOpsTrigger_runFormSync', err, {});
    return GovOpsTrigger_fail('表單同步排程執行失敗。');
  }
}

function GovOpsTrigger_logError(module, err, data) {
  try {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {});
    else if (typeof logError === 'function') logError(module, err);
  } catch (e) {}
}

function 測試_Trigger_Health() {
  return GovOpsTrigger_health({});
}
