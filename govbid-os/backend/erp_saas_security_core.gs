/**
 * GovOps OS ERP SaaS Security Core
 * SaaS 核心：Session、角色權限、租戶隔離、功能守門。
 * 請與 erp_commercial_core.gs、erp_workflow_engine.gs、erp_drive_document_core.gs 一起貼入 Apps Script。
 */

function erpSaaSEnsureTables_(){
  ERP_TABLES.sessions = ERP_TABLES.sessions || ['sessionId','tenantId','userId','sessionToken','role','status','expiresAt','createdAt','updatedAt'];
  ERP_TABLES.permissions = ERP_TABLES.permissions || ['permissionId','role','feature','canRead','canCreate','canUpdate','canDelete','createdAt','updatedAt'];
  ERP_TABLES.feature_flags = ERP_TABLES.feature_flags || ['flagId','tenantId','feature','enabled','note','createdAt','updatedAt'];
  erpEnsureSheet_('sessions', ERP_TABLES.sessions);
  erpEnsureSheet_('permissions', ERP_TABLES.permissions);
  erpEnsureSheet_('feature_flags', ERP_TABLES.feature_flags);
  erpSaaSSeedPermissions_();
}

function erpSaaSSeedPermissions_(){
  const existing = erpReadRows_('permissions');
  const rows = [
    ['owner','all','yes','yes','yes','yes'],
    ['admin','all','yes','yes','yes','no'],
    ['staff','project','yes','yes','yes','no'],
    ['staff','activity','yes','yes','yes','no'],
    ['staff','task','yes','yes','yes','no'],
    ['staff','crm','yes','yes','no','no'],
    ['staff','finance','no','no','no','no'],
    ['finance','finance','yes','yes','yes','no'],
    ['finance','project','yes','no','no','no'],
    ['finance','activity','yes','no','no','no'],
    ['viewer','project','yes','no','no','no'],
    ['viewer','activity','yes','no','no','no'],
    ['viewer','finance','no','no','no','no']
  ];
  rows.forEach(r => {
    if (existing.some(x => x.role === r[0] && x.feature === r[1])) return;
    erpAppend_('permissions', {
      permissionId: erpUuid_('PERM'), role: r[0], feature: r[1], canRead: r[2], canCreate: r[3], canUpdate: r[4], canDelete: r[5], createdAt: erpNow_(), updatedAt: erpNow_()
    });
  });
}

