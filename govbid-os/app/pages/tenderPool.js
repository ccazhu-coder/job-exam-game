(function (window) {
  'use strict';
  window.GovOpsPageCore.register('tenderPool', {
    name: 'tenderPool',
    title: '標案池',
    subtitle: '抽取第一版 tender-pool.html：查詢採購公告、新增標案、查詢標案池、更新標案狀態。',
    createLabel: '新增標案',
    idField: '標案ID',
    api: { list: '查詢標案池', create: '新增標案', update: '更新標案狀態', archive: 'archiveTender', searchTender: '查詢採購公告' },
    searchPlaceholder: '搜尋標案名稱、機關、案號、狀態',
    actions: [{ action: '查詢採購公告', label: '查詢採購公告' }],
    fields: [
      { key: '標案名稱', label: '標案名稱', required: true },
      { key: '機關名稱', label: '機關名稱' },
      { key: '標案案號', label: '標案案號' },
      { key: '招標方式', label: '招標方式' },
      { key: '決標方式', label: '決標方式' },
      { key: '截止投標日', label: '截止投標日', type: 'date' },
      { key: '預算金額', label: '預算金額', type: 'number' },
      { key: '狀態', label: '狀態', type: 'select', options: ['待分析','可投標','不投標','已投標','已決標','封存'] },
      { key: '來源連結', label: '來源連結' }
    ],
    columns: [
      { key: '標案ID', label: '標案ID' }, { key: '標案名稱', label: '標案名稱' }, { key: '機關名稱', label: '機關' },
      { key: '截止投標日', label: '截止日' }, { key: '預算金額', label: '預算' }, { key: '狀態', label: '狀態' }
    ]
  });
})(window);
