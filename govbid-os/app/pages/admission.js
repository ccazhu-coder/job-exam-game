(function (window) {
  'use strict';
  window.GovOpsPageCore.register('admission', {
    name: 'admission',
    title: '錄取名單',
    subtitle: '抽取第一版 admission.html：錄取、備取、未錄取名單與簽到表產生前置資料。',
    createLabel: '新增名單',
    idField: '報名ID',
    api: { list: 'getAdmissions', create: 'createRegistration', update: 'updateRegistrationStatus', archive: 'archiveRegistration', generateDocument: 'generateSigninSheet' },
    searchPlaceholder: '搜尋錄取 / 備取名單',
    fields: [
      { key: '姓名', label: '姓名', required: true },
      { key: '電話', label: '電話', required: true },
      { key: 'Email', label: 'Email' },
      { key: '錄取狀態', label: '錄取狀態', type: 'select', options: ['已錄取','備取','未錄取'] },
      { key: '通知狀態', label: '通知狀態', type: 'select', options: ['待通知','已通知','通知失敗'] }
    ],
    columns: [
      { key: '報名ID', label: '報名ID' },
      { key: '姓名', label: '姓名' },
      { key: '電話', label: '電話' },
      { key: '錄取狀態', label: '錄取狀態' },
      { key: '通知狀態', label: '通知' },
      { key: '用餐習慣', label: '用餐' }
    ],
    actions: [{ action: 'generateSigninSheet', label: '產生簽到表', className: 'secondary' }],
    rowActions: [
      { action: 'admit', label: '錄取' },
      { action: 'waitlist', label: '備取' },
      { action: 'reject', label: '未錄取' }
    ],
    actionHandlers: {
      generateSigninSheet: (page) => page.callApi('generateSigninSheet', {}).then(() => {
        window.RuntimeUI.toast('簽到表已依錄取名單產生', 'success');
        return page.loadData();
      }),
      admit: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 錄取狀態: '已錄取' }).then(() => page.loadData()),
      waitlist: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 錄取狀態: '備取', 資格審查狀態: '備取' }).then(() => page.loadData()),
      reject: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 錄取狀態: '未錄取', 資格審查狀態: '未錄取' }).then(() => page.loadData())
    }
  });
})(window);
