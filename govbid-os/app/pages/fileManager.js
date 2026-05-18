(function (window) {
  'use strict';
  window.GovOpsPageCore.register('fileManager', {
    name: 'fileManager',
    title: '檔案管理',
    subtitle: '抽取第一版 file-manager.html：案件/場次檔案、Google Drive 連結、結案/核銷/請款/報告用途分類。',
    createLabel: '新增檔案',
    idField: '檔案ID',
    api: { list: 'getFiles', create: 'createFile', update: 'updateFile', archive: 'deleteFile' },
    searchPlaceholder: '搜尋檔案名稱、類型、說明、上傳人',
    actions: [
      { action: 'testCloudStorage', label: '測試雲端連線' },
      { action: 'scanMissingFiles', label: '檢查缺件' },
      { action: 'createClosingPackageFolder', label: '建立結案資料包' }
    ],
    fields: [
      { key: 'caseId', label: '案件ID' }, { key: 'sessionId', label: '場次ID' },
      { key: '檔案名稱', label: '檔案名稱', required: true },
      { key: '檔案類型', label: '檔案類型', type: 'select', options: ['合約','簽到表','成果照片','發票','領據','公文','結案報告','其他'] },
      { key: 'GoogleDrive連結', label: 'Google Drive 連結' },
      { key: '檔案說明', label: '檔案說明', type: 'textarea' },
      { key: '上傳日期', label: '上傳日期', type: 'date' },
      { key: '上傳人', label: '上傳人' },
      { key: '是否結案附件', label: '結案附件', type: 'select', options: ['否','是'] },
      { key: '是否核銷附件', label: '核銷附件', type: 'select', options: ['否','是'] },
      { key: '是否請款附件', label: '請款附件', type: 'select', options: ['否','是'] },
      { key: '是否報告附件', label: '報告附件', type: 'select', options: ['否','是'] }
    ],
    columns: [
      { key: '檔案ID', label: '檔案ID' }, { key: '檔案名稱', label: '檔案名稱' }, { key: '檔案類型', label: '類型' },
      { key: '上傳日期', label: '上傳日期' }, { key: '上傳人', label: '上傳人' }, { key: 'GoogleDrive連結', label: '連結' }
    ]
  });
})(window);
