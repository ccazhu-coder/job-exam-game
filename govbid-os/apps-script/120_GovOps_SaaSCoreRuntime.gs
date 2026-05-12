/* GovOps OS｜SaaS Core Runtime v1
 * Tenant Engine + Billing Engine + RBAC Engine + Feature Runtime
 * 正式 SaaS 公司核心 Runtime。
 */

function handleGovOpsSaaSCoreAction(action, data) {
  data = data || {};
  try {
    if (action === 'tenant.create') return GovOpsTenant_create(data);
    if (action === 'tenant.query') return GovOpsTenant_query(data);
    if (action === 'subscription.create') return GovOpsSubscription_create(data);
    if (action === 'subscription.query') return GovOpsSubscription_query(data);
    if (action === 'rbac.role.create') return GovOpsRBAC_createRole(data);
    if (action === 'rbac.permission.grant') return GovOpsRBAC_grantPermission(data);
    if (action === 'feature.check') return GovOpsFeature_check(data);
    if (action === 'usage.track') return GovOpsUsage_track(data);
    return null;
  } catch (err) {
    return { success:false,message:'SaaS Core Runtime 錯誤',data:{ error:String(err) } };
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_SAAS_CORE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsSaaSCoreAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_SAAS_CORE(action, data);
  };
}

function GovOpsSaaS_now(){ return Utilities.formatDate(new Date(),'Asia/Taipei','yyyy/MM/dd HH:mm:ss'); }

function GovOpsSaaS_ensureSheets(){
  GovOpsProduct_ensureSheet('110_租戶主檔',['tenantId','租戶名稱','方案','狀態','到期日','建立時間','更新時間']);
  GovOpsProduct_ensureSheet('111_租戶方案',['方案ID','方案名稱','月費','使用者上限','Email額度','Storage額度','AI額度']);
  GovOpsProduct_ensureSheet('121_租戶訂閱',['訂閱ID','tenantId','方案ID','開始日','到期日','狀態','建立時間']);
  GovOpsProduct_ensureSheet('130_角色主檔',['角色ID','角色名稱','tenantId','建立時間']);
  GovOpsProduct_ensureSheet('132_角色權限',['角色ID','權限Key','tenantId','建立時間']);
  GovOpsProduct_ensureSheet('142_租戶Feature',['tenantId','FeatureKey','啟用狀態','限制值']);
  GovOpsProduct_ensureSheet('114_租戶用量',['tenantId','usageType','usageValue','usageDate']);
}

function GovOpsTenant_create(data){
  GovOpsSaaS_ensureSheets();
  var row={
    tenantId:data.tenantId || 'TENANT-'+Utilities.getUuid().slice(0,8),
    租戶名稱:data.租戶名稱 || data.name || '未命名租戶',
    方案:data.方案 || 'starter',
    狀態:'active',
    到期日:data.到期日 || '',
    建立時間:GovOpsSaaS_now(),
    更新時間:GovOpsSaaS_now()
  };
  GovOpsProduct_append('110_租戶主檔',row);
  GovOpsTenant_seedFeatures(row.tenantId,row.方案);
  return { success:true,message:'租戶建立完成',data:row };
}

function GovOpsTenant_seedFeatures(tenantId,plan){
  var features=[];
  if(plan==='starter') features=[['registration',1],['email',500],['crm',200]];
  if(plan==='pro') features=[['registration',1],['email',5000],['crm',5000],['ai',1],['line',1]];
  if(plan==='enterprise') features=[['registration',1],['email',999999],['crm',999999],['ai',1],['line',1],['api',1],['white_label',1]];
  features.forEach(function(f){ GovOpsProduct_append('142_租戶Feature',{ tenantId:tenantId,FeatureKey:f[0],啟用狀態:'enabled',限制值:f[1] }); });
}

function GovOpsTenant_query(data){
  GovOpsSaaS_ensureSheets();
  var rows=GovOpsProduct_readRows('110_租戶主檔');
  return { success:true,message:'租戶查詢完成',data:{ total:rows.length,rows:rows } };
}

function GovOpsSubscription_create(data){
  GovOpsSaaS_ensureSheets();
  var row={
    訂閱ID:'SUB-'+Utilities.getUuid().slice(0,8),
    tenantId:data.tenantId,
    方案ID:data.方案ID || data.plan || 'starter',
    開始日:data.開始日 || GovOpsSaaS_now(),
    到期日:data.到期日 || '',
    狀態:'active',
    建立時間:GovOpsSaaS_now()
  };
  GovOpsProduct_append('121_租戶訂閱',row);
  return { success:true,message:'訂閱建立完成',data:row };
}

function GovOpsSubscription_query(data){
  var rows=GovOpsProduct_readRows('121_租戶訂閱').filter(function(r){ return !data.tenantId || String(r.tenantId||'')===String(data.tenantId); });
  return { success:true,message:'訂閱查詢完成',data:{ total:rows.length,rows:rows } };
}

function GovOpsRBAC_createRole(data){
  var row={
    角色ID:data.roleId || 'ROLE-'+Utilities.getUuid().slice(0,8),
    角色名稱:data.roleName || 'staff',
    tenantId:data.tenantId,
    建立時間:GovOpsSaaS_now()
  };
  GovOpsProduct_append('130_角色主檔',row);
  return { success:true,message:'角色建立完成',data:row };
}

function GovOpsRBAC_grantPermission(data){
  var row={
    角色ID:data.roleId,
    權限Key:data.permissionKey,
    tenantId:data.tenantId,
    建立時間:GovOpsSaaS_now()
  };
  GovOpsProduct_append('132_角色權限',row);
  return { success:true,message:'權限授權完成',data:row };
}

function GovOpsFeature_check(data){
  var rows=GovOpsProduct_readRows('142_租戶Feature').filter(function(r){ return String(r.tenantId||'')===String(data.tenantId||'') && String(r.FeatureKey||'')===String(data.featureKey||''); });
  return { success:true,message:'Feature檢查完成',data:{ enabled:rows.length>0,rows:rows } };
}

function GovOpsUsage_track(data){
  var row={
    tenantId:data.tenantId,
    usageType:data.usageType,
    usageValue:data.usageValue || 1,
    usageDate:GovOpsSaaS_now()
  };
  GovOpsProduct_append('114_租戶用量',row);
  return { success:true,message:'用量追蹤完成',data:row };
}
