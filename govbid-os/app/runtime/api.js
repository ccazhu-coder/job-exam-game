(function (window) {
  'use strict';

  const idFields = {
    projects: '專案ID',
    finance: '財務ID',
    documents: '文件ID',
    tasks: '任務ID',
    contacts: 'id',
    instructors: '講師ID',
    vendors: '廠商ID',
    venues: '場地ID',
    staff: '人員ID',
    agencies: '機關ID',
    students: '學員ID',
    resources: '物資ID',
    accounts: '科目ID',
    templates: '模板ID',
    questionnaires: '問卷ID',
    paperArchives: '紙本ID',
    templateCases: '範本案例ID'
  };

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
  }

  function isAuthenticated() {
    return !!(window.S?.token || localStorage.getItem('GovOps_token'));
  }

  function getMock(collection) {
    const current = window.AppState[collection] || [];
    if (isAuthenticated()) return JSON.parse(JSON.stringify(current));
    return JSON.parse(JSON.stringify((current.length ? current : window.MockData[collection]) || []));
  }

  function normalize(result) {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    return result.rows || result.data || result['資料'] || result.result || result['結果'] || [];
  }

  function apiEnvelope(json) {
    if (!json) throw new Error('API 無回應');
    if (json.ok === false || json.success === false || json['成功'] === false) {
      throw new Error(json.error || json.message || json['錯誤訊息'] || 'API 呼叫失敗');
    }
    const inner = json.data || json.result || json['結果'] || json;
    if (inner && (inner.ok === false || inner.success === false || inner['成功'] === false)) {
      throw new Error(inner.error || inner.message || inner['錯誤訊息'] || 'API 操作失敗');
    }
    return inner;
  }

  async function callApi(action, data = {}) {
    const payload = {
      action,
      tenantId: window.AppState?.tenantId || window.S?.tenantId || window.S?.tid || localStorage.getItem('GovOps_tid') || '',
      workspaceId: window.AppState?.workspaceId || window.S?.workspaceId || localStorage.getItem('GovOps_workspace') || '',
      userId: window.AppState?.userId || window.S?.user?.userId || '',
      authToken: window.S?.token || localStorage.getItem('GovOps_token') || '',
      token: window.S?.token || localStorage.getItem('GovOps_token') || '',
      companyCode: window.S?.companyCode || localStorage.getItem('GovOps_code') || '',
      data
    };
    window.DebugPanel?.log({ type: 'api:request', action, payload });
    const url = window.S?.apiUrl || window.DEFAULT_API;
    if (!url) throw new Error('尚未設定 API URL');
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      window.DebugPanel?.log({ type: 'api:error', action, error: error.message });
      throw new Error('目前無法連線到系統後端');
    }
    const json = await res.json();
    window.DebugPanel?.log({ type: 'api:response', action, response: json });
    return apiEnvelope(json);
  }

  async function safeGas(action, data) {
    if (!window.S || !window.S.token) return null;
    try {
      return await callApi(action, data || {});
    } catch (error) {
      window.DebugPanel?.log({ type: 'api:fallback', action, error: error.message });
      return null;
    }
  }

  function actionForCollection(collection, operation) {
    const module = window.collectionToModule ? window.collectionToModule(collection) : collection;
    const cfg = window.getModuleConfig ? window.getModuleConfig(module) : null;
    return cfg?.api?.[operation] || null;
  }

  function localReplace(collection, rows) {
    window.AppStateStore.replaceCollection(collection, rows);
    return rows;
  }

  window.callApi = callApi;

  window.RuntimeAPI = {
    idField(collection) {
      return idFields[collection] || 'id';
    },
    async bootstrap() {
      window.AppStateStore.replaceCollection('projects', normalize(await safeGas('queryRecords', { entityType: 'project' })));
      if (!isAuthenticated() && !window.AppState.projects.length) localReplace('projects', getMock('projects'));
      window.AppStateStore.replaceCollection('finance', normalize(await safeGas('queryRecords', { entityType: 'finance' })));
      if (!isAuthenticated() && !window.AppState.finance.length) localReplace('finance', getMock('finance'));
      window.AppStateStore.replaceCollection('documents', normalize(await safeGas('queryRecords', { entityType: 'document' })));
      if (!isAuthenticated() && !window.AppState.documents.length) localReplace('documents', getMock('documents'));
      window.AppStateStore.replaceCollection('tasks', isAuthenticated() ? [] : getMock('tasks'));
      window.AppStateStore.replaceCollection('contacts', isAuthenticated() ? [] : getMock('contacts'));
      await Promise.all(['instructors', 'vendors', 'venues', 'staff', 'agencies', 'students', 'resources', 'accounts', 'templates'].map((collection) => this.refresh(collection, { silent: true })));
      window.AppStateStore.replaceCollection('notifications', isAuthenticated() ? [] : getMock('notifications'));
    },
    async refresh(collection, options = {}) {
      const listAction = actionForCollection(collection, 'list');
      const remote = listAction ? normalize(await safeGas(listAction, { filters: options.filters || {} })) : [];
      if (remote.length) return localReplace(collection, remote);
      if (isAuthenticated()) return localReplace(collection, []);
      if (!window.AppState[collection] || !window.AppState[collection].length) return localReplace(collection, getMock(collection));
      return window.AppState[collection];
    },
    async query(collection, filters) {
      let rows = (await this.refresh(collection, { filters })) || getMock(collection);
      Object.keys(filters || {}).forEach((key) => {
        if (filters[key]) rows = rows.filter((row) => String(row[key] || '').includes(String(filters[key])));
      });
      return rows;
    },
    async save(collection, record) {
      const createAction = actionForCollection(collection, 'create');
      const idField = idFields[collection] || 'id';
      let row = Object.assign({}, record);
      row[idField] = row[idField] || uid(collection.slice(0, 3).toUpperCase());
      const remote = createAction && window.S?.token ? await callApi(createAction, row) : null;
      if (remote) row = remote.record || remote.row || remote.data || remote;
      const rows = getMock(collection).filter((item) => String(item[idField]) !== String(row[idField]));
      rows.unshift(row);
      localReplace(collection, rows);
      return row;
    },
    async update(collection, id, patch) {
      const updateAction = actionForCollection(collection, 'update');
      const idField = idFields[collection] || 'id';
      const payload = Object.assign({}, patch, { id });
      payload[idField] = id;
      const remote = updateAction && window.S?.token ? await callApi(updateAction, payload) : null;
      const updated = remote?.record || remote?.row || remote?.data || null;
      const rows = getMock(collection).map((row) => String(row[idField]) === String(id) ? Object.assign({}, row, patch, updated || {}) : row);
      localReplace(collection, rows);
      return rows.find((row) => String(row[idField]) === String(id));
    },
    async setStatus(collection, id, status) {
      const cfgModule = window.collectionToModule ? window.collectionToModule(collection) : collection;
      const cfg = window.getModuleConfig ? window.getModuleConfig(cfgModule) : null;
      const operation = status === '啟用' ? 'enable' : 'disable';
      const action = cfg?.api?.[operation];
      const idField = idFields[collection] || 'id';
      if (action && window.S?.token) await callApi(action, { id, [idField]: id });
      return this.update(collection, id, { 狀態: status, status });
    },
    async archive(collection, id) {
      const archiveAction = actionForCollection(collection, 'archive');
      const idField = idFields[collection] || 'id';
      if (archiveAction && window.S?.token) await callApi(archiveAction, { id, [idField]: id });
      const rows = getMock(collection).map((row) => String(row[idField]) === String(id) ? Object.assign({}, row, { 狀態: '已封存', status: '已封存' }) : row);
      localReplace(collection, rows);
      return true;
    },
    getProjects() { return this.query('projects'); },
    getUsers() { return this.query('contacts'); },
    getFinance() { return this.query('finance'); },
    getTemplates() { return this.query('documents', { 文件類型: '模板' }); },
    saveProject(data) { return this.save('projects', data); },
    updateProject(id, data) { return this.update('projects', id, data); },
    archiveProject(id) { return this.archive('projects', id); }
  };
})(window);
