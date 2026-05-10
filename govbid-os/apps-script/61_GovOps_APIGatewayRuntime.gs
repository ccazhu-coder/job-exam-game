/*
GovOps OS｜61_GovOps_APIGatewayRuntime.gs
Enterprise API Gateway Runtime v1.0.0

目的：
1. API Key Registry
2. API Usage Log
3. API Rate Limit
4. Webhook Signature Security
5. Public API Guard

注意：
- 不開放刪除資料 API
- 不讓 public API 繞過 tenant / billing / feature enforcement
- 沒有 apiKey 時視為一般前端 Web App 呼叫，不阻擋
*/

var GOVOPS_API_GATEWAY_VERSION = '1.0.0';

var GOVOPS_API_GATEWAY_SHEETS = {
  keyRegistry: 'APIKeyRegistry',
  usageLog: 'APIUsageLog',
  rateLimit: 'APIRateLimit',
  webhookSecurityLog: 'WebhookSecurityLog',
  externalIntegrationLog: 'ExternalIntegrationLog',
  publicAccessLog: 'PublicAPIAccessLog'
};

var GovOps_APIGatewayActionMap = {
  '初始化APIGatewayRuntime': true,
  'createAPIKey': true,
  'revokeAPIKey': true,
  'validateAPIKey': true,
  'getAPIUsageSummary': true,
  'verifyWebhookSignature': true
};

function publicAPIResponse(success, message, data) {
  return {
    success: success === true,
    message: message || (success ? '操作完成。' : '操作失敗。'),
    data: data || {}
  };
}

function publicAPIFail(message, data) {
  return publicAPIResponse(false, message || 'API 操作失敗。', data || {});
}

function API_now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function API_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function API_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: String(data.plan || data['SaaS方案'] || 'FREE').toUpperCase(),
    apiKey: data.apiKey || data['APIKey'] || '',
    apiSecret: data.apiSecret || data['APISecret'] || ''
  };
}

function API_requireDAL_() {
  if (typeof DAL_ensureHeaders_ !== 'function' || typeof DAL_append !== 'function' || typeof DAL_query !== 'function') {
    return publicAPIFail('DataAccessLayer 尚未載入，請先安裝 39_GovOps_DataAccessLayer.gs。');
  }
  return null;
}

function API_keyHeaders_() {
  return ['apiKeyId','tenantId','userId','apiKey','apiSecretHash','scope','status','createdAt','expiresAt','lastUsedAt'];
}

function API_usageHeaders_() {
  return ['usageId','tenantId','apiKeyId','action','method','status','latency','createdAt'];
}

function API_rateHeaders_() {
  return ['rateId','tenantId','apiKey','periodKey','count','limit','updatedAt'];
}

function API_webhookHeaders_() {
  return ['logId','tenantId','source','eventId','signatureValid','status','message','createdAt'];
}

function API_externalLogHeaders_() {
  return ['logId','tenantId','integrationType','action','status','message','createdAt'];
}

function API_publicAccessHeaders_() {
  return ['accessId','tenantId','apiKeyId','action','scope','status','message','createdAt'];
}

function 初始化APIGatewayRuntime() {
  var err = API_requireDAL_();
  if (err) return err;
  try {
    DAL_ensureHeaders_(GOVOPS_API_GATEWAY_SHEETS.keyRegistry, API_keyHeaders_());
    DAL_ensureHeaders_(GOVOPS_API_GATEWAY_SHEETS.usageLog, API_usageHeaders_());
    DAL_ensureHeaders_(GOVOPS_API_GATEWAY_SHEETS.rateLimit, API_rateHeaders_());
    DAL_ensureHeaders_(GOVOPS_API_GATEWAY_SHEETS.webhookSecurityLog, API_webhookHeaders_());
    DAL_ensureHeaders_(GOVOPS_API_GATEWAY_SHEETS.externalIntegrationLog, API_externalLogHeaders_());
    DAL_ensureHeaders_(GOVOPS_API_GATEWAY_SHEETS.publicAccessLog, API_publicAccessHeaders_());
    return publicAPIResponse(true, 'API Gateway Runtime 初始化完成。', { version: GOVOPS_API_GATEWAY_VERSION });
  } catch (err2) {
    return publicAPIFail('API Gateway Runtime 初始化失敗，請檢查資料表權限。');
  }
}

