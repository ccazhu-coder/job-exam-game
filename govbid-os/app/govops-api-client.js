/* GovOps OS shared API client */
(function(){
  'use strict';

  var DEFAULT_TIMEOUT_MS = 45000;
  var DEFAULT_API_URL = '';

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
      message: '資料服務暫時無法連線，請稍後再試。',
      data: Object.assign({ reason: reason || 'FRONTEND_SERVICE_ERROR' }, extra || {})
    };
  }
  function handleUnauthorized(){
    ['govops_auth','govops_profile'].forEach(function(k){
      try { localStorage.removeItem(k); } catch(e){}
    });
    var cur = window.location.pathname.split('/').pop() + window.location.search;
    if (cur.indexOf('login.html') === -1 && cur.indexOf('register.html') === -1) {
      window.location.href = './login.html?redirect=' + encodeURIComponent(cur || 'dashboard.html');
    }
  }
  function doLogout(){
    ['govops_auth','govops_profile','govops_usage','govops_conn_settings','govops_root_folder'].forEach(function(k){
      try { localStorage.removeItem(k); } catch(e){}
    });
    window.location.href = './login.html';
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
        message: '資料服務暫時無法回應，請稍後再試。',
        data: { reason: 'INVALID_RESPONSE', status: res.status }
      };
    }
  }
  async function request(params, options){
    options = options || {};
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
    if (!data) return '沒有可顯示的資料。';
    return data.message || (data.success === false ? '操作未完成。' : '操作已完成。');
  }
  function extractRows(resp){
    var d = resp && resp.data ? resp.data : {};
    return d.rows || d.data || d.items || [];
  }
  async function bindMessageRequest(params, targetId, options){
    var target = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
    if (target) target.textContent = '處理中...';
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




