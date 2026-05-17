(function (window) {
  'use strict';

  window.GovOpsRuntime = {
    async boot() {
      if (window.__GovOpsRuntimeBooted) return;
      window.__GovOpsRuntimeBooted = true;
      window.RuntimeUI.init();
      window.RuntimeUI.loading(true);
      await window.RuntimeAPI.bootstrap();
      window.RuntimeUI.loading(false);
      this.patchLegacyNavigation();
      window.Router.start();
      window.EventBus.emit('runtime:ready', window.AppState);
      window.RuntimeUI.toast('GovOps Runtime 已啟動', 'success');
    },
    patchLegacyNavigation() {
      if (!window.UI || !window.UI.page || window.UI.__runtimePatched) return;
      const original = window.UI.page.bind(window.UI);
      window.UI.page = async function (id) {
        await original(id);
        window.AppStateStore.update('currentPage', id);
        if (id === 'master') {
          const section = document.getElementById('s-master');
          if (section && window.RuntimeUI) window.RuntimeUI.renderMasterDataCenter(section);
        }
      };
      window.UI.__runtimePatched = true;
      document.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const text = button.textContent.trim();
        if (/管理$/.test(text) && window.AppState.currentPage === 'master') {
          event.preventDefault();
          window.Router.go('crm');
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.GovOpsRuntime.boot());
  } else {
    window.GovOpsRuntime.boot();
  }
})(window);
