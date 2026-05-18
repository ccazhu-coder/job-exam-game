(function (window) {
  'use strict';
  window.GovOpsPageCore.register('templateCase', {
    name: 'templateCase',
    title: '文件範本與歷年案例',
    subtitle: '管理系統通用範本、租戶私人範本、示範範本與歷年標案案例；私人資料依 tenant/workspace 隔離。',
    createLabel: '新增範本或案例',
    idField: '範本案例ID',
    api: { list: 'getTemplateCases', create: 'createTemplateCase', update: 'updateTemplateCase', archive: 'archiveTemplateCase', generateFromTemplateCase: 'generateFromTemplateCase' },
    searchPlaceholder: '搜尋範本名稱、案例名稱、分類、適用階段',
    actions: [{ action: 'generateFromTemplateCase', label: '套用產生文件' }],
    rowActions: [{ action: 'generateFromTemplateCase', label: '套用' }],
    fields: [
      { key: '類型', label: '類型', type: 'select', options: ['文件範本','歷年案例'] },
      { key: '名稱', label: '名稱', required: true },
      { key: '分類', label: '分類', type: 'select', options: ['服務建議書','執行計畫書','結案報告書','簽到表','領據','核銷清單','請款單','案例參考','其他'] },
      { key: '適用階段', label: '適用階段', type: 'select', options: ['投標/提案','開案/簽約','招生/報名','執行前準備','活動執行','請款/核銷','結案/歸檔','全階段'] },
      { key: '可見範圍', label: '可見範圍', type: 'select', options: ['租戶私人','示範範本','系統通用'] },
      { key: '版本', label: '版本' },
      { key: '檔案連結', label: '檔案連結' },
      { key: '內容摘要', label: '內容摘要', type: 'textarea' },
      { key: '可作為服務建議書參考', label: '可作為服務建議書參考', type: 'select', options: ['否','是'] },
      { key: '可作為結案報告參考', label: '可作為結案報告參考', type: 'select', options: ['否','是'] },
      { key: '狀態', label: '狀態', type: 'select', options: ['草稿','啟用','停用','已封存'] }
    ],
    columns: [
      { key: '範本案例ID', label: 'ID' },
      { key: '類型', label: '類型' },
      { key: '名稱', label: '名稱' },
      { key: '分類', label: '分類' },
      { key: '適用階段', label: '階段' },
      { key: '可見範圍', label: '範圍' },
      { key: '版本', label: '版本' },
      { key: '狀態', label: '狀態' }
    ],
    actionHandlers: {
      generateFromTemplateCase: (page, id) => page
        .callApi('generateFromTemplateCase', id ? { 範本案例ID: id, templateCaseId: id } : {})
        .then(() => {
          window.RuntimeUI.toast('已依範本/案例產生文件草稿', 'success');
          return page.loadData();
        })
    }
  });
})(window);
