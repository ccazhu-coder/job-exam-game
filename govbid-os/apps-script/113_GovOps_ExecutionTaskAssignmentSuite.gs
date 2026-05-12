/* GovOps OS｜Execution Task Assignment Suite v1
 * 正式上線商品版：履約工作分配、任務派工、提醒、完成追蹤。
 * 原則：任務掛在 tenant → 標案 → 場次；負責人來自主檔或使用者角色；任務可由範本產生。
 */

function handleGovOpsExecutionTaskAssignmentAction(action, data) {
  data = data || {};
  try {
    if (action === 'execution.task.template.generate' || action === '產生履約任務範本') return GovOpsTask_Template_generate(data);
    if (action === 'execution.task.create' || action === '建立履約任務') return GovOpsTask_create(data);
    if (action === 'execution.task.query' || action === '查詢履約任務') return GovOpsTask_query(data);
    if (action === 'execution.task.assign' || action === '指派履約任務') return GovOpsTask_assign(data);
    if (action === 'execution.task.updateStatus' || action === '更新履約任務狀態') return GovOpsTask_updateStatus(data);
    if (action === 'execution.task.reminder.queue' || action === '建立履約任務提醒') return GovOpsTask_Reminder_queue(data);
    if (action === 'execution.task.dashboard' || action === '履約任務總覽') return GovOpsTask_Dashboard(data);
    return null;
  } catch (err) {
    GovOpsTask_audit('EXEC_TASK_ERROR', action, data, 'fail', String(err));
    return GovOpsTask_fail('履約任務派工模組暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXEC_TASK = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsExecutionTaskAssignmentAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXEC_TASK(action, data);
  };
}

function GovOpsTask_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTask_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTask_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTask_sheetTask() { return '90_履約工作任務'; }
function GovOpsTask_sheetAssign() { return '91_履約任務指派'; }
function GovOpsTask_sheetReminder() { return '92_履約任務提醒'; }
function GovOpsTask_sheetComplete() { return '93_履約任務完成紀錄'; }

function GovOpsTask_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsTask_sheetTask(), ['任務ID','tenantId','標案ID','標案名稱','場次ID','活動名稱','活動日期','任務階段','任務類型','任務名稱','任務內容','負責角色','負責人ID','負責人姓名','截止日','提醒時間','優先級','任務狀態','完成時間','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsTask_sheetAssign(), ['指派ID','tenantId','任務ID','標案ID','場次ID','任務名稱','被指派者ID','被指派者姓名','被指派者類型','指派人','指派時間','指派狀態','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsTask_sheetReminder(), ['提醒ID','tenantId','任務ID','標案ID','場次ID','任務名稱','提醒類型','提醒渠道','提醒對象','提醒內容','提醒時間','提醒狀態','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsTask_sheetComplete(), ['完成ID','tenantId','任務ID','標案ID','場次ID','任務名稱','完成者','完成時間','完成說明','附件URL','確認狀態','建立時間','更新時間','userId','備註']);
}

function GovOpsTask_Template_generate(data) {
  data = data || {};
  GovOpsTask_ensureSheets();
  var event = GovOpsTask_findEvent(data.tenantId || 'TENANT-DEMO', data) || {};
  var eventDate = data.活動日期 || data.eventDate || event.活動日期 || '';
  var templates = GovOpsTask_defaultTemplates(eventDate);
  var created = 0, rows = [];
  templates.forEach(function(t){
    var r = GovOpsTask_create(Object.assign({}, data, event, t));
    if (r.success) { created++; rows.push(r.data); }
  });
  return GovOpsTask_success('履約任務範本已產生。', { created: created, rows: rows });
}

function GovOpsTask_create(data) {
  data = data || {};
  GovOpsTask_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var event = GovOpsTask_findEvent(tenantId, data) || {};
  var taskName = data.任務名稱 || data.taskName || '';
  if (!taskName) return GovOpsTask_fail('請提供任務名稱。');
  var row = {
    任務ID: data.任務ID || data.taskId || 'TASK-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || event.標案ID || '',
    標案名稱: data.標案名稱 || event.標案名稱 || '',
    場次ID: data.場次ID || data.eventId || event.場次ID || '',
    活動名稱: data.活動名稱 || data.eventName || event.活動名稱 || '',
    活動日期: data.活動日期 || data.eventDate || event.活動日期 || '',
    任務階段: data.任務階段 || data.taskStage || '課前',
    任務類型: data.任務類型 || data.taskType || '行政作業',
    任務名稱: taskName,
    任務內容: data.任務內容 || data.taskContent || '',
    負責角色: data.負責角色 || data.ownerRole || 'admin_staff',
    負責人ID: data.負責人ID || data.ownerId || '',
    負責人姓名: data.負責人姓名 || data.ownerName || '',
    截止日: data.截止日 || data.dueDate || '',
    提醒時間: data.提醒時間 || data.remindAt || '',
    優先級: Number(data.優先級 || data.priority || 50),
    任務狀態: data.任務狀態 || '待指派',
    完成時間: '',
    建立時間: GovOpsTask_now(),
    更新時間: GovOpsTask_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  var existing = GovOpsTask_findDuplicate(tenantId, row.場次ID, row.任務名稱);
  if (existing) {
    GovOpsProduct_update(GovOpsTask_sheetTask(), existing._row, Object.assign({}, row, { 任務ID: existing.任務ID, 建立時間: existing.建立時間 || row.建立時間 }));
    row.任務ID = existing.任務ID;
  } else {
    GovOpsProduct_append(GovOpsTask_sheetTask(), row);
  }
  if (row.負責人ID || row.負責人姓名) GovOpsTask_assign(Object.assign({}, data, row));
  if (row.提醒時間) GovOpsTask_Reminder_queue(Object.assign({}, data, row));
  GovOpsTask_audit('EXEC_TASK_CREATE', 'execution.task.create', row, 'success', '履約任務已建立');
  return GovOpsTask_success(existing ? '履約任務已更新。' : '履約任務已建立。', row);
}

function GovOpsTask_query(data) {
  data = data || {};
  GovOpsTask_ensureSheets();
  var rows = GovOpsTask_filterRows(GovOpsTask_sheetTask(), data);
  return GovOpsTask_success('履約任務查詢完成。', { total: rows.length, summary: GovOpsTask_count(rows), rows: rows.slice(0, 1000) });
}

function GovOpsTask_assign(data) {
  data = data || {};
  GovOpsTask_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var task = GovOpsTask_findTask(tenantId, data.任務ID || data.taskId || '');
  if (!task && data.任務名稱) task = data;
  if (!task) return GovOpsTask_fail('找不到履約任務。');
  var assigneeName = data.被指派者姓名 || data.負責人姓名 || data.ownerName || '';
  var assigneeId = data.被指派者ID || data.負責人ID || data.ownerId || '';
  if (!assigneeName && !assigneeId) return GovOpsTask_fail('請提供被指派者。');
  var row = {
    指派ID: 'ASSIGN-' + Utilities.getUuid().slice(0, 8), tenantId: tenantId, 任務ID: task.任務ID, 標案ID: task.標案ID || '', 場次ID: task.場次ID || '', 任務名稱: task.任務名稱 || '', 被指派者ID: assigneeId, 被指派者姓名: assigneeName, 被指派者類型: data.被指派者類型 || data.assigneeType || task.負責角色 || '', 指派人: data.指派人 || data.userId || '', 指派時間: GovOpsTask_now(), 指派狀態: '已指派', 建立時間: GovOpsTask_now(), 更新時間: GovOpsTask_now(), userId: data.userId || '', 備註: data.備註 || ''
  };
  GovOpsProduct_append(GovOpsTask_sheetAssign(), row);
  if (task._row) GovOpsProduct_update(GovOpsTask_sheetTask(), task._row, { 負責人ID: assigneeId, 負責人姓名: assigneeName, 任務狀態: '待處理', 更新時間: GovOpsTask_now() });
  return GovOpsTask_success('履約任務已指派。', row);
}

function GovOpsTask_updateStatus(data) {
  data = data || {};
  GovOpsTask_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var task = GovOpsTask_findTask(tenantId, data.任務ID || data.taskId || '');
  if (!task) return GovOpsTask_fail('找不到履約任務。');
  var status = data.任務狀態 || data.status || '已完成';
  var patch = { 任務狀態: status, 更新時間: GovOpsTask_now() };
  if (status === '已完成') patch.完成時間 = GovOpsTask_now();
  GovOpsProduct_update(GovOpsTask_sheetTask(), task._row, patch);
  if (status === '已完成') {
    GovOpsProduct_append(GovOpsTask_sheetComplete(), { 完成ID: 'DONE-' + Utilities.getUuid().slice(0, 8), tenantId: tenantId, 任務ID: task.任務ID, 標案ID: task.標案ID, 場次ID: task.場次ID, 任務名稱: task.任務名稱, 完成者: data.完成者 || data.userId || '', 完成時間: GovOpsTask_now(), 完成說明: data.完成說明 || data.note || '', 附件URL: data.附件URL || data.attachmentUrl || '', 確認狀態: data.確認狀態 || '待確認', 建立時間: GovOpsTask_now(), 更新時間: GovOpsTask_now(), userId: data.userId || '', 備註: data.備註 || '' });
  }
  GovOpsTask_audit('EXEC_TASK_STATUS', 'execution.task.updateStatus', Object.assign({}, task, patch), 'success', '任務狀態已更新');
  return GovOpsTask_success('履約任務狀態已更新。', Object.assign({}, task, patch));
}

function GovOpsTask_Reminder_queue(data) {
  data = data || {};
  GovOpsTask_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var task = GovOpsTask_findTask(tenantId, data.任務ID || data.taskId || '') || data;
  var row = {
    提醒ID: 'REM-' + Utilities.getUuid().slice(0, 8), tenantId: tenantId, 任務ID: task.任務ID || '', 標案ID: task.標案ID || '', 場次ID: task.場次ID || '', 任務名稱: task.任務名稱 || '', 提醒類型: data.提醒類型 || '任務提醒', 提醒渠道: data.提醒渠道 || '系統/LINE/Email', 提醒對象: data.提醒對象 || task.負責人姓名 || '', 提醒內容: data.提醒內容 || ('請確認任務：「' + (task.任務名稱 || '') + '」，截止日：' + (task.截止日 || '')), 提醒時間: data.提醒時間 || task.提醒時間 || task.截止日 || GovOpsTask_now(), 提醒狀態: 'queued', 建立時間: GovOpsTask_now(), 更新時間: GovOpsTask_now(), userId: data.userId || '', 備註: data.備註 || ''
  };
  GovOpsProduct_append(GovOpsTask_sheetReminder(), row);
  if (typeof GovOpsQueuePersist_enqueue === 'function') GovOpsQueuePersist_enqueue({ tenantId: tenantId, queueName: 'notification', jobType: 'task_reminder', priority: 30, payload: row, userId: data.userId || '' });
  return GovOpsTask_success('履約任務提醒已建立。', row);
}

function GovOpsTask_Dashboard(data) {
  data = data || {};
  var tasks = GovOpsTask_filterRows(GovOpsTask_sheetTask(), data);
  return GovOpsTask_success('履約任務總覽完成。', { summary: GovOpsTask_count(tasks), tasks: tasks.slice(0, 200) });
}

function GovOpsTask_defaultTemplates(eventDate) {
  return [
    { 任務階段:'課前', 任務類型:'講師確認', 任務名稱:'確認講師與授課內容', 任務內容:'確認講師、課程主題、授課大綱與鐘點費。', 負責角色:'project_manager', 優先級:10 },
    { 任務階段:'課前', 任務類型:'招生作業', 任務名稱:'完成招生頁與報名表', 任務內容:'建立招生設定、報名連結與宣傳文案。', 負責角色:'admin_staff', 優先級:15 },
    { 任務階段:'課前', 任務類型:'名單確認', 任務名稱:'確認報名名單與錄取名冊', 任務內容:'審核報名資料並產生正式學員名冊。', 負責角色:'admin_staff', 優先級:20 },
    { 任務階段:'課前', 任務類型:'通知', 任務名稱:'寄送課前通知', 任務內容:'寄送上課時間、地點、注意事項。', 負責角色:'admin_staff', 優先級:25 },
    { 任務階段:'課前', 任務類型:'場地設備', 任務名稱:'確認場地與設備', 任務內容:'確認投影、音響、桌椅、指標與場地配置。', 負責角色:'staff', 優先級:30 },
    { 任務階段:'當日', 任務類型:'現場執行', 任務名稱:'報到與簽到管理', 任務內容:'處理學員報到、簽到表、現場問題。', 負責角色:'staff', 優先級:10 },
    { 任務階段:'當日', 任務類型:'紀錄', 任務名稱:'拍攝成果照片', 任務內容:'拍攝活動照片、講師授課、學員互動與成果。', 負責角色:'staff', 優先級:20 },
    { 任務階段:'課後', 任務類型:'成果整理', 任務名稱:'上傳照片與簽到表', 任務內容:'將成果照片、簽到表上傳至檔案中心。', 負責角色:'admin_staff', 優先級:20 },
    { 任務階段:'課後', 任務類型:'滿意度', 任務名稱:'彙整滿意度問卷', 任務內容:'彙整紙本或線上滿意度統計與改善建議。', 負責角色:'admin_staff', 優先級:25 },
    { 任務階段:'核銷', 任務類型:'核銷', 任務名稱:'整理核銷憑證', 任務內容:'整理講師費、場地費、餐費、材料費與相關發票收據。', 負責角色:'finance', 優先級:15 },
    { 任務階段:'結案', 任務類型:'結案', 任務名稱:'完成結案資料', 任務內容:'確認名冊、照片、簽到、滿意度、核銷資料並產生結案報告。', 負責角色:'project_manager', 優先級:10 }
  ];
}

function GovOpsTask_filterRows(sheetName, data) {
  GovOpsTask_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || data.場次ID || '').trim();
  return GovOpsProduct_readRows(sheetName).filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (data.任務狀態 && String(r.任務狀態 || '') !== String(data.任務狀態)) return false;
    if (data.場次ID && String(r.場次ID || '') !== String(data.場次ID)) return false;
    if (data.標案ID && String(r.標案ID || '') !== String(data.標案ID)) return false;
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
}
function GovOpsTask_findEvent(tenantId, data) { try { return GovOpsProduct_readRows('74_履約活動場次').find(function(r){ return String(r.tenantId||'')===String(tenantId) && ((data.場次ID && String(r.場次ID||'')===String(data.場次ID)) || (data.eventId && String(r.場次ID||'')===String(data.eventId))); }) || null; } catch(e){ return null; } }
function GovOpsTask_findTask(tenantId, taskId) { try { return GovOpsProduct_readRows(GovOpsTask_sheetTask()).find(function(r){ return String(r.tenantId||'')===String(tenantId) && String(r.任務ID||'')===String(taskId); }) || null; } catch(e){ return null; } }
function GovOpsTask_findDuplicate(tenantId, eventId, taskName) { try { return GovOpsProduct_readRows(GovOpsTask_sheetTask()).find(function(r){ return String(r.tenantId||'')===String(tenantId) && String(r.場次ID||'')===String(eventId||'') && String(r.任務名稱||'')===String(taskName); }) || null; } catch(e){ return null; } }
function GovOpsTask_count(rows) { var out={total:rows.length,pending:0,assigned:0,running:0,done:0,overdue:0,cancelled:0}; rows.forEach(function(r){ var s=String(r.任務狀態||''); if(s==='待指派')out.pending++; else if(s==='待處理')out.assigned++; else if(s==='執行中')out.running++; else if(s==='已完成')out.done++; else if(s==='逾期')out.overdue++; else if(s==='取消')out.cancelled++; }); return out; }
function GovOpsTask_audit(eventType, action, data, result, message) { try { if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write(eventType, action, data, result, message); } catch(e){} }
