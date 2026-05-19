(function (window) {
  'use strict';
  window.GovOpsPageCore.register('import', {
    name: 'import',
    title: '資料匯入中心',
    subtitle: '抽取第一版 import.html：報名、場次、案件與外部表單資料匯入紀錄。',
    createLabel: '新增匯入任務',
    idField: '匯入ID',
    api: { list: 'getImportJobs', create: 'createImportJob', update: 'updateImportJob', archive: 'archiveImportJob', import: 'runImportJob' },
    searchPlaceholder: '搜尋匯入來源、類型、狀態',
    fields: [
      { key: '匯入類型', label: '匯入類型', type: 'select', options: ['案件','場次','報名','滿意度','財務','文件','基本資料'] },
      { key: '來源類型', label: '來源類型', type: 'select', options: ['Google Sheet','Google Form','Excel','CSV','手動貼上'] },
      { key: '來源連結', label: '來源連結' },
      { key: '目標資料表', label: '目標資料表' },
      { key: '貼上資料', label: '貼上資料（CSV 或 JSON 陣列）', type: 'textarea' },
      { key: '匯入狀態', label: '匯入狀態', type: 'select', options: ['待匯入','匯入中','已完成','失敗'] },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '匯入ID', label: '匯入ID' },
      { key: '匯入類型', label: '類型' },
      { key: '來源類型', label: '來源' },
      { key: '目標資料表', label: '目標' },
      { key: '匯入狀態', label: '狀態' },
      { key: '建立時間', label: '建立時間' }
    ],
    rowActions: [{ action: 'runImport', label: '執行匯入' }],
    actionHandlers: {
      runImport: (page, id) => page.callApi('runImportJob', { 匯入ID: id, id }).then(() => page.loadData())
    }
  });
})(window);
