(function (window) {
  'use strict';
  window.GovOpsPageCore.register('changeLogs', {
    name: 'changeLogs',
    title: '變更紀錄',
    subtitle: '抽取第一版 change-log.html：活動/場次異動、通知判斷、標記已通知。',
    createLabel: '新增變更紀錄',
    idField: '變更ID',
    api: { list: 'getChangeLogs', create: 'createChangeLog', update: 'updateChangeLog', archive: 'archiveChangeLog', markNotified: 'markNotified' },
    searchPlaceholder: '搜尋案件、場次、異動類型、原因',
    rowActions: [{ action: 'markNotified', label: '已通知' }],
    fields: [
      { key: 'caseId', label: '案件ID' }, { key: 'sessionId', label: '場次ID' },
      { key: '異動類型', label: '異動類型', required: true },
      { key: '原內容', label: '原內容' }, { key: '新內容', label: '新內容' },
      { key: '異動原因', label: '異動原因', type: 'textarea' },
      { key: '是否通知', label: '是否通知', type: 'select', options: ['否','是'] },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '變更ID', label: '變更ID' }, { key: 'caseId', label: '案件' }, { key: 'sessionId', label: '場次' },
      { key: '異動類型', label: '異動類型' }, { key: '新內容', label: '新內容' }, { key: '是否通知', label: '通知' }
    ]
  });
})(window);
