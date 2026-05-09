/*
GovOps OS｜49_GovOps_WorkflowEngine.gs
商用 SaaS ERP Workflow Engine v1.0.0

用途：
1. 建立 ERP 流程狀態機
2. 建立流程節點與任務
3. 支援簽核流程
4. 支援 SLA Timeout 檢查
5. 支援自動轉階段
*/

var GOVOPS_WORKFLOW_VERSION = '1.0.0';
var GOVOPS_WORKFLOW_DEF_SHEET = '流程定義表';
var GOVOPS_WORKFLOW_INSTANCE_SHEET = '流程實例表';
var GOVOPS_WORKFLOW_TASK_SHEET = '流程任務表';
var GOVOPS_WORKFLOW_LOG_SHEET = '流程紀錄表';

function WF_defHeaders_() {
  return ['workflowId','tenantId','流程名稱','流程類型','節點JSON','狀態','建立時間','更新時間'];
}

function WF_instanceHeaders_() {
  return ['instanceId','workflowId','tenantId','userId','關聯類型','關聯ID','目前節點','流程狀態','開始時間','完成時間','SLA到期時間','建立時間','更新時間'];
}

function WF_taskHeaders_() {
  return ['taskId','instanceId','tenantId','userId','節點名稱','任務名稱','負責角色','負責人','任務狀態','SLA到期時間','完成時間','建立時間','更新時間'];
}

function WF_logHeaders_() {
  return ['logId','instanceId','tenantId','userId','動作','來源節點','目標節點','訊息','建立時間'];
}

function WF_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function WF_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function WF_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function WF_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function WF_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || ''
  };
}

function 初始化流程引擎() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_WORKFLOW_DEF_SHEET, WF_defHeaders_());
    DAL_ensureHeaders_(GOVOPS_WORKFLOW_INSTANCE_SHEET, WF_instanceHeaders_());
    DAL_ensureHeaders_(GOVOPS_WORKFLOW_TASK_SHEET, WF_taskHeaders_());
    DAL_ensureHeaders_(GOVOPS_WORKFLOW_LOG_SHEET, WF_logHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_WORKFLOW_DEF_SHEET, WF_defHeaders_());
    ensureSheet(GOVOPS_WORKFLOW_INSTANCE_SHEET, WF_instanceHeaders_());
    ensureSheet(GOVOPS_WORKFLOW_TASK_SHEET, WF_taskHeaders_());
    ensureSheet(GOVOPS_WORKFLOW_LOG_SHEET, WF_logHeaders_());
  }
  return WF_success_('流程引擎初始化完成。', { version: GOVOPS_WORKFLOW_VERSION });
}

function 建立流程定義(data) {
  初始化流程引擎();
  data = data || {};
  if (typeof DAL_append !== 'function') return WF_fail_('DataAccessLayer 尚未載入。');
  var ctx = WF_ctx_(data);
  var workflowId = data.workflowId || WF_id_('WF');
  var nodes = data.nodes || data['節點'] || [
    { name: '籌備中', task: '確認活動資料', role: 'staff', next: '招生中', slaHours: 72 },
    { name: '招生中', task: '追蹤報名狀態', role: 'staff', next: '執行中', slaHours: 168 },
    { name: '執行中', task: '完成活動執行', role: 'staff', next: '結案中', slaHours: 24 },
    { name: '結案中', task: '完成核銷與成果報告', role: 'admin', next: '已完成', slaHours: 168 }
  ];
  var row = {
    workflowId: workflowId,
    tenantId: ctx.tenantId,
    流程名稱: data['流程名稱'] || data.workflowName || 'GovOps 標準活動流程',
    流程類型: data['流程類型'] || data.workflowType || 'activity',
    節點JSON: JSON.stringify(nodes),
    狀態: 'active',
    建立時間: WF_now_(),
    更新時間: WF_now_()
  };
  DAL_append(GOVOPS_WORKFLOW_DEF_SHEET, row, WF_defHeaders_());
  return WF_success_('流程定義已建立。', { workflowId: workflowId });
}

