/* GovOps OS｜index.html 登入登出補丁
 * 用法：在 index.html </body> 前引入：
 * <script src="./index-auth-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})}
  function getProfile(){try{return Object.assign({tenantId:'TENANT-DEMO',userId:'USR-DEMO',orgName:'未設定組織',role:'owner',roleLabel:'負責人／系統管理者',plan:'pro',status:'active'},JSON.parse(localStorage.getItem('govops_profile')||'{}'))}catch(e){return {tenantId:'TENANT-DEMO',userId:'USR-DEMO',orgName:'未設定組織',role:'owner',roleLabel:'負責人／系統管理者',plan:'pro',status:'active'}}}
  function setProfile(p){localStorage.setItem('govops_profile',JSON.stringify(Object.assign(getProfile(),p||{})));localStorage.setItem('govops_auth','1')}
  function logout(){localStorage.removeItem('govops_auth');localStorage.removeItem('govops_profile');localStorage.removeItem('govops_usage')}
  function sectionHtml(){var p=getProfile();var authed=!!localStorage.getItem('govops_auth');return `
<section id="auth-center" class="card span12">
  <h2>帳號登入 / 登出</h2>
  <div class="hint">註冊過的帳號可在這裡登入。登入後系統會記住組織、角色與方案，所有操作會自動帶入使用者資料。</div>
  <div id="authStatus" class="${authed?'ok':'warn'}">${authed?'目前已登入：'+safe(p.orgName)+'｜'+safe(p.userId):'目前尚未登入，請輸入帳號資料登入。'}</div>
  <div class="row">
    <div><label>組織 / 公司 / 工作室名稱</label><input id="authOrgName" value="${safe(p.orgName==='未設定組織'?'':p.orgName)}" placeholder="例：知己知途、璞策顧問工作室"></div>
    <div><label>帳號 Email / User ID</label><input id="authUserId" value="${safe(p.userId==='USR-DEMO'?'':p.userId)}" placeholder="例：ccazhu@gmail.com"></div>
  </div>
  <div class="row">
    <div><label>角色</label><select id="authRole"><option value="owner">負責人／系統管理者</option><option value="pm">專案經理</option><option value="admin">行政人員</option><option value="finance">財務人員</option><option value="teacher">講師</option></select></div>
    <div><label>方案</label><select id="authPlan"><option value="pro">專業版</option><option value="team">團隊版</option><option value="enterprise">企業版</option><option value="free">免費體驗版</option></select></div>
  </div>
  <div class="row">
    <div><label>密碼</label><input id="authPassword" type="password" placeholder="前端自用版先做本機登入；正式版接後端驗證"></div>
    <div><label>登入狀態</label><input id="authTenantId" value="${safe(p.tenantId)}" placeholder="系統自動產生 tenantId"></div>
  </div>
  <div class="btns">
    <button class="green" onclick="govopsLogin()">登入</button>
    <button onclick="govopsRegisterLocal()">建立/更新本機帳號</button>
    <button class="danger" onclick="govopsLogout()">登出</button>
    <button class="secondary" onclick="location.href='./login.html'">開啟完整帳號頁</button>
  </div>
  <div id="authMsg" class="msg">尚未操作。</div>
</section>`}
  function init(){
    var dash=$('dashboard');
    if(dash && !$('auth-center')) dash.insertAdjacentHTML('afterend',sectionHtml());
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#auth-center"]')) topnav.insertAdjacentHTML('beforeend','<a href="#auth-center">登入</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#auth-center"]')) footer.insertAdjacentHTML('beforeend','<a href="#auth-center">帳號</a>');
    var p=getProfile(); if($('authRole')) $('authRole').value=p.role||'owner'; if($('authPlan')) $('authPlan').value=p.plan||'pro';
  }
  function roleLabel(role){return {owner:'負責人／系統管理者',pm:'專案經理',admin:'行政人員',finance:'財務人員',teacher:'講師'}[role]||role}
  function planLabel(plan){return {free:'免費體驗版',pro:'專業版',team:'團隊版',enterprise:'企業版'}[plan]||plan}
  window.govopsRegisterLocal=function(){
    var org=$('authOrgName').value.trim();var user=$('authUserId').value.trim();
    if(!org||!user){$('authMsg').textContent='請填寫組織名稱與帳號 Email / User ID。';return}
    var tenant='TENANT-'+btoa(unescape(encodeURIComponent(org))).replace(/[^A-Z0-9]/gi,'').slice(0,10).toUpperCase();
    setProfile({tenantId:tenant,userId:user,orgName:org,role:$('authRole').value,roleLabel:roleLabel($('authRole').value),plan:$('authPlan').value,planLabel:planLabel($('authPlan').value),status:'active',loginAt:new Date().toISOString()});
    $('authTenantId').value=tenant;$('authStatus').className='ok';$('authStatus').textContent='已建立/更新帳號並登入：'+org+'｜'+user;$('authMsg').textContent='帳號已建立，後續操作會自動帶入此帳號資料。';
    if(typeof renderSaaSPanel==='function')renderSaaSPanel();
  };
  window.govopsLogin=function(){
    var org=$('authOrgName').value.trim();var user=$('authUserId').value.trim();
    if(!org||!user){$('authMsg').textContent='請輸入已註冊的組織名稱與帳號。';return}
    window.govopsRegisterLocal();
    $('authMsg').textContent='登入成功。';
  };
  window.govopsLogout=function(){
    logout();$('authStatus').className='warn';$('authStatus').textContent='已登出。';$('authMsg').textContent='已登出，目前不會帶入任何帳號資料。';
    if(typeof renderSaaSPanel==='function')renderSaaSPanel();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
