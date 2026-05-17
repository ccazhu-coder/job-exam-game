(function (window) {
  'use strict';
  window.GovOpsPageCore.register('finance', {
    name: 'finance',
    title: '財務核銷',
    subtitle: '抽取第一版 finance.html：收入、支出、收付狀態、預計/實際收付日與財務摘要。',
    createLabel: '新增財務紀錄',
    idField: '財務ID',
    api: { list: 'getFinanceRecords', create: 'createFinanceRecord', update: 'updateFinanceRecord', archive: 'archiveFinanceRecord' },
    searchPlaceholder: '搜尋案件、科目、對象、收付狀態',
    actions: [
      { action: 'getFinanceSummary', label: '更新財務摘要' },
      { action: 'migrateOldFinanceData', label: '遷移舊資料', className: 'secondary' }
    ],
    fields: [
      { key: 'caseId', label: '案件ID' },
      { key: '類型', label: '類型', type: 'select', options: ['收入','支出'] },
      { key: '科目', label: '科目' },
      { key: '對象名稱', label: '對象名稱', required: true },
      { key: '金額', label: '金額', type: 'number', required: true },
      { key: '付款方式', label: '付款方式', type: 'select', options: ['匯款','現金','支票','刷卡','其他'] },
      { key: '收付狀態', label: '收付狀態', type: 'select', options: ['未付款','待收款','已付款','已收款','已核銷'] },
      { key: '預計收付日', label: '預計收付日', type: 'date' },
      { key: '實際收付日', label: '實際收付日', type: 'date' },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '財務ID', label: '財務ID' }, { key: 'caseId', label: '案件' }, { key: '類型', label: '類型' },
      { key: '科目', label: '科目' }, { key: '對象名稱', label: '對象' }, { key: '金額', label: '金額' }, { key: '收付狀態', label: '狀態' }
    ]
  });
})(window);
