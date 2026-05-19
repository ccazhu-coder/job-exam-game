(function (window) {
  'use strict';
  window.GovOpsPageCore.register('officialDocs', {
    name: 'officialDocs',
    title: '公文',
    subtitle: '抽取第一版 official-docs.html：來文/發文登錄、辦理期限、是否回覆、處理狀態與附件。',
    createLabel: '新增公文',
    idField: '公文ID',
    api: { list: 'getOfficialDocs', create: 'createOfficialDoc', update: 'updateOfficialDoc', archive: 'deleteOfficialDoc' },
    searchPlaceholder: '搜尋公文編號、主旨、發文單位、承辦窗口',
    actions: [
      { action: 'getOfficialDocStats', label: '更新公文統計' }
    ],
    fields: [
      { key: '公文類型', label: '公文類型', type: 'select', options: ['來文','發文'] },
      { key: '公文編號', label: '公文編號' },
      { key: '主旨', label: '主旨', required: true },
      { key: '發文單位', label: '發文單位' },
      { key: '收文單位', label: '收文單位' },
      { key: '承辦窗口', label: '承辦窗口' },
      { key: '聯絡電話', label: '聯絡電話' },
      { key: '來文日期', label: '來文日期', type: 'date' },
      { key: '發文日期', label: '發文日期', type: 'date' },
      { key: '辦理期限', label: '辦理期限', type: 'date' },
      { key: '是否需回覆', label: '是否需回覆', type: 'select', options: ['否','是'] },
      { key: '回覆期限', label: '回覆期限', type: 'date' },
      { key: '處理狀態', label: '處理狀態', type: 'select', options: ['未處理','待回覆','待補件','已完成'] },
      { key: '負責人', label: '負責人' },
      { key: 'caseId', label: '案件ID' },
      { key: '公文摘要', label: '公文摘要', type: 'textarea' },
      { key: '附件連結', label: '附件連結' }
    ],
    columns: [
      { key: '公文ID', label: '公文ID' }, { key: '公文類型', label: '類型' }, { key: '公文編號', label: '編號' },
      { key: '主旨', label: '主旨' }, { key: '辦理期限', label: '期限' }, { key: '處理狀態', label: '狀態' }
    ],
    actionHandlers: {
      getOfficialDocStats: (page) => page.callApi('getOfficialDocStats', {}).then((result) => {
        const stats = result.stats || result.data || {};
        window.RuntimeUI.toast(`公文統計：共 ${stats.total || 0} 件，待處理 ${stats.pending || 0} 件，逾期 ${stats.overdue || 0} 件`, 'success');
        return page.loadData();
      })
    }
  });
})(window);
