(function (window) {
  'use strict';
  window.GovOpsPageCore.register('reportGenerator', {
    name: 'reportGenerator',
    title: '結案報告產生器',
    subtitle: '抽取第一版 report-generator.html：載入案件報告資料、編輯章節、產生報告、匯出文件。',
    createLabel: '新增報告草稿',
    idField: '報告ID',
    api: { list: 'getReportData', create: 'autoGenerateClosingReport', update: 'saveReportDraft', archive: 'archiveReportDraft', exportDoc: 'exportDocAsGoogleDoc' },
    searchPlaceholder: '搜尋案件、報告版本、章節',
    actions: [
      { action: 'autoGenerateClosingReport', label: 'AI 產生結案報告' },
      { action: 'exportDocAsGoogleDoc', label: '匯出 Google 文件' }
    ],
    rowActions: [
      { action: 'exportDocAsGoogleDoc', label: '匯出 Doc' }
    ],
    actionHandlers: {
      async autoGenerateClosingReport(page) {
        await page.callApi('autoGenerateClosingReport', {});
        window.RuntimeUI.toast('已依案件資料產生結案報告草稿', 'success');
        await page.loadData();
      },
      async exportDocAsGoogleDoc(page, id) {
        await page.callApi('exportDocAsGoogleDoc', id ? { 報告ID: id, reportId: id } : {});
        window.RuntimeUI.toast('已匯出 Google 文件並回寫文件紀錄', 'success');
        await page.loadData();
      }
    },
    fields: [
      { key: 'caseId', label: '案件ID' },
      { key: '前言', label: '前言', type: 'textarea' },
      { key: '計畫摘要', label: '計畫摘要', type: 'textarea' },
      { key: '預期效益', label: '預期效益', type: 'textarea' },
      { key: '觀察與成果', label: '觀察與成果', type: 'textarea' },
      { key: '問題與改善', label: '問題與改善', type: 'textarea' },
      { key: '行政檢討', label: '行政檢討', type: 'textarea' },
      { key: '場次檢討', label: '場次檢討', type: 'textarea' },
      { key: '招生檢討', label: '招生檢討', type: 'textarea' },
      { key: '建議事項', label: '建議事項', type: 'textarea' }
    ],
    columns: [
      { key: '報告ID', label: '報告ID' }, { key: 'caseId', label: '案件' }, { key: '版本', label: '版本' },
      { key: '狀態', label: '狀態' }, { key: '更新時間', label: '更新時間' }
    ]
  });
})(window);
