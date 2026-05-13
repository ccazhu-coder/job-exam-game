/* GovOps OS｜ERP Aligned Core v2 — 深海軍藍×古金色 */
(function(){
  const API_ACTIONS={dashboard:'取得ERP儀表板',projectCreate:'新增專案',projectQuery:'查詢專案',activityCreate:'新增活動',activityQuery:'查詢活動',vendorCreate:'新增合作廠商',vendorQuery:'查詢合作廠商',crmQuery:'查詢學員CRM',archiveQuery:'查詢核銷缺件',enrollmentQuery:'查詢招生活動'};
  function $(id){return document.getElementById(id)}
  function profile(){try{return Object.assign({tenantId:'TENANT-COMMERCIAL',userId:'USR-OWNER',userRole:'owner',plan:'enterprise'},JSON.parse(localStorage.getItem('govops_profile')||'{}'),JSON.parse(localStorage.getItem('govops_auth')||'{}'))}catch(e){return{tenantId:'TENANT-COMMERCIAL',userId:'USR-OWNER',userRole:'owner',plan:'enterprise'}}}
  function params(obj){const p=profile();return Object.assign({tenantId:p.tenantId||'TENANT-COMMERCIAL',userId:p.userId||'USR-OWNER',userRole:p.userRole||p.role||'owner',plan:'enterprise'},obj||{})}
  async function api(obj,targetId){
    const t=$(targetId);
    if(t){t.textContent='處理中…';t.style.opacity='.6'}
    try{
      let res;
      if(window.GovOpsAPI&&GovOpsAPI.request)res=await GovOpsAPI.request(params(obj));
      else{const url=(window.GOVOPS_CONFIG&&GOVOPS_CONFIG.API_URL)||'';if(!url){const r={success:false,message:'API_URL 未設定'};if(t){t.textContent=r.message;t.style.opacity='1'}return r}const rsp=await fetch(url+'?'+new URLSearchParams(params(obj)).toString());res=await rsp.json()}
      if(t){t.textContent=format(res);t.style.opacity='1'}
      return res
    }catch(e){
      const res={success:false,message:'系統暫時無法完成操作，請確認後端是否正常。'};
      if(t){t.textContent=res.message;t.style.opacity='1'}
      return res
    }
  }
  function format(res){
    if(!res)return'系統沒有回應';
    const ok=res.success!==false;
    let s=(ok?'✅ ':'❌ ')+(res.message||'操作完成');
    const d=res.data||{};
    ['專案ID','場次ID','活動ID','廠商ID','學員ID','CRM_ID','報名ID','driveUrl'].forEach(k=>{if(d[k])s+='\n'+k+'：'+d[k]});
    if(d.新增筆數!==undefined)s+='\n新增筆數：'+d.新增筆數;
    if(d.建立筆數!==undefined)s+='\n建立筆數：'+d.建立筆數;
    if(d.使用分頁)s+='\n分頁：'+d.使用分頁;
    return s
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function renderTable(res,id){
    const box=$(id);if(!box)return;
    const d=(res&&res.data)||{};
    const arr=d.rows||d.資料||d.專案||d.廠商||d.學員||d.歸檔清單||d.核銷缺件||d.文件||d.簽到表||d.行銷名單||d.回流學員||d.activities||[];
    if(!Array.isArray(arr)||!arr.length){box.innerHTML='<div class="empty">查無資料</div>';return}
    const keys=Object.keys(arr[0]).filter(k=>k!=='_row').slice(0,10);
    box.innerHTML='<div class="table-wrap"><table><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+arr.slice(0,200).map(r=>'<tr>'+keys.map(k=>'<td>'+esc(r[k]??'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'
  }
  function dateTW(id){const v=$(id)&&$(id).value;if(!v)return'';const a=v.split('-');return a[0]+'/'+a[1]+'/'+a[2]}
  function nav(){
    const path=location.pathname.split('/').pop()||'index.html';
    const pages=[['dashboard.html','儀表板'],['projects.html','專案'],['activities.html','活動'],['enrollment.html','招生報名'],['course-ops.html','課程執行'],['vendors.html','廠商'],['crm.html','CRM'],['archive.html','核銷'],['finance-secretary.html','財務'],['pre-launch-qa.html','驗收']];
    return pages.map(([href,label])=>'<a href="./'+href+'"'+(path===href?' class="active"':'')+'>'+label+'</a>').join('')
  }
  window.ERPALIGNED={API_ACTIONS,api,renderTable,dateTW,nav,$,params,format,esc};
})();
