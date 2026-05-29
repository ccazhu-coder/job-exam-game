(function(){
  'use strict';
  var page = document.body.getAttribute('data-page') || '';
  var state = { session: null, projects: [], activities: [] };

  function $(id){ return document.getElementById(id); }
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function read(k){ try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch(e){ return {}; } }
  function token(){ var auth = read('govops_auth'); return String(auth.sessionToken || auth.token || ''); }
  function ctx(){ return { tenantId: state.session.tenantId, userId: state.session.userId, userRole: state.session.role || state.session.userRole, plan: state.session.plan, sessionToken: state.session.sessionToken }; }
  function msg(text){ var el = $('msg'); if (el) el.textContent = text || ''; }
  function friendly(res){ return (res && res.message) || '目前資料處理較慢，請稍後再試。'; }
  function goLogin(){ location.href = './login.html?redirect=' + encodeURIComponent(location.pathname.split('/').pop() || 'dashboard.html'); }

  function installStyle(){
    var css = ':root{--panel:#fffdf9;--ink:#162033;--muted:#667085;--line:#e5ded2;--navy:#0d2340;--gold:#b8963e;--red:#b83a2f;--soft:#fbf8f1}*{box-sizing:border-box}body{margin:0;background:#f6f2ea;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC","Microsoft JhengHei",sans-serif}.wrap{max-width:1180px;margin:auto;padding:22px 16px 42px}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}h1{margin:0 0 8px;color:var(--navy);font-size:2rem}.sub{color:var(--muted);line-height:1.6}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a,.nav button{border:1px solid var(--line);background:#fff;color:var(--navy);border-radius:8px;padding:10px 12px;text-decoration:none;font-weight:900;cursor:pointer}.nav .danger{color:var(--red)}.grid{display:grid;grid-template-columns:360px 1fr;gap:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;box-shadow:0 8px 22px rgba(13,35,64,.07)}h2{margin:0 0 14px;color:var(--navy);font-size:1.15rem}label{display:block;font-weight:900;margin:10px 0 6px;color:var(--navy)}input,select{width:100%;border:1px solid var(--line);border-radius:8px;padding:11px;font-size:1rem;background:#fff}button.primary{width:100%;margin-top:14px;border:0;background:var(--navy);color:#fff;border-radius:8px;padding:12px;font-weight:900;cursor:pointer}.msg{margin-top:12px;border:1px dashed var(--line);border-radius:8px;background:var(--soft);padding:12px;color:var(--muted);line-height:1.6}.table{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:#fff}table{width:100%;min-width:860px;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:.93rem}th{background:var(--soft);color:var(--navy)}.empty{padding:18px;color:var(--muted);font-weight:900}.hidden{display:none!important}@media(max-width:860px){.top{display:block}.nav{margin-top:12px}.grid{grid-template-columns:1fr}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  async function guard(){
    var t = token();
    if (!t || t.indexOf('LOCAL'+'-DEMO-') === 0) goLogin();
    var res = await GovOpsAPI.post({ action: 'auth.me', sessionToken: t });
    if (!res || !res.success) goLogin();
    state.session = Object.assign({}, res.data || {}, { sessionToken: t });
    $('app').classList.remove('hidden');
  }

  async function logout(){
    try { await GovOpsAPI.post({ action: 'auth.logout', sessionToken: token() }); } catch(e){}
    localStorage.removeItem('govops_auth');
    localStorage.removeItem('govops_profile');
    location.href = './login.html';
  }

  async function request(data){
    return await GovOpsAPI.post(Object.assign({}, data, ctx()));
  }

  async function loadProjects(){
    var res = await request({ action: 'project.list' });
    state.projects = (res && res.data && res.data.rows) || [];
    return state.projects;
  }

  async function loadActivities(projectId){
    var data = { action: 'activity.list' };
    if (projectId) data.projectId = projectId;
    var res = await request(data);
    state.activities = (res && res.data && res.data.rows) || [];
    return state.activities;
  }

  function projectOptions(selected){
    return state.projects.map(function(p){ return '<option value="'+esc(p.projectId)+'" '+(String(selected||'')===String(p.projectId)?'selected':'')+'>'+esc(p.projectId+'｜'+(p.projectName||'未命名專案'))+'</option>'; }).join('');
  }

  function activityOptions(selected){
    return state.activities.map(function(a){ return '<option value="'+esc(a.activityId)+'" '+(String(selected||'')===String(a.activityId)?'selected':'')+'>'+esc(a.activityId+'｜'+(a.activityName||'未命名活動'))+'</option>'; }).join('');
  }

  function table(rows, columns){
    if (!rows || !rows.length) return '<div class="empty">目前尚無資料</div>';
    return '<table><thead><tr>'+columns.map(function(c){return '<th>'+esc(c.label)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+columns.map(function(c){return '<td>'+esc(r[c.key])+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';
  }

  function shell(title, sub, formHtml, listTitle){
    document.body.innerHTML = '<main class="wrap"><section class="top"><div><h1>'+esc(title)+'</h1><div class="sub">'+esc(sub)+'</div></div><div class="nav"><a href="./dashboard.html">回營運首頁</a><button class="danger" id="logoutBtn">登出</button></div></section><section class="grid hidden" id="app"><article class="card">'+formHtml+'<div class="msg" id="msg">資料載入中</div></article><article class="card"><h2>'+esc(listTitle)+'</h2><div class="table" id="table"><div class="empty">資料載入中</div></div></article></section></main>';
    $('logoutBtn').addEventListener('click', logout);
  }

  async function initProjects(){
    shell('專案管理','查看與新增專案，專案是活動與後續作業資料的母體。','<h2>新增專案</h2><label>專案名稱</label><input id="projectName"><label>機關 / 客戶</label><input id="clientId"><label>專案狀態</label><select id="projectStatus"><option>執行中</option><option>籌備中</option><option>已結案</option><option>已取消</option></select><label>開始日期</label><input id="projectStartDate" type="date"><label>結束日期</label><input id="projectEndDate" type="date"><button class="primary" id="createBtn">建立專案</button>','專案列表');
    await guard();
    $('createBtn').addEventListener('click', async function(){
      if (!$('projectName').value.trim()) { msg('請輸入專案名稱。'); return; }
      msg('資料儲存中');
      var res = await request({ action:'project.create', projectName:$('projectName').value.trim(), clientId:$('clientId').value.trim(), projectStatus:$('projectStatus').value, projectStartDate:$('projectStartDate').value, projectEndDate:$('projectEndDate').value });
      msg(friendly(res));
      if (res && res.success) { $('projectName').value=''; await renderProjects(); }
    });
    await renderProjects();
  }

  async function renderProjects(){
    var rows = await loadProjects();
    $('table').innerHTML = table(rows, [{key:'projectId',label:'projectId'},{key:'projectName',label:'專案名稱'},{key:'clientId',label:'機關 / 客戶'},{key:'projectStatus',label:'狀態'},{key:'projectStartDate',label:'開始日期'},{key:'projectEndDate',label:'結束日期'}]);
    msg('專案資料已載入。');
  }

  async function initActivities(){
    shell('活動管理','查看與新增活動，活動必須綁定所屬專案。','<h2>新增活動</h2><label>所屬專案</label><select id="projectId"></select><label>活動名稱</label><input id="activityName"><label>活動日期</label><input id="activityDate" type="date"><label>地點</label><input id="locationId"><label>活動狀態</label><select id="activityStatus"><option>籌備中</option><option>執行中</option><option>已完成</option><option>已取消</option></select><button class="primary" id="createBtn">建立活動</button>','活動列表');
    await guard();
    await loadProjects();
    $('projectId').innerHTML = '<option value="">請選擇專案</option>' + projectOptions();
    $('projectId').addEventListener('change', renderActivities);
    $('createBtn').addEventListener('click', async function(){
      if (!$('projectId').value) { msg('新增活動必須選擇所屬專案。'); return; }
      if (!$('activityName').value.trim()) { msg('請輸入活動名稱。'); return; }
      msg('資料儲存中');
      var res = await request({ action:'activity.create', projectId:$('projectId').value, activityName:$('activityName').value.trim(), activityDate:$('activityDate').value, locationId:$('locationId').value.trim(), activityStatus:$('activityStatus').value });
      msg(friendly(res));
      if (res && res.success) { $('activityName').value=''; await renderActivities(); }
    });
    await renderActivities();
  }

  async function renderActivities(){
    var rows = await loadActivities($('projectId') ? $('projectId').value : '');
    $('table').innerHTML = table(rows, [{key:'activityId',label:'activityId'},{key:'projectId',label:'projectId'},{key:'activityName',label:'活動名稱'},{key:'activityDate',label:'日期'},{key:'locationId',label:'地點'},{key:'activityStatus',label:'狀態'}]);
    msg(rows.length ? '活動資料已載入。' : '目前尚無資料');
  }

  async function initTasks(){
    shell('任務 / 缺件追蹤','新增與查看活動任務、缺件與待處理事項。','<h2>新增任務</h2><label>所屬專案</label><select id="projectId"></select><label>所屬活動</label><select id="activityId"></select><label>任務 / 缺件名稱</label><input id="taskName"><label>狀態</label><select id="taskStatus"><option>待處理</option><option>處理中</option><option>已完成</option></select><label>期限</label><input id="dueAt" type="date"><button class="primary" id="createBtn">新增任務</button>','任務 / 缺件列表');
    await guard();
    await loadProjects();
    $('projectId').innerHTML = '<option value="">請選擇專案</option>' + projectOptions();
    $('projectId').addEventListener('change', async function(){ await loadActivities($('projectId').value); $('activityId').innerHTML='<option value="">請選擇活動</option>'+activityOptions(); await renderChildren('activity.task'); });
    $('activityId').addEventListener('change', function(){ renderChildren('activity.task'); });
    $('createBtn').addEventListener('click', async function(){
      if (!$('projectId').value) { msg('任務必須選擇所屬專案。'); return; }
      if (!$('activityId').value) { msg('任務必須選擇所屬活動。'); return; }
      if (!$('taskName').value.trim()) { msg('請輸入任務或缺件名稱。'); return; }
      msg('資料儲存中');
      var res = await request({ action:'activity.child.create', childType:'activity.task', projectId:$('projectId').value, activityId:$('activityId').value, taskName:$('taskName').value.trim(), taskStatus:$('taskStatus').value, dueAt:$('dueAt').value });
      msg(friendly(res));
      if (res && res.success) { $('taskName').value=''; await renderChildren('activity.task'); }
    });
    msg('請先選擇專案與活動。');
    $('table').innerHTML='<div class="empty">目前尚無資料</div>';
  }

  async function initDocuments(){
    shell('文件 / 領據','建立與查看活動文件、領據、簽到表與任務表紀錄。','<h2>新增文件紀錄</h2><label>所屬專案</label><select id="projectId"></select><label>所屬活動</label><select id="activityId"></select><label>文件類型</label><select id="documentType"><option>領據</option><option>簽到表</option><option>任務表</option><option>核銷附件</option><option>成果資料</option></select><label>文件名稱</label><input id="documentName"><label>狀態</label><select id="documentStatus"><option>待收件</option><option>已收件</option><option>需補件</option></select><button class="primary" id="createBtn">建立文件紀錄</button>','文件 / 領據列表');
    await guard();
    await loadProjects();
    $('projectId').innerHTML = '<option value="">請選擇專案</option>' + projectOptions();
    $('projectId').addEventListener('change', async function(){ await loadActivities($('projectId').value); $('activityId').innerHTML='<option value="">請選擇活動</option>'+activityOptions(); await renderChildren('document.output'); });
    $('activityId').addEventListener('change', function(){ renderChildren('document.output'); });
    $('createBtn').addEventListener('click', async function(){
      if (!$('projectId').value) { msg('文件必須選擇所屬專案。'); return; }
      if (!$('activityId').value) { msg('文件必須選擇所屬活動。'); return; }
      if (!$('documentName').value.trim()) { msg('請輸入文件名稱。'); return; }
      msg('資料儲存中');
      var res = await request({ action:'activity.child.create', childType:'document.output', projectId:$('projectId').value, activityId:$('activityId').value, documentType:$('documentType').value, documentName:$('documentName').value.trim(), documentStatus:$('documentStatus').value });
      msg(friendly(res));
      if (res && res.success) { $('documentName').value=''; await renderChildren('document.output'); }
    });
    msg('請先選擇專案與活動。');
    $('table').innerHTML='<div class="empty">目前尚無資料</div>';
  }

  async function renderChildren(childType){
    if (!$('activityId') || !$('activityId').value) { $('table').innerHTML='<div class="empty">目前尚無資料</div>'; return; }
    var res = await request({ action:'activity.child.list', childType:childType, projectId:$('projectId').value, activityId:$('activityId').value });
    var rows = (res && res.data && res.data.rows) || [];
    var cols = childType === 'activity.task'
      ? [{key:'taskId',label:'taskId'},{key:'projectId',label:'projectId'},{key:'activityId',label:'activityId'},{key:'taskName',label:'任務 / 缺件'},{key:'taskStatus',label:'狀態'},{key:'dueAt',label:'期限'}]
      : [{key:'documentId',label:'documentId'},{key:'projectId',label:'projectId'},{key:'activityId',label:'activityId'},{key:'documentType',label:'文件類型'},{key:'documentName',label:'文件名稱'},{key:'documentStatus',label:'狀態'}];
    $('table').innerHTML = table(rows, cols);
    msg(rows.length ? '資料已載入。' : '目前尚無資料');
  }

  installStyle();
  if (page === 'projects') initProjects().catch(goLogin);
  if (page === 'activities') initActivities().catch(goLogin);
  if (page === 'tasks') initTasks().catch(goLogin);
  if (page === 'documents') initDocuments().catch(goLogin);
})();
