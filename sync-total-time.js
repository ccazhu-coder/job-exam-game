(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  let tickId=null;
  let lastSessionId='';

  function getState(){
    try{return window.eval('state');}catch(_){return null;}
  }

  function ensureTimerState(){
    const state=getState();
    if(!state) return null;
    if(!state.syncTimer||typeof state.syncTimer!=='object'){
      state.syncTimer={totalSeconds:900,seconds:900,running:false,endAt:null};
    }
    const timer=state.syncTimer;
    timer.totalSeconds=Math.max(60,Number(timer.totalSeconds)||900);
    timer.seconds=Math.max(0,Number(timer.seconds));
    if(!Number.isFinite(timer.seconds)) timer.seconds=timer.totalSeconds;
    return timer;
  }

  function format(seconds){
    const value=Math.max(0,Math.ceil(Number(seconds)||0));
    const hours=Math.floor(value/3600);
    const minutes=Math.floor((value%3600)/60);
    const secs=value%60;
    return hours>0
      ? `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
      : `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }

  function currentSeconds(timer){
    if(timer.running&&timer.endAt){
      return Math.max(0,Math.ceil((timer.endAt-Date.now())/1000));
    }
    return Math.max(0,Math.ceil(timer.seconds));
  }

  function save(){
    try{if(typeof safeSave==='function')safeSave();}catch(_){}
  }

  function render(){
    const timer=ensureTimerState();
    if(!timer) return;
    const seconds=currentSeconds(timer);
    timer.seconds=seconds;
    if(timer.running&&seconds<=0){
      timer.running=false;
      timer.endAt=null;
      save();
      try{if(typeof beep==='function')beep(880,.35);}catch(_){}
      try{if(typeof toast==='function')toast('四組同步時間到');}catch(_){}
    }
    const display=byId('syncTimer');
    if(display){
      display.textContent=seconds===0?'時間到':format(seconds);
      display.classList.toggle('warning',seconds>0&&seconds<=60);
    }
    const input=byId('syncSecondsSelect');
    if(input&&document.activeElement!==input){
      input.value=String(Math.round((timer.totalSeconds/60)*10)/10);
    }
    const label=document.querySelector('#syncOverlay .sync-timer-label');
    if(label) label.textContent='本輪總時間倒數';
    const instruction=document.querySelector('#syncOverlay .sync-instruction');
    if(instruction) instruction.innerHTML='老師直接設定本輪總分鐘數，不依題數或組數相乘。<br>四組完成後，再依序點各組「評分」。';
  }

  function start(){
    const timer=ensureTimerState();
    if(!timer) return;
    if(currentSeconds(timer)<=0) timer.seconds=timer.totalSeconds;
    timer.running=true;
    timer.endAt=Date.now()+timer.seconds*1000;
    save();
    render();
  }

  function pause(){
    const timer=ensureTimerState();
    if(!timer) return;
    timer.seconds=currentSeconds(timer);
    timer.running=false;
    timer.endAt=null;
    save();
    render();
  }

  function reset(){
    const timer=ensureTimerState();
    if(!timer) return;
    timer.running=false;
    timer.endAt=null;
    timer.seconds=timer.totalSeconds;
    save();
    render();
  }

  function addMinute(){
    const timer=ensureTimerState();
    if(!timer) return;
    timer.seconds=currentSeconds(timer)+60;
    if(timer.running) timer.endAt=Date.now()+timer.seconds*1000;
    save();
    render();
  }

  function applyMinutes(input){
    const timer=ensureTimerState();
    if(!timer) return;
    let minutes=Number(input.value);
    if(!Number.isFinite(minutes)) minutes=timer.totalSeconds/60;
    minutes=Math.min(180,Math.max(1,Math.round(minutes*2)/2));
    timer.totalSeconds=Math.round(minutes*60);
    timer.seconds=timer.totalSeconds;
    timer.running=false;
    timer.endAt=null;
    input.value=String(minutes);
    save();
    render();
    try{if(typeof toast==='function')toast(`四組同步本輪時間：${minutes} 分鐘`);}catch(_){}
  }

  function replaceButton(id,text,handler){
    const old=byId(id);
    if(!old||old.dataset.syncTotalBound==='1') return;
    const button=old.cloneNode(true);
    button.id=id;
    button.textContent=text;
    button.dataset.syncTotalBound='1';
    old.replaceWith(button);
    button.addEventListener('click',handler);
  }

  function configureInput(){
    const old=byId('syncSecondsSelect');
    if(!old||old.dataset.syncTotalBound==='1') return;
    const timer=ensureTimerState();
    const input=document.createElement('input');
    input.type='number';
    input.id='syncSecondsSelect';
    input.min='1';
    input.max='180';
    input.step='0.5';
    input.inputMode='decimal';
    input.value=String(Math.round((timer.totalSeconds/60)*10)/10);
    input.setAttribute('aria-label','本輪總時間（分鐘）');
    input.title='老師自行設定本輪總時間，不依題數或組數相乘';
    input.dataset.syncTotalBound='1';
    const parent=old.parentElement;
    if(parent&&parent.classList.contains('minute-input-wrap')){
      parent.replaceChild(input,old);
      const unit=parent.querySelector('.minute-unit');
      if(unit) unit.textContent='分鐘／本輪';
    }else{
      old.replaceWith(input);
    }
    input.addEventListener('change',()=>applyMinutes(input));
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        applyMinutes(input);
        input.blur();
      }
    });
  }

  function resetForNewQuestionSet(){
    const state=getState();
    if(!state) return;
    const sessionId=state.syncSession?.createdAt||'';
    if(sessionId&&sessionId!==lastSessionId){
      lastSessionId=sessionId;
      const timer=ensureTimerState();
      timer.running=false;
      timer.endAt=null;
      timer.seconds=timer.totalSeconds;
      save();
    }
  }

  function ensure(){
    if(!byId('syncOverlay')) return;
    configureInput();
    replaceButton('syncStartBtn','▶ 開始',start);
    replaceButton('syncPauseBtn','⏸ 暫停',pause);
    replaceButton('syncResetTimerBtn','↺ 重設',reset);
    replaceButton('syncPlusBtn','＋1分鐘',addMinute);
    resetForNewQuestionSet();
    render();
  }

  function init(){
    ensureTimerState();
    ensure();
    const observer=new MutationObserver(ensure);
    observer.observe(document.body,{childList:true,subtree:true});
    tickId=setInterval(()=>{ensure();render();},200);
    window.addEventListener('beforeunload',pause);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();