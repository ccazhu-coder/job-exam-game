/* GovOps OS Shared Utils */
(function(){
  function showMessage(target,msg){
    const el=typeof target==='string'?document.getElementById(target):target;
    if(el)el.textContent=msg||'';
  }
  function formatTWDate(value){
    if(!value)return'';
    const parts=String(value).split('-');
    if(parts.length!==3)return value;
    return parts[0]+'/'+parts[1]+'/'+parts[2];
  }
  function extractSpreadsheetId(value){
    const s=String(value||'').trim();
    if(!s)return'';
    let m=s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if(m&&m[1])return m[1];
    m=s.match(/^[a-zA-Z0-9-_]{25,}$/);
    return m?m[0]:'';
  }
  function safeArray(v){return Array.isArray(v)?v:[]}
  function safeObject(v){return v&&typeof v==='object'?v:{}}
  window.GovOpsUtils={showMessage,formatTWDate,extractSpreadsheetId,safeArray,safeObject};
})();
