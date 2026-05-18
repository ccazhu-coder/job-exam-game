(function (window) {
  'use strict';

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const normalize = (result) => {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    return result.rows || result.data || result['資料'] || result.result || result['結果'] || [];
  };

  window.GovOpsPages = window.GovOpsPages || {};

  window.GovOpsPageCore = {
    esc,
    normalize,
    register(name, config) {
      window.GovOpsPages[name] = this.create(config);
    },
    create(config) {
      const state = { rows: [], query: '', editing: null };
      const idField = config.idField;
      const page = {
        config,
        async render(target) {
          target.innerHTML = this.layout();
          this.bindEvents(target);
          await this.loadData();
        },
        layout() {
          return `<div class="panel">
            <div class="runtime-table-head">
              <div>
                <h1 class="gradient" style="margin:0 0 8px">${esc(config.title)}</h1>
                <div class="sub">${esc(config.subtitle || '')}</div>
              </div>
              <div class="btns">
                ${(config.actions || []).map((a) => `<button class="${a.className || 'secondary'}" data-page-action="${esc(a.action)}">${esc(a.label)}</button>`).join('')}
                <button class="green" data-page-action="create">＋ ${esc(config.createLabel || '新增')}</button>
                <button class="secondary" data-page-action="refresh">重新整理</button>
              </div>
            </div>
            <div class="runtime-toolbar">
              <input data-page-search placeholder="${esc(config.searchPlaceholder || '搜尋關鍵字')}" value="${esc(state.query)}">
              ${(config.filters || []).map((f) => this.filterHtml(f)).join('')}
              <button class="secondary" data-page-action="search">查詢</button>
            </div>
            <div data-page-kpis></div>
            <div class="tbl-wrap" data-page-table>${this.tableHtml()}</div>
          </div>`;
        },
        filterHtml(filter) {
          return `<select data-page-filter="${esc(filter.key)}"><option value="">${esc(filter.all || '全部')}</option>${(filter.options || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
        },
        bindEvents(target) {
          target.querySelector('[data-page-search]')?.addEventListener('input', (event) => {
            state.query = event.target.value;
          });
          target.querySelectorAll('[data-page-action]').forEach((button) => {
            button.addEventListener('click', async () => this.handleAction(button.dataset.pageAction, button.dataset.id, target));
          });
        },
        async handleAction(action, id, target) {
          try {
            window.RuntimeUI.loading(true);
            if (action === 'refresh' || action === 'search') {
              await this.loadData();
              window.RuntimeUI.toast(action === 'search' ? '查詢完成' : '已重新整理', 'success');
              return;
            }
            if (action === 'create') return this.openForm();
            if (action === 'edit') return this.openForm(id);
            if (action === 'archive') return this.archive(id);
            if (config.actionHandlers && config.actionHandlers[action]) return config.actionHandlers[action](this, id, target);
            if (config.api && config.api[action]) {
              await window.callApi(config.api[action], id ? { [idField]: id, id } : {});
              window.RuntimeUI.toast('操作成功', 'success');
              await this.loadData();
              return;
            }
            await window.callApi(action, id ? { [idField]: id, id } : {});
            window.RuntimeUI.toast('操作成功：' + action, 'success');
            await this.loadData();
          } catch (error) {
            window.RuntimeUI.toast(error.message || '操作失敗', 'error');
            window.DebugPanel?.log({ type: 'page:error', page: config.name, action, error: error.message });
          } finally {
            window.RuntimeUI.loading(false);
          }
        },
        async loadData() {
          const filters = { keyword: state.query, q: state.query };
          const result = await window.callApi(config.api.list, filters);
          state.rows = normalize(result);
          this.refreshTable();
          this.refreshKpis();
          return state.rows;
        },
        refreshTable() {
          const box = document.querySelector('[data-page-table]');
          if (box) box.innerHTML = this.tableHtml();
        },
        refreshKpis() {
          const box = document.querySelector('[data-page-kpis]');
          if (!box) return;
          const total = state.rows.length;
          const active = state.rows.filter((r) => !/封存|取消|未錄取/.test(String(r['狀態'] || r['案件狀態'] || r['場次狀態'] || r['資格審查狀態'] || ''))).length;
          box.innerHTML = `<div class="case-kpis" style="margin-top:14px">
            <div class="ckpi"><div class="num">${total}</div><div class="label">全部</div></div>
            <div class="ckpi"><div class="num">${active}</div><div class="label">有效資料</div></div>
            <div class="ckpi warn"><div class="num">${Math.max(0, total - active)}</div><div class="label">需留意</div></div>
          </div>`;
        },
        tableHtml() {
          const rows = state.rows || [];
          if (!rows.length) return `<div class="empty"><div class="e"></div><div>目前沒有資料，可先新增一筆或調整查詢條件。</div></div>`;
          return `<table class="tbl"><thead><tr>${config.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th>操作</th></tr></thead><tbody>${rows.map((row) => {
            const id = row[idField] || row.id || '';
            return `<tr>${config.columns.map((c) => `<td>${esc(row[c.key] || '')}</td>`).join('')}<td><div class="master-actions">
              <button class="secondary" data-page-action="edit" data-id="${esc(id)}">修改</button>
              ${(config.rowActions || []).map((a) => `<button class="secondary" data-page-action="${esc(a.action)}" data-id="${esc(id)}">${esc(a.label)}</button>`).join('')}
              <button class="danger" data-page-action="archive" data-id="${esc(id)}">封存</button>
            </div></td></tr>`;
          }).join('')}</tbody></table>`;
        },
        openForm(id) {
          const row = id ? (state.rows.find((r) => String(r[idField]) === String(id)) || {}) : {};
          state.editing = id || null;
          window.RuntimeUI.openModal({
            title: (id ? '修改' : '新增') + config.title,
            body: `<div class="form-grid">${config.fields.map((field) => this.fieldHtml(field, row)).join('')}</div>`,
            onSave: async (data) => this.submitForm(data)
          });
        },
        fieldHtml(field, row) {
          const value = row[field.key] || field.defaultValue || '';
          if (field.type === 'select') {
            return `<div><label>${esc(field.label)}</label><select data-key="${esc(field.key)}">${(field.options || []).map((o) => `<option value="${esc(o)}" ${String(value) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
          }
          if (field.type === 'textarea') return `<div><label>${esc(field.label)}</label><textarea data-key="${esc(field.key)}">${esc(value)}</textarea></div>`;
          return `<div><label>${esc(field.label)}${field.required ? ' *' : ''}</label><input data-key="${esc(field.key)}" type="${field.type || 'text'}" value="${esc(value)}"></div>`;
        },
        validate(data) {
          const missing = (config.fields || []).filter((field) => field.required && !String(data[field.key] || '').trim());
          if (missing.length) throw new Error('缺少必填欄位：' + missing.map((f) => f.label).join('、'));
        },
        async submitForm(data) {
          this.validate(data);
          if (config.beforeSubmit) await config.beforeSubmit(this, data, !!state.editing);
          const editing = state.editing;
          if (editing) data[idField] = editing;
          const action = editing ? config.api.update : config.api.create;
          await window.callApi(action, data);
          window.RuntimeUI.closeModal();
          window.RuntimeUI.toast(editing ? '修改成功' : '新增成功', 'success');
          await this.loadData();
        },
        async archive(id) {
          if (!confirm('確認封存？資料會保留，不會刪除。')) return;
          await window.callApi(config.api.archive, { [idField]: id, id });
          window.RuntimeUI.toast('已封存', 'success');
          await this.loadData();
        },
        search() { return this.loadData(); },
        refreshTablePublic() { return this.refreshTable(); },
        callApi(action, data) { return window.callApi(action, data || {}); }
      };
      return page;
    }
  };
})(window);
