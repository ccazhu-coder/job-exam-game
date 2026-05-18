(function (window) {
  'use strict';

  const folders = [
    '01_投標資料','02_契約與決標','03_需求與規格','04_活動與場次',
    '05_報名與錄取','06_講師與工作人員','07_財務核銷','08_公文往返',
    '09_照片與成果','10_問卷與滿意度','11_結案報告','99_封存備份'
  ];
  const state = { step: 1, settings: null, provider: 'googleDrive', folderUrl: '' };

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(action, data) {
    const result = await window.callApi(action, data || {});
    return result.record || result.data || result;
  }

  function providerLabel(value) {
    return ({ googleDrive: 'Google Drive', oneDrive: 'OneDrive', manual: '手動管理' })[value] || value || '尚未設定';
  }

  function renderStatusCard() {
    const s = state.settings || {};
    if (!s.status || s.status === '未設定') return '';
    return `<div class="panel">
      <div class="runtime-table-head">
        <div>
          <h2>檔案管理已啟用</h2>
          <div class="sub">目前位置：${esc(providerLabel(s.cloudProvider || s.storageMode))} / ${esc(s.cloudRootFolderUrl || '手動管理')}</div>
        </div>
        <div class="btns">
          ${s.cloudRootFolderUrl ? `<button class="secondary" data-storage-action="openFolder">開啟資料夾</button>` : ''}
          <button class="secondary" data-storage-action="test">測試連線</button>
          <button class="secondary" data-storage-action="reset">重新設定</button>
        </div>
      </div>
      <div class="grid3">
        ${['建立專案資料夾','建立場次資料夾','建立結案資料包','建議文件存放位置','建立檔案索引','檢查缺少文件'].map((x) => `<div class="item"><b>${x}</b><div class="small">已接入 Cloud Sync Workspace</div></div>`).join('')}
      </div>
      <div class="item">系統會操作雲端資料夾；若您的電腦已安裝 OneDrive 或 Google Drive Desktop，同步資料夾會自動出現在您的電腦中。</div>
    </div>`;
  }

  function renderWizard() {
    return `<div class="panel">
      <h1 class="gradient" style="margin:0 0 8px">Cloud Sync Workspace</h1>
      <div class="sub">使用者只需選一個雲端資料夾，GovOps 會自動建立標案目錄、整理附件、建立索引與結案資料包。</div>
      <div class="case-kpis" style="margin-top:14px">
        ${[1,2,3].map((n) => `<div class="ckpi ${state.step === n ? 'warn' : ''}"><div class="num">${n}</div><div class="label">${['選擇存放方式','選擇根資料夾','確認整理規則'][n-1]}</div></div>`).join('')}
      </div>
      ${state.step === 1 ? stepOne() : state.step === 2 ? stepTwo() : stepThree()}
    </div>`;
  }

  function stepOne() {
    const cards = [
      ['googleDrive','Google Drive','適合使用 Gmail / Google Workspace 的單位'],
      ['oneDrive','OneDrive','適合 Microsoft 365 / Windows 單位'],
      ['manual','我先手動管理','系統只建立檔案結構與清單，不自動建立雲端資料夾']
    ];
    return `<div class="grid3" style="margin-top:16px">
      ${cards.map((card) => `<button class="item" style="text-align:left" data-storage-action="selectProvider" data-provider="${card[0]}"><b>${card[1]}</b><div class="small">${card[2]}</div>${state.provider === card[0] ? '<span class="tag warn">已選擇</span>' : ''}</button>`).join('')}
    </div>
    <div class="btns" style="margin-top:14px"><button data-storage-action="next">下一步</button></div>`;
  }

  function stepTwo() {
    if (state.provider === 'manual') {
      return `<div class="item" style="margin-top:16px"><b>手動管理模式</b><div class="small">系統會建立文件清單、建議資料夾結構與缺件檢查，不會自動建立雲端資料夾。</div></div>
      <div class="btns" style="margin-top:14px"><button class="secondary" data-storage-action="back">上一步</button><button data-storage-action="next">下一步</button></div>`;
    }
    return `<div class="item" style="margin-top:16px">
      <b>選擇標案根資料夾</b>
      <div class="small">請按下按鈕後貼上您選擇的 ${providerLabel(state.provider)} 資料夾網址。系統會自動保存雲端服務、根資料夾位置與租戶設定，不需要輸入 folderId。</div>
      <div class="runtime-toolbar">
        <input id="cloudFolderUrl" placeholder="貼上雲端資料夾網址" value="${esc(state.folderUrl || state.settings?.cloudRootFolderUrl || '')}">
        <button data-storage-action="chooseFolder">選擇雲端資料夾</button>
      </div>
    </div>
    <div class="btns" style="margin-top:14px"><button class="secondary" data-storage-action="back">上一步</button><button data-storage-action="next">下一步</button></div>`;
  }

  function stepThree() {
    return `<div class="item" style="margin-top:16px"><b>系統會自動建立</b><div class="grid3" style="margin-top:10px">${folders.map((x) => `<div class="item">${x}</div>`).join('')}</div></div>
    <div class="item">建立專案時會自動建立專案資料夾與標準子資料夾；建立場次時會自動建立場次資料夾。產生文件時會依生命週期建議存放位置。</div>
    <div class="btns" style="margin-top:14px"><button class="secondary" data-storage-action="back">上一步</button><button class="green" data-storage-action="finish">完成設定</button></div>`;
  }

  window.GovOpsPages.settings = {
    async render(target) {
      target.innerHTML = `${renderStatusCard()}${renderWizard()}`;
      this.bindEvents(target);
      if (!state.settings) await this.loadData(target);
    },
    bindEvents(target) {
      target.querySelectorAll('[data-storage-action]').forEach((button) => {
        button.addEventListener('click', async () => this.handle(button.dataset.storageAction, button));
      });
    },
    async handle(action, button) {
      try {
        window.RuntimeUI.loading(true);
        if (action === 'selectProvider') state.provider = button.dataset.provider || 'googleDrive';
        if (action === 'next') {
          if (state.step === 2) state.folderUrl = document.getElementById('cloudFolderUrl')?.value || state.folderUrl;
          state.step = Math.min(3, state.step + 1);
        }
        if (action === 'back') state.step = Math.max(1, state.step - 1);
        if (action === 'chooseFolder') {
          state.folderUrl = document.getElementById('cloudFolderUrl')?.value || '';
          window.RuntimeUI.toast(state.folderUrl ? '已取得雲端資料夾網址' : '請貼上您選擇的雲端資料夾網址', state.folderUrl ? 'success' : 'warn');
        }
        if (action === 'finish') await this.finish();
        if (action === 'test') {
          const r = await api('testCloudStorage', {});
          window.RuntimeUI.toast(r.message || '雲端資料夾連線正常', 'success');
        }
        if (action === 'openFolder') {
          const url = state.settings?.cloudRootFolderUrl;
          if (url) window.open(url, '_blank');
        }
        if (action === 'reset') { state.step = 1; state.settings = null; state.folderUrl = ''; }
        window.Router.refresh();
      } catch (error) {
        window.RuntimeUI.toast(error.message || '操作失敗', 'error');
      } finally {
        window.RuntimeUI.loading(false);
      }
    },
    async loadData() {
      state.settings = await api('getStorageSettings', {});
      state.provider = state.settings?.cloudProvider || state.settings?.storageMode || 'googleDrive';
      state.folderUrl = state.settings?.cloudRootFolderUrl || '';
      return state.settings;
    },
    async finish() {
      const url = document.getElementById('cloudFolderUrl')?.value || state.folderUrl || '';
      if (state.provider !== 'manual' && !url) throw new Error('請先選擇雲端資料夾');
      state.settings = await api('saveStorageSettings', {
        storageMode: state.provider === 'manual' ? 'manual' : 'cloud',
        cloudProvider: state.provider,
        cloudRootFolderUrl: url,
        autoCreateProjectFolder: true,
        autoCreateSessionFolder: true,
        enableMissingFileScan: true,
        enableClosingPackage: true,
        status: '啟用'
      });
      window.RuntimeUI.toast('檔案管理已啟用', 'success');
    },
    submitForm() {},
    refreshTable() {},
    search() {},
    validate() { return true; },
    callApi: api
  };
})(window);
