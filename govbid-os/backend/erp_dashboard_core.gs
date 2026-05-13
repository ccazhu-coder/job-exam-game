/**
 * GovOps OS ERP Dashboard Core
 * 商用儀表板：收入、支出、應收、任務、核銷缺件、專案與活動狀態。
 * 請與 ERP core / workflow / drive / security 一起貼入 Apps Script。
 */

function erpDashNumber_(v){
  const n = Number(v || 0);
  return isNaN(n) ? 0 : n;
}

function erpDashToday_(){
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function erpDashboardSummary(params){
  const tenantId = erpTenantId_(params);
  const projects = erpReadRows_('projects').filter(r => r.tenantId === tenantId);
  const activities = erpReadRows_('activities').filter(r => r.tenantId === tenantId);
  const tasks = erpReadRows_('activity_tasks').filter(r => r.tenantId === tenantId);
  const ars = erpReadRows_('receivables').filter(r => r.tenantId === tenantId);
  const pays = erpReadRows_('payments').filter(r => r.tenantId === tenantId);
  const exps = erpReadRows_('expenses').filter(r => r.tenantId === tenantId);
  let archive = [];
  try {
    if (typeof erpEnsureDriveTables_ === 'function') {
      erpEnsureDriveTables_();
      archive = erpReadRows_('archive_checklist').filter(r => r.tenantId === tenantId);
    }
  } catch (err) {}
  const today = erpDashToday_();
  const unpaid = ars.filter(r => String(r.status) !== 'paid' && String(r.status) !== 'cancelled');
  const dueTasks = tasks.filter(t => String(t.status) !== 'done' && String(t.status) !== 'cancelled' && (!t.dueDate || String(t.dueDate) <= today));
  const missingArchive = archive.filter(x => String(x.required) === 'yes' && String(x.status) !== 'done');
  const income = pays.reduce((s, r) => s + erpDashNumber_(r.amount), 0);
  const expense = exps.reduce((s, r) => s + erpDashNumber_(r.amount), 0);
  const receivable = ars.reduce((s, r) => s + erpDashNumber_(r.amount), 0);
  const unpaidAmount = unpaid.reduce((s, r) => s + erpDashNumber_(r.balance || r.amount), 0);
  return erpOk_('ERP 儀表板摘要已產生', {
    專案總數: projects.length,
    進行中專案: projects.filter(p => String(p.status) === 'active').length,
    活動總數: activities.length,
    已完成活動: activities.filter(a => String(a.status) === 'completed').length,
    已取消活動: activities.filter(a => String(a.status) === 'cancelled').length,
    今日待辦: dueTasks.length,
    應收總額: receivable,
    未收款金額: unpaidAmount,
    已收收入: income,
    支出總額: expense,
    損益: income - expense,
    核銷缺件: missingArchive.length,
    未收款: unpaid,
    今日任務: dueTasks,
    核銷缺件明細: missingArchive
  });
}

function erpDashboardProjectOverview(params){
  const tenantId = erpTenantId_(params);
  const projects = erpReadRows_('projects').filter(r => r.tenantId === tenantId);
  const activities = erpReadRows_('activities').filter(r => r.tenantId === tenantId);
  const ars = erpReadRows_('receivables').filter(r => r.tenantId === tenantId);
  const pays = erpReadRows_('payments').filter(r => r.tenantId === tenantId);
  const exps = erpReadRows_('expenses').filter(r => r.tenantId === tenantId);
  const rows = projects.map(p => {
    const pa = activities.filter(a => a.projectId === p.projectId);
    const par = ars.filter(r => r.projectId === p.projectId);
    const pp = pays.filter(r => r.projectId === p.projectId);
    const pe = exps.filter(r => r.projectId === p.projectId);
    const income = pp.reduce((s, r) => s + erpDashNumber_(r.amount), 0);
    const expense = pe.reduce((s, r) => s + erpDashNumber_(r.amount), 0);
    const unpaid = par.filter(r => String(r.status) !== 'paid' && String(r.status) !== 'cancelled').reduce((s, r) => s + erpDashNumber_(r.balance || r.amount), 0);
    return {
      專案ID: p.projectId,
      專案名稱: p.projectName,
      專案類型: p.projectType,
      狀態: p.status,
      活動數: pa.length,
      已完成活動: pa.filter(a => String(a.status) === 'completed').length,
      未收款: unpaid,
      已收收入: income,
      支出: expense,
      損益: income - expense
    };
  });
  return erpOk_('專案總覽已產生', { rows: rows, 資料: rows });
}

function erpDashboardRiskReport(params){
  const tenantId = erpTenantId_(params);
  const today = erpDashToday_();
  const tasks = erpReadRows_('activity_tasks').filter(r => r.tenantId === tenantId && String(r.status) !== 'done' && String(r.status) !== 'cancelled');
  const overdueTasks = tasks.filter(t => t.dueDate && String(t.dueDate) < today);
  const unpaid = erpReadRows_('receivables').filter(r => r.tenantId === tenantId && String(r.status) !== 'paid' && String(r.status) !== 'cancelled');
  const completedNoAR = erpReadRows_('activities').filter(a => a.tenantId === tenantId && String(a.status) === 'completed').filter(a => !unpaid.some(r => r.activityId === a.activityId));
  let archiveMissing = [];
  try {
    if (typeof erpEnsureDriveTables_ === 'function') {
      erpEnsureDriveTables_();
      archiveMissing = erpReadRows_('archive_checklist').filter(x => x.tenantId === tenantId && String(x.required) === 'yes' && String(x.status) !== 'done');
    }
  } catch (err) {}
  return erpOk_('ERP 風險報告已產生', {
    逾期任務數: overdueTasks.length,
    未收款筆數: unpaid.length,
    已完成未請款活動數: completedNoAR.length,
    核銷缺件數: archiveMissing.length,
    逾期任務: overdueTasks,
    未收款: unpaid,
    已完成未請款活動: completedNoAR,
    核銷缺件: archiveMissing
  });
}

function erpDashboardRoute(params){
  const action = String((params && params.action) || '');
  try {
    if (action === 'ERP儀表板摘要' || action === '取得ERP儀表板') return erpDashboardSummary(params);
    if (action === 'ERP專案總覽') return erpDashboardProjectOverview(params);
    if (action === 'ERP風險報告') return erpDashboardRiskReport(params);
    return null;
  } catch (err) {
    erpAudit_(params, action, 'dashboard', '', 'fail', err.message);
    return erpFail_('ERP 儀表板處理失敗：' + err.message);
  }
}

/**
 * 主 router 接法：
 * const dashboardResult = erpDashboardRoute(params);
 * if (dashboardResult) return jsonOutput(dashboardResult);
 */
