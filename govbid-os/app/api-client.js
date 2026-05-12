/*
GovOps OS｜Unified API Client
用途：前端統一 API 入口，避免各頁面各自硬寫 fetch。
設計：整合既有 config.js、localStorage session、tenant/user/role/plan。
*/
(function () {
  'use strict';

  const DEFAULT_PROFILE = {
    tenantId: 'TENANT-DEMO',
    userId: 'USR-DEMO',
    orgName: '未設定組織',
    role: 'owner',
    roleLabel: '負責人／系統管理者',
    plan: 'pro',
    status: 'active'
  };

  function getConfig() {
    return window.GOVOPS_CONFIG || {};
  }

  function getApiUrl() {
    const config = getConfig();
    if (!config.API_URL) {
      throw new Error('GOVOPS_CONFIG.API_URL 尚未設定');
    }
    return config.API_URL;
  }

  function getProfile() {
    try {
      return Object.assign({}, DEFAULT_PROFILE, JSON.parse(localStorage.getItem('govops_profile') || '{}'));
    } catch (err) {
      return DEFAULT_PROFILE;
    }
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem('govops_auth') || '{}');
    } catch (err) {
      return {};
    }
  }

  function withRuntime(payload) {
    const profile = getProfile();
    const session = getSession();
    return Object.assign({
      tenantId: profile.tenantId,
      userId: profile.userId,
      userRole: profile.role,
      plan: profile.plan,
      sessionToken: session.sessionToken || session.token || '',
      clientVersion: (getConfig().VERSION || ''),
      env: (getConfig().ENV || 'production')
    }, payload || {});
  }

  function toQuery(payload) {
    const query = new URLSearchParams();
    Object.keys(payload || {}).forEach(function (key) {
      const value = payload[key];
      if (value !== undefined && value !== null) query.append(key, value);
    });
    return query.toString();
  }

  function normalizeError(err) {
    return {
      success: false,
      message: '系統暫時無法完成操作，請稍後再試。',
      data: {
        code: 'FRONTEND_API_ERROR',
        detail: err && err.message ? err.message : String(err || '')
      }
    };
  }

  async function get(payload) {
    try {
      const finalPayload = withRuntime(payload);
      const url = getApiUrl() + '?' + toQuery(finalPayload);
      const res = await fetch(url, { method: 'GET' });
      return await res.json();
    } catch (err) {
      return normalizeError(err);
    }
  }

  async function post(payload) {
    try {
      const finalPayload = withRuntime(payload);
      const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(finalPayload)
      });
      return await res.json();
    } catch (err) {
      return normalizeError(err);
    }
  }

  async function call(action, data, options) {
    const payload = Object.assign({ action: action }, data || {});
    if (options && options.method === 'POST') return post(payload);
    return get(payload);
  }

  function isOk(result) {
    return !!(result && result.success);
  }

  function message(result) {
    if (!result) return '系統沒有回應。';
    return result.message || (result.success ? '操作完成。' : '操作失敗。');
  }

  window.GovOpsApi = {
    getConfig,
    getProfile,
    getSession,
    withRuntime,
    get,
    post,
    call,
    isOk,
    message
  };
})();
