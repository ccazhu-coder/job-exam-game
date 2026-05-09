/* GovOps OS Login Auth Adapter v1.0.0
 * 目的：讓 login.html 接入正式 Auth Backend。
 * 依賴：config.js、saas-runtime.js、govops-api-client.js
 */
(function(){
  function $(id){return document.getElementById(id)}
  function msg(text){const el=$('msg');if(el)el.textContent=text||''}
  function value(id){const el=$(id);return el?String(el.value||'').trim():''}
  function selectedText(id){const el=$(id);return el&&el.options&&el.selectedIndex>=0?el.options[el.selectedIndex].text:''}
  function normalizePlan(v){return window.GovOpsSaaS&&window.GovOpsSaaS.normalizePlan?window.GovOpsSaaS.normalizePlan(v):String(v||'PRO').toUpperCase()}
  function normalizeRole(v){return window.GovOpsSaaS&&window.GovOpsSaaS.normalizeRole?window.GovOpsSaaS.normalizeRole(v):String(v||'owner')}
  function hideTechError(text){
    text=String(text||'系統暫時無法完成操作，請稍後再試。');
    if(/TypeError|ReferenceError|SyntaxError|Exception|stack|undefined is not/i.test(text))return'系統暫時無法完成操作，請稍後再試。';
    return text;
  }
  function buildProfileFromBackend(data,fallback){
    const d=data&&data.data?data.data:{};
    const s=d.session||d.govops_profile||d;
    const profile=Object.assign({},fallback||{},s,{ 
      tenantId:s.tenantId||d.tenantId||(fallback&&fallback.tenantId)||'',
      userId:s.userId||d.userId||(fallback&&fallback.userId)||'',
      orgName:s.orgName||s.organizationName||d.organizationName||(fallback&&fallback.orgName)||'',
      organizationName:s.organizationName||s.orgName||d.organizationName||(fallback&&fallback.organizationName)||'',
      userName:s.userName||d.userName||(fallback&&fallback.userName)||'',
      email:s.email||d.email||(fallback&&fallback.email)||'',
      phone:s.phone||d.phone||(fallback&&fallback.phone)||'',
      role:normalizeRole(s.role||s.userRole||d.userRole||(fallback&&fallback.role)||'owner'),
      roleLabel:s.roleLabel||(fallback&&fallback.roleLabel)||'負責人／系統管理者',
      plan:normalizePlan(s.plan||d.plan||(fallback&&fallback.plan)||'PRO'),
      planLabel:s.planLabel||(fallback&&fallback.planLabel)||'',
      status:s.status||d.status||(fallback&&fallback.status)||'active',
      savedAt:new Date().toISOString()
    });
    return profile;
  }
  function persistSession(result,fallback){
    const profile=buildProfileFromBackend(result,fallback);
    const d=result&&result.data?result.data:{};
    const auth=d.govops_auth||{
      tenantId:profile.tenantId,
      userId:profile.userId,
      userRole:profile.role,
      plan:profile.plan,
      status:profile.status
    };
    if(!profile.tenantId||!profile.userId){
      throw new Error('後端未回傳完整 tenantId / userId。');
    }
    localStorage.setItem('govops_profile',JSON.stringify(profile));
    localStorage.setItem('govops_auth',JSON.stringify(auth));
    if(!localStorage.getItem('govops_usage'))localStorage.setItem('govops_usage',JSON.stringify({events:0,crm:0,users:1,ai:0}));
    if(window.GovOpsSaaS&&window.GovOpsSaaS.repairStoredSession)window.GovOpsSaaS.repairStoredSession();
    return profile;
  }
  async function registerOrg(){
    try{
      if(!window.GovOpsAPI||!window.GovOpsAPI.request){msg('GovOpsAPI 尚未載入，請重新整理頁面後再試。');return}
      const organizationName=value('orgName');
      if(!organizationName){msg('請先填寫組織名稱／工作室名稱。');return}
      const email=value('email');
      const phone=value('phone');
      if(!email&&!phone){msg('請至少填寫 Email 或手機，作為日後登入帳號。');return}
      msg('正在註冊組織與管理者帳號...');
      const fallback={
        orgName:organizationName,
        organizationName:organizationName,
        userName:value('defaultContact')||organizationName,
        email:email,
        phone:phone,
        role:'owner',
        roleLabel:'負責人／系統管理者',
        plan:normalizePlan(value('plan')),
        planLabel:selectedText('plan'),
        defaultHost:value('defaultHost'),
        defaultContact:value('defaultContact'),
        defaultContactPhone:value('defaultContactPhone'),
        defaultActivityType:value('defaultActivityType'),
        note:value('note'),
        status:'active'
      };
      const result=await window.GovOpsAPI.request({
        action:'註冊組織與管理者',
        organizationName:organizationName,
        organizationType:'工作室／公司',
        ownerName:value('defaultContact')||organizationName,
        email:email,
        phone:phone,
        plan:normalizePlan(value('plan')),
        note:value('note')
      });
      if(!result||result.success===false){msg(hideTechError(result&&result.message?result.message:'註冊失敗，請稍後再試。'));return}
      persistSession(result,fallback);
      msg('註冊成功，正在進入主系統...');
      setTimeout(function(){location.href='./index.html'},700);
    }catch(e){msg(hideTechError(e&&e.message));}
  }
  async function loginUser(){
    try{
      if(!window.GovOpsAPI||!window.GovOpsAPI.request){msg('GovOpsAPI 尚未載入，請重新整理頁面後再試。');return}
      const email=value('email');
      const phone=value('phone');
      if(!email&&!phone){msg('請輸入 Email 或手機。');return}
      msg('正在登入使用者...');
      const result=await window.GovOpsAPI.request({action:'登入使用者',email:email,phone:phone});
      if(!result||result.success===false){msg(hideTechError(result&&result.message?result.message:'登入失敗，請稍後再試。'));return}
      persistSession(result,{email:email,phone:phone});
      msg('登入成功，正在進入主系統...');
      setTimeout(function(){location.href='./index.html'},700);
    }catch(e){msg(hideTechError(e&&e.message));}
  }
  function bind(){
    const saveBtn=document.querySelector('button[onclick="saveProfile()"]');
    if(saveBtn){
      saveBtn.textContent='註冊組織並進入主系統';
      saveBtn.onclick=function(e){if(e)e.preventDefault();registerOrg();return false;};
      const loginBtn=document.createElement('button');
      loginBtn.type='button';
      loginBtn.className='secondary';
      loginBtn.textContent='登入使用者';
      loginBtn.onclick=function(e){if(e)e.preventDefault();loginUser();return false;};
      saveBtn.parentNode.insertBefore(loginBtn,saveBtn.nextSibling);
    }
  }
  window.GovOpsLoginAuth={registerOrg,loginUser,persistSession,bind};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
