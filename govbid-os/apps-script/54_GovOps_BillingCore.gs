/* GovOps OS｜Billing Core v1
 * 目的：補齊正式 SaaS 商用必需的方案、訂閱、用量、帳務狀態。
 */

var GOVOPS_BILLING_PLANS = {
  free: { name: '免費體驗版', monthly: 0, yearly: 0, events: 3, crm: 100, users: 1, ai: 0 },
  pro: { name: '專業版', monthly: 980, yearly: 9800, events: 20, crm: 3000, users: 3, ai: 1000 },
  team: { name: '團隊版', monthly: 2980, yearly: 29800, events: 80, crm: 20000, users: 10, ai: 5000 },
  enterprise: { name: '企業版', monthly: 0, yearly: 0, events: 999999, crm: 999999, users: 999999, ai: 999999 }
};

function handleGovOpsBillingCoreAction(action, data) {
  data = data || {};
  try {
    if (action === 'billing.plans' || action === '查詢方案') return GovOpsBilling_plans(data);
    if (action === 'billing.createSubscription' || action === '建立訂閱') return GovOpsBilling_createSubscription(data);
    if (action === 'billing.querySubscription' || action === '查詢訂閱') return GovOpsBilling_querySubscription(data);
    if (action === 'billing.updateSubscription' || action === '更新訂閱') return GovOpsBilling_updateSubscription(data);
    if (action === 'billing.usageSummary' || action === '查詢用量摘要') return GovOpsBilling_usageSummary(data);
    return null;
  } catch (err) {
    GovOpsBilling_logError('handleGovOpsBillingCoreAction', err, data);
    return GovOpsBilling_fail('帳務功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_BILLING_CORE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsBillingCoreAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_BILLING_CORE(action, data);
  };
}

function GovOpsBilling_success(message, data) {
  return { success: true, message: message || '操作完成。', data: data || {} };
}
function GovOpsBilling_fail(message, data) {
  return { success: false, message: message || '操作失敗。', data: data || {} };
}
function GovOpsBilling_now() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}
function GovOpsBilling_sheetName() {
  return '27_SaaS訂閱表';
}
function GovOpsBilling_usageSheetName() {
  return '28_APIUsage';
}
function GovOpsBilling_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsBilling_sheetName(), ['subscriptionId','tenantId','tenantName','plan','billingCycle','amount','currency','status','startDate','endDate','lastPaidAt','nextBillingAt','建立時間','更新時間','備註']);
  GovOpsProduct_ensureSheet(GovOpsBilling_usageSheetName(), ['usageId','tenantId','usageType','usageDate','count','limit','plan','建立時間','更新時間']);
}
function GovOpsBilling_plans(data) {
  return GovOpsBilling_success('方案查詢完成。', { plans: GOVOPS_BILLING_PLANS });
}
function GovOpsBilling_createSubscription(data) {
  data = data || {};
  GovOpsBilling_ensureSheets();
  var tenantId = data.tenantId || '';
  if (!tenantId) return GovOpsBilling_fail('請提供 tenantId。');
  var plan = String(data.plan || 'pro').toLowerCase();
  var cycle = String(data.billingCycle || data.週期 || 'monthly').toLowerCase();
  var planInfo = GOVOPS_BILLING_PLANS[plan] || GOVOPS_BILLING_PLANS.pro;
  var amount = cycle === 'yearly' ? planInfo.yearly : planInfo.monthly;
  var row = {
    subscriptionId: data.subscriptionId || ('SUB-' + Utilities.getUuid().slice(0, 8)),
    tenantId: tenantId,
    tenantName: data.tenantName || data.orgName || '',
    plan: plan,
    billingCycle: cycle,
    amount: amount,
    currency: data.currency || 'TWD',
    status: data.status || 'active',
    startDate: data.startDate || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd'),
    endDate: data.endDate || '',
    lastPaidAt: data.lastPaidAt || '',
    nextBillingAt: data.nextBillingAt || '',
    建立時間: GovOpsBilling_now(),
    更新時間: GovOpsBilling_now(),
    備註: data.備註 || ''
  };
  GovOpsProduct_append(GovOpsBilling_sheetName(), row);
  return GovOpsBilling_success('訂閱已建立。', row);
}
function GovOpsBilling_querySubscription(data) {
  data = data || {};
  GovOpsBilling_ensureSheets();
  var tenantId = data.tenantId || '';
  var rows = GovOpsProduct_readRows(GovOpsBilling_sheetName()).filter(function(row) {
    return !tenantId || String(row.tenantId || '') === String(tenantId);
  });
  return GovOpsBilling_success('訂閱查詢完成。', { total: rows.length, rows: rows });
}
function GovOpsBilling_updateSubscription(data) {
  data = data || {};
  GovOpsBilling_ensureSheets();
  var id = data.subscriptionId || data.訂閱ID || '';
  var tenantId = data.tenantId || '';
  var rows = GovOpsProduct_readRows(GovOpsBilling_sheetName());
  var found = rows.find(function(row) {
    return (id && String(row.subscriptionId || '') === String(id)) || (tenantId && String(row.tenantId || '') === String(tenantId));
  });
  if (!found) return GovOpsBilling_fail('找不到訂閱資料。');
  var patch = { 更新時間: GovOpsBilling_now() };
  ['plan','billingCycle','amount','currency','status','startDate','endDate','lastPaidAt','nextBillingAt','備註'].forEach(function(key) {
    if (data[key] !== undefined) patch[key] = data[key];
  });
  GovOpsProduct_update(GovOpsBilling_sheetName(), found._row, patch);
  return GovOpsBilling_success('訂閱已更新。', Object.assign({}, found, patch));
}
function GovOpsBilling_usageSummary(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var plan = String(data.plan || 'pro').toLowerCase();
  var planInfo = GOVOPS_BILLING_PLANS[plan] || GOVOPS_BILLING_PLANS.pro;
  var summary = { plan: plan, limits: planInfo, usage: {} };
  try {
    if (typeof GovOpsProduct_readRows === 'function') {
      summary.usage.events = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.活動).filter(function(r){return String(r.tenantId||'')===String(tenantId);}).length;
      summary.usage.crm = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.CRM).filter(function(r){return String(r.tenantId||'')===String(tenantId);}).length;
      summary.usage.users = GovOpsProduct_readRows('25_組織與使用者').filter(function(r){return String(r.tenantId||'')===String(tenantId);}).length;
    }
  } catch (err) {}
  return GovOpsBilling_success('用量摘要查詢完成。', summary);
}
function GovOpsBilling_logError(module, err, data) {
  try {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {});
    else if (typeof logError === 'function') logError(module, err);
  } catch (e) {}
}
function 測試_Billing_方案() { return GovOpsBilling_plans({}); }
