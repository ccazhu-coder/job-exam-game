/* GovOps OS｜SaaS Operations Core v1
 * 正式上線營運級骨架：Tenant Guard、RBAC、Audit Log、Workflow Runtime。
 * 目的：所有正式 SaaS 功能必須先通過 tenant、role、audit、workflow 的治理。
 */

function handleGovOpsSaaSOperationsCoreAction(action, data) {
  data = data || {};
  try {
    if (action === 'saas.tenant.create' || action === '建立租戶') return GovOpsSaaS_Tenant_create(data);
    if (action === 'saas.tenant.query' || action === '查詢租戶') return GovOpsSaaS_Tenant_query(data);
    if (action === 'saas.rbac.grant' || action === '授權角色') return GovOpsSaaS_RBAC_grant(data);
    if (action === 'saas.rbac.check' || action === '檢查權限') return GovOpsSaaS_RBAC_check(data);
    if (action === 'saas.audit.query' || action === '查詢稽核日誌') return GovOpsSaaS_Audit_query(data);
    if (action === 'saas.workflow.define' || action === '建立流程定義') return GovOpsSaaS_Workflow_define(data);
    if (action === 'saas.workflow.transition' || action === '推進流程狀態') return GovOpsSaaS_Workflow_transition(data);
    if (action === 'saas.workflow.query' || action === '查詢流程狀態') return GovOpsSaaS_Workflow_query(data);
    if (action === 'saas.ops.health' || action === '營運骨架健康檢查') return GovOpsSaaS_Operations_health(data);
    return null;
  } catch (err) {
    GovOpsSaaS_Audit_write('SYSTEM_ERROR', action, data, 'fail', String(err));
    return GovOpsSaaS_fail('SaaS 營運核心暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_SAAS_OPS_CORE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsSaaSOperationsCoreAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_SAAS_OPS_CORE(action, data);
  };
}

function GovOpsSaaS_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsSaaS_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsSaaS_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsSaaS_sheetTenant() { return '90_SaaS租戶主檔'; }
function GovOpsSaaS_sheetUserRole() { return '91_SaaS使用者角色'; }
function GovOpsSaaS_sheetPermission() { return '92_SaaS權限矩陣'; }
function GovOpsSaaS_sheetAudit() { return '93_SaaS稽核日誌'; }
function GovOpsSaaS_sheetWorkflowDef() { return '94_SaaS流程定義'; }
function GovOpsSaaS_sheetWorkflowInst() { return '95_SaaS流程狀態'; }

function GovOpsSaaS_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsSaaS_sheetTenant(), ['tenantId','租戶名稱','租戶類型','方案','狀態','OwnerEmail','建立時間','更新時間','備註']);
  GovOpsProduct_ensureSheet(GovOpsSaaS_sheetUserRole(), ['roleId','tenantId','userId','Email','姓名','角色','狀態','建立時間','更新時間','備註']);
  GovOpsProduct_ensureSheet(GovOpsSaaS_sheetPermission(), ['permissionId','角色','資源','動作','允許','建立時間','更新時間','備註']);
  GovOpsProduct_ensureSheet(GovOpsSaaS_sheetAudit(), ['auditId','tenantId','userId','角色','動作','資源','資料ID','結果','訊息','IP','UserAgent','建立時間','原始資料']);
  GovOpsProduct_ensureSheet(GovOpsSaaS_sheetWorkflowDef(), ['workflowId','tenantId','流程類型','流程名稱','狀態清單','允許轉換','啟用狀態','建立時間','更新時間','備註']);
  GovOpsProduct_ensureSheet(GovOpsSaaS_sheetWorkflowInst(), ['instanceId','tenantId','workflowId','流程類型','資料ID','資料名稱','目前狀態','上一狀態','下一可用狀態','負責人','狀態原因','建立時間','更新時間','userId','備註']);
}

function GovOpsSaaS_Tenant_create(data) {
  data = data || {};
  GovOpsSaaS_ensureSheets();
  var tenantId = data.tenantId || 'TEN-' + Utilities.getUuid().slice(0, 8);
  var row = {
    tenantId: tenantId,
    租戶名稱: data.租戶名稱 || data.tenantName || '',
    租戶類型: data.租戶類型 || data.tenantType || 'company',
    方案: data.方案 || data.plan || 'PRO',
    狀態: data.狀態 || '啟用',
    OwnerEmail: data.OwnerEmail || data.ownerEmail || '',
    建立時間: GovOpsSaaS_now(),
    更新時間: GovOpsSaaS_now(),
    備註: data.備註 || ''
  };
  var existing = GovOpsSaaS_findBy(GovOpsSaaS_sheetTenant(), 'tenantId', tenantId);
  if (existing) GovOpsProduct_update(GovOpsSaaS_sheetTenant(), existing._row, Object.assign({}, row, { 建立時間: existing.建立時間 || row.建立時間 }));
  else GovOpsProduct_append(GovOpsSaaS_sheetTenant(), row);
  GovOpsSaaS_Audit_write('TENANT_CREATE', 'saas.tenant.create', row, 'success', '租戶已建立');
  return GovOpsSaaS_success('租戶已建立。', row);
}

