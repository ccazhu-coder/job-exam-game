(function (window) {
  'use strict';

  window.GovOpsPageCore.register('projects', {
    name: 'cases',
    title: '業務案件 / 專案中心',
    subtitle: '管理政府標案、補助計畫、教育訓練、顧問服務與公會專案。案件資料依 tenantId / workspaceId 隔離。',
    createLabel: '新增案件',
    idField: '專案ID',
    api: { list: 'getCases', get: 'getCase', create: 'createCase', update: 'updateCase', archive: 'archiveCase' },
    searchPlaceholder: '搜尋案件名稱、主辦單位、承辦窗口或狀態',
    fields: [
      { key: '案件名稱', label: '案件名稱', required: true },
      { key: '案件類型', label: '案件類型', type: 'select', required: true, options: ['政府標案', '政府補助計畫', '教育訓練課程', '職涯諮詢', '顧問服務', '企業合作', '公會協會專案', '講座活動', '招生課程', 'AI 系統開發', '行銷專案', '內部行政', '臨時人力案', '其他'] },
      { key: '案件狀態', label: '案件狀態', type: 'select', options: ['草稿', '洽談中', '提案中', '已簽約', '執行中', '待請款', '待收款', '待結案', '已結案', '暫停', '取消', '封存'] },
      { key: '主辦單位', label: '客戶 / 主辦單位' },
      { key: '承辦窗口', label: '承辦窗口' },
      { key: '聯絡電話', label: '聯絡電話' },
      { key: 'Email', label: 'Email', type: 'email' },
      { key: '開始日期', label: '開始日期', type: 'date' },
      { key: '結束日期', label: '結束日期', type: 'date' },
      { key: '結案期限', label: '結案期限', type: 'date' },
      { key: '預估收入', label: '預估收入', type: 'number' },
      { key: '預估成本', label: '預估成本', type: 'number' },
      { key: '重要備註', label: '重要備註', type: 'textarea' }
    ],
    columns: [
      { key: '專案ID', label: '案件ID' },
      { key: '案件名稱', label: '案件名稱' },
      { key: '案件類型', label: '類型' },
      { key: '主辦單位', label: '主辦單位' },
      { key: '承辦窗口', label: '窗口' },
      { key: '案件狀態', label: '狀態' },
      { key: '預估收入', label: '預估收入' },
      { key: 'projectFolderUrl', label: '雲端資料夾' }
    ],
    rowActions: [
      { action: 'openProjectFolder', label: '資料夾' },
      { action: 'openSessions', label: '場次' },
      { action: 'openRegistrations', label: '報名' },
      { action: 'openManpower', label: '人力' }
    ],
    async beforeSubmit(page, data, editing) {
      data['專案計畫名稱'] = data['專案計畫名稱'] || data['案件名稱'];
      data['專案類型'] = data['專案類型'] || data['案件類型'];
      data['狀態'] = data['狀態'] || data['案件狀態'] || '草稿';
      data['契約金額'] = data['契約金額'] || data['預估收入'];
      if (!editing) {
        try {
          const settings = await page.callApi('getStorageSettings', {});
          const storage = settings.record || settings.data || settings.settings || settings;
          if (!storage || !storage.status || storage.status === '未設定') {
            window.RuntimeUI.toast('尚未設定 Cloud Sync，案件仍會建立；雲端資料夾可稍後於檔案管理設定。', 'warn');
          }
        } catch (error) {
          window.RuntimeUI.toast('Cloud Sync 尚未設定，案件仍會先建立。', 'warn');
        }
      }
    },
    actionHandlers: {
      async openProjectFolder(page, id) {
        const r = await page.callApi('getProjectFolderUrl', { projectId: id, '專案ID': id });
        if (r.url) window.open(r.url, '_blank');
        else window.RuntimeUI.toast('此案件尚未建立雲端資料夾。', 'warn');
      },
      openSessions(page, id) { window.AppStateStore.update('ui.caseId', id); window.Router.go('sessions'); },
      openRegistrations(page, id) { window.AppStateStore.update('ui.caseId', id); window.Router.go('registrations'); },
      openManpower(page, id) { window.AppStateStore.update('ui.caseId', id); window.Router.go('manpower'); }
    }
  });
})(window);
