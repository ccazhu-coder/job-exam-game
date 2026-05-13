/**
 * GovOps OS ERP Workflow Engine
 * 流程引擎：狀態變更後自動觸發後續營運動作。
 * 請與 erp_commercial_core.gs 一起貼入 Apps Script。
 */

function erpWorkflowRun(params){
  const action = String((params && params.action) || '');
  try {
    if (action === 'ERP流程_活動完成') return erpWorkflowCompleteActivity(params);
    if (action === 'ERP流程_活動取消') return erpWorkflowCancelActivity(params);
    if (action === 'ERP流程_活動改期') return erpWorkflowRescheduleActivity(params);
    if (action === 'ERP流程_活動重檢') return erpWorkflowRecheckActivity(params);
    if (action === 'ERP流程_專案結案檢查') return erpWorkflowProjectCloseCheck(params);
    return null;
  } catch (err) {
    erpAudit_(params, action, 'workflow', '', 'fail', err.message);
    return erpFail_('ERP 流程引擎處理失敗：' + err.message);
  }
}

function erpWorkflowFindActivity_(params){
  const tenantId = erpTenantId_(params);
  const activityId = params.activityId || params['活動ID'];
  if (!activityId) return null;
  return erpReadRows_('activities').find(a => a.tenantId === tenantId && a.activityId === activityId);
}

function erpWorkflowCompleteActivity(params){
  const act = erpWorkflowFindActivity_(params);
  if (!act) return erpFail_('找不到活動，無法完成流程');
  if (String(act.status) === 'cancelled') return erpFail_('活動已取消，不可完成');
  erpUpdateRow_('activities', act._row, { status: 'completed', updatedAt: erpNow_() });
  erpAppend_('activity_tasks', {
    taskId: erpUuid_('TASK'), tenantId: act.tenantId, projectId: act.projectId, activityId: act.activityId,
    taskName: '活動完成後請款確認', taskType: '財務', ownerUserId: erpUserId_(params),
    dueDate: erpNow_().slice(0,10), status: 'pending', completedAt: '',
    note: '活動已完成，請確認是否建立應收帳款。', createdAt: erpNow_(), updatedAt: erpNow_()
  });
  erpAppend_('activity_tasks', {
    taskId: erpUuid_('TASK'), tenantId: act.tenantId, projectId: act.projectId, activityId: act.activityId,
    taskName: '成果與核銷資料整理', taskType: '核銷', ownerUserId: erpUserId_(params),
    dueDate: erpDateAdd_(act.activityDate, 7), status: 'pending', completedAt: '',
    note: '活動完成後 7 天內整理成果照片、簽到表、領據與核銷資料。', createdAt: erpNow_(), updatedAt: erpNow_()
  });
  erpAudit_(params, 'ERP流程_活動完成', 'activities', act.activityId, 'success', '');
  return erpOk_('活動已完成，已建立請款與核銷後續任務', { 活動ID: act.activityId });
}

function erpWorkflowCancelActivity(params){
  const act = erpWorkflowFindActivity_(params);
  if (!act) return erpFail_('找不到活動，無法取消流程');
  erpUpdateRow_('activities', act._row, { status: 'cancelled', updatedAt: erpNow_() });
  erpReadRows_('activity_tasks')
    .filter(t => t.tenantId === act.tenantId && t.activityId === act.activityId && String(t.status) !== 'done')
    .forEach(t => erpUpdateRow_('activity_tasks', t._row, { status: 'cancelled', updatedAt: erpNow_(), note: String(t.note || '') + '｜活動取消，任務自動取消' }));
  erpReadRows_('receivables')
    .filter(r => r.tenantId === act.tenantId && r.activityId === act.activityId && String(r.status) !== 'paid')
    .forEach(r => erpUpdateRow_('receivables', r._row, { status: 'cancelled', updatedAt: erpNow_(), note: String(r.note || '') + '｜活動取消，應收自動取消' }));
  erpAudit_(params, 'ERP流程_活動取消', 'activities', act.activityId, 'success', '');
  return erpOk_('活動已取消，未完成任務與未收應收已同步取消', { 活動ID: act.activityId });
}

function erpWorkflowRescheduleActivity(params){
  const act = erpWorkflowFindActivity_(params);
  const newDate = params.newDate || params['新日期'] || params.activityDate || params['活動日期'];
  if (!act) return erpFail_('找不到活動，無法改期');
  if (!newDate) return erpFail_('請提供新日期');
  const beforeDate = act.activityDate;
  const update = erpUpdateActivity(Object.assign({}, params, { activityId: act.activityId, activityDate: newDate, changeType: '活動改期', changeReason: params.changeReason || params['變更原因'] || '活動日期異動' }));
  if (update && update.success === false) return update;
  erpReadRows_('activity_tasks')
    .filter(t => t.tenantId === act.tenantId && t.activityId === act.activityId && String(t.status) !== 'done' && String(t.status) !== 'cancelled')
    .forEach(t => erpUpdateRow_('activity_tasks', t._row, { note: String(t.note || '') + '｜活動由 ' + beforeDate + ' 改期至 ' + newDate + '，請重新確認截止日', updatedAt: erpNow_() }));
  erpAudit_(params, 'ERP流程_活動改期', 'activities', act.activityId, 'success', '');
  return erpOk_('活動已改期，並已標記相關任務需重檢', { 活動ID: act.activityId, 原日期: beforeDate, 新日期: newDate });
}

function erpWorkflowRecheckActivity(params){
  const act = erpWorkflowFindActivity_(params);
  if (!act) return erpFail_('找不到活動，無法重檢');
  const items = ['場地確認','講師確認','餐點確認','交通確認','講義確認','報名名單確認','核銷資料確認'];
  let count = 0;
  items.forEach(name => {
    erpAppend_('activity_tasks', {
      taskId: erpUuid_('TASK'), tenantId: act.tenantId, projectId: act.projectId, activityId: act.activityId,
      taskName: name, taskType: '重檢', ownerUserId: erpUserId_(params), dueDate: erpNow_().slice(0,10),
      status: 'pending', completedAt: '', note: params.note || '流程引擎建立重檢任務', createdAt: erpNow_(), updatedAt: erpNow_()
    });
    count++;
  });
  return erpOk_('已建立活動重檢任務', { 新增筆數: count });
}

function erpWorkflowProjectCloseCheck(params){
  const tenantId = erpTenantId_(params);
  const projectId = params.projectId || params['專案ID'];
  if (!projectId) return erpFail_('請提供專案ID');
  const activities = erpReadRows_('activities').filter(a => a.tenantId === tenantId && a.projectId === projectId && String(a.status) !== 'cancelled');
  const tasks = erpReadRows_('activity_tasks').filter(t => t.tenantId === tenantId && t.projectId === projectId && String(t.status) !== 'done' && String(t.status) !== 'cancelled');
  const unpaid = erpReadRows_('receivables').filter(r => r.tenantId === tenantId && r.projectId === projectId && String(r.status) !== 'paid' && String(r.status) !== 'cancelled');
  const notCompleted = activities.filter(a => String(a.status) !== 'completed');
  const canClose = tasks.length === 0 && unpaid.length === 0 && notCompleted.length === 0;
  return erpOk_(canClose ? '專案可結案' : '專案尚不可結案', { 可結案: canClose, 未完成活動: notCompleted, 未完成任務: tasks, 未收款: unpaid });
}

function erpWorkflowRoute(params){
  return erpWorkflowRun(params);
}

/**
 * 主 router 接法：
 * const wfResult = erpWorkflowRoute(params);
 * if (wfResult) return jsonOutput(wfResult);
 */
