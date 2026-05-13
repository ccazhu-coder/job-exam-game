/* GovOps OS Session Guard v2 — 精簡版（無 SaaS plan 限制） */
(function(){
  var HOME = './dashboard.html';

  function safeJSON(key){
    try{var r=localStorage.getItem(key);return r?JSON.parse(r):null;}catch(e){return null;}
  }

  function getSession(){
    return {profile:safeJSON('govops_profile'),auth:safeJSON('govops_auth')};
  }

  function hasSession(){
    var s=getSession();
    return !!(s.profile&&s.profile.userId);
  }

  function logout(){
    ['govops_profile','govops_auth'].forEach(function(k){localStorage.removeItem(k);});
    location.href=HOME;
  }

  // 角色檢查：roles 為陣列，'all' 代表任何已登入者皆可
  function requireRole(roles){
    roles=Array.isArray(roles)?roles:[roles];
    var s=getSession();
    var role=(s.profile&&(s.profile.role||s.profile.userRole))||'viewer';
    return roles.indexOf('all')>=0||roles.indexOf(role)>=0;
  }

  // 各頁面呼叫：未登入則跳 dashboard（登入入口）
  function guardPage(){
    if(!hasSession()&&!/dashboard\.html/i.test(location.pathname)){
      location.href=HOME+'?redirect='+encodeURIComponent(location.pathname);
    }
  }

  window.GovOpsSessionGuard={getSession:getSession,hasSession:hasSession,logout:logout,requireRole:requireRole,guardPage:guardPage};
})();
