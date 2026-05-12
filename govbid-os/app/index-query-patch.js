/* GovOps OS｜index.html 計畫與活動查詢中心補丁
 * 用法：在 index.html </body> 前引入：
 * <script src="./index-query-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})}
  function sectionHtml(){return `
<section id="plan-activity-query" class="card span12">
  <h2>計畫 / 專案 / 活動查詢</h2>
  <div class="hint">可查詢計畫、專案、政府標案、自辦課程、合作課程、企業委託與各專案底下的所有活動/場次。</div>
  <div class="row">
    <div><label>查詢類型</label><select id="qaType"><option>全部</option><option>計畫/專案</option><option>活動/場次</option><option>政府標案</option><option>自辦課程</option><option>合作課程</option><option>企業委託</option></select></div>
    <div><label>關鍵字</label><input id="qaKeyword" placeholder="計畫名稱、活動名稱、機關、講師、地點"></div>
  </div>
  <div class="row">
    <div><label>開始日期</label><input id="qaStart" type="date"></div>
    <div><label>結束日期</label><input id="qaEnd" type="date"></div>
  </div>
  <div class="row">
    <div><label>專案ID</label><input id="qaProjectId" placeholder="查詢某專案底下所有場次時使用"></div>
    <div><label>活動/場次狀態</label><select id="qaStatus"><option></option><option>規劃中</option><option>招生中</option><option>執行中</option><option>已完成</option><option>已結案</option><option>已取消</option></select></div>
  </div>
  <div class="btns">
    <button onclick="qaSearchAll()">查詢全部</button>
    <button onclick="qaSearchProjects()">查詢計畫/專案</button>
    <button onclick="qaSearchActivities()">查詢活動/場次</button>
    <button class="secondary" onclick="qaSearchProjectEvents()">查詢此專案所有場次</button>
    <button class="secondary" onclick="qaTodayActivities()">今日活動</button>
    <button class="secondary" onclick="qaUpcomingActivities()">近期活動</button>
  </div>
  <div id="qaMsg" class="msg">尚未查詢。</div>
  <div id="qaTable"></div>
</section>`}
  function init(){
    var grid=document.querySelector('main .grid');
    if(grid && !$('plan-activity-query')) grid.insertAdjacentHTML('afterbegin', sectionHtml());
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#plan-activity-query"]')) topnav.insertAdjacentHTML('beforeend','<a href="#plan-activity-query">計畫查詢</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#plan-activity-query"]')) footer.insertAdjacentHTML('beforeend','<a href="#plan-activity-query">查計畫</a>');
  }
  function params(extra){return Object.assign({
    查詢類型:$('qaType')?$('qaType').value:'',
    keyword:$('qaKeyword')?$('qaKeyword').value:'',
    關鍵字:$('qaKeyword')?$('qaKeyword').value:'',
    開始日期:$('qaStart')?$('qaStart').value:'',
    結束日期:$('qaEnd')?$('qaEnd').value:'',
    專案ID:$('qaProjectId')?$('qaProjectId').value:'',
    projectId:$('qaProjectId')?$('qaProjectId').value:'',
    狀態:$('qaStatus')?$('qaStatus').value:''
  },extra||{})}
  async function call(action,extra){if(typeof api!=='function'){ $('qaMsg').textContent='找不到後端 API 函式，請確認 index.html 原始程式已載入。'; return {success:false}; } return await api(Object.assign(params(extra),{action:action}),'qaMsg')}
  function table(rows){rows=rows||[]; if(!rows.length)return'<div class="msg">查無資料</div>'; var keys=Object.keys(rows[0]).filter(function(k){return k!=='_row'&&k!=='raw'}).slice(0,10); return '<table><thead><tr>'+keys.map(function(k){return '<th>'+safe(k)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.slice(0,100).map(function(r){return '<tr>'+keys.map(function(k){var v=r[k]; if(typeof v==='object')v=JSON.stringify(v); return '<td>'+safe(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'}
  function rowsFrom(r){if(!r||!r.data)return[]; return r.data.rows||r.data.results||r.data.events||r.data.projects||r.data||[]}
  window.qaSearchProjects=async function(){var r=await call('project.query'); if(r&&r.success)$('qaTable').innerHTML=table(rowsFrom(r))};
  window.qaSearchActivities=async function(){var r=await call('activity.query'); if(!(r&&r.success&&rowsFrom(r).length)) r=await call('查詢活動'); if(r&&r.success)$('qaTable').innerHTML=table(rowsFrom(r))};
  window.qaSearchProjectEvents=async function(){var r=await call('project.event.queryByProject'); if(!(r&&r.success&&rowsFrom(r).length)) r=await call('project.detail.get'); if(r&&r.success){var rows=rowsFrom(r); if(r.data&&r.data.detail&&r.data.detail.events)rows=r.data.detail.events; $('qaTable').innerHTML=table(rows)}};
  window.qaSearchAll=async function(){
    var p=await call('project.query');
    var a=await call('activity.query');
    var html='<h3>計畫 / 專案</h3>'+table((p&&p.success)?rowsFrom(p):[])+'<h3>活動 / 場次</h3>'+table((a&&a.success)?rowsFrom(a):[]);
    $('qaTable').innerHTML=html;
  };
  window.qaTodayActivities=async function(){var r=await call('查詢今日活動'); if(r&&r.success)$('qaTable').innerHTML=table(rowsFrom(r))};
  window.qaUpcomingActivities=async function(){var r=await call('查詢近期活動'); if(!(r&&r.success&&rowsFrom(r).length)) r=await call('activity.query',{scope:'upcoming'}); if(r&&r.success)$('qaTable').innerHTML=table(rowsFrom(r))};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
