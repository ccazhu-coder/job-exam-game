/**
 * GovOps OS ERP SaaS Billing Core
 * 訂閱商業化：方案、訂閱、帳單、用量、到期檢查。
 * 請與 ERP core / SaaS security / dashboard 一起貼入 Apps Script。
 */

function erpBillingEnsureTables_(){
  ERP_TABLES.plans = ERP_TABLES.plans || ['planId','planCode','planName','monthlyPrice','yearlyPrice','maxUsers','maxProjects','maxActivities','features','status','createdAt','updatedAt'];
  ERP_TABLES.subscriptions = ERP_TABLES.subscriptions || ['subscriptionId','tenantId','planCode','status','startDate','endDate','billingCycle','autoRenew','createdAt','updatedAt'];
  ERP_TABLES.invoices = ERP_TABLES.invoices || ['invoiceId','tenantId','subscriptionId','invoiceNo','amount','status','dueDate','paidAt','note','createdAt','updatedAt'];
  ERP_TABLES.usage_logs = ERP_TABLES.usage_logs || ['usageId','tenantId','feature','usageDate','amount','refId','note','createdAt'];
  erpEnsureSheet_('plans', ERP_TABLES.plans);
  erpEnsureSheet_('subscriptions', ERP_TABLES.subscriptions);
  erpEnsureSheet_('invoices', ERP_TABLES.invoices);
  erpEnsureSheet_('usage_logs', ERP_TABLES.usage_logs);
  erpBillingSeedPlans_();
}

function erpBillingSeedPlans_(){
  const existing = erpReadRows_('plans');
  const plans = [
    ['enterprise','企業版',2980,29800,10,9999,9999,'all'],
    ['solo','一人公司版',980,9800,2,100,500,'project,activity,crm,finance,dashboard'],
    ['trial','試用版',0,0,1,5,20,'project,activity,dashboard']
  ];
  plans.forEach(p => {
    if (existing.some(x => x.planCode === p[0])) return;
    erpAppend_('plans', { planId: erpUuid_('PLAN'), planCode: p[0], planName: p[1], monthlyPrice: p[2], yearlyPrice: p[3], maxUsers: p[4], maxProjects: p[5], maxActivities: p[6], features: p[7], status: 'active', createdAt: erpNow_(), updatedAt: erpNow_() });
  });
}

