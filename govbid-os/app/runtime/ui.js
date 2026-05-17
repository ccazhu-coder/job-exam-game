(function (window) {
  'use strict';

  const fields = {
    projects: [
      ['專案名稱', '專案名稱'], ['機關名稱', '機關名稱'], ['專案類型', '專案類型'],
      ['契約金額', '契約金額', 'number'], ['履約迄日', '履約迄日', 'date'], ['專案狀態', '專案狀態']
    ],
    finance: [
      ['類型', '類型'], ['說明', '說明'], ['金額', '金額', 'number'], ['交易日期', '交易日期', 'date'], ['付款狀態', '付款狀態']
    ],
    documents: [
      ['文件類型', '文件類型'], ['文件名稱', '文件名稱'], ['版本', '版本'], ['文件狀態', '文件狀態']
    ],
    contacts: [
      ['名稱', 'name'], ['類型', 'type'], ['電話', 'phone'], ['Email', 'email'], ['狀態', 'status']
    ]
  };

  const masterTabs = [
    { key: 'instructors', label: '講師資料', add: '新增講師', search: '搜尋講師姓名、Email、電話、服務單位、專業領域', id: '講師ID', columns: [['講師ID', '講師ID'], ['姓名', '姓名'], ['電話', '電話'], ['Email', 'Email'], ['服務單位', '服務單位'], ['專業領域', '專業領域'], ['費率', '費率'], ['銀行', '銀行']], fields: [['姓名', '姓名'], ['電話', '電話'], ['Email', 'Email'], ['服務單位', '服務單位'], ['專業領域', '專業領域'], ['費率', '費率'], ['銀行', '銀行']] },
    { key: 'vendors', label: '廠商與場地', add: '新增廠商', search: '搜尋廠商名稱、聯絡人、電話、Email、服務項目', id: '廠商ID', columns: [['廠商ID', '廠商ID'], ['廠商名稱', '廠商名稱'], ['聯絡人', '聯絡人'], ['電話', '電話'], ['Email', 'Email'], ['服務項目', '服務項目'], ['統編', '統編'], ['銀行', '銀行']], fields: [['廠商名稱', '廠商名稱'], ['聯絡人', '聯絡人'], ['電話', '電話'], ['Email', 'Email'], ['服務項目', '服務項目'], ['統編', '統編'], ['銀行', '銀行']], subTabs: [{ key: 'vendors', label: '廠商', add: '新增廠商' }, { key: 'venues', label: '場地', add: '新增場地', search: '搜尋場地名稱、地址、設備、聯絡人', id: '場地ID', columns: [['場地ID', '場地ID'], ['場地名稱', '場地名稱'], ['地址', '地址'], ['容納人數', '容納人數'], ['設備', '設備'], ['聯絡人', '聯絡人'], ['電話', '電話']], fields: [['場地名稱', '場地名稱'], ['地址', '地址'], ['容納人數', '容納人數', 'number'], ['設備', '設備'], ['聯絡人', '聯絡人'], ['電話', '電話']] }] },
    { key: 'staff', label: '工作人員資料', add: '新增工作人員', search: '搜尋工作人員姓名、Email、電話', id: '人員ID', columns: [['人員ID', '人員ID'], ['姓名', '姓名'], ['電話', '電話'], ['Email', 'Email'], ['身分證末四碼', '身分證末四碼'], ['加退保狀態', '加退保狀態'], ['銀行', '銀行']], fields: [['姓名', '姓名'], ['電話', '電話'], ['Email', 'Email'], ['身分證末四碼', '身分證末四碼'], ['加退保狀態', '加退保狀態'], ['銀行', '銀行']] },
    { key: 'agencies', label: '機關窗口', add: '新增機關窗口', search: '搜尋機關名稱、窗口姓名、職稱、Email、電話、地址', id: '機關ID', columns: [['機關ID', '機關ID'], ['機關名稱', '機關名稱'], ['窗口姓名', '窗口姓名'], ['職稱', '職稱'], ['電話', '電話'], ['Email', 'Email'], ['地址', '地址']], fields: [['機關名稱', '機關名稱'], ['窗口姓名', '窗口姓名'], ['職稱', '職稱'], ['電話', '電話'], ['Email', 'Email'], ['地址', '地址']] },
    { key: 'students', label: '學員資料', add: '新增學員', search: '搜尋學員姓名、Email、電話、身分別、報名紀錄', id: '學員ID', columns: [['學員ID', '學員ID'], ['姓名', '姓名'], ['電話', '電話'], ['Email', 'Email'], ['身分別', '身分別'], ['報名紀錄', '報名紀錄']], fields: [['姓名', '姓名'], ['電話', '電話'], ['Email', 'Email'], ['身分別', '身分別'], ['報名紀錄', '報名紀錄']] },
    { key: 'resources', label: '物資設備', add: '新增物資設備', search: '搜尋物資名稱、類別、保管人、存放位置、狀態', id: '物資ID', columns: [['物資ID', '物資ID'], ['名稱', '名稱'], ['類別', '類別'], ['數量', '數量'], ['保管人', '保管人'], ['存放位置', '存放位置'], ['狀態', '狀態', 'badge']], fields: [['名稱', '名稱'], ['類別', '類別'], ['數量', '數量', 'number'], ['保管人', '保管人'], ['存放位置', '存放位置'], ['狀態', '狀態']] },
    { key: 'accounts', label: '財務科目', add: '新增財務科目', search: '搜尋科目名稱、收入支出、核銷類別、會計代碼', id: '科目ID', columns: [['科目ID', '科目ID'], ['科目名稱', '科目名稱'], ['收入/支出', '收入/支出'], ['核銷類別', '核銷類別'], ['會計代碼', '會計代碼'], ['狀態', '狀態', 'badge']], fields: [['科目名稱', '科目名稱'], ['收入/支出', '收入/支出'], ['核銷類別', '核銷類別'], ['會計代碼', '會計代碼'], ['狀態', '狀態']] },
    { key: 'templates', label: '文件模板', add: '新增文件模板', search: '搜尋模板名稱、文件類型、適用階段、版本', id: '模板ID', columns: [['模板ID', '模板ID'], ['模板名稱', '模板名稱'], ['文件類型', '文件類型'], ['適用階段', '適用階段'], ['版本', '版本'], ['更新日期', '更新日期']], fields: [['模板名稱', '模板名稱'], ['文件類型', '文件類型'], ['適用階段', '適用階段'], ['版本', '版本'], ['更新日期', '更新日期', 'date']] }
  ];

  function ensureChrome() {
    if (!document.getElementById('runtimeModal')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="runtimeModal" class="runtime-modal hidden"></div>');
    }
    if (!document.getElementById('runtimeLoading')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="runtimeLoading" class="runtime-loading hidden"><div class="runtime-loader"></div><div>AI Runtime 正在同步資料...</div></div>');
    }
    if (!document.getElementById('assistantPanel')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="assistantPanel" class="assistant-panel hidden"></div>');
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function idField(collection) {
    const tab = masterTabs.find((item) => item.key === collection) || masterTabs.flatMap((item) => item.subTabs || []).find((item) => item.key === collection);
    return ({ projects: '專案ID', finance: '財務ID', documents: '文件ID', tasks: '任務ID', contacts: 'id' })[collection] || (tab && tab.id) || 'id';
  }

  function statusBadge(value) {
    const text = String(value || '未設定');
    const cls = /完成|啟用|最新版/.test(text) ? 'safe' : /待|注意|補件/.test(text) ? 'warn' : /封存|逾期|高風險/.test(text) ? 'danger-tag' : 'ai-tag';
    return '<span class="tag ' + cls + '">' + escapeHtml(text) + '</span>';
  }

  window.RuntimeUI = {
    init() {
      ensureChrome();
      this.injectStyles();
      this.bindAssistant();
    },
    injectStyles() {
      if (document.getElementById('runtimeStyles')) return;
      document.head.insertAdjacentHTML('beforeend', `<style id="runtimeStyles">
        .runtime-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.runtime-toolbar input,.runtime-toolbar select{max-width:320px}.runtime-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.runtime-pager{display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:10px}.runtime-modal{position:fixed;inset:0;z-index:80;background:rgba(2,6,23,.62);backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px}.runtime-dialog{width:min(820px,100%);background:linear-gradient(180deg,rgba(15,23,42,.96),rgba(8,13,24,.94));border:1px solid rgba(148,163,184,.16);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.42);overflow:hidden;color:#eaf2ff}.runtime-dialog header{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid rgba(148,163,184,.13);background:transparent;color:#eaf2ff;position:static;box-shadow:none}.runtime-dialog main{padding:18px 20px}.runtime-dialog footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid rgba(148,163,184,.13)}.runtime-loading{position:fixed;right:20px;top:20px;z-index:90;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:999px;background:rgba(15,23,42,.92);border:1px solid rgba(212,175,106,.28);box-shadow:0 16px 40px rgba(0,0,0,.28);color:#eaf2ff;font-size:13px}.runtime-loader{width:16px;height:16px;border-radius:50%;border:2px solid rgba(212,175,106,.25);border-top-color:#d4af6a;animation:runtimeSpin .8s linear infinite}@keyframes runtimeSpin{to{transform:rotate(360deg)}}.assistant-panel{position:fixed;right:18px;bottom:86px;width:min(360px,calc(100vw - 36px));z-index:75;background:rgba(15,23,42,.96);border:1px solid rgba(148,163,184,.16);box-shadow:0 22px 70px rgba(0,0,0,.32);border-radius:24px;padding:16px;color:#eaf2ff}.assistant-panel h3{margin:0 0 10px;color:#fff}.assistant-message{padding:10px 12px;border-radius:16px;background:rgba(124,58,237,.12);margin:8px 0;color:#dbeafe;font-size:13px}.master-tabs,.master-subtabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.master-tabs button,.master-subtabs button{background:rgba(15,23,42,.58);border-color:rgba(148,163,184,.14)}.master-tabs button.active,.master-subtabs button.active{background:linear-gradient(135deg,rgba(124,58,237,.26),rgba(56,189,248,.12));border-color:rgba(124,58,237,.34);color:#fff}.master-actions{display:flex;gap:6px;flex-wrap:wrap}.master-actions button{padding:6px 9px;font-size:12px}.runtime-view-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.runtime-view-item{border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.52);border-radius:14px;padding:10px}.runtime-view-item b{display:block;color:#94a3b8;font-size:12px;margin-bottom:5px}.hidden{display:none!important}
      </style>`);
    },
    loading(on) {
      ensureChrome();
      document.getElementById('runtimeLoading').classList.toggle('hidden', !on);
    },
    toast(message, type) {
      if (window.UI && window.UI.toast) window.UI.toast(message, type || 'success');
    },
    openModal(options) {
      ensureChrome();
      const modal = document.getElementById('runtimeModal');
      modal.classList.remove('hidden');
      modal.innerHTML = `<div class="runtime-dialog">
        <header><h3>${escapeHtml(options.title || '操作')}</h3><button class="secondary sm" data-close>關閉</button></header>
        <main>${options.body || ''}</main>
        <footer>${options.footer || '<button class="green" data-save>儲存</button>'}</footer>
      </div>`;
      modal.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => this.closeModal()));
      if (options.onSave && modal.querySelector('[data-save]')) {
        modal.querySelector('[data-save]').addEventListener('click', () => options.onSave(this.collect(modal)));
      }
    },
    closeModal() {
      const modal = document.getElementById('runtimeModal');
      if (modal) modal.classList.add('hidden');
    },
    form(collection, row) {
      return '<div class="form-grid">' + (fields[collection] || fields.projects).map(([label, key, type]) => {
        return `<div><label>${escapeHtml(label)}</label><input data-key="${escapeHtml(key)}" type="${type || 'text'}" value="${escapeHtml(row && row[key])}"></div>`;
      }).join('') + '</div>';
    },
    collect(root) {
      const out = {};
      root.querySelectorAll('[data-key]').forEach((el) => { out[el.dataset.key] = el.value; });
      return out;
    },
    async openCreate(collection) {
      this.openModal({
        title: '新增' + this.label(collection),
        body: this.form(collection),
        onSave: async (data) => {
          await window.RuntimeAPI.save(collection, data);
          this.closeModal();
          this.toast('已新增' + this.label(collection), 'success');
          window.Router.refresh();
        }
      });
    },
    async openEdit(collection, id) {
      const field = idField(collection);
      const row = (window.AppState[collection] || []).find((item) => String(item[field]) === String(id));
      this.openModal({
        title: '編輯' + this.label(collection),
        body: this.form(collection, row),
        footer: '<button class="secondary" data-close>取消</button><button class="danger" data-archive>封存</button><button class="green" data-save>儲存</button>',
        onSave: async (data) => {
          await window.RuntimeAPI.update(collection, id, data);
          this.closeModal();
          this.toast('已更新資料', 'success');
          window.Router.refresh();
        }
      });
      document.querySelector('#runtimeModal [data-archive]').addEventListener('click', async () => {
        await window.RuntimeAPI.archive(collection, id);
        this.closeModal();
        this.toast('已封存資料', 'success');
        window.Router.refresh();
      });
    },
    getMasterConfig() {
      const state = window.AppState;
      const baseKey = state.ui.masterTab || 'instructors';
      const base = masterTabs.find((tab) => tab.key === baseKey) || masterTabs[0];
      if (base.subTabs && base.subTabs.length) {
        const subKey = state.ui.masterSubTab || base.subTabs[0].key;
        const sub = base.subTabs.find((item) => item.key === subKey) || base.subTabs[0];
        return Object.assign({}, base, sub, { parentKey: base.key, parentLabel: base.label });
      }
      return base;
    },
    masterForm(config, row) {
      return '<div class="form-grid">' + config.fields.map(([label, key, type]) => {
        return `<div><label>${escapeHtml(label)}</label><input data-key="${escapeHtml(key)}" type="${type || 'text'}" value="${escapeHtml(row && row[key])}"></div>`;
      }).join('') + '</div>';
    },
    renderMasterDataCenter(target) {
      const state = window.AppState;
      const baseKey = state.ui.masterTab || 'instructors';
      const config = this.getMasterConfig();
      const query = state.ui.masterQuery || '';
      const showArchived = !!state.ui.masterShowArchived;
      let rows = ((state[config.key] && state[config.key].length ? state[config.key] : (window.MockData[config.key] || [])) || []).slice();
      if (!showArchived) rows = rows.filter((row) => String(row['狀態'] || row.status || '') !== '已封存');
      if (query) {
        const q = query.toLowerCase();
        rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
      }
      target.innerHTML = `<div class="panel">
        <div class="runtime-table-head">
          <div><h1 class="gradient" style="margin:0 0 8px">基本資料中心</h1><div class="sub">管理講師、廠商、場地、工作人員、機關窗口、學員、物資設備、財務科目、文件模板等基礎資料。</div></div>
          <button class="green" data-master-create>＋ ${escapeHtml(config.add)}</button>
        </div>
        <div class="master-tabs">${masterTabs.map((tab) => `<button data-master-tab="${tab.key}" class="${tab.key === baseKey ? 'active' : ''}">${escapeHtml(tab.label)}</button>`).join('')}</div>
        ${masterTabs.find((tab) => tab.key === baseKey)?.subTabs ? `<div class="master-subtabs">${masterTabs.find((tab) => tab.key === baseKey).subTabs.map((tab) => `<button data-master-subtab="${tab.key}" class="${tab.key === config.key ? 'active' : ''}">${escapeHtml(tab.label)}</button>`).join('')}</div>` : ''}
        <div class="runtime-toolbar">
          <input data-master-search placeholder="${escapeHtml(config.search)}" value="${escapeHtml(query)}">
          <select data-master-archive-filter><option value="">預設清單</option><option value="archived" ${showArchived ? 'selected' : ''}>包含封存</option></select>
          <button class="secondary" data-master-refresh>重新整理</button>
        </div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>${config.columns.map((col) => `<th>${escapeHtml(col[0])}</th>`).join('')}<th>操作</th></tr></thead><tbody>
          ${rows.length ? rows.map((row) => this.masterRow(config, row)).join('') : `<tr><td colspan="${config.columns.length + 1}"><div class="empty"><div class="e"></div><div>目前沒有資料，請先新增或調整搜尋條件。</div></div></td></tr>`}
        </tbody></table></div>
      </div>`;
      target.querySelectorAll('[data-master-tab]').forEach((button) => button.addEventListener('click', () => {
        window.AppStateStore.update('ui.masterTab', button.dataset.masterTab);
        window.AppStateStore.update('ui.masterSubTab', '');
        window.AppStateStore.update('ui.masterQuery', '');
        window.Router.refresh();
      }));
      target.querySelectorAll('[data-master-subtab]').forEach((button) => button.addEventListener('click', () => {
        window.AppStateStore.update('ui.masterSubTab', button.dataset.masterSubtab);
        window.AppStateStore.update('ui.masterQuery', '');
        window.Router.refresh();
      }));
      target.querySelector('[data-master-create]').addEventListener('click', () => this.openMasterCreate());
      target.querySelector('[data-master-search]').addEventListener('input', (event) => {
        window.AppStateStore.update('ui.masterQuery', event.target.value);
        window.Router.refresh();
      });
      target.querySelector('[data-master-archive-filter]').addEventListener('change', (event) => {
        window.AppStateStore.update('ui.masterShowArchived', event.target.value === 'archived');
        window.Router.refresh();
      });
      target.querySelector('[data-master-refresh]').addEventListener('click', () => {
        this.toast('已重新整理', 'success');
        window.Router.refresh();
      });
      target.querySelectorAll('[data-master-view]').forEach((button) => button.addEventListener('click', () => this.openMasterView(button.dataset.collection, button.dataset.id)));
      target.querySelectorAll('[data-master-edit]').forEach((button) => button.addEventListener('click', () => this.openMasterEdit(button.dataset.collection, button.dataset.id)));
      target.querySelectorAll('[data-master-toggle]').forEach((button) => button.addEventListener('click', () => this.toggleMasterStatus(button.dataset.collection, button.dataset.id)));
      target.querySelectorAll('[data-master-archive]').forEach((button) => button.addEventListener('click', () => this.archiveMaster(button.dataset.collection, button.dataset.id)));
    },
    masterRow(config, row) {
      const id = row[config.id];
      const status = String(row['狀態'] || row.status || '啟用');
      return `<tr>${config.columns.map((col) => `<td>${col[2] === 'badge' ? statusBadge(row[col[1]]) : escapeHtml(row[col[1]] || '')}</td>`).join('')}<td><div class="master-actions">
        <button class="secondary" data-master-view data-collection="${config.key}" data-id="${escapeHtml(id)}">查看</button>
        <button class="secondary" data-master-edit data-collection="${config.key}" data-id="${escapeHtml(id)}">修改</button>
        <button class="secondary" data-master-toggle data-collection="${config.key}" data-id="${escapeHtml(id)}">${status === '停用' ? '啟用' : '停用'}</button>
        <button class="danger" data-master-archive data-collection="${config.key}" data-id="${escapeHtml(id)}">封存</button>
      </div></td></tr>`;
    },
    openMasterCreate() {
      const config = this.getMasterConfig();
      this.openModal({
        title: '＋ ' + config.add,
        body: this.masterForm(config, { '狀態': '啟用' }),
        onSave: async (data) => {
          data['狀態'] = data['狀態'] || '啟用';
          await window.RuntimeAPI.save(config.key, data);
          this.closeModal();
          this.toast('新增成功', 'success');
          window.Router.refresh();
        }
      });
    },
    openMasterEdit(collection, id) {
      const config = (masterTabs.find((tab) => tab.key === collection) || masterTabs.flatMap((tab) => tab.subTabs || []).find((tab) => tab.key === collection) || this.getMasterConfig());
      const row = (window.AppState[collection] || []).find((item) => String(item[config.id]) === String(id));
      this.openModal({
        title: '修改' + config.add.replace('新增', ''),
        body: this.masterForm(config, row),
        onSave: async (data) => {
          await window.RuntimeAPI.update(collection, id, data);
          this.closeModal();
          this.toast('修改成功', 'success');
          window.Router.refresh();
        }
      });
    },
    openMasterView(collection, id) {
      const config = (masterTabs.find((tab) => tab.key === collection) || masterTabs.flatMap((tab) => tab.subTabs || []).find((tab) => tab.key === collection) || this.getMasterConfig());
      const row = (window.AppState[collection] || []).find((item) => String(item[config.id]) === String(id)) || {};
      const detail = Object.keys(row).map((key) => `<div class="runtime-view-item"><b>${escapeHtml(key)}</b>${escapeHtml(row[key])}</div>`).join('');
      this.openModal({
        title: '查看' + config.add.replace('新增', ''),
        body: `<div class="runtime-view-grid">${detail}</div><div class="panel" style="margin-top:14px"><h3>操作紀錄</h3><div class="small">建立資料、最後檢視、狀態維護紀錄會在正式後端啟用後同步顯示。</div></div>`,
        footer: '<button class="green" data-close>完成</button>'
      });
    },
    async toggleMasterStatus(collection, id) {
      const config = (masterTabs.find((tab) => tab.key === collection) || masterTabs.flatMap((tab) => tab.subTabs || []).find((tab) => tab.key === collection) || this.getMasterConfig());
      const row = (window.AppState[collection] || []).find((item) => String(item[config.id]) === String(id));
      const next = String(row && row['狀態']) === '停用' ? '啟用' : '停用';
      await window.RuntimeAPI.update(collection, id, { '狀態': next });
      this.toast('狀態已更新', 'success');
      window.Router.refresh();
    },
    async archiveMaster(collection, id) {
      if (!confirm('確認封存？資料會保留，但不在預設清單顯示。')) return;
      await window.RuntimeAPI.archive(collection, id);
      this.toast('已封存', 'success');
      window.Router.refresh();
    },
    renderTable(target, collection, columns) {
      const state = window.AppState;
      const query = state.ui.query || '';
      let rows = (state[collection] || []).slice();
      if (query) rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
      const pageSize = 8;
      const page = Math.max(1, state.ui.tablePage || 1);
      const paged = rows.slice((page - 1) * pageSize, page * pageSize);
      const field = idField(collection);
      target.innerHTML = `<div class="panel"><div class="runtime-table-head"><div><h2>${this.label(collection)} Runtime</h2><div class="small">搜尋、分頁、編輯、封存、Mock API 與 GAS API fallback 已啟用。</div></div><button class="green" data-create>新增</button></div>
        <div class="runtime-toolbar"><input data-search placeholder="搜尋 ${this.label(collection)}..." value="${escapeHtml(query)}"><button class="secondary" data-clear>清除</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>${columns.map((col) => '<th>' + escapeHtml(col[0]) + '</th>').join('')}<th>操作</th></tr></thead><tbody>
        ${paged.length ? paged.map((row) => `<tr>${columns.map((col) => '<td>' + (col[2] === 'badge' ? statusBadge(row[col[1]]) : escapeHtml(row[col[1]] || '')) + '</td>').join('')}<td><button class="sm secondary" data-edit="${escapeHtml(row[field])}">編輯</button></td></tr>`).join('') : `<tr><td colspan="${columns.length + 1}"><div class="empty"><div class="e"></div><div>目前沒有資料，可先新增一筆。</div></div></td></tr>`}
        </tbody></table></div><div class="runtime-pager"><button class="secondary sm" data-prev>上一頁</button><span class="small">第 ${page} 頁 / 共 ${Math.max(1, Math.ceil(rows.length / pageSize))} 頁</span><button class="secondary sm" data-next>下一頁</button></div></div>`;
      target.querySelector('[data-create]').addEventListener('click', () => this.openCreate(collection));
      target.querySelector('[data-search]').addEventListener('input', (event) => {
        window.AppStateStore.update('ui.query', event.target.value);
        window.AppStateStore.update('ui.tablePage', 1);
        window.Router.refresh();
      });
      target.querySelector('[data-clear]').addEventListener('click', () => {
        window.AppStateStore.update('ui.query', '');
        window.Router.refresh();
      });
      target.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => this.openEdit(collection, button.dataset.edit)));
      target.querySelector('[data-prev]').addEventListener('click', () => {
        window.AppStateStore.update('ui.tablePage', Math.max(1, page - 1));
        window.Router.refresh();
      });
      target.querySelector('[data-next]').addEventListener('click', () => {
        window.AppStateStore.update('ui.tablePage', Math.min(Math.max(1, Math.ceil(rows.length / pageSize)), page + 1));
        window.Router.refresh();
      });
    },
    bindAssistant() {
      document.querySelectorAll('.assistant-orb').forEach((orb) => {
        orb.onclick = () => this.toggleAssistant();
      });
    },
    toggleAssistant() {
      ensureChrome();
      const panel = document.getElementById('assistantPanel');
      panel.classList.toggle('hidden');
      panel.innerHTML = `<h3>AI Assistant</h3>${(window.AppState.notifications || []).map((n) => `<div class="assistant-message"><b>${escapeHtml(n.type)}</b><br>${escapeHtml(n.message)}</div>`).join('')}<div class="btns"><button class="green sm" onclick="Router.go('priorities')">今日優先</button><button class="secondary sm" onclick="Router.go('projects')">專案資料</button></div>`;
    },
    label(collection) {
      return ({ projects: '專案', finance: '財務', documents: '文件', contacts: '基礎資料', tasks: '任務' })[collection] || collection;
    }
  };
})(window);
