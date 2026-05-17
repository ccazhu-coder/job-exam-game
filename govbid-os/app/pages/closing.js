(function (window) {
  'use strict';
  window.GovOpsPageCore.register('closing', {
    name: 'closing',
    title: '結案',
    subtitle: '抽取第一版 closing.html：結案摘要、檢核清單、初始化缺件、更新檢核與產生結案摘要。',
    createLabel: '新增結案項目',
    idField: '結案項目ID',
    api: { list: 'getClosingChecklist', create: 'initClosingChecklist', update: 'updateClosingItem', archive: 'archiveClosingItem', generateReport: 'generateClosingSummary' },
    searchPlaceholder: '搜尋結案項目、缺件、負責人',
    actions: [
      { action: 'initClosingChecklist', label: '初始化結案檢核' },
      { action: 'generateClosingSummary', label: '產生結案摘要' }
    ],
    fields: [
      { key: 'caseId', label: '案件ID' }, { key: '結案項目', label: '結案項目', required: true },
      { key: '類型', label: '類型', type: 'select', options: ['文件','核銷','成果','驗收','請款','歸檔'] },
      { key: '是否必備', label: '是否必備', type: 'select', options: ['是','否'] },
      { key: '狀態', label: '狀態', type: 'select', options: ['未完成','待補件','已完成'] },
      { key: '負責人', label: '負責人' }, { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '結案項目ID', label: '項目ID' }, { key: '結案項目', label: '項目' }, { key: '類型', label: '類型' },
      { key: '是否必備', label: '必備' }, { key: '狀態', label: '狀態' }, { key: '負責人', label: '負責人' }
    ]
  });
})(window);