function GovOpsSaaS_Tenant_query(data) {
  data = data || {};
  GovOpsSaaS_ensureSheets();
  var keyword = String(data.keyword || data.關鍵字 || data.tenantId || '').trim();
  var rows = GovOpsProduct_readRows(GovOpsSaaS_sheetTenant()).filter(function(r){ return !keyword || JSON.stringify(r).indexOf(keyword) >= 0; });
  return GovOpsSaaS_success('租戶查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsSaaS_Tenant_guard(data, resourceTenantId) {
  data = data || {};
  var requesterTenant = String(data.tenantId || '');
  var targetTenant = String(resourceTenantId || data.tenantId || '');
  if (!requesterTenant) return { allow: false, reason: '缺少 tenantId。' };
  if (requesterTenant !== targetTenant && String(data.userRole || data.角色 || '') !== 'super_admin') return { allow: false, reason: '租戶資料隔離禁止跨租戶存取。' };
  return { allow: true, reason: 'Tenant Guard passed.' };
}

function GovOpsSaaS_RBAC_grant(data) {
  data = data || {};
  GovOpsSaaS_ensureSheets();
  var row = {
    roleId: data.roleId || 'ROLE-' + Utilities.getUuid().slice(0, 8),
    tenantId: data.tenantId || 'TENANT-DEMO',
    userId: data.userId || '',
    Email: data.Email || data.email || '',
    姓名: data.姓名 || data.name || '',
    角色: data.角色 || data.role || 'project_member',
    狀態: data.狀態 || '啟用',
    建立時間: GovOpsSaaS_now(),
    更新時間: GovOpsSaaS_now(),
    備註: data.備註 || ''
  };
  var existing = GovOpsSaaS_findRole(row.tenantId, row.userId, row.Email);
  if (existing) GovOpsProduct_update(GovOpsSaaS_sheetUserRole(), existing._row, Object.assign({}, row, { roleId: existing.roleId, 建立時間: existing.建立時間 || row.建立時間 }));
  else GovOpsProduct_append(GovOpsSaaS_sheetUserRole(), row);
  GovOpsSaaS_Audit_write('RBAC_GRANT', 'saas.rbac.grant', row, 'success', '角色已授權');
  return GovOpsSaaS_success('角色已授權。', row);
}

function GovOpsSaaS_RBAC_check(data) {
  data = data || {};
  GovOpsSaaS_ensureSheets();
  var role = data.角色 || data.role || data.userRole || GovOpsSaaS_getUserRole(data.tenantId, data.userId, data.Email || data.email);
  var resource = data.資源 || data.resource || '*';
  var action = data.動作 || data.permissionAction || data.checkAction || '*';
  var allow = GovOpsSaaS_RBAC_allow(role, resource, action);
  var result = { allow: allow, role: role, resource: resource, action: action, reason: allow ? '權限通過。' : '權限不足。' };
  GovOpsSaaS_Audit_write('RBAC_CHECK', 'saas.rbac.check', Object.assign({}, data, result), allow ? 'success' : 'deny', result.reason);
  return allow ? GovOpsSaaS_success('權限檢查通過。', result) : GovOpsSaaS_fail('權限不足。', result);
}

function GovOpsSaaS_RBAC_allow(role, resource, action) {
  role = String(role || 'guest');
  if (role === 'super_admin' || role === 'owner') return true;
  var map = {
    project_manager: ['tender:*','execution:*','resource:read','finance:read','report:*'],
    admin_staff: ['execution:*','resource:read','report:read','file:*'],
    finance: ['finance:*','reimbursement:*','vendor:read','report:read'],
    lecturer: ['execution:read','attendance:read','satisfaction:read','file:create'],
    staff: ['execution:read','file:create','attendance:create'],
    client: ['report:read','dashboard:read'],
    guest: ['public:read']
  };
  var grants = map[role] || [];
  var token = resource + ':' + action;
  return grants.some(function(g){ return g === '*:*' || g === token || g === resource + ':*' || (g.endsWith(':*') && token.indexOf(g.replace(':*','')) === 0); });
}

function GovOpsSaaS_Audit_write(eventType, action, data, result, message) {
  try {
    GovOpsSaaS_ensureSheets();
    var row = {
      auditId: 'AUD-' + Utilities.getUuid().slice(0, 8),
      tenantId: data && data.tenantId || '',
      userId: data && data.userId || '',
      角色: data && (data.userRole || data.角色 || data.role) || '',
      動作: action || eventType || '',
      資源: data && (data.resource || data.資源 || '') || '',
      資料ID: data && (data.id || data.資料ID || data.標案ID || data.場次ID || '') || '',
      結果: result || '',
      訊息: message || '',
      IP: data && data.ip || '',
      UserAgent: data && data.userAgent || '',
      建立時間: GovOpsSaaS_now(),
      原始資料: JSON.stringify(data || {}).slice(0, 45000)
    };
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsSaaS_sheetAudit(), row);
  } catch (err) {}
}

