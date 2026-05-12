/* GovOps OS｜index.html 結案交付補丁
 * 用法：在 index.html </body> 前引入：
 * <script src="./index-closing-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})}
  function sectionHtml(){return `
<section id="closing-delivery" class="card span12">
  <h2>結案交付</h2>
  <div class="hint">結案前先做缺件檢查，再建立交付包，最後輸出結案報告、HTML、Word可開啟版與 Drive 檔案連結。</div>
  <div class="row">
    <div><label>系統活動編號 / 專案ID</label><input id="closeActivityId" placeholder="可填活動ID或專案ID"></div>
    <div><label>結案狀態</label><select id="closeStatus"><option>結案檢查中</option><option>待補件</option><option>可結案</option><option>已結案</option></select></div>
  </div>
  <label>檢討與建議</label><textarea id="closeReview" placeholder="輸入本案檢討、改善建議、後續追蹤事項"></textarea>
  <div class="btns">
    <button onclick="closingSummaryIndex()">結案摘要</button>
    <button onclick="closingCheckIndex()">缺件檢查</button>
    <button onclick="closingCreateIndex()">建立結案主檔</button>
    <button class="green" onclick="closingPackageIndex()">建立交付包</button>
  </div>
  <div class="btns">
    <button onclick="closingReportIndex()">產生結案報告</button>
    <button onclick="closingHtmlIndex()">產生 HTML</button>
    <button class="green" onclick="closingWordIndex()">匯出 Word 可開啟版</button>
    <button class="green" onclick="closingDriveHtmlIndex()">Drive 匯出 HTML</button>
    <button onclick="closingPackageIndexFile()">Drive 匯出交付包索引</button>
  </div>
  <div id="closingMsg" class="msg">尚未操作。</div>
  <div id="closingTable"></div>
</section>`}
  function init(){
    var grid=document.querySelector('main .grid');
    if(grid && !$('closing-delivery')) grid.insertAdjacentHTML('beforeend', sectionHtml());
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#closing-delivery"]')) topnav.insertAdjacentHTML('beforeend','<a href="#closing-delivery">結案</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#closing-delivery"]')) footer.insertAdjacentHTML('beforeend','<a href="#closing-delivery">結案</a>');
  }
  function params(extra){
    return Object.assign({
      activityId:$('closeActivityId')?$('closeActivityId').value:'',
      活動ID:$('closeActivityId')?$('closeActivityId').value:'',
      專案ID:$('closeActivityId')?$('closeActivityId').value:'',
      projectId:$('closeActivityId')?$('closeActivityId').value:'',
      結案狀態:$('closeStatus')?$('closeStatus').value:'',
      檢討建議:$('closeReview')?$('closeReview').value:'',
      review:$('closeReview')?$('closeReview').value:''
    }, extra||{});
  }
  async function call(action, extra){
    if(typeof api!=='function'){ $('closingMsg').textContent='找不到後端 API 函式，請確認 index.html 原始程式已載入。'; return {success:false}; }
    return await api(Object.assign(params(extra),{action:action}), 'closingMsg');
  }
  function table(rows){
    rows=rows||[];
    if(!rows.length) return '<div class="msg">無資料</div>';
    var keys=Object.keys(rows[0]).filter(function(k){return k!=='_row' && k!=='raw'}).slice(0,8);
    return '<table><thead><tr>'+keys.map(function(k){return '<th>'+safe(k)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.slice(0,80).map(function(r){return '<tr>'+keys.map(function(k){var v=r[k]; if(typeof v==='object') v=JSON.stringify(v); return '<td>'+safe(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>';
  }
  function showResultTable(data){
    if(!data){ $('closingTable').innerHTML=''; return; }
    if(Array.isArray(data)) $('closingTable').innerHTML=table(data);
    else if(data.checks) $('closingTable').innerHTML='<h3>缺件檢查</h3>'+table(data.checks);
    else if(data.rows) $('closingTable').innerHTML=table(data.rows);
    else if(data.file) $('closingTable').innerHTML='<div class="ok">檔案已建立：<br><a href="'+safe(data.file.url)+'" target="_blank">'+safe(data.file.name||data.file.url)+'</a></div>';
    else $('closingTable').innerHTML='<div class="msg">'+safe(JSON.stringify(data,null,2))+'</div>';
  }
  window.closingSummaryIndex=async function(){var r=await call('project.closing.summary'); if(r&&r.data) showResultTable(r.data)};
  window.closingCheckIndex=async function(){var r=await call('project.closing.check'); if(r&&r.data) showResultTable(r.data)};
  window.closingCreateIndex=async function(){var r=await call('project.closing.create'); if(r&&r.data) showResultTable(r.data)};
  window.closingPackageIndex=async function(){var r=await call('project.closing.package'); if(r&&r.data) showResultTable(r.data)};
  window.closingReportIndex=async function(){var r=await call('project.document.closingReport'); if(r&&r.data) showResultTable(r.data)};
  window.closingHtmlIndex=async function(){var r=await call('project.document.deliveryHtml'); if(r&&r.data) showResultTable(r.data)};
  window.closingDriveHtmlIndex=async function(){var r=await call('project.export.closingHtmlFile'); if(r&&r.data) showResultTable(r.data)};
  window.closingWordIndex=async function(){var r=await call('project.export.closingWordFile'); if(r&&r.data) showResultTable(r.data)};
  window.closingPackageIndexFile=async function(){var r=await call('project.export.deliveryPackageIndex'); if(r&&r.data) showResultTable(r.data)};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
