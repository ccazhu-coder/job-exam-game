(function (window) {
  'use strict';
  window.GovOpsPageCore.register('manpower', {
    name: 'manpower',
    title: '人力招募',
    subtitle: '抽取第一版 manpower.html：招募需求、職務、費用、狀態與關聯案件 / 場次。',
    createLabel: '新增人力需求',
    idField: '人力ID',
    api: { list: 'getManpower', create: 'createManpower', update: 'updateManpower', archive: 'archiveManpower' },
    searchPlaceholder: '搜尋職務、姓名、電話、案件或場次',
    fields: [
      { key: 'caseId', label: '案件ID' },
      { key: 'sessionId', label: '場次ID' },
      { key: '姓名', label: '姓名' },
      { key: '電話', label: '電話' },
      { key: 'Email', label: 'Email' },
      { key: '職務類型', label: '職務類型', type: 'select', options: ['行政工作人員','現場工作人員','助教','講師助理','攝影','設計','其他'] },
      { key: '工作日期', label: '工作日期', type: 'date' },
      { key: '費用', label: '費用', type: 'number' },
      { key: '狀態', label: '狀態', type: 'select', options: ['待確認','已確認','已取消','已完成'] },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '人力ID', label: '人力ID' },
      { key: '姓名', label: '姓名' },
      { key: '職務類型', label: '職務' },
      { key: '工作日期', label: '日期' },
      { key: '費用', label: '費用' },
      { key: '狀態', label: '狀態' }
    ],
    rowActions: [{ action: 'schedule', label: '排班' }],
    actionHandlers: {
      schedule(page, id) { window.AppStateStore.update('ui.manpowerId', id); window.Router.go('manpowerSchedule'); }
    }
  });
})(window);
