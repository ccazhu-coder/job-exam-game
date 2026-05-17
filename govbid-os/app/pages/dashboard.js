(function (window) {
  'use strict';
  window.GovOpsPages.dashboard = {
    render(target) {
      target.innerHTML = '<div class="panel"><h1 class="gradient">AI 指揮中心</h1><div class="sub">此頁沿用主控台首頁 Runtime，請使用左側「AI 指揮中心」。</div></div>';
    },
    bindEvents() {},
    loadData() { return Promise.resolve([]); },
    submitForm() {},
    refreshTable() {},
    search() {},
    validate() { return true; },
    callApi(action, data) { return window.callApi(action, data || {}); }
  };
})(window);
