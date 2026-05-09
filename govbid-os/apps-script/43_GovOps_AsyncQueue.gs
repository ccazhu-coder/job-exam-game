/*
GovOps OS｜43_GovOps_AsyncQueue.gs
商用 SaaS ERP 非同步任務佇列 v1.0.0

用途：
處理提醒、AI、LINE、Drive、同步等耗時任務，降低 Apps Script timeout 與 quota 風險。
*/

var GOVOPS_QUEUE_VERSION = '1.0.0';
var GOVOPS_QUEUE_SHEET = '系統任務佇列';
var GOVOPS_QUEUE_LOG_SHEET = '系統任務執行紀錄';

function QUEUE_headers_() {
  return [
    'queueId','tenantId','userId','任務類型','action','payload','狀態','優先級','重試次數','最大重試','排程時間','開始時間','完成時間','錯誤訊息','建立時間','更新時間'
  ];
}

function QUEUE_logHeaders_() {
  return [
    'logId','queueId','tenantId','userId','action','執行狀態','執行訊息','執行時間','耗時毫秒'
  ];
}

function QUEUE_now_() {
  return typeof now === 'function'
    ? now()
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function QUEUE_success_(message, data) {
  return typeof success === 'function'
    ? success(message, data)
    : { success: true, message: message || '操作完成。', data: data || {} };
}

function QUEUE_fail_(message, data) {
  return typeof fail === 'function'
    ? fail(message, data)
    : { success: false, message: message || '操作失敗。', data: data || {} };
}

function QUEUE_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function QUEUE_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化任務佇列() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_QUEUE_SHEET, QUEUE_headers_());
    DAL_ensureHeaders_(GOVOPS_QUEUE_LOG_SHEET, QUEUE_logHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_QUEUE_SHEET, QUEUE_headers_());
    ensureSheet(GOVOPS_QUEUE_LOG_SHEET, QUEUE_logHeaders_());
  }
  return QUEUE_success_('任務佇列初始化完成。', { version: GOVOPS_QUEUE_VERSION });
}

function 建立非同步任務(data) {
  初始化任務佇列();
  data = data || {};
  var ctx = QUEUE_ctx_(data);
  var action = data.actionName || data.targetAction || data.action || '';
  if (!action) return QUEUE_fail_('請提供要執行的任務 action。');

  var queueId = QUEUE_id_('QUEUE');
  var row = {
    queueId: queueId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    任務類型: data.taskType || data['任務類型'] || 'general',
    action: action,
    payload: JSON.stringify(data.payload || data.data || {}),
    狀態: 'pending',
    優先級: Number(data.priority || data['優先級'] || 5),
    重試次數: 0,
    最大重試: Number(data.maxRetry || data['最大重試'] || 3),
    排程時間: data.scheduleAt || data['排程時間'] || QUEUE_now_(),
    開始時間: '',
    完成時間: '',
    錯誤訊息: '',
    建立時間: QUEUE_now_(),
    更新時間: QUEUE_now_()
  };

  if (typeof DAL_append === 'function') {
    DAL_append(GOVOPS_QUEUE_SHEET, row, QUEUE_headers_());
  } else if (typeof appendObject === 'function') {
    appendObject(GOVOPS_QUEUE_SHEET, row);
  }

  return QUEUE_success_('任務已加入佇列。', { queueId: queueId });
}

function 查詢任務佇列(data) {
  初始化任務佇列();
  data = data || {};
  if (typeof DAL_query === 'function') {
    var res = DAL_query(GOVOPS_QUEUE_SHEET, Object.assign({}, QUEUE_ctx_(data), {
      keyword: data.keyword || data['關鍵字'] || '',
      filters: data.status ? { '狀態': data.status } : {},
      page: data.page || 1,
      limit: data.limit || 100,
      cache: false
    }));
    return QUEUE_success_('任務佇列查詢完成。', { 任務: res.data.rows, 筆數: res.data.total });
  }
  return QUEUE_fail_('DataAccessLayer 尚未載入。');
}

