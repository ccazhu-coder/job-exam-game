(function (window) {
  'use strict';

  window.GovOpsPageCore.register('manpowerSchedule', {
    name: 'manpowerSchedule',
    title: '人力排班',
    subtitle: '管理支援人員、工讀生與工作人員的場次排班、實際工時、應付金額與付款狀態。',
    createLabel: '新增排班',
    idField: '排班ID',
    api: {
      list: 'getManpowerSchedules',
      create: 'createManpowerSchedule',
      update: 'updateManpowerSchedule',
      archive: 'archiveManpowerSchedule'
    },
    searchPlaceholder: '搜尋姓名、案件、場次、日期或角色',
    fields: [
      { key: '人力ID', label: '人力ID' },
      { key: 'caseId', label: '案件ID' },
      { key: 'sessionId', label: '場次ID' },
      { key: '姓名', label: '姓名', required: true },
      { key: '日期', label: '日期', type: 'date', required: true },
      { key: '開始時間', label: '開始時間', type: 'time' },
      { key: '結束時間', label: '結束時間', type: 'time' },
      { key: '角色', label: '角色' },
      { key: '實際工時', label: '實際工時', type: 'number' },
      { key: '時薪', label: '時薪', type: 'number' },
      { key: '應付金額', label: '應付金額', type: 'number' },
      { key: '付款狀態', label: '付款狀態', type: 'select', options: ['待付款', '已建立應付款', '已付款'] },
      { key: '到班狀態', label: '到班狀態', type: 'select', options: ['未到班', '已到班', '已請假', '未到'] },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '排班ID', label: '排班ID' },
      { key: '姓名', label: '姓名' },
      { key: '日期', label: '日期' },
      { key: '開始時間', label: '開始' },
      { key: '結束時間', label: '結束' },
      { key: '角色', label: '角色' },
      { key: '實際工時', label: '工時' },
      { key: '應付金額', label: '應付金額' },
      { key: '付款狀態', label: '付款' },
      { key: '到班狀態', label: '到班' }
    ],
    rowActions: [{ action: 'generateStaffReceipt', label: '簽收單' }],
    actions: [{ action: 'checkConflict', label: '檢查排班衝突', className: 'secondary' }],
    actionHandlers: {
      async checkConflict(page) {
        const result = await page.callApi('checkManpowerScheduleConflict', {});
        const count = result.conflictCount || result.count || 0;
        if (count > 0) {
          window.RuntimeUI.toast(`發現 ${count} 筆排班衝突，請檢查同人同日重疊時段。`, 'error');
        } else {
          window.RuntimeUI.toast('排班衝突檢查完成，目前沒有時間重疊。', 'success');
        }
      },
      async generateStaffReceipt(page, id) {
        const result = await page.callApi('generateStaffReceipt', { 排班ID: id, id });
        const url = result.fileUrl || result.document?.['檔案連結'];
        window.RuntimeUI.toast(url ? '工作人員費用簽收單已產生。' : '簽收單紀錄已建立，雲端文件稍後補產。', 'success');
        await page.loadData();
      }
    }
  });
})(window);
