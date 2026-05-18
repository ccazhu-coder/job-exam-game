(function (window) {
  'use strict';
  window.GovOpsPageCore.register('paperArchive', {
    name: 'paperArchive',
    title: '紙本文件歸檔',
    subtitle: '管理紙本原件收回、掃描、上傳、實體位置、文件盒與卷宗，並標記是否列入核銷或結案。',
    createLabel: '新增紙本文件',
    idField: '紙本ID',
    api: { list: 'getPaperArchives', create: 'createPaperArchive', update: 'updatePaperArchive', archive: 'archivePaperArchive', generatePaperArchiveLabel: 'generatePaperArchiveLabel' },
    searchPlaceholder: '搜尋文件名稱、文件編號、資料夾、文件盒、卷宗',
    actions: [{ action: 'generatePaperArchiveLabel', label: '產生紙本標籤' }],
    fields: [
      { key: 'caseId', label: '案件ID' },
      { key: 'sessionId', label: '場次ID' },
      { key: '紙本文件類型', label: '紙本文件類型', type: 'select', options: ['簽到表','簽退表','問卷','領據','發票/收據','公文','契約','驗收資料','其他'] },
      { key: '紙本文件編號', label: '紙本文件編號' },
      { key: '文件名稱', label: '文件名稱', required: true },
      { key: '是否已收回', label: '是否已收回', type: 'select', options: ['否','是'] },
      { key: '是否已掃描', label: '是否已掃描', type: 'select', options: ['否','是'] },
      { key: '是否已上傳', label: '是否已上傳', type: 'select', options: ['否','是'] },
      { key: '實體存放位置', label: '實體存放位置' },
      { key: '資料夾編號', label: '資料夾編號' },
      { key: '文件盒編號', label: '文件盒編號' },
      { key: '卷宗名稱', label: '卷宗名稱' },
      { key: '是否列入結案', label: '是否列入結案', type: 'select', options: ['否','是'] },
      { key: '是否列入核銷', label: '是否列入核銷', type: 'select', options: ['否','是'] },
      { key: '是否缺件', label: '是否缺件', type: 'select', options: ['否','是'] },
      { key: '借出狀態', label: '借出狀態', type: 'select', options: ['未借出','已借出','已歸還'] },
      { key: '狀態', label: '狀態', type: 'select', options: ['待收回','待掃描','待上傳','已歸檔','缺件','已封存'] }
    ],
    columns: [
      { key: '紙本ID', label: '紙本ID' },
      { key: 'caseId', label: '案件' },
      { key: '紙本文件類型', label: '類型' },
      { key: '文件名稱', label: '名稱' },
      { key: '是否已收回', label: '收回' },
      { key: '是否已掃描', label: '掃描' },
      { key: '是否已上傳', label: '上傳' },
      { key: '實體存放位置', label: '位置' },
      { key: '是否缺件', label: '缺件' },
      { key: '狀態', label: '狀態' }
    ],
    actionHandlers: {
      generatePaperArchiveLabel: (page) => page.callApi('generatePaperArchiveLabel', {}).then(() => page.loadData())
    }
  });
})(window);
