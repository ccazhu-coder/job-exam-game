(() => {
  'use strict';
  const KEY='interviewMarketGeneralDefaultV1';
  const VERSION='20260726-11';

  function loadMinuteControls(){
    if(!document.querySelector('link[data-minute-controls]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href=`time-minutes.css?v=${VERSION}`;
      link.dataset.minuteControls='1';
      document.head.appendChild(link);
    }
    if(!document.querySelector('script[data-minute-controls]')){
      const script=document.createElement('script');
      script.src=`time-minutes.js?v=${VERSION}`;
      script.async=false;
      script.dataset.minuteControls='1';
      document.head.appendChild(script);
    }
  }

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

  loadMinuteControls();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();