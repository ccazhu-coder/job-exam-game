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
    return ({ projects: '專案ID', finance: '財務ID', documents: '文件ID', tasks: '任務ID', contacts: 'id' })[collection] || 'id';
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
        .runtime-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.runtime-toolbar input,.runtime-toolbar select{max-width:260px}.runtime-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.runtime-pager{display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:10px}.runtime-modal{position:fixed;inset:0;z-index:80;background:rgba(13,35,64,.28);backdrop-filter:blur(8px);display:grid;place-items:center;padding:18px}.runtime-dialog{width:min(720px,100%);background:rgba(255,250,241,.96);border:1px solid rgba(184,150,62,.25);border-radius:24px;box-shadow:0 24px 80px rgba(13,35,64,.22);overflow:hidden}.runtime-dialog header{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid rgba(13,35,64,.1);background:transparent;color:#182235;position:static;box-shadow:none}.runtime-dialog main{padding:18px 20px}.runtime-dialog footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid rgba(13,35,64,.1)}.runtime-loading{position:fixed;right:20px;top:20px;z-index:90;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:999px;background:#fffaf1;border:1px solid rgba(184,150,62,.25);box-shadow:0 16px 40px rgba(13,35,64,.16);color:#0d2340;font-size:13px}.runtime-loader{width:16px;height:16px;border-radius:50%;border:2px solid rgba(184,150,62,.25);border-top-color:#b8963e;animation:runtimeSpin .8s linear infinite}@keyframes runtimeSpin{to{transform:rotate(360deg)}}.assistant-panel{position:fixed;right:18px;bottom:86px;width:min(360px,calc(100vw - 36px));z-index:75;background:rgba(255,250,241,.96);border:1px solid rgba(184,150,62,.25);box-shadow:0 22px 70px rgba(13,35,64,.22);border-radius:24px;padding:16px}.assistant-panel h3{margin:0 0 10px;color:#0d2340}.assistant-message{padding:10px 12px;border-radius:16px;background:rgba(184,150,62,.1);margin:8px 0;color:#344054;font-size:13px}.hidden{display:none!important}
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
      modal.querySelector('[data-close]').addEventListener('click', () => this.closeModal());
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
