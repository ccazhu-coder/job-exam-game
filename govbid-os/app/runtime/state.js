(function (window) {
  'use strict';

  const STORAGE_KEY = 'GovOps_runtime_state_v1';
  const savedRaw = safeParse(localStorage.getItem(STORAGE_KEY), {});
  const storedTenantId = localStorage.getItem('GovOps_tid') || '';
  const storedWorkspaceId = localStorage.getItem('GovOps_workspace') || '';
  const saved = (savedRaw.tenantId && storedTenantId && String(savedRaw.tenantId) !== String(storedTenantId)) ||
    (savedRaw.workspaceId && storedWorkspaceId && String(savedRaw.workspaceId) !== String(storedWorkspaceId))
    ? {}
    : savedRaw;
  if (saved !== savedRaw) localStorage.removeItem(STORAGE_KEY);
  const collectionKeys = [
    'projects',
    'contacts',
    'tasks',
    'finance',
    'documents',
    'notifications',
    'instructors',
    'vendors',
    'venues',
    'staff',
    'agencies',
    'students',
    'resources',
    'accounts',
    'templates',
    'cases',
    'sessions',
    'registrationsWorkflow',
    'reviewWorkflow',
    'admissionsWorkflow',
    'manpower',
    'manpowerSchedule',
    'importJobs',
    'caseRequirements',
    'changeLogs',
    'calendarItems',
    'officialDocs',
    'files',
    'questionnaires',
    'paperArchives',
    'closingItems',
    'reports',
    'templateCases',
    'tenders',
    'tenantUsers'
  ];

  const defaultUi = {
    loading: false,
    query: '',
    tablePage: 1,
    sortKey: '',
    sortDir: 'asc',
    assistantOpen: false,
    masterTab: 'instructors',
    masterSubTab: '',
    masterQuery: '',
    masterShowArchived: false
  };

  const state = Object.assign({
    user: null,
    tenant: null,
    tenantId: '',
    userId: '',
    workspaceId: '',
    currentPage: 'command',
    ui: Object.assign({}, defaultUi)
  }, saved);
  collectionKeys.forEach((name) => {
    if (!Array.isArray(state[name])) state[name] = [];
  });
  state.ui = Object.assign({}, defaultUi, state.ui || {});

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  window.AppState = state;
  window.AppStateStore = {
    get() {
      return state;
    },
    set(patch) {
      Object.assign(state, patch || {});
      if (patch && patch.user) state.userId = patch.user.userId || patch.user['使用者ID'] || state.userId || '';
      persist();
      window.EventBus && window.EventBus.emit('state:changed', state);
      return state;
    },
    update(path, value) {
      const keys = path.split('.');
      let target = state;
      keys.slice(0, -1).forEach((key) => {
        target[key] = target[key] || {};
        target = target[key];
      });
      target[keys[keys.length - 1]] = value;
      persist();
      window.EventBus && window.EventBus.emit('state:changed', state);
      return state;
    },
    replaceCollection(name, rows) {
      state[name] = rows || [];
      persist();
      window.EventBus && window.EventBus.emit(name + ':changed', state[name]);
      window.EventBus && window.EventBus.emit('state:changed', state);
    },
    clearTenantData() {
      collectionKeys.forEach((name) => {
        state[name] = [];
      });
      state.user = null;
      state.tenant = null;
      state.tenantId = '';
      state.userId = '';
      state.workspaceId = '';
      state.currentPage = 'command';
      state.ui = Object.assign({}, defaultUi);
      persist();
      window.EventBus && window.EventBus.emit('state:changed', state);
    },
    hardReset() {
      collectionKeys.forEach((name) => {
        state[name] = [];
      });
      state.user = null;
      state.tenant = null;
      state.tenantId = '';
      state.userId = '';
      state.workspaceId = '';
      state.currentPage = 'command';
      state.ui = Object.assign({}, defaultUi);
      localStorage.removeItem(STORAGE_KEY);
      window.EventBus && window.EventBus.emit('state:changed', state);
    }
  };
})(window);