function createAPIKey(data) {
  var init = 初始化APIGatewayRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = API_ctx_(data);
  if (!ctx.tenantId) return publicAPIFail('缺少 tenantId，無法建立 API Key。');

  try {
    var apiKeyId = API_id_('AKID');
    var apiKey = 'gok_' + Utilities.getUuid().replace(/-/g, '');
    var apiSecret = 'gos_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    var apiSecretHash = API_hash_(apiSecret);
    var expiresAt = data.expiresAt || API_formatDate_(API_addDays_(new Date(), 365));
    var scope = data.scope || 'read';

    var row = {
      apiKeyId: apiKeyId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      apiKey: apiKey,
      apiSecretHash: apiSecretHash,
      scope: scope,
      status: 'ACTIVE',
      createdAt: API_now_(),
      expiresAt: expiresAt,
      lastUsedAt: ''
    };

    DAL_append(GOVOPS_API_GATEWAY_SHEETS.keyRegistry, row, API_keyHeaders_());
    API_publicLog_(ctx.tenantId, apiKeyId, 'createAPIKey', scope, 'success', 'API Key 已建立。');
    return publicAPIResponse(true, 'API Key 已建立。請立即保存 apiSecret，系統不會再次顯示。', Object.assign({}, row, { apiSecret: apiSecret }));
  } catch (err) {
    return publicAPIFail('API Key 建立失敗。');
  }
}

function revokeAPIKey(data) {
  var init = 初始化APIGatewayRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = API_ctx_(data);
  var apiKeyId = data.apiKeyId || data['APIKeyID'] || '';
  var apiKey = data.apiKey || '';
  if (!ctx.tenantId) return publicAPIFail('缺少 tenantId。');
  if (!apiKeyId && !apiKey) return publicAPIFail('請提供 apiKeyId 或 apiKey。');

  try {
    var filters = apiKeyId ? { apiKeyId: apiKeyId } : { apiKey: apiKey };
    var key = DAL_findOne(GOVOPS_API_GATEWAY_SHEETS.keyRegistry, { tenantId: ctx.tenantId, filters: filters, cache: false });
    if (!key) return publicAPIFail('查無 API Key。');
    DAL_updateByRow(GOVOPS_API_GATEWAY_SHEETS.keyRegistry, key._row, { status: 'REVOKED', lastUsedAt: API_now_() });
    API_publicLog_(ctx.tenantId, key.apiKeyId, 'revokeAPIKey', key.scope, 'success', 'API Key 已停用。');
    return publicAPIResponse(true, 'API Key 已停用。', { apiKeyId: key.apiKeyId, status: 'REVOKED' });
  } catch (err) {
    return publicAPIFail('API Key 停用失敗。');
  }
}

function validateAPIKey(data) {
  var init = 初始化APIGatewayRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = API_ctx_(data);
  if (!ctx.apiKey || !ctx.apiSecret) return publicAPIFail('請提供 apiKey 與 apiSecret。');

  try {
    var key = DAL_findOne(GOVOPS_API_GATEWAY_SHEETS.keyRegistry, {
      tenantId: ctx.tenantId,
      filters: { apiKey: ctx.apiKey },
      cache: false
    });
    if (!key) return publicAPIFail('API Key 驗證失敗。');
    if (String(key.status) !== 'ACTIVE') return publicAPIFail('API Key 已停用。');
    if (ctx.tenantId && String(key.tenantId) !== String(ctx.tenantId)) return publicAPIFail('API Key 不屬於此租戶。');
    if (API_isExpired_(key.expiresAt)) return publicAPIFail('API Key 已到期。');
    if (String(key.apiSecretHash) !== String(API_hash_(ctx.apiSecret))) return publicAPIFail('API Secret 驗證失敗。');

    if (typeof DAL_updateByRow === 'function') {
      DAL_updateByRow(GOVOPS_API_GATEWAY_SHEETS.keyRegistry, key._row, { lastUsedAt: API_now_() });
    }

    return publicAPIResponse(true, 'API Key 驗證成功。', {
      apiKeyId: key.apiKeyId,
      tenantId: key.tenantId,
      userId: key.userId,
      scope: key.scope,
      status: key.status
    });
  } catch (err) {
    return publicAPIFail('API Key 驗證失敗。');
  }
}

