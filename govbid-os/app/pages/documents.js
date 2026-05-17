(function (window) {
  'use strict';
  window.GovOpsPageCore.register('documents', {
    name: 'documents',
    title: '行政文件',
    subtitle: '抽取第一版 documents.html：簽到表、錄取名單、訂餐表、地址標籤、領據、核銷清單與工作檢核表產生。',
    createLabel: '新增文件任務',
    idField: '文件ID',
    api: { list: 'getDocuments', create: 'createAdminDocument', update: 'updateDocument', archive: 'archiveDocument' },
    searchPlaceholder: '搜尋文件名稱、類型、案件、場次',
    actions: [
      { action: 'generateAttendanceSheet', label: '產生簽到表' },
      { action: 'generateAdmissionNotice', label: '錄取通知' },
      { action: 'generateMealCountSheet', label: '訂餐表' },
      { action: 'generateReimbursementSheet', label: '核銷清單' },
      { action: 'generateWorkChecklist', label: '工作檢核表' }
    ],
    fields: [
      { key: 'caseId', label: '案件ID' }, { key: 'sessionId', label: '場次ID' },
      { key: '文件類型', label: '文件類型', type: 'select', options: ['簽到表','錄取名單','訂餐表','領據','核銷清單','工作檢核表','其他'] },
      { key: '文件名稱', label: '文件名稱', required: true },
      { key: '檔案連結', label: '檔案連結' },
      { key: '文件狀態', label: '文件狀態', type: 'select', options: ['草稿版','送出版','核定版','補件版','最新版','作廢版'] }
    ],
    columns: [
      { key: '文件ID', label: '文件ID' }, { key: 'caseId', label: '案件' }, { key: 'sessionId', label: '場次' },
      { key: '文件類型', label: '類型' }, { key: '文件名稱', label: '名稱' }, { key: '文件狀態', label: '狀態' }
    ]
  });
})(window);
