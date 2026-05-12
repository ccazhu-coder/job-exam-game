/* GovOps OS Shared API Client v1.0.3
 * 目的：統一前端 API 呼叫、SaaS session 注入、JSON 防呆、錯誤中文化與 timeout。
 * 產品化更新：整合 Product Core actions，不另外建立第二套 API client。
 */
(function(){
  const DEFAULT_TIMEOUT_MS=25000;
  const DEFAULT_API_URL='https://script.google.com/macros/s/AKfycbx1bhCaRf2c85JQhECQRnrLVinTIYemFd9uN4c997zzYLacNWMne_AogYq-BWyJRPlDLQ/exec';
  function getDefaultApiUrl(){
    if(window.GOVOPS_CONFIG&&window.GOVOPS_CONFIG.API_URL)return window.GOVOPS_CONFIG.API_URL;
    return window.GOVOPS_API_URL || window.API_URL || DEFAULT_API_URL;
  }
  function getProfile(){
    try{return JSON.parse(localStorage.getItem('govops_profile')||'{}')}catch(e){return{}}
  }
  function getAuth(){
    try{return JSON.parse(localStorage.getItem('govops_auth')||'{}')}catch(e){return{}}
  }
  function runtimeParams(params){
    const profile=getProfile();
    const auth=getAuth();
    const base={
      tenantId:params&&params.tenantId || profile.tenantId || auth.tenantId || 'TENANT-DEMO',
      userId:params&&params.userId || profile.userId || auth.userId || 'USR-DEMO',
      userRole:params&&params.userRole || profile.userRole || profile.role || auth.userRole || auth.role || 'owner',
      plan:params&&params.plan || profile.plan || auth.plan || 'pro',
      sessionToken:params&&params.sessionToken || auth.sessionToken || auth.token || '',
      clientVersion:window.GOVOPS_CONFIG&&window.GOVOPS_CONFIG.VERSION || '',
      env:window.GOVOPS_CONFIG&&window.GOVOPS_CONFIG.ENV || 'production'
    };
    return Object.assign(base,params||{});
  }
  function toQuery(params){
    const enriched=runtimeParams(params||{});
    const payload=window.GovOpsSaaS&&window.GovOpsSaaS.toBackendParams?window.GovOpsSaaS.toBackendParams(enriched):enriched;
    return new URLSearchParams(payload).toString();
  }
  function friendlyError(reason,extra){
    return {success:false,message:'系統暫時無法完成操作，請稍後再試。',data:Object.assign({reason:reason||'FRONTEND_API_ERROR'},extra||{})};
  }
  async function request(params,options){
    options=options||{};
    const apiUrl=options.apiUrl||getDefaultApiUrl();
    const timeoutMs=options.timeoutMs||DEFAULT_TIMEOUT_MS;
    if(!apiUrl)return {success:false,message:'尚未設定 API_URL，請確認系統部署設定。',data:{reason:'MISSING_API_URL'}};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const url=apiUrl+'?'+toQuery(params||{});
      const res=await fetch(url,{method:'GET',signal:controller.signal});
      clearTimeout(timer);
      const text=await res.text();
      let data;
      try{data=JSON.parse(text)}catch(e){return {success:false,message:'API 回傳格式不是有效 JSON，請檢查 Apps Script 部署。',data:{reason:'INVALID_JSON',status:res.status,raw:text.slice(0,300)}}}
      if(!res.ok){return {success:false,message:data.message||'API 連線失敗，請稍後再試。',data:data.data||{status:res.status}}}
      return data;
    }catch(e){
      clearTimeout(timer);
      return friendlyError(e&&e.name==='AbortError'?'TIMEOUT':'FRONTEND_API_ERROR');
    }
  }
  async function post(params,options){
    options=options||{};
    const apiUrl=options.apiUrl||getDefaultApiUrl();
    const timeoutMs=options.timeoutMs||DEFAULT_TIMEOUT_MS;
    if(!apiUrl)return {success:false,message:'尚未設定 API_URL，請確認系統部署設定。',data:{reason:'MISSING_API_URL'}};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const res=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(runtimeParams(params||{})),signal:controller.signal});
      clearTimeout(timer);
      const text=await res.text();
      let data;
      try{data=JSON.parse(text)}catch(e){return {success:false,message:'API 回傳格式不是有效 JSON，請檢查 Apps Script 部署。',data:{reason:'INVALID_JSON',status:res.status,raw:text.slice(0,300)}}}
      if(!res.ok){return {success:false,message:data.message||'API 連線失敗，請稍後再試。',data:data.data||{status:res.status}}}
      return data;
    }catch(e){
      clearTimeout(timer);
      return friendlyError(e&&e.name==='AbortError'?'TIMEOUT':'FRONTEND_API_ERROR');
    }
  }
  function formatResult(data){
    if(!data)return'系統沒有回應';
    let text=data.success===false?(data.message||'系統暫時無法完成操作，請稍後再試。'):(data.message||'操作完成');
    const d=data.data||{};
    if(d.活動ID)text+='\n系統活動編號：'+d.活動ID;
    if(d.報名ID)text+='\n報名編號：'+d.報名ID;
    if(d.標案ID)text+='\n標案ID：'+d.標案ID;
    if(d.應收ID)text+='\n應收ID：'+d.應收ID;
    if(d.收款ID)text+='\n收款ID：'+d.收款ID;
    if(d.支出ID)text+='\n支出ID：'+d.支出ID;
    if(d.新增筆數!==undefined)text+='\n新增筆數：'+d.新增筆數;
    if(d.略過筆數!==undefined)text+='\n略過筆數：'+d.略過筆數;
    if(d.使用分頁)text+='\n使用分頁：'+d.使用分頁;
    if(d.最後同步列數!==undefined)text+='\n最後同步列數：'+d.最後同步列數;
    if(d.連結)text+='\n連結：'+d.連結;
    if(d.摘要內容)text+='\n\n'+d.摘要內容;
    return text;
  }
  async function bindMessageRequest(params,targetId,options){
    const target=typeof targetId==='string'?document.getElementById(targetId):targetId;
    if(target)target.textContent='處理中，請稍候...';
    const result=await request(params,options||{});
    if(target)target.textContent=formatResult(result);
    return result;
  }
  function extractRows(resp){
    const d=resp&&resp.data?resp.data:{};
    return d.rows||d.結果||d.任務||d.缺件||d.學員||d.資料||d.明細||d.提醒||[];
  }
  const ProductCore={
    initSchema:function(data){return request(Object.assign({action:'product.schema.init'},data||{}));},
    schemaHealth:function(data){return request(Object.assign({action:'product.schema.health'},data||{}));},
    syncRegistrationFast:function(data){return request(Object.assign({action:'registration.sync.fast'},data||{}),{timeoutMs:45000});},
    createTender:function(data){return request(Object.assign({action:'tender.create'},data||{}));},
    queryTender:function(data){return request(Object.assign({action:'tender.query'},data||{}));},
    updateTenderStatus:function(data){return request(Object.assign({action:'tender.updateStatus'},data||{}));}
  };
  window.GovOpsAPI={request,post,bindMessageRequest,formatResult,extractRows,toQuery,runtimeParams,getProfile,getAuth,getDefaultApiUrl,ProductCore,DEFAULT_API_URL};
  window.GovOpsApi=window.GovOpsAPI;
})();
