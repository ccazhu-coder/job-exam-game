/* GovOps OS Shared Table Renderer */
(function(){
  function renderTable(resp,targetId,limit){
    const target=typeof targetId==='string'?document.getElementById(targetId):targetId;
    if(!target)return;
    const rows=(window.GovOpsAPI&&window.GovOpsAPI.extractRows)?window.GovOpsAPI.extractRows(resp):[];
    if(!Array.isArray(rows)||!rows.length){target.innerHTML='';return}
    const max=limit||20;
    const keys=Object.keys(rows[0]).filter(k=>k!=='_row').slice(0,8);
    target.innerHTML='<table><thead><tr>'+keys.map(k=>'<th>'+k+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(0,max).map(r=>'<tr>'+keys.map(k=>'<td>'+(r[k]??'')+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }
  window.GovOpsTable={renderTable};
})();
