/*
GovOps OS｜47_GovOps_AdminConsoleRuntime.gs
商用 SaaS ERP Admin Console Runtime v1.0.0

用途：
1. 租戶管理
2. 使用者管理
3. 方案管理
4. Queue Dashboard
5. Monitoring Dashboard
6. Backup Dashboard
*/

var GOVOPS_ADMIN_VERSION = '1.0.0';

function ADM_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function ADM_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function ADM_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function ADM_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: String(data.userRole || data['使用者角色'] || '').toLowerCase(),
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function ADM_requireDAL_() {
  if (typeof DAL_query !== 'function' || typeof DAL_findOne !== 'function' || typeof DAL_updateByRow !== 'function') {
    return ADM_fail_('DataAccessLayer 尚未載入。');
  }
  return null;
}

function ADM_requireOwner_(data) {
  var ctx = ADM_ctx_(data);
  if (ctx.userRole !== 'owner' && ctx.userRole !== 'admin') {
    return ADM_fail_('目前角色無法使用系統管理功能。');
  }
  return null;
}

function 查詢管理後台總覽(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  data = data || {};
  var ctx = ADM_ctx_(data);

  var users = DAL_query('使用者帳號表', { tenantId: ctx.tenantId, limit: 100, cache: false }).data;
  var usage = DAL_query('SaaS使用量', { tenantId: ctx.tenantId, limit: 100, cache: false }).data;
  var queue = DAL_query('系統任務佇列', { tenantId: ctx.tenantId, limit: 100, cache: false }).data;
  var errors = DAL_query('系統錯誤追蹤', { tenantId: ctx.tenantId, limit: 100, cache: false }).data;
  var backups = DAL_query('系統備份索引', { tenantId: ctx.tenantId, limit: 100, cache: false }).data;

  return ADM_success_('管理後台總覽取得完成。', {
    使用者數: users.total,
    使用量紀錄數: usage.total,
    Queue待處理數: (queue.rows || []).filter(function(r){ return String(r['狀態']) === 'pending'; }).length,
    錯誤數: errors.total,
    備份數: backups.total,
    version: GOVOPS_ADMIN_VERSION
  });
}

function 查詢租戶使用者(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  var ctx = ADM_ctx_(data || {});
  var res = DAL_query('使用者帳號表', {
    tenantId: ctx.tenantId,
    keyword: data.keyword || data['關鍵字'] || '',
    limit: data.limit || 100,
    page: data.page || 1,
    cache: false
  });
  return ADM_success_('使用者清單取得完成。', { 使用者: res.data.rows, 筆數: res.data.total });
}

function 更新使用者角色(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  data = data || {};
  var ctx = ADM_ctx_(data);
  var targetUserId = data.targetUserId || data['目標使用者ID'] || '';
  var role = String(data.newRole || data['新角色'] || '').toLowerCase();
  if (!targetUserId) return ADM_fail_('請提供目標使用者ID。');
  if (['owner','admin','finance','staff','viewer'].indexOf(role) < 0) return ADM_fail_('角色不正確。');
  var user = DAL_findOne('使用者帳號表', { tenantId: ctx.tenantId, filters: { userId: targetUserId }, cache: false });
  if (!user) return ADM_fail_('查無使用者。');
  DAL_updateByRow('使用者帳號表', user._row, { userRole: role, 更新時間: ADM_now_() });
  return ADM_success_('使用者角色已更新。', { userId: targetUserId, userRole: role });
}

function 更新使用者狀態(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  data = data || {};
  var ctx = ADM_ctx_(data);
  var targetUserId = data.targetUserId || data['目標使用者ID'] || '';
  var status = data.status || data['狀態'] || '';
  if (!targetUserId) return ADM_fail_('請提供目標使用者ID。');
  if (['active','disabled'].indexOf(String(status)) < 0) return ADM_fail_('狀態不正確。');
  var user = DAL_findOne('使用者帳號表', { tenantId: ctx.tenantId, filters: { userId: targetUserId }, cache: false });
  if (!user) return ADM_fail_('查無使用者。');
  DAL_updateByRow('使用者帳號表', user._row, { 狀態: status, 更新時間: ADM_now_() });
  return ADM_success_('使用者狀態已更新。', { userId: targetUserId, status: status });
}

function 查詢租戶方案(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  var ctx = ADM_ctx_(data || {});
  var sub = DAL_findOne('SaaS訂閱表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
  var usage = DAL_query('SaaS使用量', { tenantId: ctx.tenantId, limit: 50, cache: false }).data.rows || [];
  return ADM_success_('租戶方案資料取得完成。', { 方案: sub || {}, 使用量: usage });
}

function 更新租戶方案(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  data = data || {};
  var ctx = ADM_ctx_(data);
  var plan = String(data.newPlan || data.plan || data['新方案'] || '').toUpperCase();
  if (['FREE','STARTER','PRO','ENTERPRISE'].indexOf(plan) < 0) return ADM_fail_('方案不正確。');
  var sub = DAL_findOne('SaaS訂閱表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
  if (!sub) return ADM_fail_('查無訂閱資料。');
  DAL_updateByRow('SaaS訂閱表', sub._row, { plan: plan, 方案名稱: plan, 更新時間: ADM_now_() });
  return ADM_success_('租戶方案已更新。', { tenantId: ctx.tenantId, plan: plan });
}

function 查詢QueueDashboard(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  var ctx = ADM_ctx_(data || {});
  var res = DAL_query('系統任務佇列', { tenantId: ctx.tenantId, limit: data.limit || 100, cache: false });
  var rows = res.data.rows || [];
  return ADM_success_('Queue Dashboard 取得完成。', {
    pending: rows.filter(function(r){ return String(r['狀態']) === 'pending'; }).length,
    running: rows.filter(function(r){ return String(r['狀態']) === 'running'; }).length,
    done: rows.filter(function(r){ return String(r['狀態']) === 'done'; }).length,
    failed: rows.filter(function(r){ return String(r['狀態']) === 'failed'; }).length,
    dead: rows.filter(function(r){ return String(r['狀態']) === 'dead'; }).length,
    任務: rows
  });
}

function 查詢監控Dashboard(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  if (typeof 查詢系統監控 === 'function') return 查詢系統監控(data || {});
  return ADM_fail_('監控系統尚未載入。');
}

function 查詢備份Dashboard(data) {
  var err = ADM_requireDAL_(); if (err) return err;
  err = ADM_requireOwner_(data); if (err) return err;
  if (typeof 查詢備份索引 === 'function') return 查詢備份索引(data || {});
  return ADM_fail_('備份系統尚未載入。');
}

function 測試_AdminConsoleRuntime() {
  return ADM_success_('Admin Console Runtime 載入正常。', { version: GOVOPS_ADMIN_VERSION });
}