function 啟動流程實例(data) {
  初始化流程引擎();
  data = data || {};
  if (typeof DAL_findOne !== 'function' || typeof DAL_append !== 'function') return WF_fail_('DataAccessLayer 尚未載入。');
  var ctx = WF_ctx_(data);
  var workflowId = data.workflowId || '';
  var def = workflowId ? DAL_findOne(GOVOPS_WORKFLOW_DEF_SHEET, { tenantId: ctx.tenantId, filters: { workflowId: workflowId }, cache: false }) : null;
  if (!def) {
    var created = 建立流程定義(Object.assign({}, data, { workflowType: data['關聯類型'] || data.relationType || 'activity' }));
    workflowId = created.data.workflowId;
    def = DAL_findOne(GOVOPS_WORKFLOW_DEF_SHEET, { tenantId: ctx.tenantId, filters: { workflowId: workflowId }, cache: false });
  }
  var nodes = WF_parseNodes_(def['節點JSON']);
  var firstNode = nodes[0] || { name: '開始', task: '開始流程', role: 'staff', slaHours: 24 };
  var instanceId = WF_id_('WFI');
  var instance = {
    instanceId: instanceId,
    workflowId: workflowId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    關聯類型: data['關聯類型'] || data.relationType || 'activity',
    關聯ID: data['關聯ID'] || data.relationId || data['活動ID'] || data.activityId || '',
    目前節點: firstNode.name,
    流程狀態: 'running',
    開始時間: WF_now_(),
    完成時間: '',
    SLA到期時間: WF_addHours_(firstNode.slaHours || 24),
    建立時間: WF_now_(),
    更新時間: WF_now_()
  };
  DAL_append(GOVOPS_WORKFLOW_INSTANCE_SHEET, instance, WF_instanceHeaders_());
  WF_createTask_(ctx, instanceId, firstNode);
  WF_log_(ctx, instanceId, '啟動流程', '', firstNode.name, '流程已啟動');
  return WF_success_('流程已啟動。', { instanceId: instanceId, 目前節點: firstNode.name });
}

function 流程轉階段(data) {
  初始化流程引擎();
  data = data || {};
  if (typeof DAL_findOne !== 'function' || typeof DAL_updateByRow !== 'function') return WF_fail_('DataAccessLayer 尚未載入。');
  var ctx = WF_ctx_(data);
  var instanceId = data.instanceId || data['流程實例ID'] || '';
  if (!instanceId) return WF_fail_('請提供流程實例ID。');
  var inst = DAL_findOne(GOVOPS_WORKFLOW_INSTANCE_SHEET, { tenantId: ctx.tenantId, filters: { instanceId: instanceId }, cache: false });
  if (!inst) return WF_fail_('查無流程實例。');
  var def = DAL_findOne(GOVOPS_WORKFLOW_DEF_SHEET, { tenantId: ctx.tenantId, filters: { workflowId: inst.workflowId }, cache: false });
  var nodes = WF_parseNodes_(def && def['節點JSON']);
  var current = nodes.filter(function(n){ return n.name === inst['目前節點']; })[0];
  var nextName = data.nextNode || data['目標節點'] || (current && current.next) || '已完成';
  var nextNode = nodes.filter(function(n){ return n.name === nextName; })[0];
  var patch = { 目前節點: nextName, 更新時間: WF_now_() };
  if (nextName === '已完成') {
    patch.流程狀態 = 'done';
    patch.完成時間 = WF_now_();
  } else {
    patch.流程狀態 = 'running';
    patch.SLA到期時間 = WF_addHours_((nextNode && nextNode.slaHours) || 24);
  }
  DAL_updateByRow(GOVOPS_WORKFLOW_INSTANCE_SHEET, inst._row, patch);
  if (nextNode) WF_createTask_(ctx, instanceId, nextNode);
  WF_log_(ctx, instanceId, '轉階段', inst['目前節點'], nextName, data.message || '流程轉階段');
  return WF_success_('流程階段已更新。', { instanceId: instanceId, 目前節點: nextName });
}

