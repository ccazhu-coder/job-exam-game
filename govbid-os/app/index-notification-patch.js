/* GovOps OS｜index.html 通知中心補丁
 * 用法：在 index.html </body> 前引入：
 * <script src="./index-notification-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'amp;'}[c]||c})}
  function sectionHtml(){return `
<section id="notification-center" class="card span12">
  <h2>通知中心｜錄取通知 / 開課前1天通知</h2>
  <div class="hint">先設定寄件模板，系統會依目前活動或場次統一寄送，減少逐一通知學員與老師的工作。</div>
  <div class="row">
    <div><label>系統活動編號 / 場次ID</label><input id="ntActivityId" placeholder="可填活動ID或場次ID"></div>
    <div><label>通知對象</label><select id="ntAudience"><option>已入選學員</option><option>候補學員</option><option>未錄取學員</option><option>開課前1天學員</option><option>開課前1天老師</option></select></div>
  </div>
  <div class="row">
    <div><label>寄件模板類型</label><select id="ntTemplateType"><option>錄取通知</option><option>候補通知</option><option>未錄取通知</option><option>開課前1天通知學生</option><option>開課前1天通知老師</option></select></div>
    <div><label>寄件狀態</label><select id="ntSendMode"><option>先預覽不寄送</option><option>立即批次寄送</option></select></div>
  </div>
  <label>Email 主旨</label><input id="ntSubject" placeholder="例：【錄取通知】{{活動名稱}} 課程錄取通知">
  <label>Email 內容模板</label><textarea id="ntBody" style="min-height:180px" placeholder="可使用變數：{{姓名}}、{{活動名稱}}、{{活動日期}}、{{開始時間}}、{{結束時間}}、{{活動地點}}、{{講師}}、{{主辦單位}}、{{備註}}"></textarea>
  <div class="btns">
    <button onclick="ntLoadDefaultTemplate()">載入預設模板</button>
    <button onclick="ntSaveTemplate()">儲存模板</button>
    <button class="secondary" onclick="ntPreviewList()">預覽收件名單</button>
    <button class="green" onclick="ntBatchSend()">系統統一寄送</button>
    <button class="secondary" onclick="ntSendLog()">查看寄送紀錄</button>
  </div>
  <div id="notificationMsg" class="msg">尚未操作。</div>
  <div id="notificationTable"></div>
</section>`}
  function init(){
    var grid=document.querySelector('main .grid');
    if(grid && !$('notification-center')) grid.insertAdjacentHTML('beforeend', sectionHtml());
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#notification-center"]')) topnav.insertAdjacentHTML('beforeend','<a href="#notification-center">通知</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#notification-center"]')) footer.insertAdjacentHTML('beforeend','<a href="#notification-center">通知</a>');
    ntLoadDefaultTemplate();
  }
  function defaults(type){
    var m={
      '錄取通知':{s:'【錄取通知】{{活動名稱}} 課程錄取通知',b:'{{姓名}} 您好：\n\n恭喜您已錄取「{{活動名稱}}」。\n\n課程資訊如下：\n日期：{{活動日期}}\n時間：{{開始時間}}－{{結束時間}}\n地點：{{活動地點}}\n講師：{{講師}}\n\n請依通知時間準時報到，如不克參加，請提前回覆主辦單位。\n\n主辦單位：{{主辦單位}}'},
      '候補通知':{s:'【候補通知】{{活動名稱}} 候補通知',b:'{{姓名}} 您好：\n\n您目前為「{{活動名稱}}」候補名單。若有名額釋出，主辦單位將再通知您。\n\n感謝您的報名。'},
      '未錄取通知':{s:'【報名結果通知】{{活動名稱}}',b:'{{姓名}} 您好：\n\n感謝您報名「{{活動名稱}}」。本次因名額或資格條件限制，未能錄取您參加。\n\n後續若有相關課程或活動，歡迎持續關注。'},
      '開課前1天通知學生':{s:'【課前提醒】{{活動名稱}} 明天開課提醒',b:'{{姓名}} 您好：\n\n提醒您明天將參加「{{活動名稱}}」。\n\n日期：{{活動日期}}\n時間：{{開始時間}}－{{結束時間}}\n地點：{{活動地點}}\n講師：{{講師}}\n\n請準時報到，並攜帶個人物品。期待與您見面。'},
      '開課前1天通知老師':{s:'【講師課前提醒】{{活動名稱}} 明日授課提醒',b:'{{講師}} 老師您好：\n\n提醒您明天有「{{活動名稱}}」授課行程。\n\n日期：{{活動日期}}\n時間：{{開始時間}}－{{結束時間}}\n地點：{{活動地點}}\n\n若有教材、設備或交通需求，請提前與主辦單位確認。'}
    };
    return m[type]||m['錄取通知'];
  }
  function params(extra){return Object.assign({
    activityId:$('ntActivityId')?$('ntActivityId').value:'',
    活動ID:$('ntActivityId')?$('ntActivityId').value:'',
    場次ID:$('ntActivityId')?$('ntActivityId').value:'',
    通知對象:$('ntAudience')?$('ntAudience').value:'',
    模板類型:$('ntTemplateType')?$('ntTemplateType').value:'',
    寄送模式:$('ntSendMode')?$('ntSendMode').value:'',
    Email主旨:$('ntSubject')?$('ntSubject').value:'',
    Email內容:$('ntBody')?$('ntBody').value:''
  },extra||{})}
  async function call(action,extra){if(typeof api!=='function'){ $('notificationMsg').textContent='找不到後端 API 函式，請確認 index.html 原始程式已載入。'; return {success:false}; } return await api(Object.assign(params(extra),{action:action}),'notificationMsg')}
  function table(rows){rows=rows||[]; if(!rows.length)return'<div class="msg">無資料</div>'; var keys=Object.keys(rows[0]).filter(function(k){return k!=='_row'&&k!=='raw'}).slice(0,8); return '<table><thead><tr>'+keys.map(function(k){return '<th>'+safe(k)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.slice(0,100).map(function(r){return '<tr>'+keys.map(function(k){var v=r[k]; if(typeof v==='object')v=JSON.stringify(v); return '<td>'+safe(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'}
  window.ntLoadDefaultTemplate=function(){var d=defaults($('ntTemplateType')?$('ntTemplateType').value:'錄取通知'); if($('ntSubject'))$('ntSubject').value=d.s; if($('ntBody'))$('ntBody').value=d.b;};
  window.ntSaveTemplate=function(){return call('notification.template.save')};
  window.ntPreviewList=async function(){var r=await call('notification.recipient.preview'); if(r&&r.success&&r.data)$('notificationTable').innerHTML=table(r.data.rows||r.data.recipients||[])};
  window.ntBatchSend=async function(){var r=await call('notification.email.batchSend'); if(r&&r.success&&r.data)$('notificationTable').innerHTML=table(r.data.rows||r.data.logs||[])};
  window.ntSendLog=async function(){var r=await call('notification.email.logs'); if(r&&r.success&&r.data)$('notificationTable').innerHTML=table(r.data.rows||r.data.logs||[])};
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='ntTemplateType')ntLoadDefaultTemplate()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
