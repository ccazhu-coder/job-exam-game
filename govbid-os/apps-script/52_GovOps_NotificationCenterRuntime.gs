/*
GovOps OS｜52_GovOps_NotificationCenterRuntime.gs
Enterprise SaaS ERP Notification Center Runtime v1.0.0

用途：
1. 系統通知中心
2. LINE Notification Runtime
3. Email Notification Runtime
4. SLA Alert Runtime
5. AI Reminder Runtime
6. ERP Alert Center
*/

var GOVOPS_NOTIFY_VERSION = '1.0.0';
var GOVOPS_NOTIFY_SHEET = '系統通知中心';
var GOVOPS_NOTIFY_LOG_SHEET = '通知發送紀錄';

function NT_headers_() {
  return ['noticeId','tenantId','userId','通知類型','通知標題','通知內容','通知渠道','通知狀態','關聯類型','關聯ID','排程時間','發送時間','建立時間','更新時間'];
}

function NT_logHeaders_() {
  return ['logId','noticeId','tenantId','userId','通知渠道','發送狀態','訊息','發送時間'];
}

function NT_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function NT_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function NT_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function NT_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function NT_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化通知中心() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_NOTIFY_SHEET, NT_headers_());
    DAL_ensureHeaders_(GOVOPS_NOTIFY_LOG_SHEET, NT_logHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_NOTIFY_SHEET, NT_headers_());
    ensureSheet(GOVOPS_NOTIFY_LOG_SHEET, NT_logHeaders_());
  }
  return NT_success_('通知中心初始化完成。', { version: GOVOPS_NOTIFY_VERSION });
}

function 建立系統通知(data) {
  初始化通知中心();
  data = data || {};
  if (typeof DAL_append !== 'function') return NT_fail_('DataAccessLayer 尚未載入。');
  var ctx = NT_ctx_(data);
  var title = data.title || data['通知標題'] || '';
  var content = data.content || data['通知內容'] || '';
  if (!title && !content) return NT_fail_('請提供通知標題或內容。');
  var noticeId = NT_id_('NTC');
  var row = {
    noticeId: noticeId,
    tenantId: ctx.tenantId,
    userId: data.targetUserId || ctx.userId,
    通知類型: data.noticeType || data['通知類型'] || 'system',
    通知標題: title || 'GovOps 系統通知',
    通知內容: content,
    通知渠道: data.channel || data['通知渠道'] || 'in_app',
    通知狀態: 'pending',
    關聯類型: data.relationType || data['關聯類型'] || '',
    關聯ID: data.relationId || data['關聯ID'] || '',
    排程時間: data.scheduleAt || data['排程時間'] || NT_now_(),
    發送時間: '',
    建立時間: NT_now_(),
    更新時間: NT_now_()
  };
  DAL_append(GOVOPS_NOTIFY_SHEET, row, NT_headers_());
  return NT_success_('通知已建立。', { noticeId: noticeId });
}

function 查詢系統通知(data) {
  初始化通知中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return NT_fail_('DataAccessLayer 尚未載入。');
  var ctx = NT_ctx_(data);
  var filters = {};
  if (data.status) filters['通知狀態'] = data.status;
  if (data.noticeType) filters['通知類型'] = data.noticeType;
  var res = DAL_query(GOVOPS_NOTIFY_SHEET, {
    tenantId: ctx.tenantId,
    keyword: data.keyword || data['關鍵字'] || '',
    filters: filters,
    limit: data.limit || 100,
    page: data.page || 1,
    cache: false
  });
  return NT_success_('通知查詢完成。', { 通知: res.data.rows, 筆數: res.data.total });
}

function 發送待處理通知(data) {
  初始化通知中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return NT_fail_('DataAccessLayer 尚未載入。');
  var ctx = NT_ctx_(data);
  var res = DAL_query(GOVOPS_NOTIFY_SHEET, {
    tenantId: ctx.tenantId,
    filters: { '通知狀態': 'pending' },
    limit: data.limit || 20,
    cache: false
  });
  var rows = res.data.rows || [];
  var results = [];
  rows.forEach(function(n) { results.push(NT_sendOne_(n)); });
  return NT_success_('待處理通知發送完成。', { 發送數: results.length, 結果: results });
}

