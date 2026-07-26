(() => {
  'use strict';

  function loadUiFix(){
    if(document.querySelector('link[data-formal-ui-fix]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='formal-ui-fix.css?v=4.0.0';
    link.dataset.formalUiFix='1';
    document.head.appendChild(link);
  }

  function showFailure(error){
    console.error('正式版程式載入失敗', error);
    const render=()=>{
      const splash=document.getElementById('splash');
      if(splash) splash.innerHTML='<div class="splash-card"><h1>程式載入失敗</h1><p>請按 Ctrl＋F5 強制重新整理；仍無法開啟時，請使用離線備援包。</p></div>';
    };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',render); else render();
  }

  try{
    loadUiFix();
    const encoded=window.__CORE_B64||'';
    if(!encoded) throw new Error('MISSING_CORE');
    const binary=atob(encoded);
    const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
    const code=new TextDecoder('utf-8').decode(bytes);
    window.__CORE_B64='';
    eval(code);
  }catch(error){
    showFailure(error);
  }
})();