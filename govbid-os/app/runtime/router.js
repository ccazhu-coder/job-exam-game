(function (window) {
  'use strict';

  const routes = {
    dashboard: 'command',
    command: 'command',
    projects: 'projects',
    cases: 'projects',
    caseRequirements: 'caseRequirements',
    sessions: 'sessions',
    registrations: 'registrations',
    review: 'review',
    admission: 'admission',
    manpower: 'manpower',
    manpowerSchedule: 'manpowerSchedule',
    import: 'import',
    changeLogs: 'changeLogs',
    tasks: 'tasks',
    calendar: 'calendar',
    officialDocs: 'officialDocs',
    fileManager: 'fileManager',
    closing: 'closing',
    reportGenerator: 'reportGenerator',
    tenderPool: 'tenderPool',
    users: 'users',
    crm: 'master',
    master: 'master',
    finance: 'finance',
    documents: 'documents',
    settings: 'settings',
    activities: 'activities',
    priorities: 'priorities'
  };

  const runtimeTables = {
    projects: { collection: 'projects', columns: [['專案名稱', '專案名稱'], ['機關', '機關名稱'], ['類型', '專案類型'], ['金額', '契約金額'], ['狀態', '專案狀態', 'badge'], ['健康', '健康分數']] },
    finance: { collection: 'finance', columns: [['日期', '交易日期'], ['類型', '類型', 'badge'], ['說明', '說明'], ['金額', '金額'], ['付款', '付款狀態', 'badge']] },
    documents: { collection: 'documents', columns: [['類型', '文件類型'], ['名稱', '文件名稱'], ['版本', '版本'], ['狀態', '文件狀態', 'badge'], ['建立時間', '建立時間']] },
    crm: { collection: 'contacts', columns: [['名稱', 'name'], ['類型', 'type'], ['電話', 'phone'], ['Email', 'email'], ['狀態', 'status', 'badge']] }
  };

  function routeFromHash() {
    return (location.hash || '#/dashboard').replace(/^#\/?/, '') || 'dashboard';
  }

  async function render(route) {
    const page = routes[route] || route || 'command';
    window.AppStateStore.update('currentPage', page);
    if (window.UI && window.UI.page) await window.UI.page(page);
    const modulePage = window.GovOpsPages && (window.GovOpsPages[page] || window.GovOpsPages[route]);
    if (modulePage) {
      const section = ensureSection(page);
      section.classList.add('show');
      await modulePage.render(section);
    } else if (route === 'master' || route === 'crm') {
      const section = document.getElementById('s-master');
      if (section) window.RuntimeUI.renderMasterDataCenter(section);
    } else if (runtimeTables[route]) {
      const section = document.getElementById('s-' + page);
      if (section) window.RuntimeUI.renderTable(section, runtimeTables[route].collection, runtimeTables[route].columns);
    }
    window.EventBus.emit('router:navigated', { route, page });
  }

  function ensureSection(page) {
    let section = document.getElementById('s-' + page);
    if (!section) {
      const host = document.getElementById('sections') || document.body;
      section = document.createElement('section');
      section.id = 's-' + page;
      section.className = 'section';
      host.appendChild(section);
    }
    document.querySelectorAll('.section').forEach((node) => node.classList.remove('show'));
    return section;
  }

  window.Router = {
    start() {
      window.addEventListener('hashchange', () => render(routeFromHash()));
      render(routeFromHash());
    },
    go(route) {
      location.hash = '#/' + route;
    },
    refresh() {
      render(routeFromHash());
    }
  };

  window.loadPage = function (route) {
    window.Router.go(route);
  };
})(window);
