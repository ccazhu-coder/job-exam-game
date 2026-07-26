(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const getState = () => window.eval('state');
  const call = (name, ...args) => typeof window[name] === 'function' ? window[name](...args) : undefined;
  let mirrorTimerId = null;
  let pickerMode = 'select';
  let pickerReplaceIndex = null;
  let pickerPool = [];
  let pickerOrder = [];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char]));
  }

  function getPool() {
    try {
      const pool = window.eval('roundPool()');
      return Array.isArray(pool) ? pool : [];
    } catch (_) {
      return [];
    }
  }

  function questionSetFrom(questions) {
    const labels = window.eval('roundLabels');
    return {
      id: questions.map(q => q.id).join('、'),
      category: `${labels[getState().round]}｜5題練習組`,
      question: questions.map((q, i) => `${i + 1}. ${q.question}`).join(String.fromCharCode(10, 10)),
      intent: '觀察學員能否在不同題型中，保持回答架構、職務連結與安全意識。',
      hint: '每題先說結論，再補充理由或實例；老師可在每題開始前重新啟動倒數。',
      questions: questions.map(q => JSON.parse(JSON.stringify(q)))
    };
  }

  function sessionHasScores() {
    const state = getState();
    return Boolean(state.syncSession?.tokens?.some(token => state.attempts.some(attempt => attempt.token === token)));
  }

  function markQuestionsUsed(questions) {
    const state = getState();
    try {
      const key = window.eval('usedKey()');
      state.used[key] = state.used[key] || [];
      questions.forEach(question => {
        const id = String(question.id);
        if (!state.used[key].includes(id)) state.used[key].push(id);
      });
    } catch (_) {}
  }

  function publishQuestionSet(questions, label = '老師指定5題') {
    if (!Array.isArray(questions) || questions.length !== 5) {
      call('toast', '請選滿5題');
      return;
    }
    const state = getState();
    const set = questionSetFrom(questions);
    const base = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tokens = [0, 1, 2, 3].map(index => `${base}-team-${index}`);

    call('snapshot', label);
    state.activeTeam = 0;
    state.current = set;
    state.currentToken = tokens[0];
    state.currentSaved = false;
    state.criteria = [3, 3, 3, 3, 3];
    state.syncSession = {
      createdAt: new Date().toISOString(),
      source: label,
      questionSet: JSON.parse(JSON.stringify(set)),
      tokens
    };
    markQuestionsUsed(questions);
    call('resetTimer', false);
    call('log', `${label}｜四組同步｜題號 ${questions.map(q => q.id).join('、')}`);
    call('renderAll');
    call('safeSave');
    renderSync(true);
    flashDraw();
  }

  function flashDraw() {
    const flash = document.createElement('div');
    flash.className = 'sync-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 520);
    if (typeof window.gameFxSound === 'function') window.gameFxSound('draw');
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
          <div><h2>四組同步練習</h2><p>老師控制抽題｜四組共用同一組5題</p></div>
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
          <div class="sync-list" id="syncQuestionList"><div class="sync-empty">老師可選擇「隨機抽5題」或「老師手動選5題」。</div></div>
          <div class="sync-meta"><span id="syncQuestionNos">題號：—</span><span>每題右側可單獨替換｜四組同題同步練習</span></div>
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
        <button class="btn btn-primary" id="syncDrawBtn">🎲 隨機抽5題</button>
        <button class="btn btn-gold" id="syncManualBtn">☑ 老師手動選5題</button>
        <button class="btn btn-ghost" id="syncChangeBtn">重新隨機5題</button>
        <button class="btn btn-ghost" id="syncFollowBtn">❓ 追問題</button>
        <button class="btn btn-ghost" id="syncEventBtn">⚡ 事件卡</button>
        <button class="btn btn-gold" id="syncNextAllBtn">🔄 四組下一位</button>
      </footer>`;
    document.body.appendChild(overlay);
    bindOverlay();
  }

  function ensurePicker() {
    if (byId('syncPickerOverlay')) return;
    const picker = document.createElement('div');
    picker.id = 'syncPickerOverlay';
    picker.className = 'sync-picker-overlay';
    picker.innerHTML = `
      <div class="sync-picker-card" role="dialog" aria-modal="true" aria-labelledby="syncPickerTitle">
        <div class="sync-picker-head">
          <div><h3 id="syncPickerTitle">老師手動選5題</h3><p id="syncPickerSubtitle">從目前輪次題庫中勾選5題</p></div>
          <button class="sync-picker-close" id="syncPickerCloseBtn" aria-label="關閉">×</button>
        </div>
        <div class="sync-picker-tools">
          <input id="syncPickerSearch" type="search" placeholder="搜尋題號、類別或題目內容">
          <span id="syncPickerCount">已選0題</span>
        </div>
        <div class="sync-picker-list" id="syncPickerList"></div>
        <div class="sync-picker-actions">
          <button class="btn btn-ghost" id="syncPickerClearBtn">清除選取</button>
          <button class="btn btn-ghost" id="syncPickerCancelBtn">取消</button>
          <button class="btn btn-primary" id="syncPickerConfirmBtn">套用題目</button>
        </div>
      </div>`;
    document.body.appendChild(picker);
    byId('syncPickerCloseBtn').addEventListener('click', closePicker);
    byId('syncPickerCancelBtn').addEventListener('click', closePicker);
    byId('syncPickerClearBtn').addEventListener('click', () => { pickerOrder = []; renderPickerList(); });
    byId('syncPickerConfirmBtn').addEventListener('click', confirmPicker);
    byId('syncPickerSearch').addEventListener('input', renderPickerList);
    picker.addEventListener('click', event => { if (event.target === picker) closePicker(); });
  }

  function bindOverlay() {
    byId('syncCloseBtn').addEventListener('click', closeSyncMode);
    byId('syncFullscreenBtn').addEventListener('click', () => call('fullscreen'));
    byId('syncDrawBtn').addEventListener('click', () => drawForAll(false));
    byId('syncManualBtn').addEventListener('click', () => openPicker('select'));
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
      if (byId('syncPickerOverlay')?.classList.contains('open')) {
        if (event.key === 'Escape') closePicker();
        return;
      }
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if (event.key === 'Escape') closeSyncMode();
      if (event.key.toLowerCase() === 'd') drawForAll(false);
      if (event.key.toLowerCase() === 'm') openPicker('select');
      if (event.key.toLowerCase() === 'n') advanceAllTeams();
    });
  }

  function openSyncMode() {
    ensureOverlay();
    ensurePicker();
    const overlay = byId('syncOverlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderSync();
    startTimerMirror();
    if (typeof window.gameFxSound === 'function') window.gameFxSound('open');
  }

  function closeSyncMode() {
    closePicker();
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
    const currentQuestions = state.current?.questions;
    if (!Array.isArray(currentQuestions) || currentQuestions.length !== 5) {
      call('toast', '目前題庫無法抽出5題');
      return;
    }
    publishQuestionSet(currentQuestions, isChange ? '重新隨機5題' : '隨機抽5題');
  }

  function openPicker(mode, replaceIndex = null) {
    ensurePicker();
    pickerMode = mode;
    pickerReplaceIndex = replaceIndex;
    pickerPool = getPool();
    const state = getState();
    const current = state.syncSession?.questionSet?.questions || [];

    if (mode === 'replace') {
      if (!current.length) {
        call('toast', '請先抽出或選定5題');
        return;
      }
      if (sessionHasScores()) {
        call('toast', '已有小組完成評分，請先進入下一回合再換題');
        return;
      }
      const otherIds = new Set(current.filter((_, index) => index !== replaceIndex).map(q => String(q.id)));
      pickerPool = pickerPool.filter(q => !otherIds.has(String(q.id)));
      pickerOrder = [];
      byId('syncPickerTitle').textContent = `替換第${replaceIndex + 1}題`;
      byId('syncPickerSubtitle').textContent = '選擇1題後套用，其餘4題保持不變';
      byId('syncPickerClearBtn').classList.add('hidden');
    } else {
      pickerOrder = current.map(q => String(q.id));
      byId('syncPickerTitle').textContent = '老師手動選5題';
      byId('syncPickerSubtitle').textContent = '從目前輪次與求職方向的題庫中勾選5題';
      byId('syncPickerClearBtn').classList.remove('hidden');
    }

    byId('syncPickerSearch').value = '';
    renderPickerList();
    byId('syncPickerOverlay').classList.add('open');
    setTimeout(() => byId('syncPickerSearch').focus(), 30);
  }

  function closePicker() {
    byId('syncPickerOverlay')?.classList.remove('open');
  }

  function togglePickerQuestion(id) {
    const value = String(id);
    const existingIndex = pickerOrder.indexOf(value);
    if (existingIndex >= 0) {
      pickerOrder.splice(existingIndex, 1);
    } else {
      const max = pickerMode === 'replace' ? 1 : 5;
      if (pickerOrder.length >= max) {
        if (pickerMode === 'replace') pickerOrder = [value];
        else call('toast', '最多只能選5題');
      } else {
        pickerOrder.push(value);
      }
    }
    renderPickerList();
  }

  function renderPickerList() {
    const list = byId('syncPickerList');
    if (!list) return;
    const keyword = (byId('syncPickerSearch')?.value || '').trim().toLowerCase();
    const filtered = pickerPool.filter(question => {
      const haystack = `${question.id} ${question.category} ${question.question}`.toLowerCase();
      return !keyword || haystack.includes(keyword);
    });
    list.innerHTML = filtered.length ? filtered.map(question => {
      const selected = pickerOrder.includes(String(question.id));
      const order = pickerOrder.indexOf(String(question.id)) + 1;
      return `<button type="button" class="sync-pick-row${selected ? ' selected' : ''}" data-pick-id="${escapeHtml(question.id)}">
        <span class="sync-pick-check">${selected ? (pickerMode === 'replace' ? '✓' : order) : ''}</span>
        <span class="sync-pick-content"><b>題號 ${escapeHtml(question.id)}｜${escapeHtml(question.category)}</b><span>${escapeHtml(question.question)}</span></span>
      </button>`;
    }).join('') : '<div class="sync-picker-empty">找不到符合的題目</div>';
    list.querySelectorAll('[data-pick-id]').forEach(button => {
      button.addEventListener('click', () => togglePickerQuestion(button.dataset.pickId));
    });
    const required = pickerMode === 'replace' ? 1 : 5;
    byId('syncPickerCount').textContent = `已選${pickerOrder.length}題／需選${required}題`;
    byId('syncPickerConfirmBtn').disabled = pickerOrder.length !== required;
  }

  function confirmPicker() {
    const required = pickerMode === 'replace' ? 1 : 5;
    if (pickerOrder.length !== required) {
      call('toast', `請選滿${required}題`);
      return;
    }
    const selected = pickerOrder.map(id => pickerPool.find(question => String(question.id) === id)).filter(Boolean);
    if (selected.length !== required) {
      call('toast', '選題資料不完整，請重新選擇');
      return;
    }

    if (pickerMode === 'replace') {
      const state = getState();
      const current = state.syncSession?.questionSet?.questions || [];
      const next = current.map(q => JSON.parse(JSON.stringify(q)));
      next[pickerReplaceIndex] = selected[0];
      publishQuestionSet(next, `老師替換第${pickerReplaceIndex + 1}題`);
    } else {
      publishQuestionSet(selected, '老師手動選5題');
    }
    closePicker();
  }

  function advanceAllTeams() {
    const state = getState();
    call('snapshot', '四組同步下一位');
    state.teams.forEach(team => { team.member = (team.member + 1) % team.members.length; });
    state.current = null;
    state.currentToken = null;
    state.currentSaved = false;
    state.syncSession = null;
    state.criteria = [3, 3, 3, 3, 3];
    call('resetTimer', false);
    call('renderAll');
    call('safeSave');
    renderSync();
    if (typeof window.gameFxSound === 'function') window.gameFxSound('next');
    call('toast', '四組角色已同步輪替');
  }

  function scoreTeam(index) {
    const state = getState();
    const session = state.syncSession;
    if (!session?.questionSet) {
      call('toast', '請先抽出或選定5題');
      return;
    }
    state.activeTeam = index;
    state.current = JSON.parse(JSON.stringify(session.questionSet));
    state.currentToken = session.tokens[index];
    const existing = state.attempts.find(attempt => attempt.token === state.currentToken);
    state.currentSaved = Boolean(existing);
    state.criteria = existing ? [...existing.criteria] : [3, 3, 3, 3, 3];
    call('renderAll');
    call('safeSave');
    closeSyncMode();
    call('toast', `現在評分：${state.teams[index].name}`);
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
      list.innerHTML = '<div class="sync-empty">老師可選擇「隨機抽5題」或「老師手動選5題」。</div>';
      byId('syncQuestionNos').textContent = '題號：—';
      byId('syncReady').textContent = '尚未抽題';
      return;
    }
    list.innerHTML = set.questions.map((question, index) => `<div class="sync-question-item${animate ? ' fresh' : ''}">
      <span class="sync-qno">${index + 1}</span>
      <span class="sync-question-text">${escapeHtml(question.question)}</span>
      <button type="button" class="sync-replace-btn" data-replace-index="${index}" title="只替換這一題">換這題</button>
    </div>`).join('');
    list.querySelectorAll('[data-replace-index]').forEach(button => {
      button.addEventListener('click', () => openPicker('replace', Number(button.dataset.replaceIndex)));
    });
    byId('syncQuestionNos').textContent = `題號：${set.questions.map(question => question.id).join('、')}`;
    byId('syncReady').textContent = state.syncSession?.source || '四組同步作答中';
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
    ensurePicker();
    window.openFourGroupSync = openSyncMode;
    window.closeFourGroupSync = closeSyncMode;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();