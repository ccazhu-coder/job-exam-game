(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  let audioEnabled=localStorage.getItem('interviewGameSound')!=='off';
  let audioCtx=null;

  function tone(freq=520,duration=.08,type='sine',volume=.035){
    if(!audioEnabled)return;
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
      osc.type=type;osc.frequency.value=freq;gain.gain.value=volume;
      osc.connect(gain);gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(volume,audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
      osc.start();osc.stop(audioCtx.currentTime+duration);
    }catch(_){ }
  }
  function successSound(){tone(523,.08,'triangle');setTimeout(()=>tone(659,.1,'triangle'),85);setTimeout(()=>tone(784,.14,'triangle'),175)}
  function drawSound(){tone(330,.06,'square',.018);setTimeout(()=>tone(494,.11,'triangle',.03),70)}
  function nextSound(){tone(392,.07,'triangle');setTimeout(()=>tone(587,.12,'triangle'),80)}

  function ripple(event){
    const el=event.currentTarget;
    if(!el||el.disabled)return;
    const rect=el.getBoundingClientRect();
    const size=Math.max(rect.width,rect.height);
    const dot=document.createElement('span');
    dot.className='game-ripple';dot.style.width=dot.style.height=`${size}px`;
    dot.style.left=`${event.clientX-rect.left-size/2}px`;dot.style.top=`${event.clientY-rect.top-size/2}px`;
    el.appendChild(dot);setTimeout(()=>dot.remove(),600);
  }

  function enhanceQuestionList(){
    const box=byId('question');
    if(!box||!box.classList.contains('multi'))return;
    const raw=box.textContent.trim();
    if(!raw||box.dataset.gameSource===raw)return;
    box.dataset.gameSource=raw;
    const lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);
    if(lines.length<2)return;
    box.innerHTML='';
    lines.forEach((line,index)=>{
      const cleaned=line.replace(/^\d+[\.、]\s*/, '');
      const item=document.createElement('div');item.className='game-question-item';item.style.animationDelay=`${index*75}ms`;
      const no=document.createElement('span');no.className='game-question-number';no.textContent=String(index+1);
      const text=document.createElement('span');text.className='game-question-text';text.textContent=cleaned;
      item.append(no,text);box.appendChild(item);
    });
  }

  function animateDraw(){
    const card=byId('questionCard');if(!card)return;
    card.classList.remove('game-deal');void card.offsetWidth;card.classList.add('game-deal');
    setTimeout(enhanceQuestionList,30);drawSound();
  }

  function showTurnBanner(){
    let banner=document.querySelector('.game-turn-banner');
    if(!banner){banner=document.createElement('div');banner.className='game-turn-banner';banner.innerHTML='<small>下一位挑戰者</small><strong></strong>';document.body.appendChild(banner)}
    const label=(byId('playerStatus')?.textContent||'應徵者').replace('應徵者：','');
    banner.querySelector('strong').textContent=label;
    banner.classList.remove('show');void banner.offsetWidth;banner.classList.add('show');nextSound();
  }

  function confetti(count=52){
    const colors=['#38c7ff','#f3b63f','#7a6cff','#30b982','#e95562','#ffffff'];
    for(let i=0;i<count;i++){
      const c=document.createElement('i');c.className='game-confetti';
      c.style.left=`${Math.random()*100}vw`;c.style.background=colors[i%colors.length];
      c.style.setProperty('--fall',`${1.25+Math.random()*1.25}s`);
      c.style.setProperty('--drift',`${-110+Math.random()*220}px`);
      c.style.transform=`rotate(${Math.random()*180}deg)`;
      document.body.appendChild(c);setTimeout(()=>c.remove(),2800);
    }
  }

  function scoreAnimation(){
    const total=Number(byId('scoreTotal')?.textContent||0);
    const card=document.querySelector('.score-total');
    card?.classList.remove('game-score-pop');void card?.offsetWidth;card?.classList.add('game-score-pop');
    setTimeout(()=>document.querySelector('.rank-item')?.classList.add('game-rank-flash'),80);
    setTimeout(()=>document.querySelector('.rank-item')?.classList.remove('game-rank-flash'),900);
    if(total>=20){confetti(total>=24?80:48);successSound()}else tone(620,.1,'triangle');
  }

  function addSoundToggle(){
    const actions=document.querySelector('.top-actions');if(!actions||byId('soundToggleBtn'))return;
    const b=document.createElement('button');b.id='soundToggleBtn';b.className='icon-btn game-sound-btn';
    const refresh=()=>b.textContent=audioEnabled?'🔊 音效':'🔇 靜音';refresh();
    b.addEventListener('click',()=>{audioEnabled=!audioEnabled;localStorage.setItem('interviewGameSound',audioEnabled?'on':'off');refresh();if(audioEnabled)tone(660,.12,'triangle')});
    actions.appendChild(b);
  }

  function monitorTimer(){
    const timer=byId('timer');if(!timer)return;
    let last=timer.textContent;
    new MutationObserver(()=>{
      const text=timer.textContent.trim();if(text===last)return;last=text;
      timer.classList.remove('game-ticking');void timer.offsetWidth;timer.classList.add('game-ticking');
      const parts=text.match(/^(\d+):(\d+)$/);const seconds=parts?Number(parts[1])*60+Number(parts[2]):0;
      timer.classList.toggle('game-urgent',seconds>0&&seconds<=10);
      if(seconds>0&&seconds<=5)tone(760+(5-seconds)*40,.045,'square',.018);
      if(text==='時間到'){timer.classList.add('game-timeup');tone(220,.32,'sawtooth',.04);setTimeout(()=>timer.classList.remove('game-timeup'),1200)}
    }).observe(timer,{childList:true,characterData:true,subtree:true});
  }

  function monitorQuestions(){
    const q=byId('question');if(!q)return;
    new MutationObserver(()=>requestAnimationFrame(enhanceQuestionList)).observe(q,{childList:true,characterData:true,subtree:true});
    enhanceQuestionList();
  }

  function bindGameEvents(){
    document.querySelectorAll('.btn,.icon-btn,.tab,.preset,.score-option').forEach(el=>el.addEventListener('pointerdown',ripple));
    ['drawBtn','changeBtn','pDraw'].forEach(id=>byId(id)?.addEventListener('click',()=>setTimeout(animateDraw,15)));
    ['nextRoleBtn','pNext'].forEach(id=>byId(id)?.addEventListener('click',()=>setTimeout(showTurnBanner,35)));
    byId('saveScoreBtn')?.addEventListener('click',()=>setTimeout(scoreAnimation,70));
    byId('eventBtn')?.addEventListener('click',()=>setTimeout(()=>byId('challengeOverlay')?.classList.add('event-mode'),20));
    byId('followBtn')?.addEventListener('click',()=>byId('challengeOverlay')?.classList.remove('event-mode'));
    byId('closeChallenge')?.addEventListener('click',()=>byId('challengeOverlay')?.classList.remove('event-mode'));
    document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>tone(460,.065,'triangle',.025)));
  }

  function renameExports(){
    const download=(content,name,type)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
    byId('exportBtn')?.addEventListener('click',event=>{
      if(typeof state==='undefined'||typeof CRITERIA==='undefined')return;
      event.preventDefault();event.stopImmediatePropagation();
      const cell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
      const rows=[['面談演練闖關遊戲｜面談紀錄'],['匯出時間',new Date().toLocaleString('zh-TW')],[],['時間','組別','應徵者','輪次','求職方向','題號','類別','題目',...CRITERIA,'總分','評語'],...state.attempts.map(a=>[a.time,a.team,a.player,a.round,a.career,a.questionId,a.category,a.question,...a.criteria,a.total,a.comment]),[],['組別','累計分數','完成題數'],...state.teams.map(t=>[t.name,t.score,t.attempts])];
      download('\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\n'),'面談演練闖關遊戲_面談成績.csv','text/csv;charset=utf-8');tone(680,.1,'triangle');
    },true);
    byId('backupBtn')?.addEventListener('click',event=>{
      if(typeof state==='undefined')return;
      event.preventDefault();event.stopImmediatePropagation();download(JSON.stringify(state,null,2),'面談演練闖關遊戲_課程備份.json','application/json');tone(680,.1,'triangle');
    },true);
  }

  function loadFourGroupMode(){
    if(!document.querySelector('link[data-sync-mode]')){
      const link=document.createElement('link');
      link.rel='stylesheet';link.href='sync-mode.css?v=20260726-7';link.dataset.syncMode='1';
      document.head.appendChild(link);
    }
    if(!document.querySelector('script[data-sync-mode]')){
      const script=document.createElement('script');
      script.src='sync-mode.js?v=20260726-7';script.dataset.syncMode='1';
      document.body.appendChild(script);
    }
  }

  window.gameFxSound=kind=>{
    if(kind==='draw')drawSound();
    else if(kind==='next')nextSound();
    else if(kind==='success')successSound();
    else tone(520,.08,'triangle');
  };

  function init(){
    document.title='面談演練闖關遊戲｜正式上課版';
    addSoundToggle();bindGameEvents();monitorTimer();monitorQuestions();renameExports();loadFourGroupMode();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();