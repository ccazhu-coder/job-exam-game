(function (window) {
  'use strict';

  window.GovOpsPageCore.register('closing', {
    name: 'closing',
    title: '結案檢核中心',
    subtitle: '管理案件結案缺件、附件清單、摘要產出與歸檔狀態。結案資料必須依目前 tenant / workspace 隔離。',
    createLabel: '新增結案檢核',
    idField: '結案檢核ID',
    api: {
      list: 'getClosingChecklist',
      create: 'initClosingChecklist',
      update: 'updateClosingItem',
      archive: 'archiveClosingItem'
    },
    searchPlaceholder: '搜尋案件、檢核項目、狀態或備註',
    actions: [
      { action: 'initClosingChecklist', label: '初始化結案檢核' },
      { action: 'generateClosingSummary', label: '產生結案摘要', className: 'secondary' }
    ],
    fields: [
      { key: 'caseId', label: '案件ID' },
      { key: '結案檢核項目', label: '結案檢核項目', required: true },
      { key: '類型', label: '類型', type: 'select', options: ['文件', '照片', '核銷', '問卷', '報告', '歸檔'] },
      { key: '是否必備', label: '是否必備', type: 'select', options: ['是', '否'] },
      { key: '狀態', label: '狀態', type: 'select', options: ['待處理', '待補件', '已完成', '不適用', '封存'] },
      { key: '負責人', label: '負責人' },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '結案檢核ID', label: '檢核ID' },
      { key: 'caseId', label: '案件ID' },
      { key: '結案檢核項目', label: '檢核項目' },
      { key: '類型', label: '類型' },
      { key: '是否必備', label: '必備' },
      { key: '狀態', label: '狀態' },
      { key: '負責人', label: '負責人' }
    ],
    actionHandlers: {
      async initClosingChecklist(page) {
        const result = await page.callApi('initClosingChecklist', {});
        const count = result.createdCount || result.count || 0;
        window.RuntimeUI.toast(`結案檢核已初始化，新增 ${count} 筆項目`, 'success');
        await page.loadData();
      },
      async generateClosingSummary(page) {
        const result = await page.callApi('generateClosingSummary', {});
        const pending = result.pendingCount ?? result.pending ?? 0;
        const completed = result.completedCount ?? result.completed ?? 0;
        window.RuntimeUI.toast(`結案摘要已產生：完成 ${completed}，待處理 ${pending}`, 'success');
        await page.loadData();
      }
    }
  });
})(window);
