(function (window) {
  'use strict';

  const STORAGE_KEY = 'GovOps_runtime_state_v1';
  const saved = safeParse(localStorage.getItem(STORAGE_KEY), {});
  const state = Object.assign({
    user: null,
    tenant: null,
    tenantId: '',
    workspaceId: '',
    currentPage: 'command',
    projects: [],
    contacts: [],
    tasks: [],
    finance: [],
    documents: [],
    notifications: [],
    ui: {
      loading: false,
      query: '',
      tablePage: 1,
      sortKey: '',
      sortDir: 'asc',
      assistantOpen: false
    }
  }, saved);

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
      ['projects','contacts','tasks','finance','documents','notifications','instructors','vendors','venues','staff','agencies','students','resources','accounts','templates'].forEach((name) => {
        state[name] = [];
      });
      state.user = null;
      state.tenant = null;
      state.tenantId = '';
      state.workspaceId = '';
      persist();
      window.EventBus && window.EventBus.emit('state:changed', state);
    }
  };
})(window);