function GovOpsSaaS_Audit_query(data) {
  data = data || {};
  GovOpsSaaS_ensureSheets();
  var tenantId = String(data.tenantId || '').trim();
  var keyword = String(data.keyword || data.關鍵字 || '').trim();
  var rows = GovOpsProduct_readRows(GovOpsSaaS_sheetAudit()).filter(function(r){
    if (tenantId && String(r.tenantId || '') !== tenantId && String(data.userRole || '') !== 'super_admin') return false;
    return !keyword || JSON.stringify(r).indexOf(keyword) >= 0;
  });
  return GovOpsSaaS_success('稽核日誌查詢完成。', { total: rows.length, rows: rows.slice(-500).reverse() });
}

function GovOpsSaaS_Workflow_define(data) {
  data = data || {};
  GovOpsSaaS_ensureSheets();
  var row = {
    workflowId: data.workflowId || 'WF-' + Utilities.getUuid().slice(0, 8),
    tenantId: data.tenantId || 'TENANT-DEMO',
    流程類型: data.流程類型 || data.workflowType || 'tender_execution',
    流程名稱: data.流程名稱 || data.workflowName || '標案履約流程',
    狀態清單: data.狀態清單 || data.states || '待處理,執行中,待驗收,待結案,已完成,已取消',
    允許轉換: data.允許轉換 || data.transitions || '待處理>執行中,執行中>待驗收,待驗收>待結案,待結案>已完成,執行中>已取消',
    啟用狀態: data.啟用狀態 || '啟用',
    建立時間: GovOpsSaaS_now(),
    更新時間: GovOpsSaaS_now(),
    備註: data.備註 || ''
  };
  var existing = GovOpsSaaS_findWorkflowDef(row.tenantId, row.流程類型);
  if (existing) GovOpsProduct_update(GovOpsSaaS_sheetWorkflowDef(), existing._row, Object.assign({}, row, { workflowId: existing.workflowId, 建立時間: existing.建立時間 || row.建立時間 }));
  else GovOpsProduct_append(GovOpsSaaS_sheetWorkflowDef(), row);
  GovOpsSaaS_Audit_write('WORKFLOW_DEFINE', 'saas.workflow.define', row, 'success', '流程定義已建立');
  return GovOpsSaaS_success('流程定義已建立。', row);
}

