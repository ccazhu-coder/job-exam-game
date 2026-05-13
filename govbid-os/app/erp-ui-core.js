/* GovOps ERP UI Core｜產品整合正式上線共用前端 */
(function(){
  function $(id){return document.getElementById(id)}
  function safeJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback||{}))}catch(e){return fallback||{}}}
  function ensureSession(){
    if(!localStorage.getItem('govops_profile')) localStorage.setItem('govops_profile',JSON.stringify({tenantId:'TENANT-COMMERCIAL',userId:'USR-OWNER',userName:'珍珠老師',orgName:'知己知途／GovOps OS',role:'owner',plan:'enterprise'}));
    if(!localStorage.getItem('govops_auth')) localStorage.setItem('govops_auth',JSON.stringify({tenantId:'TENANT-COMMERCIAL',userId:'USR-OWNER',userRole:'owner',role:'owner',plan:'enterprise',status:'active',sessionToken:'LOCAL-ENTERPRISE-'+Date.now()}));
  }
  function profile(){ensureSession();return Object.assign({tenantId:'TENANT-COMMERCIAL',userId:'USR-OWNER',role:'owner',plan:'enterprise'},safeJSON('govops_profile',{}),safeJSON('govops_auth',{}))}
  function params(obj){const p=profile();return Object.assign({tenantId:p.tenantId,userId:p.userId,userRole:p.role||p.userRole||'owner',plan:'enterprise'},obj||{})}
  async function api(obj,targetId){
    const target=typeof targetId==='string'?$(targetId):targetId;
    if(target)target.textContent='處理中...';
    let res;
    try{
      if(window.GovOpsAPI&&GovOpsAPI.request)res=await GovOpsAPI.request(params(obj));
      else{const url=(window.GOVOPS_CONFIG&&GOVOPS_CONFIG.API_URL)||'';const r=await fetch(url+'?'+new URLSearchParams(params(obj)).toString());res=await r.json()}
      if(target)target.textContent=format(res);
      return res;
    }catch(e){res={success:false,message:'系統暫時無法完成操作，請確認 Apps Script 是否已部署最新版。'};if(target)target.textContent=res.message;return res}
  }
  function format(res){if(!res)return'系統沒有回應';let text=res.message||'操作完成';const d=res.data||{};['專案ID','活動ID','場次ID','廠商ID','報名ID','應收ID','收款ID','支出ID','folderId','driveUrl','連結'].forEach(k=>{if(d[k])text+='\n'+k+'：'+d[k]});if(d.新增筆數!==undefined)text+='\n新增筆數：'+d.新增筆數;return text}
  function dateTW(id){const v=$(id)&&$(id).value;if(!v)return'';const a=v.split('-');return a[0]+'/'+a[1]+'/'+a[2]}
  function renderTable(res,id){const box=$(id);if(!box)return;const d=(res&&res.data)||{};const arr=d.rows||d.資料||d.廠商||d.學員||d.文件||d.歸檔清單||d.任務||d.變更紀錄||d.版本紀錄||d.未收款||[];if(!Array.isArray(arr)||!arr.length){box.innerHTML='<div class="empty">查無資料</div>';return}const keys=Object.keys(arr[0]).filter(k=>k!=='_row').slice(0,10);box.innerHTML='<table><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+arr.slice(0,80).map(r=>'<tr>'+keys.map(k=>'<td>'+esc(r[k]??'')+'</td>').join('')+'</tr>').join('')+'</tbody></table>'}
  function esc(v){return String(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function bindForm(formId, action, msgId, tableId, mapFn){const f=$(formId);if(!f)return;f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(f);const obj={action};fd.forEach((v,k)=>obj[k]=v);if(mapFn)Object.assign(obj,mapFn());const res=await api(obj,msgId);if(tableId)renderTable(res,tableId)})}
  function nav(){return '<a href="./dashboard.html">Dashboard</a><a href="./projects.html">專案</a><a href="./activities.html">活動</a><a href="./vendors.html">廠商</a><a href="./crm.html">CRM</a><a href="./archive.html">核銷</a><a href="./finance-secretary.html">財務</a>'}
  window.ERPUI={api,renderTable,dateTW,bindForm,profile,params,nav,$};
})();