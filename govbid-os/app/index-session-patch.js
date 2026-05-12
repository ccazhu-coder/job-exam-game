/* GovOps OS｜index.html 多場次管理補丁
 * 用法：在 index.html </body> 前引入：
 * <script src="./index-session-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})}
  function sectionHtml(){return `
<section id="session-management" class="card span12">
  <h2>場次管理</h2>
  <div class="hint">一個專案可以有多場活動或課程。請先選專案，再建立各場次；後續招生、報名、CRM、任務、執行、財務、核銷都可依場次操作。</div>
  <div class="row">
    <div><label>專案ID</label><input id="smProjectId" placeholder="請輸入或由專案管理帶入"></div>
    <div><label>目前場次ID</label><input id="smEventId" placeholder="建立或選定場次後自動帶入"></div>
  </div>
  <label>場次 / 課程名稱＊</label><input id="smEventName" placeholder="例：第一場履歷課、第二場AI工具課">
  <div class="row">
    <div><label>場次日期＊</label><input id="smEventDate" type="date"></div>
    <div><label>場次類型</label><select id="smEventType"><option>課程</option><option>講座</option><option>工作坊</option><option>說明會</option><option>企業參訪</option><option>成果展</option><option>其他</option></select></div>
  </div>
  <div class="row">
    <div><label>開始時間</label><input id="smStartTime" type="time" value="09:00"></div>
    <div><label>結束時間</label><input id="smEndTime" type="time" value="12:00"></div>
  </div>
  <div class="row">
    <div><label>場次地點</label><input id="smLocation"></div>
    <div><label>講師</label><input id="smTeacher"></div>
  </div>
  <div class="row">
    <div><label>預計招生人數</label><input id="smQuota" type="number" min="0"></div>
    <div><label>場次狀態</label><select id="smStatus"><option>規劃中</option><option>招生中</option><option>已額滿</option><option>執行中</option><option>已完成</option><option>已取消</option></select></div>
  </div>
  <label>場次備註</label><textarea id="smNote"></textarea>
  <div class="btns">
    <button class="green" onclick="smCreateEvent()">新增場次</button>
    <button onclick="smCreateEventAndRegistration()">新增場次＋建立招生設定</button>
    <button class="secondary" onclick="smQueryEvents()">查詢此專案所有場次</button>
    <button class="secondary" onclick="smSelectCurrentEvent()">選定目前場次</button>
  </div>
  <div id="sessionMsg" class="msg">尚未操作。</div>
  <div id="sessionTable"></div>
</section>`}
  function init(){
    var grid=document.querySelector('main .grid');
    if(grid && !$('session-management')){
      var pm=$('project-management');
      if(pm) pm.insertAdjacentHTML('afterend', sectionHtml()); else grid.insertAdjacentHTML('afterbegin', sectionHtml());
    }
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#session-management"]')) topnav.insertAdjacentHTML('beforeend','<a href="#session-management">場次</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#session-management"]')) footer.insertAdjacentHTML('beforeend','<a href="#session-management">場次</a>');
  }
  function params(extra){return Object.assign({
    專案ID:$('smProjectId')?$('smProjectId').value:'',
    projectId:$('smProjectId')?$('smProjectId').value:'',
    場次ID:$('smEventId')?$('smEventId').value:'',
    eventId:$('smEventId')?$('smEventId').value:'',
    活動ID:$('smEventId')?$('smEventId').value:'',
    activityId:$('smEventId')?$('smEventId').value:'',
    活動名稱:$('smEventName')?$('smEventName').value:'',
    場次名稱:$('smEventName')?$('smEventName').value:'',
    活動日期:$('smEventDate')?$('smEventDate').value:'',
    場次日期:$('smEventDate')?$('smEventDate').value:'',
    場次類型:$('smEventType')?$('smEventType').value:'',
    開始時間:$('smStartTime')?$('smStartTime').value:'',
    結束時間:$('smEndTime')?$('smEndTime').value:'',
    地點:$('smLocation')?$('smLocation').value:'',
    活動地點:$('smLocation')?$('smLocation').value:'',
    講師:$('smTeacher')?$('smTeacher').value:'',
    招生人數:$('smQuota')?$('smQuota').value:'',
    預計人數:$('smQuota')?$('smQuota').value:'',
    場次狀態:$('smStatus')?$('smStatus').value:'',
    備註:$('smNote')?$('smNote').value:''
  },extra||{})}
  async function call(action,extra){if(typeof api!=='function'){ $('sessionMsg').textContent='找不到後端 API 函式，請確認 index.html 原始程式已載入。'; return {success:false}; } return await api(Object.assign(params(extra),{action:action}),'sessionMsg')}
  function table(rows){rows=rows||[]; if(!rows.length)return'<div class="msg">查無場次</div>'; var keys=Object.keys(rows[0]).filter(function(k){return k!=='_row'&&k!=='raw'}).slice(0,9); return '<table><thead><tr>'+keys.map(function(k){return '<th>'+safe(k)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.slice(0,80).map(function(r){return '<tr>'+keys.map(function(k){var v=r[k]; if(typeof v==='object')v=JSON.stringify(v); return '<td>'+safe(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'}
  function propagateEvent(eventId,projectId){
    ['activityId','regActivityId','taskActivityId','itemActivityId','signActivityId','checkActivityId','driveActivityId','execActivityId','closeActivityId','finActivityId'].forEach(function(id){if($(id)&&eventId)$(id).value=eventId});
    if($('responseSheetName')&&!$('responseSheetName').value)$('responseSheetName').value='Form_Responses';
    if($('projectName')&&projectId&&!$('projectName').value)$('projectName').value=projectId;
  }
  window.smCreateEvent=async function(){if(!$('smProjectId').value){$('sessionMsg').textContent='請先輸入專案ID。';return} if(!$('smEventName').value){$('sessionMsg').textContent='請先填寫場次/課程名稱。';return} var r=await call('project.createEvent'); if(r&&r.success&&r.data){var ev=r.data.event||r.data; var id=ev.場次ID||ev.活動ID||ev.eventId||ev.id||$('smEventId').value; if(id){$('smEventId').value=id; propagateEvent(id,$('smProjectId').value)}}};
  window.smCreateEventAndRegistration=async function(){await window.smCreateEvent(); if($('smEventId').value){await call('project.createRegistration')}};
  window.smQueryEvents=async function(){if(!$('smProjectId').value){$('sessionMsg').textContent='請先輸入專案ID。';return} var r=await call('project.event.queryByProject'); if(!(r&&r.success&&r.data&&((r.data.rows||r.data.events||[]).length))){r=await call('project.detail.get')} if(r&&r.success&&r.data){var rows=r.data.rows||r.data.events||(r.data.detail&&r.data.detail.events)||[]; $('sessionTable').innerHTML=table(rows)}};
  window.smSelectCurrentEvent=function(){var id=$('smEventId').value; if(!id){$('sessionMsg').textContent='請先輸入或建立場次ID。';return} propagateEvent(id,$('smProjectId').value); $('sessionMsg').textContent='已選定目前場次：'+id+'\n後續招生、報名、任務、執行、財務、核銷會優先使用此場次。'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
