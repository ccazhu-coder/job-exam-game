(function (window) {
  'use strict';
  window.GovOpsPages.masterData = {
    render(target) {
      window.RuntimeUI.renderMasterDataCenter(target);
    },
    bindEvents() {},
    loadData() { return Promise.resolve([]); },
    submitForm() {},
    refreshTable() {},
    search() {},
    validate() { return true; },
    callApi(action, data) { return window.callApi(action, data || {}); }
  };
  window.GovOpsPages.master = window.GovOpsPages.masterData;
})(window);