function NT_sendOne_(notice) {
  var channel = String(notice['通知渠道'] || 'in_app');
  var result;
  if (channel === 'email') result = NT_sendEmail_(notice);
  else if (channel === 'line') result = NT_sendLine_(notice);
  else result = NT_sendInApp_(notice);
  var ok = result && result.success !== false;
  if (typeof DAL_updateByRow === 'function') {
    DAL_updateByRow(GOVOPS_NOTIFY_SHEET, notice._row, {
      通知狀態: ok ? 'sent' : 'failed',
      發送時間: NT_now_(),
      更新時間: NT_now_()
    });
  }
  NT_log_(notice, channel, ok ? '成功' : '失敗', result && result.message ? result.message : '');
  return { noticeId: notice.noticeId, success: ok, channel: channel };
}

function NT_sendInApp_(notice) {
  return NT_success_('站內通知已送達。');
}

function NT_sendEmail_(notice) {
  try {
    var email = NT_resolveUserEmail_(notice.tenantId, notice.userId);
    if (!email) return NT_fail_('查無使用者 Email。');
    MailApp.sendEmail(email, notice['通知標題'] || 'GovOps 系統通知', notice['通知內容'] || '');
    return NT_success_('Email 已發送。');
  } catch (err) {
    return NT_fail_('Email 發送失敗。');
  }
}

function NT_sendLine_(notice) {
  // LINE Messaging API 需要 Channel Access Token 與 userId mapping。
  // 目前先記錄為可送達任務，正式 token 接入後由 LINE Runtime 發送。
  return NT_success_('LINE 通知已建立，等待 LINE Runtime 接入。');
}

function NT_resolveUserEmail_(tenantId, userId) {
  try {
    if (typeof DAL_findOne !== 'function') return '';
    var user = DAL_findOne('使用者帳號表', { tenantId: tenantId, filters: { userId: userId }, cache: false });
    return user ? (user.Email || user['Email'] || '') : '';
  } catch (err) {
    return '';
  }
}

function NT_log_(notice, channel, status, message) {
  var row = {
    logId: NT_id_('NLOG'),
    noticeId: notice.noticeId,
    tenantId: notice.tenantId,
    userId: notice.userId,
    通知渠道: channel,
    發送狀態: status,
    訊息: message || '',
    發送時間: NT_now_()
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_NOTIFY_LOG_SHEET, row, NT_logHeaders_());
}

function 建立SLA逾期通知(data) {
  data = data || {};
  var res = typeof 檢查流程SLA === 'function' ? 檢查流程SLA(data) : NT_fail_('流程 SLA 檢查尚未載入。');
  if (!res.success) return res;
  var overdue = res.data.逾期任務 || [];
  var created = [];
  overdue.forEach(function(t) {
    created.push(建立系統通知(Object.assign({}, data, {
      noticeType: 'sla_overdue',
      title: '流程任務逾期提醒',
      content: '任務「' + (t['任務名稱'] || '') + '」已超過 SLA 時限，請盡快處理。',
      channel: 'in_app',
      relationType: 'workflow_task',
      relationId: t.taskId
    })));
  });
  return NT_success_('SLA 逾期通知已建立。', { 建立數: created.length });
}

function 建立AI提醒通知(data) {
  data = data || {};
  var title = data.title || 'AI 秘書提醒';
  var content = data.content || data.text || data.message || '您有一則 AI 秘書提醒。';
  return 建立系統通知(Object.assign({}, data, { noticeType: 'ai_reminder', title: title, content: content, channel: data.channel || 'in_app' }));
}

function 安裝通知中心觸發器() {
  初始化通知中心();
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === '發送待處理通知') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('發送待處理通知').timeBased().everyMinutes(5).create();
  return NT_success_('通知中心觸發器已安裝。');
}

function 測試_NotificationCenterRuntime() {
  初始化通知中心();
  var ctx = { tenantId: 'QA-NOTIFY', userId: 'QA-USER' };
  var n = 建立系統通知(Object.assign({}, ctx, { title: '測試通知', content: '這是一則測試通知', channel: 'in_app' }));
  var q = 查詢系統通知(ctx);
  return NT_success_('Notification Center Runtime 測試完成。', { 建立通知: n, 查詢: q });
}
