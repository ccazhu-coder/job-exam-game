(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const formatMinutes=seconds=>{
    const value=Math.max(.5,Number(seconds||90)/60);
    return Number.isInteger(value)?String(value):String(Math.round(value*10)/10);
  };
  const parseMinutes=value=>{
    const n=Number(value);
    if(!Number.isFinite(n)) return null;
    return Math.min(30,Math.max(.5,Math.round(n*2)/2));
  };
  function wrapMinuteInput(oldElement,isSync=false){
    if(!oldElement||oldElement.dataset.minuteReady==='1') return oldElement;
    const input=document.createElement('input');
    input.type='number';
    input.id=oldElement.id;
    input.min='0.5';
    input.max='30';
    input.step='0.5';
    input.inputMode='decimal';
    input.autocomplete='off';
    input.setAttribute('aria-label',isSync?'每題時間（分鐘）':'每題回答時間（分鐘）');
    input.value=formatMinutes(typeof state!=='undefined'?state.answerSeconds:90);
    input.dataset.minuteReady='1';
    const wrap=document.createElement('div');
    wrap.className='minute-input-wrap';
    const unit=document.createElement('span');
    unit.className='minute-unit';
    unit.textContent='分鐘';
    oldElement.replaceWith(wrap);
    wrap.append(input,unit);
    if(!isSync){
      const help=document.createElement('div');
      help.className='minute-help';
      help.textContent='可輸入 1、1.5、2、3…，最少 0.5 分鐘。';
      wrap.insertAdjacentElement('afterend',help);
    }
    const apply=()=>{
      if(typeof state==='undefined') return;
      const minutes=parseMinutes(input.value);
      if(minutes===null){ input.value=formatMinutes(state.answerSeconds); return; }
      input.value=String(minutes);
      state.answerSeconds=Math.round(minutes*60);
      if(typeof resetTimer==='function') resetTimer();
      if(typeof safeSave==='function') safeSave();
      const other=byId(isSync?'answerSeconds':'syncSecondsSelect');
      if(other&&other!==input) other.value=String(minutes);
      if(typeof toast==='function') toast(`每題時間已設定為 ${minutes} 分鐘`);
    };
    input.addEventListener('change',apply);
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}});
    return input;
  }
  function updateMain(){
    const old=byId('answerSeconds');
    if(old&&!old.dataset.minuteReady){
      const label=old.previousElementSibling;
      if(label&&label.tagName==='LABEL') label.textContent='每題回答時間（分鐘）';
      wrapMinuteInput(old,false);
    }
    const minus=byId('minusTimerBtn');
    const plus=byId('plusTimerBtn');
    if(minus&&!minus.dataset.minuteControl){
      minus.textContent='−1分鐘';
      minus.onclick=()=>typeof adjustTimer==='function'&&adjustTimer(-60);
      minus.dataset.minuteControl='1';
    }
    if(plus&&!plus.dataset.minuteControl){
      plus.textContent='＋1分鐘';
      plus.onclick=()=>typeof adjustTimer==='function'&&adjustTimer(60);
      plus.dataset.minuteControl='1';
    }
  }
  function updateSync(){
    const old=byId('syncSecondsSelect');
    if(old&&!old.dataset.minuteReady) wrapMinuteInput(old,true);
    const plus=byId('syncPlusBtn');
    if(plus&&!plus.dataset.minuteControl){
      const replacement=plus.cloneNode(true);
      replacement.textContent='＋1分鐘';
      replacement.dataset.minuteControl='1';
      plus.replaceWith(replacement);
      replacement.addEventListener('click',()=>typeof adjustTimer==='function'&&adjustTimer(60));
    }
  }
  function patchRenderers(){
    if(typeof renderStatus==='function'&&!renderStatus.__minutesPatched){
      const original=renderStatus;
      renderStatus=function(){
        original();
        updateMain();
        const input=byId('answerSeconds');
        if(input) input.value=formatMinutes(state.answerSeconds);
      };
      renderStatus.__minutesPatched=true;
    }
    if(typeof renderSync==='function'&&!renderSync.__minutesPatched){
      const originalSync=renderSync;
      renderSync=function(...args){
        originalSync(...args);
        updateSync();
        const input=byId('syncSecondsSelect');
        if(input) input.value=formatMinutes(state.answerSeconds);
      };
      renderSync.__minutesPatched=true;
    }
  }
  function init(){
    patchRenderers();
    updateMain();
    updateSync();
    const main=byId('answerSeconds');
    if(main) main.value=formatMinutes(typeof state!=='undefined'?state.answerSeconds:90);
    const sync=byId('syncSecondsSelect');
    if(sync) sync.value=formatMinutes(typeof state!=='undefined'?state.answerSeconds:90);
    const observer=new MutationObserver(()=>{updateMain();updateSync();});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();