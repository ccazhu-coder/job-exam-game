(function (window) {
  'use strict';

  const generatorLabels = {
    generateAttendanceSheet: '簽到表',
    generateAdmissionNotice: '錄取通知',
    generateMealCountSheet: '訂餐表',
    generateReimbursementSheet: '核銷清單',
    generateWorkChecklist: '工作檢核表'
  };

  async function runGenerator(page, action) {
    const result = await page.callApi(action, {});
    const label = generatorLabels[action] || '文件';
    const url = result.fileUrl || result.fileUrlForUser || result.document?.['檔案連結'];
    window.RuntimeUI.toast(url ? `${label}已產生並建立雲端連結。` : `${label}文件紀錄已建立。`, 'success');
    await page.loadData();
  }

  window.GovOpsPageCore.register('documents', {
    name: 'documents',
    title: '行政文件中心',
    subtitle: '管理簽到表、錄取名冊、訂餐表、地址標籤、領據、核銷清單與工作檢核表等文件產出紀錄。',
    createLabel: '新增文件',
    idField: '文件ID',
    api: {
      list: 'getDocuments',
      create: 'createAdminDocument',
      update: 'updateDocument',
      archive: 'archiveDocument'
    },
    searchPlaceholder: '搜尋文件名稱、文件類型、案件、場次或狀態',
    actions: [
      { action: 'generateAttendanceSheet', label: '產生簽到表' },
      { action: 'generateAdmissionNotice', label: '產生錄取通知', className: 'secondary' },
      { action: 'generateMealCountSheet', label: '產生訂餐表', className: 'secondary' },
      { action: 'generateReimbursementSheet', label: '產生核銷清單', className: 'secondary' },
      { action: 'generateWorkChecklist', label: '產生工作檢核表', className: 'secondary' }
    ],
    fields: [
      { key: 'caseId', label: '案件ID' },
      { key: 'sessionId', label: '場次ID' },
      { key: '文件類型', label: '文件類型', type: 'select', options: ['簽到表', '錄取名單', '訂餐表', '領據', '核銷清單', '工作檢核表', '公文附件', '結案附件', '其他'] },
      { key: '文件名稱', label: '文件名稱', required: true },
      { key: '檔案連結', label: '檔案連結' },
      { key: '文件狀態', label: '文件狀態', type: 'select', options: ['草稿版', '待產生', '已產生', '需重產', '送出版', '核定版', '作廢版'] },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '文件ID', label: '文件ID' },
      { key: 'caseId', label: '案件' },
      { key: 'sessionId', label: '場次' },
      { key: '文件類型', label: '文件類型' },
      { key: '文件名稱', label: '文件名稱' },
      { key: '文件狀態', label: '狀態' },
      { key: '檔案連結', label: '連結' }
    ],
    actionHandlers: {
      generateAttendanceSheet: (page) => runGenerator(page, 'generateAttendanceSheet'),
      generateAdmissionNotice: (page) => runGenerator(page, 'generateAdmissionNotice'),
      generateMealCountSheet: (page) => runGenerator(page, 'generateMealCountSheet'),
      generateReimbursementSheet: (page) => runGenerator(page, 'generateReimbursementSheet'),
      generateWorkChecklist: (page) => runGenerator(page, 'generateWorkChecklist')
    }
  });
})(window);
