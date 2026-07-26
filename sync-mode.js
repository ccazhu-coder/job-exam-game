(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const getState = () => window.eval('state');
  const call = (name, ...args) => typeof window[name] === 'function' ? window[name](...args) : undefined;
  let mirrorTimerId = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function ensureButton() {
    if (byId('syncModeBtn')) return;
    const button = document.createElement('button');
    button.id = 'syncModeBtn';
    button.className = 'icon-btn';
    button.textContent = '四組同步';
    button.title = '一台電腦投影，四組共用同一組5題同步練習';
    const anchor = byId('presentationBtn');
    anchor?.parentElement?.insertBefore(button, anchor);
    button.addEventListener('click', openSyncMode);
  }

  function ensureOverlay() {
    if (byId('syncOverlay')) return;
    const overlay = document.createElement('section');
    overlay.id = 'syncOverlay';
    overlay.className = 'sync-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <header class="sync-head">
        <div class="sync-title">
          <div class="sync-title-icon">🎯</div>
          <div><h2>四組同步練習</h2><p>單一電腦投影｜四組共用同一組5題</p></div>
        </div>
        <div class="sync-settings">
          <select id="syncRoundSelect" aria-label="面試輪次">
            <option value="warmup">第一輪｜暖身面試</option>
            <option value="scenario">第二輪｜情境挑戰</option>
            <option value="career">第三輪｜職類面試</option>
            <option value="offer">第四輪｜Offer談判</option>
            <option value="pk">最終關｜面試PK</option>
          </select>
          <select id="syncCareerSelect" aria-label="求職方向">
            <option value="pilot">無人機操作／飛手</option>
            <option value="media">空拍攝影／影像製作</option>
            <option value="inspection">巡檢／測繪／工程應用</option>
            <option value="project">專案行政／業務助理</option>
          </select>
          <select id="syncSecondsSelect" aria-label="每題時間">
            <option value="60">每題60秒</option>
            <option value="90">每題90秒</option>
            <option value="120">每題120秒</option>
            <option value="180">每題180秒</option>
          </select>
        </div>
        <div class="sync-head-actions">
          <button class="btn btn-ghost" id="syncFullscreenBtn">全螢幕</button>
          <button class="btn btn-red" id="syncCloseBtn">退出同步</button>
        </div>
      </header>
      <div class="sync-groups" id="syncGroups"></div>
      <main class="sync-main">
        <article class="sync-question-panel">
          <div class="sync-question-head">
            <span class="sync-round-pill" id="syncRoundPill">第一輪｜暖身面試</span>
            <span class="sync-ready" id="syncReady">尚未抽題</span>
          </div>
          <div class="sync-list" id="syncQuestionList"><div class="sync-empty">老師按下「同步抽5題」後，四組一起開始練習。</div></div>
          <div class="sync-meta"><span id="syncQuestionNos">題號：—</span><span>四組同題｜每組自行分配應徵者、面試官、觀察員與紀錄員</span></div>
        </article>
        <aside class="sync-timer-panel">
          <div class="sync-timer-label">全班共用倒數</div>
          <div class="sync-timer" id="syncTimer">01:30</div>
          <div class="sync-mini-controls">
            <button class="btn btn-green" id="syncStartBtn">▶ 開始</button>
            <button class="btn btn-ghost" id="syncPauseBtn">⏸ 暫停</button>
            <button class="btn btn-ghost" id="syncResetTimerBtn">↺ 重設</button>
            <button class="btn btn-ghost" id="syncPlusBtn">＋10秒</button>
          </div>
          <div class="sync-instruction">每題回答完可按「重設」重新計時。<br>全部5題完成後，再依序點各組「評分」。</div>
        </aside>
      </main>
      <footer class="sync-toolbar">
        <button class="btn btn-primary" id="syncDrawBtn">🎴 同步抽5題</button>
        <button class="btn btn-ghost" id="syncChangeBtn">換5題</button>
        <button class="btn btn-ghost" id="syncFollowBtn">❓ 追問題</button>
        <button class="btn btn-ghost" id="syncEventBtn">⚡ 事件卡</button>
        <button class="btn btn-gold" id="syncNextAllBtn">🔄 四組下一位</button>
      </footer>`;
    document.body.appendChild(overlay);
    bindOverlay();
  }

  function bindOverlay() {
    byId('syncCloseBtn').addEventListener('click', closeSyncMode);
    byId('syncFullscreenBtn').addEventListener('click', () => call('fullscreen'));
    byId('syncDrawBtn').addEventListener('click', () => drawForAll(false));
    byId('syncChangeBtn').addEventListener('click', () => drawForAll(true));
    byId('syncStartBtn').addEventListener('click', () => call('startTimer'));
    byId('syncPauseBtn').addEventListener('click', () => { call('stopTimer'); call('safeSave'); });
    byId('syncResetTimerBtn').addEventListener('click', () => call('resetTimer'));
    byId('syncPlusBtn').addEventListener('click', () => call('adjustTimer', 10));
    byId('syncFollowBtn').addEventListener('click', () => byId('followBtn')?.click());
    byId('syncEventBtn').addEventListener('click', () => byId('eventBtn')?.click());
    byId('syncNextAllBtn').addEventListener('click', advanceAllTeams);

    byId('syncRoundSelect').addEventListener('change', event => {
      call('setRound', event.target.value);
      const state = getState();
      state.syncSession = null;
      renderSync();
    });
    byId('syncCareerSelect').addEventListener('change', event => {
      call('setCareer', event.target.value);
      const state = getState();
      state.syncSession = null;
      renderSync();
    });
    byId('syncSecondsSelect').addEventListener('change', event => {
      const state = getState();
      state.answerSeconds = Number(event.target.value);
      call('resetTimer');
      renderTimerMirror();
    });

    document.addEventListener('keydown', event => {
      if (!byId('syncOverlay')?.classList.contains('open')) return;
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if (event.key === 'Escape') closeSyncMode();
      if (event.key.toLowerCase() === 'd') drawForAll(false);
      if (event.key.toLowerCase() === 'n') advanceAllTeams();
    });
  }

  function openSyncMode() {
    ensureOverlay();
    const overlay = byId('syncOverlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderSync();
    startTimerMirror();
    if (typeof window.gameFxSound === 'function') window.gameFxSound('open');
  }

  function closeSyncMode() {
    const overlay = byId('syncOverlay');
    overlay?.classList.remove('open');
    overlay?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    stopTimerMirror();
  }

  function drawForAll(isChange) {
    const state = getState();
    state.activeTeam = 0;
    call('drawQuestion', isChange);
    const current = state.current ? JSON.parse(JSON.stringify(state.current)) : null;
    const base = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.syncSession = {
      createdAt: new Date().toISOString(),
      questionSet: current,
      tokens: [0,1,2,3].map(index => `${base}-team-${index}`)
    };
    call('safeSave');
    renderSync(true);
    const flash = document.createElement('div');
    flash.className = 'sync-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 520);
    if (typeof window.gameFxSound === 'function') window.gameFxSound('draw');
  }

  function advanceAllTeams() {
    const state = getState();
    if (typeof window.snapshot === 'function') window.snapshot('四組同步下一位');
    state.teams.forEach(team => { team.member = (team.member + 1) % team.members.length; });
    state.current = null;
    state.currentToken = null;
    state.currentSaved = false;
    state.syncSession = null;
    state.criteria = [3,3,3,3,3];
    call('resetTimer', false);
    call('renderAll');
    call('safeSave');
    renderSync();
    if (typeof window.gameFxSound === 'function') window.gameFxSound('next');
    if (typeof window.toast === 'function') window.toast('四組角色已同步輪替');
  }

  function scoreTeam(index) {
    const state = getState();
    const session = state.syncSession;
    if (!session?.questionSet) {
      if (typeof window.toast === 'function') window.toast('請先同步抽5題');
      return;
    }
    state.activeTeam = index;
    state.current = JSON.parse(JSON.stringify(session.questionSet));
    state.currentToken = session.tokens[index];
    const existing = state.attempts.find(attempt => attempt.token === state.currentToken);
    state.currentSaved = Boolean(existing);
    state.criteria = existing ? [...existing.criteria] : [3,3,3,3,3];
    call('renderAll');
    call('safeSave');
    closeSyncMode();
    if (typeof window.toast === 'function') window.toast(`現在評分：${state.teams[index].name}`);
  }

  function renderGroups() {
    const state = getState();
    const container = byId('syncGroups');
    if (!container) return;
    container.innerHTML = state.teams.map((team, index) => {
      const candidate = team.members[team.member];
      const interviewer = team.members[(team.member + 1) % team.members.length];
      const token = state.syncSession?.tokens?.[index];
      const scored = token && state.attempts.some(attempt => attempt.token === token);
      return `<div class="sync-group"><div><b>${escapeHtml(team.name)}｜應徵者：${escapeHtml(candidate)}</b><span>面試官：${escapeHtml(interviewer)}${scored ? '｜✓ 已評分' : ''}</span></div><button class="sync-score-btn" data-sync-score="${index}">${scored ? '修改評分' : '評分'}</button></div>`;
    }).join('');
    container.querySelectorAll('[data-sync-score]').forEach(button => {
      button.addEventListener('click', () => scoreTeam(Number(button.dataset.syncScore)));
    });
  }

  function renderQuestions(animate = false) {
    const state = getState();
    const set = state.syncSession?.questionSet || (state.current?.questions ? state.current : null);
    const list = byId('syncQuestionList');
    if (!list) return;
    if (!set?.questions?.length) {
      list.innerHTML = '<div class="sync-empty">老師按下「同步抽5題」後，四組一起開始練習。</div>';
      byId('syncQuestionNos').textContent = '題號：—';
      byId('syncReady').textContent = '尚未抽題';
      return;
    }
    list.innerHTML = set.questions.map((question, index) => `<div class="sync-question-item${animate ? ' fresh' : ''}"><span class="sync-qno">${index + 1}</span><span>${escapeHtml(question.question)}</span></div>`).join('');
    byId('syncQuestionNos').textContent = `題號：${set.questions.map(question => question.id).join('、')}`;
    byId('syncReady').textContent = '四組同步作答中';
  }

  function renderTimerMirror() {
    const state = getState();
    const timer = byId('syncTimer');
    if (!timer) return;
    const seconds = Math.max(0, Number(state.seconds || 0));
    timer.textContent = seconds === 0 ? '時間到' : `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
    timer.classList.toggle('warning', seconds > 0 && seconds <= 10);
  }

  function startTimerMirror() {
    stopTimerMirror();
    mirrorTimerId = window.setInterval(renderTimerMirror, 200);
  }

  function stopTimerMirror() {
    if (mirrorTimerId) window.clearInterval(mirrorTimerId);
    mirrorTimerId = null;
  }

  function renderSync(animate = false) {
    const state = getState();
    byId('syncRoundSelect').value = state.round;
    byId('syncCareerSelect').value = state.career;
    byId('syncSecondsSelect').value = String(state.answerSeconds);
    const labels = window.eval('roundLabels');
    byId('syncRoundPill').textContent = labels[state.round];
    renderGroups();
    renderQuestions(animate);
    renderTimerMirror();
  }

  function init() {
    ensureButton();
    ensureOverlay();
    window.openFourGroupSync = openSyncMode;
    window.closeFourGroupSync = closeSyncMode;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();