function getAPIScopeAccess(scope, action) {
  scope = String(scope || '').toLowerCase();
  action = String(action || '');
  var scopes = scope.split(',').map(function(s) { return s.trim(); });
  if (scopes.indexOf('admin') >= 0) return true;
  if (scopes.indexOf('read') >= 0 && /^查詢|^取得|get/.test(action)) return true;
  if (scopes.indexOf('write') >= 0 && /^新增|^建立|^更新|create|mark|schedule/.test(action)) return true;
  if (scopes.indexOf('finance') >= 0 && /應收|收款|支出|損益|Invoice|Payment|Billing/.test(action)) return true;
  if (scopes.indexOf('ai') >= 0 && /AI|秘書/.test(action)) return true;
  if (scopes.indexOf('webhook') >= 0 && /Webhook|webhook/.test(action)) return true;
  return false;
}

function assertAPIRateLimit(data) {
  var init = 初始化APIGatewayRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = API_ctx_(data);
  if (!ctx.apiKey) return publicAPIResponse(true, '一般前端呼叫，不套用 API rate limit。');

  try {
    var limit = API_rateLimitByPlan_(ctx.plan);
    var periodKey = API_periodHour_();
    var existing = DAL_findOne(GOVOPS_API_GATEWAY_SHEETS.rateLimit, {
      tenantId: ctx.tenantId,
      filters: { apiKey: ctx.apiKey, periodKey: periodKey },
      cache: false
    });

    if (!existing) {
      DAL_append(GOVOPS_API_GATEWAY_SHEETS.rateLimit, {
        rateId: API_id_('RATE'),
        tenantId: ctx.tenantId,
        apiKey: ctx.apiKey,
        periodKey: periodKey,
        count: 1,
        limit: limit,
        updatedAt: API_now_()
      }, API_rateHeaders_());
      return publicAPIResponse(true, 'API 使用量正常。', { count: 1, limit: limit });
    }

    var count = Number(existing.count || 0) + 1;
    if (count > Number(existing.limit || limit)) {
      return publicAPIFail('API 使用量已超過本方案限制，請稍後再試或升級方案。', { count: count, limit: existing.limit || limit });
    }

    DAL_updateByRow(GOVOPS_API_GATEWAY_SHEETS.rateLimit, existing._row, { count: count, updatedAt: API_now_() });
    return publicAPIResponse(true, 'API 使用量正常。', { count: count, limit: existing.limit || limit });
  } catch (err) {
    return publicAPIFail('API 使用量檢查失敗。');
  }
}

function logAPIUsage(data) {
  var init = 初始化APIGatewayRuntime();
  if (!init.success) return init;
  data = data || {};
  try {
    DAL_append(GOVOPS_API_GATEWAY_SHEETS.usageLog, {
      usageId: API_id_('USE'),
      tenantId: data.tenantId || '',
      apiKeyId: data.apiKeyId || '',
      action: data.action || '',
      method: data.method || 'POST',
      status: data.status || '',
      latency: Number(data.latency || 0),
      createdAt: API_now_()
    }, API_usageHeaders_());
    return publicAPIResponse(true, 'API 使用紀錄已建立。');
  } catch (err) {
    return publicAPIFail('API 使用紀錄建立失敗。');
  }
}

function createWebhookSignature(data) {
  data = data || {};
  var secret = data.secret || data.apiSecret || '';
  var payload = typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || {});
  if (!secret) return publicAPIFail('缺少 webhook secret。');
  var signature = Utilities.computeHmacSha256Signature(payload, secret)
    .map(function(b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; })
    .join('');
  return publicAPIResponse(true, 'Webhook signature 已產生。', { signature: signature });
}

