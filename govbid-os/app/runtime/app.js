(function (window, document) {
  'use strict';

  function moduleCfg(module) {
    return window.getModuleConfig ? window.getModuleConfig(module) : null;
  }

  function collectionOf(module) {
    const cfg = moduleCfg(module);
    return cfg?.collection || module;
  }

  function apiAction(module, op) {
    const cfg = moduleCfg(module);
    return cfg?.api?.[op] || null;
  }

  function pageOf(module) {
    const cfg = moduleCfg(module);
    return cfg?.page || module;
  }

  window.DebugPanel = {
    entries: [],
    log(entry) {
      const item = Object.assign({ time: new Date().toLocaleTimeString('zh-TW') }, entry || {});
      this.entries.unshift(item);
      this.entries = this.entries.slice(0, 20);
      this.render();
    },
    render() {
      const panel = document.getElementById('debugPanel');
      const log = document.getElementById('debugLog');
      if (!panel || !log) return;
      log.innerHTML = this.entries.map((entry) => {
        const title = [entry.time, entry.type, entry.action, entry.module].filter(Boolean).join(' | ');
        const detail = JSON.stringify(entry.payload || entry.response || entry.error || entry, null, 2);
        return `<div class="debug-entry"><b>${title}</b><br><code>${detail.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</code></div>`;
      }).join('');
    },
    toggle(force) {
      const panel = document.getElementById('debugPanel');
      if (!panel) return;
      panel.classList.toggle('hidden', typeof force === 'boolean' ? !force : !panel.classList.contains('hidden'));
    }
  };

  window.AppRuntime = {
    async boot() {
      if (window.__GovOpsRuntimeBooted) return;
      window.__GovOpsRuntimeBooted = true;
      window.RuntimeUI.init();
      this.bindDelegation();
      window.RuntimeUI.loading(true);
      await window.RuntimeAPI.bootstrap();
      window.RuntimeUI.loading(false);
      this.patchLegacyNavigation();
      window.Router.start();
      window.EventBus.emit('runtime:ready', window.AppState);
      window.RuntimeUI.toast('GovOps Runtime 已啟動', 'success');
    },
    bindDelegation() {
      if (window.__GovOpsDelegationBound) return;
      window.__GovOpsDelegationBound = true;
      document.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        event.preventDefault();
        const action = target.dataset.action;
        const module = target.dataset.module;
        const id = target.dataset.id;
        await this.handleAction(action, { module, id, target });
      });
    },
    patchLegacyNavigation() {
      if (!window.UI || !window.UI.page || window.UI.__runtimePatched) return;
      const original = window.UI.page.bind(window.UI);
      window.UI.page = async function (id) {
        await original(id);
        window.AppStateStore.update('currentPage', id);
        const pageModule = window.GovOpsPages && window.GovOpsPages[id];
        if (pageModule) {
          let section = document.getElementById('s-' + id);
          if (!section) {
            section = document.createElement('section');
            section.id = 's-' + id;
            section.className = 'section';
            (document.getElementById('sections') || document.body).appendChild(section);
          }
          document.querySelectorAll('.section').forEach((node) => node.classList.remove('show'));
          section.classList.add('show');
          await pageModule.render(section);
        } else if (id === 'master') {
          const section = document.getElementById('s-master');
          if (section && window.RuntimeUI) window.RuntimeUI.renderMasterDataCenter(section);
        }
      };
      window.UI.__runtimePatched = true;
    },
    async handleAction(action, context = {}) {
      const module = context.module || '';
      const collection = collectionOf(module);
      const id = context.id;
      window.DebugPanel.log({ type: 'click', action, module, id });
      try {
        window.RuntimeUI.loading(true);
        switch (action) {
          case 'toggleDebug':
            window.DebugPanel.toggle();
            return;
          case 'navigate':
            window.Router.go(id || pageOf(module));
            return;
          case 'switchMasterTab':
            window.AppStateStore.update('ui.masterTab', id || collection);
            window.AppStateStore.update('ui.masterSubTab', '');
            window.AppStateStore.update('ui.masterQuery', '');
            window.Router.refresh();
            return;
          case 'switchMasterSubTab':
            window.AppStateStore.update('ui.masterSubTab', id || collection);
            window.AppStateStore.update('ui.masterQuery', '');
            window.Router.refresh();
            return;
          case 'refresh':
            await window.RuntimeAPI.refresh(collection);
            window.RuntimeUI.toast('已重新整理', 'success');
            window.Router.refresh();
            return;
          case 'search':
            window.Router.refresh();
            window.RuntimeUI.toast('查詢完成', 'success');
            return;
          case 'create':
          case 'openModal':
            window.RuntimeUI.openMasterCreate(collection);
            return;
          case 'edit':
            window.RuntimeUI.openMasterEdit(collection, id);
            return;
          case 'view':
            window.RuntimeUI.openMasterView(collection, id);
            return;
          case 'save':
            window.RuntimeUI.toast('請在表單中按「儲存」完成新增或修改。', 'warn');
            return;
          case 'update':
            window.RuntimeUI.openMasterEdit(collection, id);
            return;
          case 'disable':
            await window.RuntimeAPI.setStatus(collection, id, '停用');
            window.RuntimeUI.toast('已停用', 'success');
            window.Router.refresh();
            return;
          case 'enable':
            await window.RuntimeAPI.setStatus(collection, id, '啟用');
            window.RuntimeUI.toast('已啟用', 'success');
            window.Router.refresh();
            return;
          case 'archive':
            await window.RuntimeUI.archiveMaster(collection, id);
            return;
          case 'deleteDraft':
            await window.RuntimeAPI.archive(collection, id);
            window.RuntimeUI.toast('草稿已作廢', 'success');
            window.Router.refresh();
            return;
          case 'export':
            this.exportModule(collection);
            return;
          case 'import':
            await this.callConfiguredApi(module, 'import', {});
            return;
          case 'syncCalendar':
            await this.callConfiguredApi(module || 'calendar', 'syncCalendar', {});
            return;
          case 'sendLine':
            await this.callConfiguredApi(module || 'line', 'sendLine', {});
            return;
          case 'generateDocument':
            await this.callConfiguredApi(module, 'generateDocument', {});
            return;
          case 'generateReport':
            await this.callConfiguredApi(module, 'generateReport', {});
            return;
          case 'closeModal':
            window.RuntimeUI.closeModal();
            return;
          default:
            await this.callRawOrReport(action, module, { id });
        }
      } catch (error) {
        window.DebugPanel.log({ type: 'error', action, module, id, error: error.message });
        window.RuntimeUI.toast(error.message || '操作失敗', 'error');
      } finally {
        window.RuntimeUI.loading(false);
      }
    },
    async callConfiguredApi(module, op, data) {
      const action = apiAction(module, op);
      if (!action) {
        const label = moduleCfg(module)?.label || module || op;
        throw new Error('此功能尚未接上後端：' + label + ' / ' + op);
      }
      const result = await window.callApi(action, data || {});
      window.RuntimeUI.toast('操作成功：' + action, 'success');
      return result;
    },
    async callRawOrReport(action, module, data) {
      const configured = apiAction(module, action);
      const api = configured || action;
      try {
        const result = await window.callApi(api, data || {});
        window.RuntimeUI.toast('操作成功：' + api, 'success');
        return result;
      } catch (error) {
        throw new Error('此功能尚未接上後端：' + api + '（' + error.message + '）');
      }
    },
    exportModule(collection) {
      const rows = window.AppState[collection] || [];
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `govops-${collection}.json`;
      a.click();
      URL.revokeObjectURL(url);
      window.RuntimeUI.toast('已匯出資料', 'success');
    }
  };

  window.GovOpsRuntime = window.AppRuntime;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AppRuntime.boot());
  } else {
    window.AppRuntime.boot();
  }
})(window, document);
