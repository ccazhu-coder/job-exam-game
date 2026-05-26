/* GovOps OS shared API client */
(function(){
  'use strict';

  var DEFAULT_TIMEOUT_MS = 45000;
  var DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbzEayaKAUTk5C0s_3fSGQe49KmuJmsZNhYCoia2cjpYSmlYqnnZKIRHZh1GQZT4JpDy5g/exec';

  function getDefaultApiUrl(){
    return window.GOVOPS_CONFIG && window.GOVOPS_CONFIG.API_URL
      ? window.GOVOPS_CONFIG.API_URL
      : DEFAULT_API_URL;
  }
  function readJson(key){
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function getProfile(){ return readJson('govops_profile'); }
  function getAuth(){ return readJson('govops_auth'); }
  function isLocalDemoSession(){
    return String(getAuth().sessionToken || getProfile().sessionToken || '').indexOf('LOCAL-DEMO-') === 0;
  }
  function runtimeParams(params){
    params = params || {};
    var profile = getProfile();
    var auth = getAuth();
    var role = params.userRole || auth.userRole || auth.role || profile.userRole || profile.role || 'viewer';
    var plan = params.plan || auth.plan || auth.planId || profile.plan || profile.planId || 'free';
    var base = {
      tenantId: params.tenantId || auth.tenantId || profile.tenantId || profile.workspaceId || '',
      userId: params.userId || auth.userId || profile.userId || '',
      userRole: role,
      role: role,
      plan: plan,
      sessionToken: params.sessionToken || auth.sessionToken || profile.sessionToken || auth.token || '',
      clientVersion: (window.GOVOPS_CONFIG && window.GOVOPS_CONFIG.VERSION) || '',
      env: (window.GOVOPS_CONFIG && window.GOVOPS_CONFIG.ENV) || 'production'
    };
    return Object.assign(base, params);
  }
  function friendlyError(reason, extra){
    return {
      success: false,
      message: '系統暫時無法完成操作，請稍後再試。',
      data: Object.assign({ reason: reason || 'FRONTEND_API_ERROR' }, extra || {})
    };
  }
  function handleUnauthorized(){
    if (isLocalDemoSession()) return;
    ['govops_auth','govops_profile'].forEach(function(k){
      try { localStorage.removeItem(k); } catch(e){}
    });
    var cur = window.location.pathname + window.location.search;
    if (cur.indexOf('login.html') === -1 && cur.indexOf('register.html') === -1) {
      window.location.href = './login.html?redirect=' + encodeURIComponent(cur);
    }
  }
  function doLogout(){
    ['govops_auth','govops_profile','govops_usage','govops_conn_settings','govops_root_folder'].forEach(function(k){
      try { localStorage.removeItem(k); } catch(e){}
    });
    window.location.href = './login.html';
  }
  function localDemoResponse(params){
    var action = (params && params.action) || 'demo';
    if (action === 'getMe') return { success: true, message: 'Demo session 已載入。', data: getAuth() };
    return { success: true, message: 'Demo 模式已接收：' + action, data: { rows: [], reason: 'LOCAL_DEMO' } };
  }
  function shouldUseLocalDemo(params){
    var action = String((params && params.action) || '');
    return isLocalDemoSession() && ['loginUser','registerTenant','logoutUser'].indexOf(action) < 0;
  }
  function toQuery(params){
    var enriched = runtimeParams(params || {});
    enriched._t = Date.now();
    return new URLSearchParams(enriched).toString();
  }
  async function parseResponse(res){
    var text = await res.text();
    try { return JSON.parse(text); }
    catch(e){
      return {
        success: false,
        message: 'API 回應不是 JSON，請檢查 Apps Script 部署狀態。',
        data: { reason: 'INVALID_JSON', status: res.status, raw: text.slice(0, 300) }
      };
    }
  }
  async function request(params, options){
    options = options || {};
    if (shouldUseLocalDemo(params || {})) return localDemoResponse(params || {});
    var apiUrl = options.apiUrl || getDefaultApiUrl();
    if (!apiUrl) return friendlyError('MISSING_API_URL');
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, options.timeoutMs || DEFAULT_TIMEOUT_MS);
    try {
      var res = await fetch(apiUrl + '?' + toQuery(params || {}), { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      var data = await parseResponse(res);
      if (data && data.error === 'UNAUTHORIZED') handleUnauthorized();
      return data;
    } catch(e) {
      clearTimeout(timer);
      return friendlyError(e && e.name === 'AbortError' ? 'TIMEOUT' : 'FRONTEND_API_ERROR');
    }
  }
  async function post(params, options){
    options = options || {};
    if (shouldUseLocalDemo(params || {})) return localDemoResponse(params || {});
    var apiUrl = options.apiUrl || getDefaultApiUrl();
    if (!apiUrl) return friendlyError('MISSING_API_URL');
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, options.timeoutMs || DEFAULT_TIMEOUT_MS);
    try {
      var res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(runtimeParams(params || {})),
        signal: controller.signal
      });
      clearTimeout(timer);
      var data = await parseResponse(res);
      if (data && data.error === 'UNAUTHORIZED') handleUnauthorized();
      return data;
    } catch(e) {
      clearTimeout(timer);
      return friendlyError(e && e.name === 'AbortError' ? 'TIMEOUT' : 'FRONTEND_API_ERROR');
    }
  }
  function formatResult(data){
    if (!data) return '沒有回應資料。';
    return data.message || (data.success === false ? '操作未完成。' : '操作完成。');
  }
  function extractRows(resp){
    var d = resp && resp.data ? resp.data : {};
    return d.rows || d.data || d.items || [];
  }
  async function bindMessageRequest(params, targetId, options){
    var target = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
    if (target) target.textContent = '處理中，請稍候...';
    var result = await request(params, options || {});
    if (target) target.textContent = formatResult(result);
    return result;
  }
  var ProductCore = {
    initSchema: function(data){ return request(Object.assign({ action: 'product.schema.init' }, data || {})); },
    schemaHealth: function(data){ return request(Object.assign({ action: 'product.schema.health' }, data || {})); },
    syncRegistrationFast: function(data){ return request(Object.assign({ action: 'registration.sync.fast' }, data || {}), { timeoutMs: 45000 }); },
    createTender: function(data){ return request(Object.assign({ action: 'tender.create' }, data || {})); },
    queryTender: function(data){ return request(Object.assign({ action: 'tender.query' }, data || {})); },
    updateTenderStatus: function(data){ return request(Object.assign({ action: 'tender.updateStatus' }, data || {})); }
  };

  window.GovOpsAPI = {
    request: request,
    post: post,
    bindMessageRequest: bindMessageRequest,
    formatResult: formatResult,
    extractRows: extractRows,
    toQuery: toQuery,
    runtimeParams: runtimeParams,
    getProfile: getProfile,
    getAuth: getAuth,
    getDefaultApiUrl: getDefaultApiUrl,
    doLogout: doLogout,
    handleUnauthorized: handleUnauthorized,
    ProductCore: ProductCore,
    DEFAULT_API_URL: DEFAULT_API_URL
  };
  window.GovOpsApi = window.GovOpsAPI;
})();
