/* 知己知途｜專案活動管理系統｜活動異動中心補丁
 * 用法：在 index-integrated.html </body> 前引入：
 * <script src="./index-change-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]})}
  function sectionHtml(){return `
<section id="change-center" class="card span12">
  <h2>活動異動中心</h2>
  <div class="hint">活動辦理中若臨時改時間、改地點、換講師、延期或取消，請在這裡建立異動紀錄，再套用到場次並通知學員／講師／工作人員。不要直接覆蓋原始資料，才有完整歷程可追蹤。</div>
  <div class="row">
    <div><label>專案ID</label><input id="chgProjectId" placeholder="可填專案ID"></div>
    <div><label>場次ID / 活動ID</label><input id="chgEventId" placeholder="必填：要異動的場次ID"></div>
  </div>
  <div class="row">
    <div><label>異動類型</label><select id="chgType"><option>時間異動</option><option>地點異動</option><option>講師異動</option><option>課程內容異動</option><option>餐點異動</option><option>報到方式異動</option><option>取消活動</option><option>延期活動</option><option>其他</option></select></div>
    <div><label>異動人員</label><input id="chgUser" placeholder="例：珍珠老師 / 行政人員"></div>
  </div>
  <label>原內容</label><textarea id="chgOld" placeholder="例：原時間 5/25 09:00-12:00；原地點：田中婦女中心"></textarea>
  <label>新內容</label><textarea id="chgNew" placeholder="例：改為 5/25 13:00-16:00；改到彰化縣OO教室"></textarea>
  <label>異動原因</label><textarea id="chgReason" placeholder="例：講師交通延誤、場地臨時無法使用、報名人數調整"></textarea>
  <div class="row">
    <div><label>通知學員</label><select id="chgNotifyStudents"><option>是</option><option>否</option></select></div>
    <div><label>通知老師</label><select id="chgNotifyTeacher"><option>是</option><option>否</option></select></div>
  </div>
  <label>通知工作人員</label><select id="chgNotifyStaff"><option>否</option><option>是</option></select>
  <div class="btns">
    <button class="green" onclick="chgCreate()">建立異動紀錄</button>
    <button onclick="chgQuery()">查詢本場異動</button>
    <button onclick="chgSummary()">異動摘要</button>
  </div>
  <div class="row">
    <div><label>異動ID</label><input id="chgId" placeholder="建立異動後填入，或手動貼上"></div>
    <div><label>後續處理</label><div class="btns"><button class="secondary" onclick="chgApply()">套用到場次</button><button class="green" onclick="chgNotify()">發送異動通知</button></div></div>
  </div>
  <div id="changeMsg" class="msg">尚未操作。</div>
  <div id="changeTable"></div>
</section>`}
  function init(){
    var grid=document.querySelector('main .grid');
    if(grid && !$('change-center')){
      var exec=$('execution-center');
      if(exec) exec.insertAdjacentHTML('afterend', sectionHtml()); else grid.insertAdjacentHTML('beforeend', sectionHtml());
    }
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#change-center"]')) topnav.insertAdjacentHTML('beforeend','<a href="#change-center">異動</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#change-center"]')) footer.insertAdjacentHTML('beforeend','<a href="#change-center">異動</a>');
  }
  function params(extra){return Object.assign({
    專案ID:$('chgProjectId')?$('chgProjectId').value:'', projectId:$('chgProjectId')?$('chgProjectId').value:'',
    場次ID:$('chgEventId')?$('chgEventId').value:'', 活動ID:$('chgEventId')?$('chgEventId').value:'', eventId:$('chgEventId')?$('chgEventId').value:'', activityId:$('chgEventId')?$('chgEventId').value:'',
    異動ID:$('chgId')?$('chgId').value:'', changeId:$('chgId')?$('chgId').value:'',
    異動類型:$('chgType')?$('chgType').value:'', changeType:$('chgType')?$('chgType').value:'',
    原內容:$('chgOld')?$('chgOld').value:'', oldValue:$('chgOld')?$('chgOld').value:'',
    新內容:$('chgNew')?$('chgNew').value:'', newValue:$('chgNew')?$('chgNew').value:'',
    異動原因:$('chgReason')?$('chgReason').value:'', reason:$('chgReason')?$('chgReason').value:'',
    是否通知學員:$('chgNotifyStudents')?$('chgNotifyStudents').value:'', notifyStudents:$('chgNotifyStudents')?$('chgNotifyStudents').value:'',
    是否通知老師:$('chgNotifyTeacher')?$('chgNotifyTeacher').value:'', notifyTeacher:$('chgNotifyTeacher')?$('chgNotifyTeacher').value:'',
    是否通知工作人員:$('chgNotifyStaff')?$('chgNotifyStaff').value:'', notifyStaff:$('chgNotifyStaff')?$('chgNotifyStaff').value:'',
    異動人員:$('chgUser')?$('chgUser').value:''
  },extra||{})}
  async function call(action,extra){if(typeof api!=='function'){ $('changeMsg').textContent='找不到後端 API 函式，請確認前端 api() 已載入。'; return {success:false}; } return await api(Object.assign(params(extra),{action:action}),'changeMsg')}
  function table(rows){rows=rows||[]; if(!rows.length)return'<div class="msg">查無異動資料</div>'; var keys=Object.keys(rows[0]).filter(function(k){return k!=='_row'&&k!=='raw'}).slice(0,12); return '<table><thead><tr>'+keys.map(function(k){return '<th>'+safe(k)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.slice(0,100).map(function(r){return '<tr>'+keys.map(function(k){var v=r[k]; if(typeof v==='object')v=JSON.stringify(v); return '<td>'+safe(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'}
  function showData(r){if(!r||!r.data)return; if(r.data.change&&r.data.change.異動ID&&$('chgId'))$('chgId').value=r.data.change.異動ID; if(r.data.rows)$('changeTable').innerHTML=table(r.data.rows); else if(r.data.checks)$('changeTable').innerHTML=table(r.data.checks); else $('changeTable').innerHTML='<div class="msg">'+safe(JSON.stringify(r.data,null,2))+'</div>'}
  window.chgCreate=async function(){if(!$('chgEventId').value){$('changeMsg').textContent='請先填寫場次ID / 活動ID。';return} var r=await call('change.create'); showData(r)};
  window.chgQuery=async function(){var r=await call('change.queryByEvent'); showData(r)};
  window.chgSummary=async function(){var r=await call('change.summary'); showData(r)};
  window.chgApply=async function(){if(!$('chgId').value){$('changeMsg').textContent='請先填寫異動ID。';return} var r=await call('change.applyToEvent'); showData(r)};
  window.chgNotify=async function(){if(!$('chgId').value){$('changeMsg').textContent='請先填寫異動ID。';return} var r=await call('change.notify'); showData(r)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();