function erpSaaSCreateSession(params){
  erpSaaSEnsureTables_();
  const tenantId = erpTenantId_(params);
  const userId = erpUserId_(params);
  const role = params.role || params.userRole || params['使用者角色'] || 'owner';
  const token = 'S-' + Utilities.getUuid();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  const expiresAt = Utilities.formatDate(expires, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  erpAppend_('sessions', { sessionId: erpUuid_('SES'), tenantId: tenantId, userId: userId, sessionToken: token, role: role, status: 'active', expiresAt: expiresAt, createdAt: erpNow_(), updatedAt: erpNow_() });
  erpAudit_(params, '建立SaaS Session', 'sessions', userId, 'success', '');
  return erpOk_('Session 已建立', { tenantId: tenantId, userId: userId, role: role, sessionToken: token, expiresAt: expiresAt });
}

function erpSaaSValidateSession(params){
  erpSaaSEnsureTables_();
  const tenantId = erpTenantId_(params);
  const userId = erpUserId_(params);
  const token = params.sessionToken || params.token || '';
  if (!token) return erpFail_('缺少 sessionToken');
  const row = erpReadRows_('sessions').find(s => s.tenantId === tenantId && s.userId === userId && s.sessionToken === token && String(s.status) === 'active');
  if (!row) return erpFail_('Session 無效或已登出');
  const expiry = new Date(row.expiresAt);
  if (!isNaN(expiry.getTime()) && expiry.getTime() < new Date().getTime()) return erpFail_('Session 已過期');
  return erpOk_('Session 有效', { tenantId: tenantId, userId: userId, role: row.role, expiresAt: row.expiresAt });
}

function erpSaaSLogout(params){
  erpSaaSEnsureTables_();
  const tenantId = erpTenantId_(params);
  const userId = erpUserId_(params);
  const token = params.sessionToken || params.token || '';
  let count = 0;
  erpReadRows_('sessions').filter(s => s.tenantId === tenantId && s.userId === userId && (!token || s.sessionToken === token)).forEach(s => {
    erpUpdateRow_('sessions', s._row, { status: 'logged_out', updatedAt: erpNow_() });
    count++;
  });
  return erpOk_('已登出', { 更新筆數: count });
}

function erpSaaSFeatureFromAction_(action){
  const text = String(action || '');
  if (text.match(/收款|應收|支出|損益|財務|未收款/)) return 'finance';
  if (text.match(/CRM|學員|報名|行銷/)) return 'crm';
  if (text.match(/活動|場次|任務|作業包|歸檔|文件|核銷/)) return 'activity';
  if (text.match(/專案|計畫/)) return 'project';
  return 'all';
}

function erpSaaSOperationFromAction_(action){
  const text = String(action || '');
  if (text.match(/查詢|取得|列表/)) return 'read';
  if (text.match(/新增|建立|登錄|儲存|同步/)) return 'create';
  if (text.match(/更新|修改|取消|完成|改期|重檢/)) return 'update';
  if (text.match(/刪除|移除/)) return 'delete';
  return 'read';
}

function erpSaaSCan_(role, feature, operation){
  if (role === 'owner') return true;
  const rows = erpReadRows_('permissions');
  let row = rows.find(r => r.role === role && r.feature === feature) || rows.find(r => r.role === role && r.feature === 'all');
  if (!row) return false;
  if (operation === 'read') return String(row.canRead) === 'yes';
  if (operation === 'create') return String(row.canCreate) === 'yes';
  if (operation === 'update') return String(row.canUpdate) === 'yes';
  if (operation === 'delete') return String(row.canDelete) === 'yes';
  return false;
}

function erpSaaSGuard(params){
  erpSaaSEnsureTables_();
  const action = String((params && params.action) || '');
  const role = params.role || params.userRole || params['使用者角色'] || 'owner';
  const feature = erpSaaSFeatureFromAction_(action);
  const operation = erpSaaSOperationFromAction_(action);
  const validationRequired = params.requireSession === true || params.requireSession === 'true';
  if (validationRequired) {
    const valid = erpSaaSValidateSession(params);
    if (!valid.success) return valid;
  }
  if (!erpSaaSCan_(role, feature, operation)) {
    erpAudit_(params, '權限拒絕：' + action, feature, '', 'fail', role + ' cannot ' + operation + ' ' + feature);
    return erpFail_('權限不足，無法執行此功能', { role: role, feature: feature, operation: operation });
  }
  return erpOk_('權限通過', { role: role, feature: feature, operation: operation });
}

function erpSaaSSetFeatureFlag(params){
  erpSaaSEnsureTables_();
  const tenantId = erpTenantId_(params);
  const feature = params.feature || params['功能'];
  if (!feature) return erpFail_('請提供功能名稱');
  const enabled = params.enabled === false || params.enabled === 'false' || params.enabled === 'no' ? 'no' : 'yes';
  const existing = erpReadRows_('feature_flags').find(f => f.tenantId === tenantId && f.feature === feature);
  if (existing) {
    erpUpdateRow_('feature_flags', existing._row, { enabled: enabled, note: params.note || params['備註'] || '', updatedAt: erpNow_() });
    return erpOk_('功能旗標已更新', { feature: feature, enabled: enabled });
  }
  erpAppend_('feature_flags', { flagId: erpUuid_('FLAG'), tenantId: tenantId, feature: feature, enabled: enabled, note: params.note || params['備註'] || '', createdAt: erpNow_(), updatedAt: erpNow_() });
  return erpOk_('功能旗標已建立', { feature: feature, enabled: enabled });
}

function erpSaaSRoute(params){
  const action = String((params && params.action) || '');
  try {
    if (action === '建立Session' || action === 'SaaS建立Session') return erpSaaSCreateSession(params);
    if (action === '驗證Session' || action === 'SaaS驗證Session') return erpSaaSValidateSession(params);
    if (action === '登出' || action === 'SaaS登出') return erpSaaSLogout(params);
    if (action === '權限檢查' || action === 'SaaS權限檢查') return erpSaaSGuard(params);
    if (action === '設定功能旗標') return erpSaaSSetFeatureFlag(params);
    return null;
  } catch (err) {
    erpAudit_(params, action, 'saas_security', '', 'fail', err.message);
    return erpFail_('SaaS 權限系統處理失敗：' + err.message);
  }
}

/**
 * 主 router 建議接法：
 * const saasResult = erpSaaSRoute(params);
 * if (saasResult) return jsonOutput(saasResult);
 * const guard = erpSaaSGuard(params);
 * if (!guard.success) return jsonOutput(guard);
 */
