(function (window) {
  'use strict';
  window.GovOpsPageCore.register('settings', {
    name: 'settings',
    title: '系統設定',
    subtitle: '抽取第一版 settings.html：API URL、Sheet ID、Drive folder、健康檢查、初始化與連線測試。',
    createLabel: '新增設定',
    idField: '設定ID',
    api: { list: 'getSettings', create: 'saveSetting', update: 'saveSetting', archive: 'archiveSetting' },
    searchPlaceholder: '搜尋設定鍵或設定值',
    actions: [
      { action: 'health', label: '系統健康檢查' },
      { action: '正式平台初始化v01', label: '正式平台初始化' }
    ],
    fields: [
      { key: 'key', label: '設定鍵', required: true },
      { key: 'value', label: '設定值', required: true },
      { key: '說明', label: '說明' }
    ],
    columns: [
      { key: '設定ID', label: '設定ID' }, { key: 'key', label: '設定鍵' }, { key: 'value', label: '設定值' }, { key: '更新時間', label: '更新時間' }
    ]
  });
})(window);
