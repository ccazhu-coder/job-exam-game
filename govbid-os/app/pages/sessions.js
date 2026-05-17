(function (window) {
  'use strict';
  window.GovOpsPageCore.register('sessions', {
    name: 'sessions',
    title: '場次管理 / 活動場次',
    subtitle: '抽取第一版 sessions.html：案件底下建立場次、維護時間地點、講師、工作人員與現場需求。',
    createLabel: '新增場次',
    idField: '活動ID',
    api: { list: 'getSessions', get: 'getSession', create: 'createSession', update: 'updateSession', archive: 'archiveSession', generateTasks: 'generateSessionTasks' },
    searchPlaceholder: '搜尋場次名稱、地點、講師',
    fields: [
      { key: 'caseId', label: '關聯案件ID' },
      { key: '場次名稱', label: '場次名稱', required: true },
      { key: '場次類型', label: '場次類型', type: 'select', options: ['課程','講座','活動','諮詢','顧問會議','籌備會議','成果會議','驗收會議','訪視行程','場勘行程','其他'] },
      { key: '場次狀態', label: '場次狀態', type: 'select', options: ['規劃中','確認中','執行中','已完成','取消'] },
      { key: '場次日期', label: '場次日期', type: 'date' },
      { key: '開始時間', label: '開始時間', type: 'time' },
      { key: '結束時間', label: '結束時間', type: 'time' },
      { key: '活動地點', label: '活動地點' },
      { key: '報名截止日', label: '報名截止日', type: 'date' },
      { key: '講師', label: '講師' },
      { key: '聯絡人', label: '聯絡人' },
      { key: '工作人員', label: '工作人員' },
      { key: '預計人數', label: '預計人數', type: 'number' },
      { key: '實際人數', label: '實際人數', type: 'number' },
      { key: '是否需簽到表', label: '是否需簽到表', type: 'select', options: ['否','是'] },
      { key: '是否需問卷', label: '是否需問卷', type: 'select', options: ['否','是'] },
      { key: '是否需便當', label: '是否需便當', type: 'select', options: ['否','是'] },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '活動ID', label: '場次編號' },
      { key: '活動名稱', label: '場次名稱' },
      { key: '活動類型', label: '類型' },
      { key: '活動日期', label: '日期' },
      { key: '活動地點', label: '地點' },
      { key: '講師', label: '講師' },
      { key: '狀態', label: '狀態' }
    ],
    rowActions: [
      { action: 'openRegistrations', label: '報名' },
      { action: 'generateTasks', label: 'SOP任務' }
    ],
    actionHandlers: {
      openRegistrations(page, id) { window.AppStateStore.update('ui.sessionId', id); window.Router.go('registrations'); },
      async generateTasks(page, id) { await window.callApi('generateSessionTasks', { sessionId: id, 活動ID: id }); window.RuntimeUI.toast('已產生 SOP 任務', 'success'); }
    }
  });
})(window);