function verifyWebhookSignature(data) {
  var init = 初始化APIGatewayRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = API_ctx_(data);
  try {
    var expected = createWebhookSignature({ secret: data.secret || data.apiSecret, payload: data.payload });
    var ok = expected.success && String(expected.data.signature) === String(data.signature || '');
    DAL_append(GOVOPS_API_GATEWAY_SHEETS.webhookSecurityLog, {
      logId: API_id_('WHSEC'),
      tenantId: ctx.tenantId,
      source: data.source || 'webhook',
      eventId: data.eventId || '',
      signatureValid: ok ? 'true' : 'false',
      status: ok ? 'success' : 'failed',
      message: ok ? 'Webhook signature 驗證成功。' : 'Webhook signature 驗證失敗。',
      createdAt: API_now_()
    }, API_webhookHeaders_());
    if (!ok) return publicAPIFail('Webhook signature 驗證失敗。');
    return publicAPIResponse(true, 'Webhook signature 驗證成功。');
  } catch (err) {
    return publicAPIFail('Webhook signature 驗證失敗。');
  }
}

function apiGatewayGuard(action, data) {
  data = data || {};
  var ctx = API_ctx_(data);
  if (!ctx.apiKey) return publicAPIResponse(true, '一般前端 Web App 呼叫，略過 API Gateway Guard。');

  var started = new Date().getTime();
  var validated = validateAPIKey(data);
  if (!validated.success) return validated;

  var scope = validated.data.scope || '';
  if (!getAPIScopeAccess(scope, action)) {
    API_publicLog_(validated.data.tenantId, validated.data.apiKeyId, action, scope, 'denied', 'API scope 無權執行此 action。');
    return publicAPIFail('API scope 無權執行此功能。');
  }

  var rate = assertAPIRateLimit(Object.assign({}, data, { tenantId: validated.data.tenantId, plan: ctx.plan || 'FREE' }));
  if (!rate.success) return rate;

  if (typeof 檢查租戶狀態 === 'function') {
    var tenant = 檢查租戶狀態({ tenantId: validated.data.tenantId, userId: validated.data.userId });
    if (tenant.success) {
      var tenantStatus = tenant.data && tenant.data.租戶 ? (tenant.data.租戶.status || tenant.data.租戶['狀態']) : '';
      if (tenantStatus && String(tenantStatus).toLowerCase() !== 'active') return publicAPIFail('租戶目前不是啟用狀態。');
    }
  }

  if (typeof assertBillingGoodStanding === 'function') {
    var billing = assertBillingGoodStanding({ tenantId: validated.data.tenantId, userId: validated.data.userId, plan: ctx.plan });
    if (!billing.success) return billing;
  }

  logAPIUsage({ tenantId: validated.data.tenantId, apiKeyId: validated.data.apiKeyId, action: action, method: data.method || 'POST', status: 'success', latency: new Date().getTime() - started });
  API_publicLog_(validated.data.tenantId, validated.data.apiKeyId, action, scope, 'success', 'API Gateway Guard 通過。');
  return publicAPIResponse(true, 'API Gateway Guard 通過。', validated.data);
}

function handleAPIGatewayAction(action, data) {
  if (!GovOps_APIGatewayActionMap[action]) return null;
  try {
    if (action === '初始化APIGatewayRuntime') return 初始化APIGatewayRuntime(data || {});
    if (action === 'createAPIKey') return createAPIKey(data || {});
    if (action === 'revokeAPIKey') return revokeAPIKey(data || {});
    if (action === 'validateAPIKey') return validateAPIKey(data || {});
    if (action === 'getAPIUsageSummary') return getAPIUsageSummary(data || {});
    if (action === 'verifyWebhookSignature') return verifyWebhookSignature(data || {});
    return null;
  } catch (err) {
    return publicAPIFail('API Gateway 暫時無法完成操作，請稍後再試。');
  }
}

