/* GovOps OS｜index.html ERP主檔資料層補丁
 * 用法：在 index.html </body> 前引入：
 * <script src="./index-masterdata-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})}
  function sectionHtml(){return `
<section id="master-data" class="card span12">
  <h2>ERP 主檔資料層</h2>
  <div class="hint">這一層只建立一次，後續場次排課、派工、廠商、核銷與履約資源選單都會自動帶入，不需要每次重打。</div>
  <h2 style="margin-top:18px">資源類型主檔</h2>
  <div class="row">
    <div><label>類型分類</label><select id="mdTypeCategory"><option>講師專業類型</option><option>工作人員類型</option><option>合作廠商類型</option></select></div>
    <div><label>類型名稱</label><input id="mdTypeName" placeholder="例：AI數位應用類、職涯就業類、餐廳/餐飲"></div>
  </div>
  <label>類型說明</label><textarea id="mdTypeNote"></textarea>
  <div class="btns"><button onclick="mdCreateType()">新增資源類型</button><button class="secondary" onclick="mdQueryTypes()">查詢資源類型</button></div>

  <h2 style="margin-top:18px">講師基本資料</h2>
  <div class="row"><div><label>講師姓名</label><input id="mdTeacherName"></div><div><label>專業類型</label><input id="mdTeacherType" list="mdTeacherTypeList"><datalist id="mdTeacherTypeList"></datalist></div></div>
  <label>課程領域</label><input id="mdTeacherField" placeholder="例：AI應用、職涯就業、身心靈療癒">
  <label>可授課主題</label><textarea id="mdTeacherTopics"></textarea>
  <div class="row"><div><label>服務對象專長</label><input id="mdTeacherAudience"></div><div><label>證照資格</label><input id="mdTeacherCert"></div></div>
  <div class="row"><div><label>鐘點費 / 報價</label><input id="mdTeacherFee" type="number" min="0"></div><div><label>授課地區</label><input id="mdTeacherArea"></div></div>
  <div class="row"><div><label>聯絡電話</label><input id="mdTeacherPhone"></div><div><label>Email</label><input id="mdTeacherEmail"></div></div>
  <label>匯款資料</label><textarea id="mdTeacherBank"></textarea>
  <div class="btns"><button class="green" onclick="mdCreateTeacher()">新增講師</button><button class="secondary" onclick="mdQueryTeachers()">查詢講師</button></div>

  <h2 style="margin-top:18px">工作人員基本資料</h2>
  <div class="row"><div><label>人員姓名</label><input id="mdStaffName"></div><div><label>人員類型</label><input id="mdStaffType" list="mdStaffTypeList"><datalist id="mdStaffTypeList"></datalist></div></div>
  <label>可支援工作</label><textarea id="mdStaffJobs" placeholder="報到支援、攝影紀錄、核銷支援、現場執行"></textarea>
  <div class="row"><div><label>專長技能</label><input id="mdStaffSkill"></div><div><label>可配合時段</label><input id="mdStaffTime"></div></div>
  <div class="row"><div><label>時薪 / 日薪 / 報價</label><input id="mdStaffFee" type="number" min="0"></div><div><label>聯絡電話</label><input id="mdStaffPhone"></div></div>
  <label>匯款資料</label><textarea id="mdStaffBank"></textarea>
  <div class="btns"><button class="green" onclick="mdCreateStaff()">新增工作人員</button><button class="secondary" onclick="mdQueryStaff()">查詢工作人員</button></div>

  <h2 style="margin-top:18px">合作廠商基本資料</h2>
  <div class="row"><div><label>廠商名稱</label><input id="mdVendorName"></div><div><label>廠商類型</label><input id="mdVendorType" list="mdVendorTypeList"><datalist id="mdVendorTypeList"></datalist></div></div>
  <label>服務項目</label><textarea id="mdVendorService" placeholder="場地、原材料/物料、餐廳/餐飲、印刷/設計、交通/接駁、設備租借、住宿、保險、攝影錄影"></textarea>
  <div class="row"><div><label>聯絡人</label><input id="mdVendorContact"></div><div><label>聯絡電話</label><input id="mdVendorPhone"></div></div>
  <div class="row"><div><label>統一編號</label><input id="mdVendorTaxId"></div><div><label>報價方式</label><input id="mdVendorQuote"></div></div>
  <div class="row"><div><label>可服務地區</label><input id="mdVendorArea"></div><div><label>可配合文件</label><input id="mdVendorDocs" placeholder="發票、收據、報價單、合約、保險"></div></div>
  <label>備註</label><textarea id="mdVendorNote"></textarea>
  <div class="btns"><button class="green" onclick="mdCreateVendor()">新增合作廠商</button><button class="secondary" onclick="mdQueryVendors()">查詢合作廠商</button><button class="secondary" onclick="mdRefreshMenus()">更新履約資源選單</button></div>
  <div id="masterMsg" class="msg">尚未操作。</div>
  <div id="masterTable"></div>
</section>`}
  function init(){
    var grid=document.querySelector('main .grid');
    if(grid && !$('master-data')) grid.insertAdjacentHTML('beforeend', sectionHtml());
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#master-data"]')) topnav.insertAdjacentHTML('beforeend','<a href="#master-data">主檔</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#master-data"]')) footer.insertAdjacentHTML('beforeend','<a href="#master-data">主檔</a>');
    seedDatalists();
  }
  function seedDatalists(){
    setList('mdTeacherTypeList',['AI數位應用類','職涯就業類','身心靈療癒類']);
    setList('mdStaffTypeList',['報到支援','行政支援','攝影紀錄','核銷支援','現場執行']);
    setList('mdVendorTypeList',['場地','原材料/物料','餐廳/餐飲','印刷/設計','交通/接駁','設備租借','住宿','保險','攝影錄影','其他廠商']);
  }
  function setList(id,items){var el=$(id); if(el) el.innerHTML=items.map(function(v){return '<option value="'+safe(v)+'">'}).join('')}
  function params(extra){return Object.assign({
    類型分類:$('mdTypeCategory')?$('mdTypeCategory').value:'', 類型名稱:$('mdTypeName')?$('mdTypeName').value:'', 類型說明:$('mdTypeNote')?$('mdTypeNote').value:'',
    講師姓名:$('mdTeacherName')?$('mdTeacherName').value:'', 專業類型:$('mdTeacherType')?$('mdTeacherType').value:'', 課程領域:$('mdTeacherField')?$('mdTeacherField').value:'', 可授課主題:$('mdTeacherTopics')?$('mdTeacherTopics').value:'', 服務對象專長:$('mdTeacherAudience')?$('mdTeacherAudience').value:'', 證照資格:$('mdTeacherCert')?$('mdTeacherCert').value:'', 鐘點費:$('mdTeacherFee')?$('mdTeacherFee').value:'', 授課地區:$('mdTeacherArea')?$('mdTeacherArea').value:'', 聯絡電話:$('mdTeacherPhone')?$('mdTeacherPhone').value:'', Email:$('mdTeacherEmail')?$('mdTeacherEmail').value:'', 匯款資料:$('mdTeacherBank')?$('mdTeacherBank').value:'',
    人員姓名:$('mdStaffName')?$('mdStaffName').value:'', 人員類型:$('mdStaffType')?$('mdStaffType').value:'', 可支援工作:$('mdStaffJobs')?$('mdStaffJobs').value:'', 專長技能:$('mdStaffSkill')?$('mdStaffSkill').value:'', 可配合時段:$('mdStaffTime')?$('mdStaffTime').value:'', 薪資報價:$('mdStaffFee')?$('mdStaffFee').value:'', 工作人員電話:$('mdStaffPhone')?$('mdStaffPhone').value:'', 工作人員匯款資料:$('mdStaffBank')?$('mdStaffBank').value:'',
    廠商名稱:$('mdVendorName')?$('mdVendorName').value:'', 廠商類型:$('mdVendorType')?$('mdVendorType').value:'', 服務項目:$('mdVendorService')?$('mdVendorService').value:'', 聯絡人:$('mdVendorContact')?$('mdVendorContact').value:'', 廠商電話:$('mdVendorPhone')?$('mdVendorPhone').value:'', 統一編號:$('mdVendorTaxId')?$('mdVendorTaxId').value:'', 報價方式:$('mdVendorQuote')?$('mdVendorQuote').value:'', 可服務地區:$('mdVendorArea')?$('mdVendorArea').value:'', 可配合文件:$('mdVendorDocs')?$('mdVendorDocs').value:'', 廠商備註:$('mdVendorNote')?$('mdVendorNote').value:''
  },extra||{})}
  async function call(action,extra){if(typeof api!=='function'){ $('masterMsg').textContent='找不到後端 API 函式，請確認 index.html 原始程式已載入。'; return {success:false}; } return await api(Object.assign(params(extra),{action:action}),'masterMsg')}
  function table(rows){rows=rows||[]; if(!rows.length)return'<div class="msg">查無資料</div>'; var keys=Object.keys(rows[0]).filter(function(k){return k!=='_row'&&k!=='raw'}).slice(0,10); return '<table><thead><tr>'+keys.map(function(k){return '<th>'+safe(k)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.slice(0,100).map(function(r){return '<tr>'+keys.map(function(k){var v=r[k]; if(typeof v==='object')v=JSON.stringify(v); return '<td>'+safe(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'}
  function renderRows(r){if(r&&r.success&&r.data){$('masterTable').innerHTML=table(r.data.rows||r.data.results||r.data||[])}}
  window.mdCreateType=function(){return call('master.resourceType.create')};
  window.mdQueryTypes=async function(){renderRows(await call('master.resourceType.query'))};
  window.mdCreateTeacher=function(){return call('master.teacher.create')};
  window.mdQueryTeachers=async function(){renderRows(await call('master.teacher.query'))};
  window.mdCreateStaff=function(){return call('master.staff.create')};
  window.mdQueryStaff=async function(){renderRows(await call('master.staff.query'))};
  window.mdCreateVendor=function(){return call('master.vendor.create')};
  window.mdQueryVendors=async function(){renderRows(await call('master.vendor.query'))};
  window.mdRefreshMenus=async function(){
    var t=await call('master.resource.menu');
    if(t&&t.success&&t.data){
      if(t.data.講師專業類型) setList('mdTeacherTypeList',t.data.講師專業類型);
      if(t.data.工作人員類型) setList('mdStaffTypeList',t.data.工作人員類型);
      if(t.data.合作廠商類型) setList('mdVendorTypeList',t.data.合作廠商類型);
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
