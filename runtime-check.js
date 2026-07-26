(() => {
  'use strict';

  const errors = [];
  const warnings = [];
  const byId = id => document.getElementById(id);
  const hasFn = name => typeof window[name] === 'function';
  const call = (name, ...args) => {
    if (!hasFn(name)) {
      errors.push(`缺少功能：${name}`);
      showFailure();
      return undefined;
    }
    return window[name](...args);
  };
  const bindClick = (id, handler) => {
    const el = byId(id);
    if (!el) {
      errors.push(`缺少按鈕：#${id}`);
      return;
    }
    if (typeof el.onclick !== 'function' && el.dataset.runtimeBound !== '1') {
      el.addEventListener('click', handler);
      el.dataset.runtimeBound = '1';
      warnings.push(`已自動補綁：#${id}`);
    }
  };
  const bindChange = (id, handler) => {
    const el = byId(id);
    if (!el) {
      errors.push(`缺少欄位：#${id}`);
      return;
    }
    if (typeof el.onchange !== 'function' && el.dataset.runtimeChangeBound !== '1') {
      el.addEventListener('change', handler);
      el.dataset.runtimeChangeBound = '1';
      warnings.push(`已自動補綁：#${id}`);
    }
  };

  function showFailure() {
    let banner = byId('systemErrorBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'systemErrorBanner';
      banner.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:9999;padding:12px 16px;border-radius:12px;background:#a71930;color:white;font-weight:800;box-shadow:0 12px 35px rgba(0,0,0,.3);white-space:pre-wrap';
      document.body.appendChild(banner);
    }
    banner.textContent = `系統載入不完整，請按 Ctrl＋F5 重新整理。\n${errors.join('｜')}`;
  }

  function wireFallbacks() {
    bindClick('splashHelpBtn', () => call('openOverlay', 'helpOverlay'));
    bindClick('helpBtn', () => call('openOverlay', 'helpOverlay'));
    bindClick('newGameBtn', () => {
      try { localStorage.removeItem('droneInterviewFormalV2'); } catch (_) {}
      call('enterApp', false);
    });
    bindClick('resumeBtn', () => call('enterApp', true));
    bindClick('setupBtn', () => { call('renderSetup'); call('openOverlay', 'setupOverlay'); });
    bindClick('saveSetupBtn', () => call('saveSetup'));
    bindClick('drawBtn', () => call('drawQuestion', false));
    bindClick('changeBtn', () => call('drawQuestion', true));
    bindClick('nextRoleBtn', () => call('nextRole'));
    bindClick('undoBtn', () => call('undo'));
    bindClick('followBtn', () => call('showChallenge', '面試官追問', FOLLOWUPS[Math.floor(Math.random() * FOLLOWUPS.length)]));
    bindClick('eventBtn', () => call('showChallenge', '突發事件卡', EVENTS[Math.floor(Math.random() * EVENTS.length)]));
    bindClick('closeChallenge', () => call('closeOverlay', 'challengeOverlay'));
    bindClick('startTimerBtn', () => call('startTimer'));
    bindClick('pauseTimerBtn', () => { call('stopTimer'); call('safeSave'); });
    bindClick('resetTimerBtn', () => call('resetTimer'));
    bindClick('minusTimerBtn', () => call('adjustTimer', -10));
    bindClick('plusTimerBtn', () => call('adjustTimer', 10));
    bindClick('saveScoreBtn', () => call('saveScore'));
    bindClick('exportBtn', () => call('exportCSV'));
    bindClick('backupBtn', () => call('backupJSON'));
    bindClick('importBtn', () => byId('importFile')?.click());
    bindClick('resetBtn', () => call('openOverlay', 'resetOverlay'));
    bindClick('confirmResetBtn', () => call('resetAll'));
    bindClick('printBtn', () => window.print());
    bindClick('clearLogBtn', () => {
      if (typeof window.snapshot === 'function') window.snapshot('清除紀錄顯示');
      try {
        const logBox = byId('log');
        if (logBox) logBox.innerHTML = '<div class="empty">尚無紀錄</div>';
      } catch (_) {}
    });
    bindClick('presentationBtn', () => call('presentation'));
    bindClick('fullscreenBtn', () => call('fullscreen'));
    bindClick('pDraw', () => call('drawQuestion', false));
    bindClick('pTimer', () => call('toggleTimer'));
    bindClick('pFollow', () => byId('followBtn')?.click());
    bindClick('pNext', () => call('nextRole'));
    bindClick('pExit', () => call('presentation', false));

    bindChange('roundSelect', event => call('setRound', event.target.value));
    bindChange('careerSelect', event => call('setCareer', event.target.value));
    bindChange('answerSeconds', event => {
      try {
        window.eval(`state.answerSeconds=${Number(event.target.value)}`);
        call('resetTimer');
      } catch (_) {
        warnings.push('回答時間欄位由主程式控制');
      }
    });

    const importFile = byId('importFile');
    if (importFile && typeof importFile.onchange !== 'function' && importFile.dataset.runtimeChangeBound !== '1') {
      importFile.addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (file) call('importJSON', file);
        event.target.value = '';
      });
      importFile.dataset.runtimeChangeBound = '1';
    }

    document.querySelectorAll('[data-close]').forEach(button => {
      if (typeof button.onclick !== 'function' && button.dataset.runtimeBound !== '1') {
        button.addEventListener('click', () => call('closeOverlay', button.dataset.close));
        button.dataset.runtimeBound = '1';
      }
    });
    document.querySelectorAll('.tab[data-round]').forEach(button => {
      if (typeof button.onclick !== 'function' && button.dataset.runtimeBound !== '1') {
        button.addEventListener('click', () => call('setRound', button.dataset.round));
        button.dataset.runtimeBound = '1';
      }
    });
    document.querySelectorAll('.preset[data-preset]').forEach(button => {
      if (typeof button.onclick !== 'function' && button.dataset.runtimeBound !== '1') {
        button.addEventListener('click', () => call('applyPreset', Number(button.dataset.preset)));
        button.dataset.runtimeBound = '1';
      }
    });
  }

  function diagnostics() {
    const required = [
      'newGameBtn','resumeBtn','splashHelpBtn','setupBtn','presentationBtn','fullscreenBtn','helpBtn',
      'drawBtn','changeBtn','nextRoleBtn','undoBtn','followBtn','eventBtn','exportBtn','backupBtn','importBtn','resetBtn',
      'startTimerBtn','pauseTimerBtn','resetTimerBtn','minusTimerBtn','plusTimerBtn','saveScoreBtn','printBtn','clearLogBtn',
      'pDraw','pTimer','pFollow','pNext','pExit','closeChallenge','saveSetupBtn','confirmResetBtn'
    ];
    const missing = required.filter(id => !byId(id));
    const unbound = required.filter(id => {
      const el = byId(id);
      return el && typeof el.onclick !== 'function' && el.dataset.runtimeBound !== '1';
    });
    const report = {
      ok: missing.length === 0 && unbound.length === 0 && errors.length === 0,
      checkedAt: new Date().toISOString(),
      buttonCount: document.querySelectorAll('button').length,
      missing,
      unbound,
      errors: [...errors],
      warnings: [...warnings]
    };
    document.documentElement.dataset.systemReady = report.ok ? 'ok' : 'error';
    if (!report.ok) showFailure();
    console.info('[無人機求職任務] 按鈕串連檢查', report);
    return report;
  }

  wireFallbacks();
  window.runSystemDiagnostics = diagnostics;
  window.__BUTTON_DIAGNOSTICS__ = diagnostics();
})();
