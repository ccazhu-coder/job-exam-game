(function (window) {
  'use strict';
  const fields = [
    { key: 'sessionId', label: '場次ID' },
    { key: '姓名', label: '姓名', required: true },
    { key: '電話', label: '電話', required: true },
    { key: 'Email', label: 'Email', type: 'email' },
    { key: '性別', label: '性別', type: 'select', options: ['','男','女','其他'] },
    { key: '身分別', label: '身分別', type: 'select', options: ['','在職勞工','失業者','應屆畢業生','學生','自營作業者','其他'] },
    { key: '服務單位', label: '服務單位' },
    { key: '職稱', label: '職稱' },
    { key: '出生日期', label: '出生日期', type: 'date' },
    { key: '用餐習慣', label: '用餐習慣', type: 'select', options: ['','葷食','素食','不需要'] },
    { key: '地址', label: '地址' },
    { key: '報名來源', label: '報名來源', type: 'select', options: ['手動新增','線上報名','現場補報名','電話報名','其他'] },
    { key: '備註', label: '備註', type: 'textarea' }
  ];
  window.GovOpsPageCore.register('registrations', {
    name: 'registrations',
    title: '報名管理',
    subtitle: '抽取第一版 registrations.html：手動新增、查詢、資格審查、錄取狀態、批次更新。',
    createLabel: '新增報名',
    idField: '報名ID',
    api: { list: 'getRegistrations', get: 'getRegistration', create: 'createRegistration', update: 'updateRegistration', archive: 'archiveRegistration', updateStatus: 'updateRegistrationStatus', batchUpdate: 'batchUpdateStatus' },
    searchPlaceholder: '搜尋姓名、電話、Email、服務單位',
    fields,
    columns: [
      { key: '報名ID', label: '報名ID' },
      { key: '姓名', label: '姓名' },
      { key: '電話', label: '電話' },
      { key: 'Email', label: 'Email' },
      { key: '資格審查狀態', label: '資格審查' },
      { key: '錄取狀態', label: '錄取' },
      { key: '用餐習慣', label: '用餐' }
    ],
    rowActions: [
      { action: 'approve', label: '符合資格' },
      { action: 'admit', label: '錄取' },
      { action: 'waitlist', label: '備取' },
      { action: 'reject', label: '未錄取' }
    ],
    beforeSubmit(page, data) {
      data.caseId = data.caseId || window.AppState?.ui?.caseId || '';
      data.sessionId = data.sessionId || window.AppState?.ui?.sessionId || '';
      data['活動ID'] = data['活動ID'] || data.sessionId;
      data['資格審查狀態'] = data['資格審查狀態'] || '待審查';
      data['錄取狀態'] = data['錄取狀態'] || '待審查';
      data['報名來源'] = data['報名來源'] || '手動新增';
      data['通知狀態'] = data['通知狀態'] || '待通知';
      data['狀態'] = data['狀態'] || data['錄取狀態'];
    },
    actionHandlers: {
      approve: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 資格審查狀態: '符合資格' }).then(() => page.loadData()),
      admit: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 錄取狀態: '已錄取' }).then(() => page.loadData()),
      waitlist: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 資格審查狀態: '備取', 錄取狀態: '備取' }).then(() => page.loadData()),
      reject: (page, id) => page.callApi('updateRegistrationStatus', { regId: id, 報名ID: id, 資格審查狀態: '不符合資格', 錄取狀態: '未錄取' }).then(() => page.loadData())
    }
  });
})(window);
