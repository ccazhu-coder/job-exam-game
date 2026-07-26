(() => {
  'use strict';
  const KEY='interviewMarketGeneralDefaultV1';
  const VERSION='20260726-12';

  function loadScript(src,attribute,onload){
    if(document.querySelector(`script[${attribute}]`)){
      if(onload) onload();
      return;
    }
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.setAttribute(attribute,'1');
    if(onload) script.onload=onload;
    document.head.appendChild(script);
  }

  function loadMinuteControls(){
    if(!document.querySelector('link[data-minute-controls]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href=`time-minutes.css?v=${VERSION}`;
      link.dataset.minuteControls='1';
      document.head.appendChild(link);
    }
    loadScript(`time-minutes.js?v=${VERSION}`,'data-minute-controls',()=>{
      loadScript(`sync-total-time.js?v=${VERSION}`,'data-sync-total-time');
    });
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