function 完成流程任務(data) {
  初始化流程引擎();
  data = data || {};
  var ctx = WF_ctx_(data);
  var taskId = data.taskId || data['任務ID'] || '';
  if (!taskId) return WF_fail_('請提供任務ID。');
  var task = DAL_findOne(GOVOPS_WORKFLOW_TASK_SHEET, { tenantId: ctx.tenantId, filters: { taskId: taskId }, cache: false });
  if (!task) return WF_fail_('查無流程任務。');
  DAL_updateByRow(GOVOPS_WORKFLOW_TASK_SHEET, task._row, { 任務狀態: 'done', 完成時間: WF_now_(), 更新時間: WF_now_() });
  WF_log_(ctx, task.instanceId, '完成任務', task['節點名稱'], task['節點名稱'], '任務已完成');
  return WF_success_('流程任務已完成。', { taskId: taskId });
}

function 查詢流程任務(data) {
  初始化流程引擎();
  data = data || {};
  if (typeof DAL_query !== 'function') return WF_fail_('DataAccessLayer 尚未載入。');
  var ctx = WF_ctx_(data);
  var res = DAL_query(GOVOPS_WORKFLOW_TASK_SHEET, { tenantId: ctx.tenantId, keyword: data.keyword || data['關鍵字'] || '', limit: data.limit || 100, page: data.page || 1, cache: false });
  return WF_success_('流程任務查詢完成。', { 任務: res.data.rows, 筆數: res.data.total });
}

function 檢查流程SLA(data) {
  初始化流程引擎();
  data = data || {};
  if (typeof DAL_query !== 'function') return WF_fail_('DataAccessLayer 尚未載入。');
  var ctx = WF_ctx_(data);
  var res = DAL_query(GOVOPS_WORKFLOW_TASK_SHEET, { tenantId: ctx.tenantId, filters: { '任務狀態': 'pending' }, limit: 300, cache: false });
  var rows = res.data.rows || [];
  var nowDate = new Date();
  var overdue = [];
  rows.forEach(function(t) {
    var due = new Date(t['SLA到期時間']);
    if (String(due) !== 'Invalid Date' && due < nowDate) overdue.push(t);
  });
  return WF_success_('流程 SLA 檢查完成。', { 逾期任務: overdue, 逾期數: overdue.length });
}

function WF_createTask_(ctx, instanceId, node) {
  var taskId = WF_id_('WFT');
  var row = {
    taskId: taskId,
    instanceId: instanceId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    節點名稱: node.name || '',
    任務名稱: node.task || node.name || '',
    負責角色: node.role || 'staff',
    負責人: '',
    任務狀態: 'pending',
    SLA到期時間: WF_addHours_(node.slaHours || 24),
    完成時間: '',
    建立時間: WF_now_(),
    更新時間: WF_now_()
  };
  DAL_append(GOVOPS_WORKFLOW_TASK_SHEET, row, WF_taskHeaders_());
  return taskId;
}

function WF_log_(ctx, instanceId, action, fromNode, toNode, message) {
  var row = {
    logId: WF_id_('WFL'),
    instanceId: instanceId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    動作: action,
    來源節點: fromNode || '',
    目標節點: toNode || '',
    訊息: message || '',
    建立時間: WF_now_()
  };
  DAL_append(GOVOPS_WORKFLOW_LOG_SHEET, row, WF_logHeaders_());
}

function WF_parseNodes_(raw) {
  try { return raw ? JSON.parse(raw) : []; } catch (err) { return []; }
}

function WF_addHours_(hours) {
  var d = new Date();
  d.setHours(d.getHours() + Number(hours || 24));
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_WorkflowEngine() {
  初始化流程引擎();
  var ctx = { tenantId: 'QA-WF', userId: 'QA-USER', userRole: 'owner' };
  var start = 啟動流程實例(Object.assign({}, ctx, { 關聯類型: 'activity', 關聯ID: 'QA-ACTIVITY' }));
  var tasks = 查詢流程任務(ctx);
  return WF_success_('Workflow Engine 測試完成。', { 啟動: start, 任務: tasks });
}