function 執行待處理任務(data) {
  初始化任務佇列();
  data = data || {};
  var limit = Number(data.limit || 10);
  var res = DAL_query(GOVOPS_QUEUE_SHEET, Object.assign({}, QUEUE_ctx_(data), {
    filters: { '狀態': 'pending' },
    limit: limit,
    page: 1,
    sortBy: '優先級',
    sortDir: 'asc',
    cache: false
  }));

  var tasks = res.data.rows || [];
  var results = [];
  tasks.forEach(function(task) {
    results.push(QUEUE_executeOne_(task));
  });

  return QUEUE_success_('待處理任務執行完成。', {
    執行數: results.length,
    結果: results
  });
}

function QUEUE_executeOne_(task) {
  var started = new Date().getTime();
  var queueId = task.queueId;
  var action = task.action;
  var payload = {};
  try {
    payload = task.payload ? JSON.parse(task.payload) : {};
  } catch (err) {
    payload = {};
  }

  payload.tenantId = payload.tenantId || task.tenantId;
  payload.userId = payload.userId || task.userId;

  try {
    DAL_updateByRow(GOVOPS_QUEUE_SHEET, task._row, {
      狀態: 'running',
      開始時間: QUEUE_now_(),
      更新時間: QUEUE_now_()
    });

    var result = QUEUE_runAction_(action, payload);
    var ok = result && result.success !== false;

    DAL_updateByRow(GOVOPS_QUEUE_SHEET, task._row, {
      狀態: ok ? 'done' : 'failed',
      完成時間: QUEUE_now_(),
      錯誤訊息: ok ? '' : (result && result.message ? result.message : '任務執行失敗'),
      更新時間: QUEUE_now_()
    });

    QUEUE_log_(task, ok ? '成功' : '失敗', result && result.message ? result.message : '', new Date().getTime() - started);
    return { queueId: queueId, success: ok, message: result && result.message ? result.message : '' };
  } catch (err) {
    var retry = Number(task['重試次數'] || 0) + 1;
    var maxRetry = Number(task['最大重試'] || 3);
    var nextStatus = retry >= maxRetry ? 'dead' : 'pending';
    DAL_updateByRow(GOVOPS_QUEUE_SHEET, task._row, {
      狀態: nextStatus,
      重試次數: retry,
      錯誤訊息: '任務執行失敗，將依重試次數處理。',
      更新時間: QUEUE_now_()
    });
    QUEUE_log_(task, '失敗', '任務執行失敗，已記錄。', new Date().getTime() - started);
    return { queueId: queueId, success: false, message: '任務執行失敗。' };
  }
}

function QUEUE_runAction_(action, payload) {
  var allow = {
    '查詢今日提醒': true,
    '執行提醒檢查': true,
    '產生秘書摘要': true,
    'AI秘書查詢': true,
    '建立Drive資料夾': true,
    'AI缺件檢查': true
  };
  if (!allow[action]) return QUEUE_fail_('此 action 尚未允許進入非同步佇列。');
  if (typeof router === 'function') return router(action, payload || {});
  return QUEUE_fail_('router 尚未載入。');
}

function QUEUE_log_(task, status, message, ms) {
  var row = {
    logId: QUEUE_id_('QLOG'),
    queueId: task.queueId,
    tenantId: task.tenantId,
    userId: task.userId,
    action: task.action,
    執行狀態: status,
    執行訊息: message || '',
    執行時間: QUEUE_now_(),
    耗時毫秒: ms || 0
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_QUEUE_LOG_SHEET, row, QUEUE_logHeaders_());
}

function 安裝任務佇列觸發器() {
  初始化任務佇列();
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === '執行待處理任務') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('執行待處理任務').timeBased().everyMinutes(5).create();
  return QUEUE_success_('任務佇列觸發器已安裝，每 5 分鐘執行一次。');
}

function 測試_AsyncQueue() {
  初始化任務佇列();
  var q = 建立非同步任務({
    tenantId: 'QA-QUEUE',
    userId: 'QA-USER',
    taskType: 'ai',
    targetAction: 'AI秘書查詢',
    payload: { tenantId: 'QA-QUEUE', userId: 'QA-USER', text: '查詢未收款' }
  });
  return QUEUE_success_('AsyncQueue 測試任務已建立。', q.data);
}
