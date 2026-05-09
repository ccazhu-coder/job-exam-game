/* GovOps OS Frontend SaaS Runtime v1.0.0 */
(function(){
  const PLAN_ALIASES={free:'FREE',starter:'STARTER',pro:'PRO',team:'ENTERPRISE',enterprise:'ENTERPRISE',FREE:'FREE',STARTER:'STARTER',PRO:'PRO',TEAM:'ENTERPRISE',ENTERPRISE:'ENTERPRISE'};
  const ROLE_ALIASES={owner:'owner',admin:'admin',pm:'admin',finance:'finance',staff:'staff',teacher:'staff',viewer:'viewer'};
  const PLAN_LIMITS={
    FREE:{name:'免費體驗版',events:3,crm:50,users:1,ai:0,features:['dashboard','activity','registration','crm','onsite','check','query']},
    STARTER:{name:'入門版',events:20,crm:500,users:1,ai:0,features:['dashboard','activity','registration','crm','onsite','check','query','drive','calendar_sync']},
    PRO:{name:'專業版',events:100,crm:5000,users:3,ai:300,features:['dashboard','activity','registration','crm','onsite','check','query','drive','finance','notification','ai_secretary','advanced_crm','analytics_dashboard','line_bot']},
    ENTERPRISE:{name:'企業版',events:999999,crm:999999,users:999999,ai:999999,features:['all']}
  };
  const ROLE_PERMISSIONS={
    owner:['all'],
    admin:['dashboard','activity','registration','crm','onsite','check','query','drive','finance','notification','ai_secretary','advanced_crm','analytics_dashboard','calendar_sync'],
    finance:['dashboard','query','finance','analytics_dashboard'],
    staff:['dashboard','registration','crm','onsite','query','calendar_sync'],
    viewer:['dashboard','query']
  };
  function normalizePlan(plan){return PLAN_ALIASES[String(plan||'PRO').trim()]||'PRO'}
  function normalizeRole(role){return ROLE_ALIASES[String(role||'owner').trim()]||'viewer'}
  function safeJSON(key,fallback){try{const raw=localStorage.getItem(key);if(!raw)return fallback||{};return JSON.parse(raw)}catch(e){return fallback||{}}}
  function getProfile(){const p=Object.assign({tenantId:'TENANT-DEMO',userId:'USR-DEMO',orgName:'未設定組織',role:'owner',roleLabel:'負責人／系統管理者',plan:'PRO',status:'active'},safeJSON('govops_profile',{}));p.plan=normalizePlan(p.plan);p.role=normalizeRole(p.role||p.userRole);return p}
  function getAuth(){const a=safeJSON('govops_auth',{});if(typeof a==='string')return{};a.plan=normalizePlan(a.plan||getProfile().plan);a.userRole=normalizeRole(a.userRole||a.role||getProfile().role);return a}
  function getUsage(){return Object.assign({events:0,crm:0,users:1,ai:0},safeJSON('govops_usage',{}))}
  function getPlan(){return PLAN_LIMITS[getProfile().plan]||PLAN_LIMITS.PRO}
  function hasFeature(feature){const p=getProfile();const plan=getPlan();const roleFeatures=ROLE_PERMISSIONS[p.role]||[];const planOk=plan.features.includes('all')||plan.features.includes(feature);const roleOk=roleFeatures.includes('all')||roleFeatures.includes(feature);return planOk&&roleOk&&p.status==='active'}
  function toBackendParams(params){const p=getProfile();return Object.assign({tenantId:p.tenantId,userId:p.userId,userRole:p.role,plan:p.plan,使用者ID:p.userId,組織ID:p.tenantId,使用者角色:p.role,SaaS方案:p.plan},params||{})}
  function repairStoredSession(){const p=getProfile();localStorage.setItem('govops_profile',JSON.stringify(p));localStorage.setItem('govops_auth',JSON.stringify({tenantId:p.tenantId,userId:p.userId,userRole:p.role,plan:p.plan,status:p.status||'active'}));return p}
  window.GovOpsSaaS={PLAN_LIMITS,ROLE_PERMISSIONS,normalizePlan,normalizeRole,getProfile,getAuth,getUsage,getPlan,hasFeature,toBackendParams,repairStoredSession};
  repairStoredSession();
})();
