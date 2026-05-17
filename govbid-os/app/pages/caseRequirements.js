(function (window) {
  'use strict';
  window.GovOpsPageCore.register('caseRequirements', {
    name: 'caseRequirements',
    title: '需求摘要',
    subtitle: '抽取第一版 case-requirements.html：服務對象、預期場次、預算段落、驗收項目與需求摘要保存。',
    createLabel: '新增需求摘要',
    idField: '需求ID',
    api: { list: 'getCaseRequirements', get: 'getCaseRequirements', create: 'saveCaseRequirements', update: 'saveCaseRequirements', archive: 'archiveCaseRequirements' },
    searchPlaceholder: '搜尋案件、需求、驗收項目、預算關鍵字',
    actions: [{ action: 'parseBudget', label: '解析預算段落', className: 'secondary' }],
    fields: [
      { key: 'caseId', label: '案件ID' },
      { key: '服務對象', label: '服務對象' },
      { key: '服務對象人數', label: '服務對象人數', type: 'number' },
      { key: '預期場次數', label: '預期場次數', type: 'number' },
      { key: '預期參與人次', label: '預期參與人次', type: 'number' },
      { key: '計畫目標', label: '計畫目標', type: 'textarea' },
      { key: '預期效益', label: '預期效益', type: 'textarea' },
      { key: '預算文字', label: '預算文字', type: 'textarea' },
      { key: '驗收項目名稱', label: '驗收項目名稱' },
      { key: '繳交期限', label: '繳交期限', type: 'date' },
      { key: '狀態', label: '狀態', type: 'select', options: ['未完成','進行中','已完成','已封存'] }
    ],
    columns: [
      { key: '需求ID', label: '需求ID' },
      { key: 'caseId', label: '案件ID' },
      { key: '服務對象', label: '服務對象' },
      { key: '預期場次數', label: '場次' },
      { key: '驗收項目名稱', label: '驗收項目' },
      { key: '狀態', label: '狀態' }
    ],
    actionHandlers: {
      async parseBudget(page) {
        await page.callApi('createBudgetItem', { note: '由新版需求摘要頁觸發預算解析' });
        window.RuntimeUI.toast('預算解析 action 已送出', 'success');
      }
    }
  });
})(window);
