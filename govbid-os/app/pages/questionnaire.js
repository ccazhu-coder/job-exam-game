(function (window) {
  'use strict';
  window.GovOpsPageCore.register('questionnaire', {
    name: 'questionnaire',
    title: '問卷統計與滿意度分析',
    subtitle: '支援紙本問卷、Google 表單、Excel 匯入與手動統計；問卷資料可套入成果與結案報告。',
    createLabel: '新增問卷統計',
    idField: '問卷ID',
    api: { list: 'getQuestionnaires', create: 'createQuestionnaire', update: 'updateQuestionnaire', archive: 'archiveQuestionnaire', generateQuestionnaireAnalysis: 'generateQuestionnaireAnalysis' },
    searchPlaceholder: '搜尋問卷名稱、來源、案件、場次',
    actions: [{ action: 'generateQuestionnaireAnalysis', label: '產生滿意度分析' }],
    fields: [
      { key: 'caseId', label: '案件ID' },
      { key: 'sessionId', label: '場次ID' },
      { key: '問卷來源', label: '問卷來源', type: 'select', options: ['紙本問卷','Google 表單','其他線上表單','Excel 匯入','手動統計'] },
      { key: '問卷名稱', label: '問卷名稱', required: true },
      { key: '發放份數', label: '發放份數', type: 'number' },
      { key: '回收份數', label: '回收份數', type: 'number' },
      { key: '有效份數', label: '有效份數', type: 'number' },
      { key: '線上回覆數', label: '線上回覆數', type: 'number' },
      { key: '紙本回覆數', label: '紙本回覆數', type: 'number' },
      { key: '整體滿意度', label: '整體滿意度', type: 'number' },
      { key: '文字回饋摘要', label: '文字回饋摘要', type: 'textarea' },
      { key: 'AI改善建議', label: 'AI 改善建議', type: 'textarea' },
      { key: '狀態', label: '狀態', type: 'select', options: ['待統計','已統計','已分析','已套入結案報告','已封存'] }
    ],
    columns: [
      { key: '問卷ID', label: '問卷ID' },
      { key: 'caseId', label: '案件' },
      { key: 'sessionId', label: '場次' },
      { key: '問卷來源', label: '來源' },
      { key: '問卷名稱', label: '名稱' },
      { key: '有效份數', label: '有效' },
      { key: '整體滿意度', label: '滿意度' },
      { key: '狀態', label: '狀態' }
    ],
    actionHandlers: {
      generateQuestionnaireAnalysis: (page) => page.callApi('generateQuestionnaireAnalysis', {}).then(() => page.loadData())
    }
  });
})(window);
