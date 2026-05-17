(function (window) {
  'use strict';
  window.GovOpsPageCore.register('review', {
    name: 'review',
    title: '資格審查',
    subtitle: '抽取第一版 review.html / registrations.html 審查流程：審查狀態、補件、錄取判斷。',
    createLabel: '新增審查紀錄',
    idField: '報名ID',
    api: { list: 'getRegistrations', create: 'createRegistration', update: 'updateRegistrationStatus', archive: 'archiveRegistration' },
    searchPlaceholder: '搜尋待審查姓名、電話、Email',
    fields: [
      { key: '報名ID', label: '報名ID' },
      { key: '資格審查狀態', label: '資格審查狀態', type: 'select', options: ['待審查','符合資格','不符合資格','需補件','已錄取','備取','未錄取','取消報名'] },
      { key: '錄取狀態', label: '錄取狀態', type: 'select', options: ['','已錄取','備取','未錄取'] },
      { key: '補件項目', label: '補件項目' },
      { key: '補件期限', label: '補件期限', type: 'date' },
      { key: '審查結果說明', label: '審查結果說明', type: 'textarea' }
    ],
    columns: [
      { key: '報名ID', label: '報名ID' },
      { key: '姓名', label: '姓名' },
      { key: '電話', label: '電話' },
      { key: '資格審查狀態', label: '資格審查' },
      { key: '補件項目', label: '補件' },
      { key: '補件期限', label: '期限' }
    ],
    rowActions: [
      { action: 'approve', label: '符合' },
      { action: 'supplement', label: '補件' },
      { action: 'reject', label: '不符合' }
    ],
    actionHandlers: {
      approve: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 資格審查狀態: '符合資格' }).then(() => page.loadData()),
      supplement: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 資格審查狀態: '需補件' }).then(() => page.loadData()),
      reject: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 資格審查狀態: '不符合資格' }).then(() => page.loadData())
    }
  });
})(window);
