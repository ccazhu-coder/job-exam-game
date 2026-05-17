(function (window) {
  'use strict';
  window.GovOpsPageCore.register('calendar', {
    name: 'calendar',
    title: '日曆',
    subtitle: '抽取第一版 calendar.html：案件與場次行程、即將到來事項、Calendar 同步狀態。',
    createLabel: '新增日曆事項',
    idField: '日曆ID',
    api: { list: 'getCalendarItems', create: 'createCalendarItem', update: 'updateCalendarItem', archive: 'archiveCalendarItem', syncCalendar: 'syncGoogleCalendar' },
    searchPlaceholder: '搜尋案件、場次、日期、地點',
    actions: [{ action: 'syncCalendar', label: '同步 Google Calendar' }],
    fields: [
      { key: 'caseId', label: '案件ID' }, { key: 'sessionId', label: '場次ID' },
      { key: '標題', label: '標題', required: true }, { key: '日期', label: '日期', type: 'date' },
      { key: '開始時間', label: '開始時間', type: 'time' }, { key: '結束時間', label: '結束時間', type: 'time' },
      { key: '地點', label: '地點' }, { key: '同步狀態', label: '同步狀態', type: 'select', options: ['未同步','已同步','同步失敗'] }
    ],
    columns: [
      { key: '日曆ID', label: '日曆ID' }, { key: '標題', label: '標題' }, { key: '日期', label: '日期' },
      { key: '開始時間', label: '開始' }, { key: '結束時間', label: '結束' }, { key: '同步狀態', label: '同步' }
    ]
  });
})(window);
