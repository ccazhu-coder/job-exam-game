(function (window) {
  'use strict';

  const idFields = {
    projects: '專案ID',
    finance: '財務ID',
    documents: '文件ID',
    tasks: '任務ID',
    contacts: 'id'
  };

  const entityToCollection = {
    project: 'projects',
    finance: 'finance',
    document: 'documents',
    task: 'tasks',
    contact: 'contacts'
  };

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
  }

  function getMock(collection) {
    return JSON.parse(JSON.stringify((window.AppState[collection] && window.AppState[collection].length ? window.AppState[collection] : window.MockData[collection]) || []));
  }

  async function gas(action, data) {
    if (!window.GovOpsAPI || !window.S || !window.S.token) return null;
    try {
      return await window.GovOpsAPI.call(action, data || {});
    } catch (error) {
      console.warn('[RuntimeAPI] GAS fallback to mock:', action, error.message);
      return null;
    }
  }

  function normalize(result) {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    return result.rows || result.data || result['資料'] || result.result || result['結果'] || [];
  }

  window.RuntimeAPI = {
    async bootstrap() {
      window.AppStateStore.replaceCollection('projects', normalize(await gas('queryRecords', { entityType: 'project' })) || getMock('projects'));
      if (!window.AppState.projects.length) window.AppStateStore.replaceCollection('projects', getMock('projects'));
      window.AppStateStore.replaceCollection('finance', normalize(await gas('queryRecords', { entityType: 'finance' })) || getMock('finance'));
      if (!window.AppState.finance.length) window.AppStateStore.replaceCollection('finance', getMock('finance'));
      window.AppStateStore.replaceCollection('documents', normalize(await gas('queryRecords', { entityType: 'document' })) || getMock('documents'));
      if (!window.AppState.documents.length) window.AppStateStore.replaceCollection('documents', getMock('documents'));
      window.AppStateStore.replaceCollection('tasks', getMock('tasks'));
      window.AppStateStore.replaceCollection('contacts', getMock('contacts'));
      window.AppStateStore.replaceCollection('notifications', getMock('notifications'));
    },
    async query(collection, filters) {
      let rows = getMock(collection);
      Object.keys(filters || {}).forEach((key) => {
        if (filters[key]) rows = rows.filter((row) => String(row[key] || '').includes(String(filters[key])));
      });
      return rows;
    },
    async save(collection, record) {
      const rows = getMock(collection);
      const idField = idFields[collection] || 'id';
      const prefix = collection.slice(0, 3).toUpperCase();
      const row = Object.assign({}, record);
      row[idField] = row[idField] || uid(prefix);
      rows.unshift(row);
      window.AppStateStore.replaceCollection(collection, rows);
      const entityType = Object.keys(entityToCollection).find((key) => entityToCollection[key] === collection);
      if (entityType && window.GovOpsAPI && window.S && window.S.token) window.GovOpsAPI.createRecord(entityType, row).catch(() => {});
      return row;
    },
    async update(collection, id, patch) {
      const idField = idFields[collection] || 'id';
      const rows = getMock(collection).map((row) => String(row[idField]) === String(id) ? Object.assign({}, row, patch) : row);
      window.AppStateStore.replaceCollection(collection, rows);
      return rows.find((row) => String(row[idField]) === String(id));
    },
    async archive(collection, id) {
      const idField = idFields[collection] || 'id';
      const rows = getMock(collection).map((row) => String(row[idField]) === String(id) ? Object.assign({}, row, { 狀態: '已封存', status: '已封存' }) : row);
      window.AppStateStore.replaceCollection(collection, rows);
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
