(function (window) {
  'use strict';
  window.GovOpsPageCore.register('tasks', {
    name: 'tasks',
    title: '任務',
    subtitle: '抽取第一版 tasks.html：任務新增、查詢、修改、完成、刪除草稿與批次完成。',
    createLabel: '新增任務',
    idField: '任務ID',
    api: { list: 'getTasks', create: 'createTask', update: 'updateTask', archive: 'deleteTask', batchComplete: 'batchCompleteTask' },
    searchPlaceholder: '搜尋任務名稱、負責人、案件、優先度',
    actions: [{ action: 'batchComplete', label: '批次標記完成' }],
    fields: [
      { key: '任務名稱', label: '任務名稱', required: true },
      { key: '任務類型', label: '任務類型', type: 'select', options: ['一般','行政','報名','文件','財務','結案'] },
      { key: '優先度', label: '優先度', type: 'select', options: ['低','中','高','緊急'] },
      { key: '任務狀態', label: '任務狀態', type: 'select', options: ['待辦','進行中','已完成','已取消'] },
      { key: '負責人', label: '負責人' }, { key: 'caseId', label: '案件ID' },
      { key: '開始日期', label: '開始日期', type: 'date' }, { key: '截止日期', label: '截止日期', type: 'date' },
      { key: '提醒日期', label: '提醒日期', type: 'date' }, { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '任務ID', label: '任務ID' }, { key: '任務名稱', label: '任務' }, { key: '任務類型', label: '類型' },
      { key: '優先度', label: '優先' }, { key: '任務狀態', label: '狀態' }, { key: '負責人', label: '負責人' }, { key: '截止日期', label: '截止' }
    ]
  });
})(window);