function getAPIUsageSummary(data) {
  var init = 初始化APIGatewayRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = API_ctx_(data);
  if (!ctx.tenantId) return publicAPIFail('缺少 tenantId。');
  try {
    var logs = DAL_query(GOVOPS_API_GATEWAY_SHEETS.usageLog, { tenantId: ctx.tenantId, limit: data.limit || 1000, cache: false }).data.rows || [];
    var successLogs = logs.filter(function(l) { return String(l.status) === 'success'; });
    var failedLogs = logs.filter(function(l) { return String(l.status) !== 'success'; });
    var totalLatency = logs.reduce(function(sum, l) { return sum + Number(l.latency || 0); }, 0);
    return publicAPIResponse(true, 'API 使用量摘要取得完成。', {
      tenantId: ctx.tenantId,
      total: logs.length,
      success: successLogs.length,
      failed: failedLogs.length,
      avgLatency: logs.length ? Math.round(totalLatency / logs.length) : 0,
      latest: logs.slice(0, 20)
    });
  } catch (err) {
    return publicAPIFail('API 使用量摘要取得失敗。');
  }
}

function API_publicLog_(tenantId, apiKeyId, action, scope, status, message) {
  try {
    if (typeof DAL_append !== 'function') return;
    DAL_append(GOVOPS_API_GATEWAY_SHEETS.publicAccessLog, {
      accessId: API_id_('PAPI'),
      tenantId: tenantId || '',
      apiKeyId: apiKeyId || '',
      action: action || '',
      scope: scope || '',
      status: status || '',
      message: message || '',
      createdAt: API_now_()
    }, API_publicAccessHeaders_());
  } catch (err) {}
}

function API_rateLimitByPlan_(plan) {
  plan = String(plan || 'FREE').toUpperCase();
  if (plan === 'FREE') return 30;
  if (plan === 'STARTER') return 300;
  if (plan === 'PRO') return 3000;
  if (plan === 'ENTERPRISE') return 999999;
  return 30;
}

function API_periodHour_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyyMMddHH');
}

function API_hash_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''), Utilities.Charset.UTF_8);
  return raw.map(function(b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function API_formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function API_addDays_(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function API_isExpired_(expiresAt) {
  if (!expiresAt) return false;
  var d = new Date(expiresAt);
  if (String(d) === 'Invalid Date') return false;
  return d < new Date();
}

function 測試_CreateAPIKey() {
  return createAPIKey({ tenantId: 'QA-API', userId: 'QA-USER', scope: 'read,write,finance,ai,webhook', plan: 'PRO' });
}

function 測試_ValidateAPIKey() {
  var created = createAPIKey({ tenantId: 'QA-API', userId: 'QA-USER', scope: 'read,write', plan: 'PRO' });
  return validateAPIKey({ tenantId: 'QA-API', apiKey: created.data.apiKey, apiSecret: created.data.apiSecret });
}

function 測試_RateLimit() {
  var created = createAPIKey({ tenantId: 'QA-API', userId: 'QA-USER', scope: 'read', plan: 'PRO' });
  return assertAPIRateLimit({ tenantId: 'QA-API', apiKey: created.data.apiKey, plan: 'PRO' });
}

function 測試_WebhookSignature() {
  var payload = { event: 'qa.test', ok: true };
  var sig = createWebhookSignature({ secret: 'QA-SECRET', payload: payload });
  return verifyWebhookSignature({ tenantId: 'QA-API', secret: 'QA-SECRET', payload: payload, signature: sig.data.signature, source: 'qa', eventId: 'QA-EVENT' });
}

function 測試_APIGatewayGuard() {
  var created = createAPIKey({ tenantId: 'QA-API', userId: 'QA-USER', scope: 'read,write,finance,ai,admin', plan: 'PRO' });
  return apiGatewayGuard('查詢學員', { tenantId: 'QA-API', apiKey: created.data.apiKey, apiSecret: created.data.apiSecret, plan: 'PRO' });
}
