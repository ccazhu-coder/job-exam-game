/* GovOps OS Session Guard Runtime v1.0.0
 * 目的：正式 ERP SaaS Session Verification Layer。
 * 依賴：config.js、saas-runtime.js、govops-api-client.js
 */
(function(){
  var LOGIN_URL='./login.html';
  var VERIFY_ACTION='取得目前使用者Session';
  var SESSION_KEYS=['govops_profile','govops_auth','govops_usage'];

  function safeJSON(key,fallback){
    try{
      var raw=localStorage.getItem(key);
      if(!raw)return fallback||null;
      var parsed=JSON.parse(raw);
      return parsed&&typeof parsed==='object'?parsed:(fallback||null);
    }catch(e){return fallback||null;}
  }

  function getSession(){
    var profile=safeJSON('govops_profile',null);
    var auth=safeJSON('govops_auth',null);
    return {profile:profile,auth:auth,usage:safeJSON('govops_usage',{})};
  }

  function hasLocalSession(){
    var session=getSession();
    return !!(session.profile&&session.auth&&(session.profile.tenantId||session.auth.tenantId)&&(session.profile.userId||session.auth.userId));
  }

  function getVerifyPayload(){
    var session=getSession();
    var profile=session.profile||{};
    var auth=session.auth||{};
    return {
      action:VERIFY_ACTION,
      tenantId:profile.tenantId||auth.tenantId||'',
      userId:profile.userId||auth.userId||'',
      email:profile.email||auth.email||'',
      phone:profile.phone||auth.phone||'',
      userRole:profile.role||profile.userRole||auth.userRole||'',
      plan:profile.plan||auth.plan||''
    };
  }

  function normalizeProfile(result){
    var d=result&&result.data?result.data:{};
    var s=d.session||d.govops_profile||d;
    return {
      tenantId:s.tenantId||d.tenantId||'',
      userId:s.userId||d.userId||'',
      userName:s.userName||d.userName||'',
      organizationName:s.organizationName||s.orgName||d.organizationName||'',
      orgName:s.orgName||s.organizationName||d.organizationName||'',
      email:s.email||d.email||'',
      phone:s.phone||d.phone||'',
      role:s.role||s.userRole||d.userRole||'viewer',
      userRole:s.userRole||s.role||d.userRole||'viewer',
      roleLabel:s.roleLabel||'',
      plan:s.plan||d.plan||'FREE',
      planLabel:s.planLabel||'',
      status:s.status||d.status||'active',
      verifiedAt:new Date().toISOString(),
      authVersion:s.authVersion||d.authVersion||''
    };
  }

  function persistVerifiedSession(result){
    var d=result&&result.data?result.data:{};
    var profile=normalizeProfile(result);
    if(!profile.tenantId||!profile.userId){
      return {success:false,message:'後端未回傳完整 Session，請重新登入。'};
    }
    var auth=d.govops_auth||{
      tenantId:profile.tenantId,
      userId:profile.userId,
      userRole:profile.userRole||profile.role,
      plan:profile.plan,
      status:profile.status
    };
    localStorage.setItem('govops_profile',JSON.stringify(profile));
    localStorage.setItem('govops_auth',JSON.stringify(auth));
    if(!localStorage.getItem('govops_usage')){
      localStorage.setItem('govops_usage',JSON.stringify({events:0,crm:0,users:1,ai:0}));
    }
    if(window.GovOpsSaaS&&typeof window.GovOpsSaaS.repairStoredSession==='function'){
      window.GovOpsSaaS.repairStoredSession();
    }
    return {success:true,message:'Session 驗證成功。',session:profile};
  }

  function redirectToLogin(reason){
    try{
      if(reason)localStorage.setItem('govops_last_logout_reason',reason);
    }catch(e){}
    if(!/login\.html$/i.test(location.pathname)){
      location.href=LOGIN_URL;
    }
  }

  function clearSession(){
    SESSION_KEYS.forEach(function(key){localStorage.removeItem(key);});
  }

  function logout(reason){
    clearSession();
    redirectToLogin(reason||'已登出，請重新登入。');
  }

  function friendlyError(message){
    message=String(message||'Session 驗證失敗，請重新登入。');
    if(/TypeError|ReferenceError|SyntaxError|Exception|stack|undefined is not/i.test(message)){
      return 'Session 驗證失敗，請重新登入。';
    }
    return message;
  }

  async function verify(options){
    options=options||{};
    if(!hasLocalSession()){
      if(options.redirect!==false)redirectToLogin('尚未登入，請先登入。');
      return {success:false,message:'尚未登入，請先登入。'};
    }
    if(!window.GovOpsAPI||typeof window.GovOpsAPI.request!=='function'){
      return {success:false,message:'API Client 尚未載入，無法驗證 Session。'};
    }
    try{
      var result=await window.GovOpsAPI.request(getVerifyPayload());
      if(!result||result.success===false){
        clearSession();
        var msg=friendlyError(result&&result.message?result.message:'Session 無效，請重新登入。');
        if(options.redirect!==false)redirectToLogin(msg);
        return {success:false,message:msg,data:result&&result.data?result.data:{}};
      }
      var saved=persistVerifiedSession(result);
      if(!saved.success){
        clearSession();
        if(options.redirect!==false)redirectToLogin(saved.message);
        return saved;
      }
      return {success:true,message:'Session 驗證成功。',data:saved.session};
    }catch(e){
      clearSession();
      var errMsg=friendlyError(e&&e.message);
      if(options.redirect!==false)redirectToLogin(errMsg);
      return {success:false,message:errMsg};
    }
  }

  function requireRole(roles){
    roles=Array.isArray(roles)?roles:[roles];
    var session=getSession();
    var role=(session.profile&& (session.profile.role||session.profile.userRole)) || (session.auth&&session.auth.userRole) || '';
    if(roles.indexOf('all')>=0||roles.indexOf(role)>=0)return true;
    return false;
  }

  function requirePlan(plans){
    plans=Array.isArray(plans)?plans:[plans];
    var session=getSession();
    var plan=(session.profile&&session.profile.plan)||(session.auth&&session.auth.plan)||'';
    plan=String(plan||'').toUpperCase();
    return plans.map(function(p){return String(p||'').toUpperCase();}).indexOf(plan)>=0;
  }

  window.GovOpsSessionGuard={
    verify:verify,
    logout:logout,
    getSession:getSession,
    requireRole:requireRole,
    requirePlan:requirePlan,
    clearSession:clearSession,
    getVerifyPayload:getVerifyPayload
  };
})();