function erpBillingCreateSubscription(params){
  erpBillingEnsureTables_();
  const tenantId = erpTenantId_(params);
  const planCode = params.planCode || params['方案'] || 'enterprise';
  const cycle = params.billingCycle || params['週期'] || 'monthly';
  const days = cycle === 'yearly' ? 365 : 30;
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  const startDate = Utilities.formatDate(start, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
  const endDate = Utilities.formatDate(end, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
  erpReadRows_('subscriptions').filter(s => s.tenantId === tenantId && String(s.status) === 'active').forEach(s => erpUpdateRow_('subscriptions', s._row, { status: 'replaced', updatedAt: erpNow_() }));
  const obj = erpAppend_('subscriptions', { subscriptionId: erpUuid_('SUB'), tenantId: tenantId, planCode: planCode, status: 'active', startDate: startDate, endDate: endDate, billingCycle: cycle, autoRenew: params.autoRenew || 'yes', createdAt: erpNow_(), updatedAt: erpNow_() });
  erpAudit_(params, '建立訂閱', 'subscriptions', obj.subscriptionId, 'success', '');
  return erpOk_('訂閱已建立', { subscriptionId: obj.subscriptionId, planCode: planCode, endDate: endDate });
}

function erpBillingGetActiveSubscription_(tenantId){
  return erpReadRows_('subscriptions').find(s => s.tenantId === tenantId && String(s.status) === 'active');
}

function erpBillingCheckSubscription(params){
  erpBillingEnsureTables_();
  const tenantId = erpTenantId_(params);
  const sub = erpBillingGetActiveSubscription_(tenantId);
  if (!sub) return erpFail_('尚未建立有效訂閱', { status: 'no_subscription' });
  const today = new Date(erpNow_().slice(0,10));
  const end = new Date(sub.endDate);
  if (!isNaN(end.getTime()) && end.getTime() < today.getTime()) {
    erpUpdateRow_('subscriptions', sub._row, { status: 'expired', updatedAt: erpNow_() });
    return erpFail_('訂閱已到期', { status: 'expired', endDate: sub.endDate });
  }
  return erpOk_('訂閱有效', { subscriptionId: sub.subscriptionId, planCode: sub.planCode, endDate: sub.endDate });
}

function erpBillingCreateInvoice(params){
  erpBillingEnsureTables_();
  const tenantId = erpTenantId_(params);
  const sub = erpBillingGetActiveSubscription_(tenantId);
  if (!sub) return erpFail_('尚未建立有效訂閱，無法開立帳單');
  const plan = erpReadRows_('plans').find(p => p.planCode === sub.planCode);
  const amount = Number(params.amount || params['金額'] || (sub.billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice) || 0);
  const due = new Date(); due.setDate(due.getDate() + 7);
  const dueDate = params.dueDate || params['到期日'] || Utilities.formatDate(due, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
  const obj = erpAppend_('invoices', { invoiceId: erpUuid_('INV'), tenantId: tenantId, subscriptionId: sub.subscriptionId, invoiceNo: 'INV-' + new Date().getTime(), amount: amount, status: 'unpaid', dueDate: dueDate, paidAt: '', note: params.note || params['備註'] || '', createdAt: erpNow_(), updatedAt: erpNow_() });
  return erpOk_('帳單已建立', { invoiceId: obj.invoiceId, invoiceNo: obj.invoiceNo, amount: amount, dueDate: dueDate });
}

function erpBillingMarkInvoicePaid(params){
  erpBillingEnsureTables_();
  const tenantId = erpTenantId_(params);
  const invoiceId = params.invoiceId || params['帳單ID'];
  if (!invoiceId) return erpFail_('請提供帳單ID');
  const inv = erpReadRows_('invoices').find(i => i.tenantId === tenantId && i.invoiceId === invoiceId);
  if (!inv) return erpFail_('找不到帳單');
  erpUpdateRow_('invoices', inv._row, { status: 'paid', paidAt: erpNow_(), updatedAt: erpNow_() });
  return erpOk_('帳單已標記為已付款', { invoiceId: invoiceId });
}

function erpBillingLogUsage(params){
  erpBillingEnsureTables_();
  const tenantId = erpTenantId_(params);
  const feature = params.feature || params['功能'] || 'general';
  const amount = Number(params.amount || params['用量'] || 1);
  const obj = erpAppend_('usage_logs', { usageId: erpUuid_('USE'), tenantId: tenantId, feature: feature, usageDate: erpNow_().slice(0,10), amount: amount, refId: params.refId || '', note: params.note || '', createdAt: erpNow_() });
  return erpOk_('用量已記錄', { usageId: obj.usageId });
}

function erpBillingUsageSummary(params){
  erpBillingEnsureTables_();
  const tenantId = erpTenantId_(params);
  const logs = erpReadRows_('usage_logs').filter(x => x.tenantId === tenantId);
  const summary = {};
  logs.forEach(x => { summary[x.feature] = (summary[x.feature] || 0) + Number(x.amount || 0); });
  const invoices = erpReadRows_('invoices').filter(x => x.tenantId === tenantId);
  const unpaid = invoices.filter(x => String(x.status) !== 'paid' && String(x.status) !== 'cancelled');
  return erpOk_('訂閱用量摘要已產生', { 用量: summary, 未付款帳單: unpaid, 帳單: invoices });
}

function erpBillingRoute(params){
  const action = String((params && params.action) || '');
  try {
    if (action === '建立訂閱') return erpBillingCreateSubscription(params);
    if (action === '檢查訂閱') return erpBillingCheckSubscription(params);
    if (action === '建立帳單') return erpBillingCreateInvoice(params);
    if (action === '帳單已付款') return erpBillingMarkInvoicePaid(params);
    if (action === '記錄用量') return erpBillingLogUsage(params);
    if (action === '查詢訂閱用量') return erpBillingUsageSummary(params);
    return null;
  } catch (err) {
    erpAudit_(params, action, 'billing', '', 'fail', err.message);
    return erpFail_('Billing 系統處理失敗：' + err.message);
  }
}

/**
 * 主 router 接法：
 * const billingResult = erpBillingRoute(params);
 * if (billingResult) return jsonOutput(billingResult);
 */
