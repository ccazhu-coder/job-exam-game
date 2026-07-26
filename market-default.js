(() => {
  'use strict';
  const KEY='interviewMarketGeneralDefaultV1';
  function init(){
    if(typeof state==='undefined') return;
    try{
      if(!localStorage.getItem(KEY)){
        state.career='general';
        localStorage.setItem(KEY,'1');
      }
    }catch(_){
      if(state.career==='pilot') state.career='general';
    }
    const main=document.getElementById('careerSelect');
    const sync=document.getElementById('syncCareerSelect');
    if(main) main.value=state.career;
    if(sync) sync.value=state.career;
    if(typeof renderAll==='function') renderAll();
    if(typeof safeSave==='function') safeSave();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();