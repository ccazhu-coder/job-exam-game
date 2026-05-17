(function (window) {
  'use strict';
  window.GovOpsPageCore.register('manpowerSchedule', {
    name: 'manpowerSchedule',
    title: '人力排班',
    subtitle: '抽取第一版 manpower-schedule.html：人員、日期、時段、角色、到班狀態與衝突檢查。',
    createLabel: '新增排班',
    idField: '排班ID',
    api: { list: 'getManpowerSchedules', create: 'createManpowerSchedule', update: 'updateManpowerSchedule', archive: 'archiveManpowerSchedule', checkConflict: 'checkManpowerScheduleConflict' },
    searchPlaceholder: '搜尋人員、日期、場次、角色',
    fields: [
      { key: '人力ID', label: '人力ID' },
      { key: 'sessionId', label: '場次ID' },
      { key: '姓名', label: '姓名', required: true },
      { key: '日期', label: '日期', type: 'date', required: true },
      { key: '開始時間', label: '開始時間', type: 'time' },
      { key: '結束時間', label: '結束時間', type: 'time' },
      { key: '角色', label: '角色' },
      { key: '到班狀態', label: '到班狀態', type: 'select', options: ['未確認','已確認','已到班','未到班','請假'] },
      { key: '備註', label: '備註', type: 'textarea' }
    ],
    columns: [
      { key: '排班ID', label: '排班ID' },
      { key: '姓名', label: '姓名' },
      { key: '日期', label: '日期' },
      { key: '開始時間', label: '開始' },
      { key: '結束時間', label: '結束' },
      { key: '角色', label: '角色' },
      { key: '到班狀態', label: '狀態' }
    ],
    actions: [{ action: 'checkConflict', label: '檢查衝突', className: 'secondary' }],
    actionHandlers: {
      checkConflict: (page) => page.callApi('checkManpowerScheduleConflict', {}).then(() => window.RuntimeUI.toast('排班衝突檢查完成', 'success'))
    }
  });
})(window);