function GovOpsSaaS_Workflow_transition(data) {
  data = data || {};
  GovOpsSaaS_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var type = data.流程類型 || data.workflowType || 'tender_execution';
  var dataId = data.資料ID || data.dataId || data.標案ID || data.場次ID || '';
  var next = data.下一狀態 || data.nextState || '';
  if (!dataId || !next) return GovOpsSaaS_fail('請提供資料ID與下一狀態。');
  var def = GovOpsSaaS_findWorkflowDef(tenantId, type) || GovOpsSaaS_Workflow_define({ tenantId: tenantId, 流程類型: type }).data;
  var inst = GovOpsSaaS_findWorkflowInst(tenantId, type, dataId);
  var current = inst && inst.目前狀態 || data.目前狀態 || '待處理';
  var allow = GovOpsSaaS_Workflow_canTransition(def, current, next);
  if (!allow) {
    GovOpsSaaS_Audit_write('WORKFLOW_DENY', 'saas.workflow.transition', data, 'deny', '流程狀態不允許轉換');
    return GovOpsSaaS_fail('流程狀態不允許轉換。', { current: current, next: next, transitions: def.允許轉換 });
  }
  var nextAvailable = GovOpsSaaS_Workflow_nextStates(def, next).join(',');
  var row = {
    instanceId: inst && inst.instanceId || 'WFI-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    workflowId: def.workflowId,
    流程類型: type,
    資料ID: dataId,
    資料名稱: data.資料名稱 || data.dataName || '',
    目前狀態: next,
    上一狀態: current,
    下一可用狀態: nextAvailable,
    負責人: data.負責人 || data.owner || '',
    狀態原因: data.狀態原因 || data.reason || '',
    建立時間: inst && inst.建立時間 || GovOpsSaaS_now(),
    更新時間: GovOpsSaaS_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (inst) GovOpsProduct_update(GovOpsSaaS_sheetWorkflowInst(), inst._row, row);
  else GovOpsProduct_append(GovOpsSaaS_sheetWorkflowInst(), row);
  GovOpsSaaS_Audit_write('WORKFLOW_TRANSITION', 'saas.workflow.transition', row, 'success', current + ' → ' + next);
  return GovOpsSaaS_success('流程狀態已推進。', row);
}

function GovOpsSaaS_Workflow_query(data) {
  data = data || {};
  GovOpsSaaS_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.資料ID || '').trim();
  var rows = GovOpsProduct_readRows(GovOpsSaaS_sheetWorkflowInst()).filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    return !keyword || JSON.stringify(r).indexOf(keyword) >= 0;
  });
  return GovOpsSaaS_success('流程狀態查詢完成。', { total: rows.length, rows: rows.slice(0, 500) });
}

function GovOpsSaaS_Operations_health(data) {
  GovOpsSaaS_ensureSheets();
  var checks = {
    tenantTable: GovOpsSaaS_countSheet(GovOpsSaaS_sheetTenant()),
    roleTable: GovOpsSaaS_countSheet(GovOpsSaaS_sheetUserRole()),
    auditTable: GovOpsSaaS_countSheet(GovOpsSaaS_sheetAudit()),
    workflowDefTable: GovOpsSaaS_countSheet(GovOpsSaaS_sheetWorkflowDef()),
    workflowInstTable: GovOpsSaaS_countSheet(GovOpsSaaS_sheetWorkflowInst())
  };
  return GovOpsSaaS_success('營運骨架健康檢查完成。', checks);
}

function GovOpsSaaS_getUserRole(tenantId, userId, email) {
  var r = GovOpsSaaS_findRole(tenantId, userId, email);
  return r && r.狀態 === '啟用' ? r.角色 : 'guest';
}

function GovOpsSaaS_findRole(tenantId, userId, email) {
  try { return GovOpsProduct_readRows(GovOpsSaaS_sheetUserRole()).find(function(r){ return String(r.tenantId || '') === String(tenantId || '') && ((userId && String(r.userId || '') === String(userId)) || (email && String(r.Email || '') === String(email))); }) || null; } catch (err) { return null; }
}
function GovOpsSaaS_findBy(sheetName, key, value) { try { return GovOpsProduct_readRows(sheetName).find(function(r){ return String(r[key] || '') === String(value); }) || null; } catch (err) { return null; } }
function GovOpsSaaS_findWorkflowDef(tenantId, type) { try { return GovOpsProduct_readRows(GovOpsSaaS_sheetWorkflowDef()).find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.流程類型 || '') === String(type) && String(r.啟用狀態 || '') === '啟用'; }) || null; } catch (err) { return null; } }
function GovOpsSaaS_findWorkflowInst(tenantId, type, dataId) { try { return GovOpsProduct_readRows(GovOpsSaaS_sheetWorkflowInst()).find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.流程類型 || '') === String(type) && String(r.資料ID || '') === String(dataId); }) || null; } catch (err) { return null; } }
function GovOpsSaaS_Workflow_canTransition(def, current, next) { return String(def.允許轉換 || '').split(',').some(function(t){ var p = t.split('>'); return String(p[0] || '').trim() === String(current) && String(p[1] || '').trim() === String(next); }); }
function GovOpsSaaS_Workflow_nextStates(def, current) { return String(def.允許轉換 || '').split(',').map(function(t){ return t.split('>'); }).filter(function(p){ return String(p[0] || '').trim() === String(current); }).map(function(p){ return String(p[1] || '').trim(); }); }
function GovOpsSaaS_countSheet(sheetName) { try { return GovOpsProduct_readRows(sheetName).length; } catch (err) { return 0; } }
