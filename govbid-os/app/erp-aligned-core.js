/* GovOps OS｜ERP Aligned Core v4 — 深海軍藍×古金色 */
(function(){
  function $(id){return document.getElementById(id)}
  function profile(){try{return Object.assign({tenantId:'',userId:'',userRole:'viewer',plan:'free'},JSON.parse(localStorage.getItem('govops_profile')||'{}'),JSON.parse(localStorage.getItem('govops_auth')||'{}'))}catch(e){return{tenantId:'',userId:'',userRole:'viewer',plan:'free'}}}
  function params(obj){const p=profile();return Object.assign({tenantId:p.tenantId||'',userId:p.userId||'',userRole:p.userRole||p.role||'viewer',plan:p.planId||p.plan||'free'},obj||{})}

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
      const res={success:false,message:'系統暫時無法完成操作。'};
      if(t){t.textContent=res.message;t.style.opacity='1'}
      return res
    }
  }

  function format(res){
    if(!res)return'系統沒有回應';
    const ok=res.success!==false;
    let s=(ok?'✅ ':'❌ ')+(res.message||'操作完成');
    const d=res.data||{};
    ['專案ID','活動ID','廠商ID','學員ID','CRM_ID','講師ID','人員ID','報名ID','driveUrl'].forEach(k=>{if(d[k])s+='\n'+k+'：'+d[k]});
    if(d.新增筆數!==undefined)s+='\n新增筆數：'+d.新增筆數;
    return s
  }

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  // ── 標準表格 ────────────────────────────────────────────
  function renderTable(res,id){
    const box=$(id);if(!box)return;
    const d=(res&&res.data)||{};
    const arr=d.rows||d.資料||d.專案||d.廠商||d.學員||d.歸檔清單||d.核銷缺件||d.文件||d.簽到表||d.行銷名單||d.回流學員||[];
    if(!Array.isArray(arr)||!arr.length){box.innerHTML='<div class="empty">查無資料</div>';return}
    const keys=Object.keys(arr[0]).filter(k=>k!=='_row').slice(0,10);
    box.innerHTML='<div class="table-wrap"><table><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+arr.slice(0,200).map(r=>'<tr>'+keys.map(k=>'<td>'+esc(r[k]??'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'
  }

  // ── 可編輯表格（每行有「編輯」按鈕） ────────────────────
  function renderTableWithEdit(res,id,onEdit,displayKeys){
    const box=$(id);if(!box)return;
    const d=(res&&res.data)||{};
    const arr=d.rows||d.資料||d.專案||d.廠商||d.學員||[];
    if(!Array.isArray(arr)||!arr.length){box.innerHTML='<div class="empty">查無資料</div>';return}
    const keys=displayKeys||Object.keys(arr[0]).filter(k=>k!=='_row').slice(0,8);
    window.__editRows__=arr;window.__onEditRow__=onEdit;
    box.innerHTML='<div class="table-wrap"><table><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'<th style="width:58px;text-align:center">操作</th></tr></thead><tbody>'+arr.slice(0,200).map((r,i)=>'<tr>'+keys.map(k=>'<td>'+esc(r[k]??'')+'</td>').join('')+'<td style="text-align:center"><button class="ghost" style="padding:3px 10px;font-size:.76rem" onclick="window.__onEditRow__(window.__editRows__['+i+'])">編輯</button></td></tr>').join('')+'</tbody></table></div>'
  }

  // ── 編輯 Modal ────────────────────────────────────────
  function showEditModal(title,fields,rowData,actionName,idField,afterSave){
    _removeModal('_govopsModal');
    const formId='_modalEditForm';
    const html=_buildFormHtml(fields,rowData);
    const modal=document.createElement('div');
    modal.id='_govopsModal';modal.className='modal-backdrop';
    modal.innerHTML='<div class="modal"><h2>'+esc(title)+'</h2><form id="'+formId+'">'+html+'</form><div class="btns" style="margin-top:14px;justify-content:flex-end"><button class="secondary" id="_modalCancel">取消</button><button class="gold" id="_modalSave">儲存變更</button></div><div id="_modalMsg" class="msg" style="margin-top:8px;min-height:0;display:none"></div></div>';
    document.body.appendChild(modal);
    $('_modalCancel').onclick=()=>modal.remove();
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
    $('_modalSave').onclick=async()=>{
      const msgEl=$('_modalMsg');msgEl.style.display='block';msgEl.textContent='儲存中…';
      const fd=new FormData($(formId));
      const payload={action:actionName};
      if(idField)payload[idField]=rowData[idField];
      fd.forEach((v,k)=>{if(v!=='')payload[k]=v;});
      const r=await api(payload,'_modalMsg');
      if(r&&r.success)setTimeout(()=>{modal.remove();if(afterSave)afterSave();},700);
    };
  }

  // ── 選取器 Modal（選廠商、講師、工作人員） ────────────
  // usage: showPickerModal('查詢講師', ['講師ID','姓名','電話','專業領域'], onSelect)
  // onSelect(row) — caller decides what to do with the selected row
  function showPickerModal(queryAction,displayKeys,onSelect,title){
    _removeModal('_pickerModal');
    const modal=document.createElement('div');
    modal.id='_pickerModal';modal.className='modal-backdrop';
    modal.innerHTML='<div class="modal" style="max-width:680px"><h2>'+(title||'選取資料')+'</h2>'+
      '<div class="form-row" style="margin-bottom:10px">'+
      '<div class="field"><input id="_pickerKw" placeholder="關鍵字篩選…" autocomplete="off" onkeydown="if(event.key===\'Enter\')_pickerSearch()"></div>'+
      '<div class="field" style="max-width:90px"><button onclick="_pickerSearch()">搜尋</button></div></div>'+
      '<div id="_pickerResult" class="msg" style="min-height:40px">輸入關鍵字或直接搜尋…</div>'+
      '<div id="_pickerTable" style="margin-top:8px"></div>'+
      '<div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="secondary" onclick="document.getElementById(\'_pickerModal\').remove()">取消</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});

    window._pickerSearch=async()=>{
      const kw=$('_pickerKw').value;
      const r=await api({action:queryAction,keyword:kw},'_pickerResult');
      const d=(r&&r.data)||{};
      const arr=d.rows||[];
      if(!Array.isArray(arr)||!arr.length){$('_pickerTable').innerHTML='<div class="empty">查無資料</div>';return}
      const keys=displayKeys||Object.keys(arr[0]).filter(k=>k!=='_row').slice(0,6);
      window._pickerRows=arr;
      $('_pickerTable').innerHTML='<div class="table-wrap"><table><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'<th style="width:58px;text-align:center">選取</th></tr></thead><tbody>'+
        arr.slice(0,50).map((row,i)=>'<tr>'+keys.map(k=>'<td>'+esc(row[k]??'')+'</td>').join('')+'<td style="text-align:center"><button class="gold" style="padding:3px 10px;font-size:.76rem" onclick="_pickerSelect('+i+')">選取</button></td></tr>').join('')+
        '</tbody></table></div>';
      window._pickerSelect=i=>{
        modal.remove();
        if(onSelect)onSelect(window._pickerRows[i]);
      };
    };
    // Auto-search on open
    window._pickerSearch();
  }

  function _removeModal(id){const el=document.getElementById(id);if(el)el.remove();}

  // ── 主表單內嵌選取器（在 Modal 中使用）─────────────────
  // 調用方式：_mpick(pickerAction, displayKeys, title, inputId, autoFillMap, appendMode)
  window._mpick = function(action, keys, title, inputId, autoFill, append) {
    showPickerModal(action, keys, function(row) {
      const target = document.getElementById(inputId);
      if(target) {
        const val = row['姓名'] || row[keys && keys[1]] || '';
        target.value = append ? (target.value ? target.value + '、' + val : val) : val;
      }
      if(autoFill) {
        Object.keys(autoFill).forEach(function(formField){
          const rowKey = autoFill[formField];
          const el = document.getElementById('_pf_' + formField.replace(/[^a-zA-Z0-9]/g,'_'));
          if(el && row[rowKey] !== undefined) el.value = row[rowKey] || '';
        });
      }
    }, title);
  };

  function _buildFormHtml(fields,rowData){
    const rows=[];let buf=[];
    fields.forEach((f,i)=>{
      let input;
      if(f.type==='select'){
        const opts=(f.options||[]).map(o=>{const val=typeof o==='object'?o.value:o;const lbl=typeof o==='object'?o.label:o;const sel=String(rowData[f.name]||'')===String(val)?' selected':'';return'<option value="'+esc(val)+'"'+sel+'>'+esc(lbl)+'</option>';}).join('');
        input='<select name="'+esc(f.name)+'">'+opts+'</select>';
      }else if(f.type==='textarea'){
        input='<textarea name="'+esc(f.name)+'" rows="2">'+esc(rowData[f.name]||'')+'</textarea>';
      }else if(f.type==='picker'||f.type==='picker-append'){
        const pfId='_pf_'+f.name.replace(/[^a-zA-Z0-9]/g,'_');
        const aFill=JSON.stringify(f.autoFill||{});
        const pKeys=JSON.stringify(f.pickerKeys||[]);
        const pTitle=JSON.stringify(f.pickerTitle||'選取');
        const pAction=JSON.stringify(f.pickerAction||'');
        const append=f.type==='picker-append'||f.append?'true':'false';
        input='<div style="display:flex;gap:6px">'+
          '<input id="'+pfId+'" name="'+esc(f.name)+'" value="'+esc(rowData[f.name]||'')+'" style="flex:1">'+
          '<button type="button" class="secondary" style="flex:0 0 58px;padding:8px 10px;font-size:.78rem" '+
          'onclick="_mpick('+pAction+','+pKeys+','+pTitle+',\''+pfId+'\','+aFill+','+append+')">選取</button></div>';
      }else{
        input='<input name="'+esc(f.name)+'" type="'+(f.type||'text')+'" value="'+esc(rowData[f.name]||'')+'"'+(f.readonly?' readonly style="background:var(--gray-100);cursor:not-allowed"':'')+'>';
      }
      buf.push('<div class="field"><label>'+esc(f.label)+'</label>'+input+'</div>');
      if(buf.length===2||i===fields.length-1){rows.push('<div class="form-row">'+buf.join('')+'</div>');buf=[];}
    });
    return rows.join('');
  }

  function dateTW(id){const v=$(id)&&$(id).value;if(!v)return'';const a=v.split('-');return a[0]+'/'+a[1]+'/'+a[2]}

  function nav(){
    const path=location.pathname.split('/').pop()||'index.html';
    const pages=[
      ['dashboard.html','儀表板'],
      ['cases.html','業務案件'],['case-requirements.html','需求摘要'],
      ['sessions.html','場次管理'],['change-log.html','變更紀錄'],
      ['registrations.html','報名管理'],['review.html','資格審查'],['admission.html','錄取名單'],
      ['manpower.html','人力招募'],['manpower-schedule.html','人力排班'],
      ['import.html','資料匯入'],['documents.html','行政文件'],
      ['calendar.html','日曆'],['tasks.html','任務'],
      ['finance.html','財務'],['official-docs.html','公文'],
      ['file-manager.html','檔案管理'],['closing.html','結案'],['report-generator.html','結案報告'],
      ['master-data.html','基本資料'],['settings.html','系統設定'],
      ['tender-pool.html','標案池'],['vendors.html','廠商'],
      ['users.html','成員管理']
    ]
    return pages.map(([href,label])=>'<a href="./'+href+'"'+(path===href?' class="active"':'')+'>'+label+'</a>').join('');
  }

  function userChip(){
    try{
      const auth=JSON.parse(localStorage.getItem('govops_auth')||'{}');
      const p=JSON.parse(localStorage.getItem('govops_profile')||'{}');
      const name=auth.userName||p.userName||p.orgName||p.email||'使用者';
      const ws=auth.workspaceName||p.orgName||'';
      const LABELS={'tenant_owner':'擁有者','sys_admin':'系統管理','admin':'管理者','project':'專案','admin_staff':'行政','finance':'財務','viewer':'檢視者',owner:'負責人',staff:'行政'};
      const role=LABELS[auth.role||p.role||p.userRole]||'';
      if(!name)return '';
      return '<span style="font-size:.76rem;color:rgba(255,255,255,.7);margin-left:8px">'+
        _escNav(name)+(ws?'・'+_escNav(ws):'')+(role?' ('+_escNav(role)+')':'')+'</span>'+
        '<button onclick="if(window.GovOpsAPI&&GovOpsAPI.doLogout){GovOpsAPI.doLogout();}else{[\'govops_profile\',\'govops_auth\'].forEach(k=>localStorage.removeItem(k));location.href=\'./login.html\';}" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.75);padding:4px 11px;border-radius:5px;font-size:.74rem;cursor:pointer;margin-left:4px">登出</button>';
    }catch(e){return '';}
  }
  function _escNav(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  window.ERPALIGNED={api,renderTable,renderTableWithEdit,showEditModal,showPickerModal,dateTW,nav,userChip,appendUserChip,$,params,format,esc};

  // ── 自動初始化：Guard + UserChip（dashboard / login / register 跳過） ──
  document.addEventListener('DOMContentLoaded',function(){
    const skipPages=['dashboard.html','login.html','register.html'];
    const curPage=location.pathname.split('/').pop()||'';
    const isSkip=skipPages.some(function(p){return curPage===p||location.pathname.endsWith('/');})||location.pathname.endsWith('/govbid-os/app/');
    if(isSkip) return;

    // SaaS Guard：檢查 govops_auth.sessionToken（優先）或 govops_profile.userId（向後相容）
    try{
      const auth=JSON.parse(localStorage.getItem('govops_auth')||'null');
      const prof=JSON.parse(localStorage.getItem('govops_profile')||'null');
      const hasSession=(auth&&auth.sessionToken&&auth.isLoggedIn);
      const hasProfile=(prof&&prof.userId);
      if(!hasSession&&!hasProfile){
        location.href='./login.html?redirect='+encodeURIComponent(location.pathname);
        return;
      }
    }catch(e){location.href='./login.html';return;}

    // UserChip：在 header 右側插入使用者資訊+登出
    const wrap=document.querySelector('header .wrap');
    if(wrap&&!wrap.querySelector('#_erpChip')){
      const chip=document.createElement('div');
      chip.id='_erpChip';
      chip.style.cssText='display:flex;align-items:center;gap:4px;flex-shrink:0;margin-left:4px';
      chip.innerHTML=userChip();
      wrap.appendChild(chip);
    }
  });

  // dashboard 呼叫：登入成功後手動插入 userChip
  function appendUserChip(wrapSelector){
    const wrap=document.querySelector(wrapSelector||'header .wrap');
    if(!wrap)return;
    let chip=document.getElementById('_erpChip');
    if(!chip){chip=document.createElement('div');chip.id='_erpChip';chip.style.cssText='display:flex;align-items:center;gap:4px;flex-shrink:0;margin-left:4px';wrap.appendChild(chip);}
    chip.innerHTML=userChip();
  }
})();

