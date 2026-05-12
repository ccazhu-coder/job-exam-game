/* GovOps OS｜index.html 活動執行中心補丁
 * 用法：在 index.html </body> 前引入：
 * <script src="./index-execution-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})}
  function sectionHtml(){return `
<section id="execution-center" class="card span12">
  <h2>活動執行中心</h2>
  <div class="hint">活動當天與課後資料統一在這裡處理：出席、用餐、滿意度、成果照片、簽到表與核銷附件。</div>
  <label>系統活動編號 / 專案ID</label><input id="execActivityId" placeholder="可填活動ID或專案ID">
  <h2 style="margin-top:18px">出席管理</h2>
  <div class="row">
    <div><label>應出席人數</label><input id="execExpected" type="number" min="0"></div>
    <div><label>實際出席人數</label><input id="execActual" type="number" min="0"></div>
  </div>
  <div class="row">
    <div><label>缺席人數</label><input id="execAbsent" type="number" min="0"></div>
    <div><label>出席備註</label><input id="execAttendNote"></div>
  </div>
  <div class="btns"><button onclick="execSaveAttendance()">儲存出席統計</button><button class="secondary" onclick="execGenerateSignIn()">生成簽到表</button><button class="secondary" onclick="execQuerySignIn()">查詢簽到名單</button></div>
  <h2 style="margin-top:18px">用餐統計</h2>
  <div class="btns"><button onclick="execMealSummary()">用餐統計</button><button onclick="execMealList()">用餐名單</button><button class="secondary" onclick="execMealVendorNote()">餐飲廠商備註</button></div>
  <h2 style="margin-top:18px">滿意度</h2>
  <div class="row">
    <div><label>問卷方式</label><select id="execSurveyType"><option>紙本問卷</option><option>Google表單</option><option>其他線上問卷</option></select></div>
    <div><label>滿意度平均</label><input id="execSatAvg" type="number" step="0.1" min="0"></div>
  </div>
  <label>問卷連結</label><input id="execSurveyUrl" placeholder="Google 表單或其他問卷連結">
  <label>意見摘要 / 改善建議</label><textarea id="execSurveyNote"></textarea>
  <div class="btns"><button onclick="execSaveSatisfaction()">儲存滿意度</button></div>
  <h2 style="margin-top:18px">成果照片 / 簽到表 / 核銷附件</h2>
  <div class="row">
    <div><label>附件類別</label><select id="execFileType"><option>成果照片</option><option>簽到表</option><option>滿意度資料</option><option>核銷憑證</option><option>講師領據</option><option>工作人員領據</option><option>餐費收據</option><option>其他附件</option></select></div>
    <div><label>檔案名稱</label><input id="execFileName"></div>
  </div>
  <label>Drive / 檔案 URL</label><input id="execFileUrl" placeholder="貼上成果照片、簽到表或核銷附件連結">
  <div class="row">
    <div><label>納入結案</label><select id="execIncludeClosing"><option>是</option><option>否</option></select></div>
    <div><label>納入核銷</label><select id="execIncludeReimburse"><option>否</option><option>是</option></select></div>
  </div>
  <div class="btns"><button onclick="execSaveFile()">新增附件</button><button class="secondary" onclick="execCreateReimburseFromFile()">建立核銷附件紀錄</button><button class="secondary" onclick="execMissingCheck()">查詢核銷缺件</button></div>
  <div id="executionMsg" class="msg">尚未操作。</div>
  <div id="executionTable"></div>
</section>`}
  function init(){
    var grid=document.querySelector('main .grid');
    if(grid && !$('execution-center')) grid.insertAdjacentHTML('beforeend', sectionHtml());
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#execution-center"]')) topnav.insertAdjacentHTML('beforeend','<a href="#execution-center">執行</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#execution-center"]')) footer.insertAdjacentHTML('beforeend','<a href="#execution-center">執行</a>');
  }
  function params(extra){
    return Object.assign({
      activityId:$('execActivityId')?$('execActivityId').value:'',
      活動ID:$('execActivityId')?$('execActivityId').value:'',
      專案ID:$('execActivityId')?$('execActivityId').value:'',
      projectId:$('execActivityId')?$('execActivityId').value:'',
      場次ID:$('execActivityId')?$('execActivityId').value:'',
      應出席人數:$('execExpected')?$('execExpected').value:'',
      實際出席人數:$('execActual')?$('execActual').value:'',
      缺席人數:$('execAbsent')?$('execAbsent').value:'',
      備註:$('execAttendNote')?$('execAttendNote').value:'',
      問卷方式:$('execSurveyType')?$('execSurveyType').value:'',
      滿意度平均:$('execSatAvg')?$('execSatAvg').value:'',
      問卷連結:$('execSurveyUrl')?$('execSurveyUrl').value:'',
      意見摘要:$('execSurveyNote')?$('execSurveyNote').value:'',
      檔案類別:$('execFileType')?$('execFileType').value:'',
      檔案名稱:$('execFileName')?$('execFileName').value:'',
      DriveURL:$('execFileUrl')?$('execFileUrl').value:'',
      檔案URL:$('execFileUrl')?$('execFileUrl').value:'',
      是否納入結案:$('execIncludeClosing')?$('execIncludeClosing').value:'',
      是否納入核銷:$('execIncludeReimburse')?$('execIncludeReimburse').value:'',
      憑證URL:$('execFileUrl')?$('execFileUrl').value:''
    }, extra||{});
  }
  async function call(action, extra){
    if(typeof api!=='function'){ $('executionMsg').textContent='找不到後端 API 函式，請確認 index.html 原始程式已載入。'; return {success:false}; }
    return await api(Object.assign(params(extra),{action:action}), 'executionMsg');
  }
  function table(rows){
    rows=rows||[];
    if(!rows.length) return '<div class="msg">無資料</div>';
    var keys=Object.keys(rows[0]).filter(function(k){return k!=='_row' && k!=='raw'}).slice(0,8);
    return '<table><thead><tr>'+keys.map(function(k){return '<th>'+safe(k)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.slice(0,80).map(function(r){return '<tr>'+keys.map(function(k){var v=r[k]; if(typeof v==='object') v=JSON.stringify(v); return '<td>'+safe(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>';
  }
  function kvTable(data){return table(Object.keys(data||{}).map(function(k){return {項目:k,內容:typeof data[k]==='object'?JSON.stringify(data[k]):data[k]}}))}
  window.execSaveAttendance=function(){return call('execution.attendance.record')};
  window.execMealSummary=async function(){var r=await call('project.meal.summary'); if(r&&r.success&&r.data) $('executionTable').innerHTML=kvTable(r.data)};
  window.execMealList=async function(){var r=await call('project.meal.list'); if(r&&r.success&&r.data) $('executionTable').innerHTML=table(r.data.rows||[])};
  window.execMealVendorNote=async function(){var r=await call('project.meal.vendorNote'); if(r&&r.success&&r.data) $('executionTable').innerHTML='<div class="msg">'+safe(r.data.note||'')+'</div>'};
  window.execSaveSatisfaction=function(){return call('execution.satisfaction.record')};
  window.execSaveFile=function(){return call('file.center.create')};
  window.execCreateReimburseFromFile=function(){return call('project.finance.reimburse.record',{核銷類型:$('execFileType')?$('execFileType').value:'',金額:0})};
  window.execGenerateSignIn=async function(){
    if(typeof generateSignIn==='function') return generateSignIn();
    return call('生成簽到表');
  };
  window.execQuerySignIn=async function(){
    if(typeof querySignIn==='function') return querySignIn();
    return call('查詢簽到名單');
  };
  window.execMissingCheck=async function(){
    if(typeof missingCheck==='function') return missingCheck();
    return call('查詢缺件');
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
