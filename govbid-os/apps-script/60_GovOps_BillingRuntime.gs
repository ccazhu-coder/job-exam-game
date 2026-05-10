/*
GovOps OS｜60_GovOps_BillingRuntime.gs
Commercial SaaS Billing Runtime v1.0.0

目的：
1. SaaS 帳務帳戶
2. SaaS Invoice
3. SaaS Payment
4. Renewal Billing
5. Billing Guard

注意：
- 不串真正金流
- 不自動扣款
- 獨立 patch layer
*/

var GOVOPS_BILLING_VERSION = '1.0.0';

var GOVOPS_BILLING_SHEETS = {
  invoice: 'SaaSInvoice',
  payment: 'SaaSPayment',
  account: 'SaaSBillingAccount',
  log: 'SaaSBillingLog',
  renewal: 'SaaSRenewalSchedule',
  ledger: 'SaaSRevenueLedger'
};

var GovOps_BillingActionMap = {
  '初始化BillingRuntime': true,
  'createBillingAccount': true,
  'createInvoice': true,
  'markInvoicePaid': true,
  'markInvoiceOverdue': true,
  'cancelInvoice': true,
  'scheduleRenewal': true,
  'runRenewalBilling': true,
  'getTenantBillingSummary': true
};

function billingResponse(success, message, data) {
  return {
    success: success === true,
    message: message || (success ? '操作完成。' : '操作失敗。'),
    data: data || {}
  };
}

function billingFail(message, data) {
  return billingResponse(false, message || '帳務操作失敗。', data || {});
}

function BILL_now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function BILL_todayDate_() {
  return new Date(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd 00:00:00'));
}

function BILL_formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function BILL_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function BILL_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: String(data.plan || data['SaaS方案'] || '').toUpperCase()
  };
}

function BILL_requireDAL_() {
  if (typeof DAL_ensureHeaders_ !== 'function' || typeof DAL_append !== 'function' || typeof DAL_query !== 'function') {
    return billingFail('DataAccessLayer 尚未載入，請先安裝 39_GovOps_DataAccessLayer.gs。');
  }
  return null;
}

function BILL_invoiceHeaders_() {
  return ['invoiceId','tenantId','plan','amount','taxAmount','totalAmount','dueDate','status','periodStart','periodEnd','paymentId','paidAt','paymentMethod','createdAt','updatedAt'];
}

function BILL_paymentHeaders_() {
  return ['paymentId','invoiceId','tenantId','amount','paidAt','paymentMethod','status','note','createdAt'];
}

function BILL_accountHeaders_() {
  return ['tenantId','billingName','taxId','billingEmail','billingPhone','billingAddress','paymentMethod','status','createdAt','updatedAt'];
}

function BILL_logHeaders_() {
  return ['logId','tenantId','userId','action','status','message','createdAt'];
}

function BILL_renewalHeaders_() {
  return ['renewalId','tenantId','plan','nextBillingDate','status','lastInvoiceId','createdAt','updatedAt'];
}

function BILL_ledgerHeaders_() {
  return ['ledgerId','tenantId','invoiceId','paymentId','amount','type','status','recognizedAt','createdAt'];
}

function 初始化BillingRuntime() {
  var err = BILL_requireDAL_();
  if (err) return err;
  try {
    DAL_ensureHeaders_(GOVOPS_BILLING_SHEETS.invoice, BILL_invoiceHeaders_());
    DAL_ensureHeaders_(GOVOPS_BILLING_SHEETS.payment, BILL_paymentHeaders_());
    DAL_ensureHeaders_(GOVOPS_BILLING_SHEETS.account, BILL_accountHeaders_());
    DAL_ensureHeaders_(GOVOPS_BILLING_SHEETS.log, BILL_logHeaders_());
    DAL_ensureHeaders_(GOVOPS_BILLING_SHEETS.renewal, BILL_renewalHeaders_());
    DAL_ensureHeaders_(GOVOPS_BILLING_SHEETS.ledger, BILL_ledgerHeaders_());
    return billingResponse(true, 'Billing Runtime 初始化完成。', { version: GOVOPS_BILLING_VERSION });
  } catch (err2) {
    return billingFail('Billing Runtime 初始化失敗，請檢查資料表權限。');
  }
}

function BILL_log_(ctx, action, status, message) {
  try {
    if (typeof DAL_append !== 'function') return;
    DAL_append(GOVOPS_BILLING_SHEETS.log, {
      logId: BILL_id_('BLOG'),
      tenantId: ctx.tenantId || '',
      userId: ctx.userId || '',
      action: action || '',
      status: status || '',
      message: message || '',
      createdAt: BILL_now_()
    }, BILL_logHeaders_());
  } catch (err) {}
}

function createBillingAccount(data) {
  var init = 初始化BillingRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = BILL_ctx_(data);
  if (!ctx.tenantId) return billingFail('缺少 tenantId，無法建立帳務帳戶。');

  try {
    var existed = DAL_findOne(GOVOPS_BILLING_SHEETS.account, {
      tenantId: ctx.tenantId,
      filters: { tenantId: ctx.tenantId },
      cache: false
    });

    var row = {
      tenantId: ctx.tenantId,
      billingName: data.billingName || data['帳務名稱'] || data.organizationName || '',
      taxId: data.taxId || data['統一編號'] || '',
      billingEmail: data.billingEmail || data.email || data['Email'] || '',
      billingPhone: data.billingPhone || data.phone || data['電話'] || '',
      billingAddress: data.billingAddress || data.address || data['地址'] || '',
      paymentMethod: data.paymentMethod || data['付款方式'] || 'manual',
      status: data.status || 'ACTIVE',
      createdAt: existed ? existed.createdAt : BILL_now_(),
      updatedAt: BILL_now_()
    };

    if (existed && typeof DAL_updateByRow === 'function') {
      DAL_updateByRow(GOVOPS_BILLING_SHEETS.account, existed._row, row);
      BILL_log_(ctx, 'createBillingAccount', 'updated', '帳務帳戶已更新。');
      return billingResponse(true, '帳務帳戶已更新。', row);
    }

    DAL_append(GOVOPS_BILLING_SHEETS.account, row, BILL_accountHeaders_());
    BILL_log_(ctx, 'createBillingAccount', 'success', '帳務帳戶已建立。');
    return billingResponse(true, '帳務帳戶已建立。', row);
  } catch (err) {
    return billingFail('帳務帳戶建立失敗。');
  }
}

function getPlanPrice(plan) {
  plan = String(plan || 'FREE').toUpperCase();
  if (plan === 'FREE') return 0;
  if (plan === 'STARTER') return 990;
  if (plan === 'PRO') return 2990;
  if (plan === 'ENTERPRISE') return 99999;
  return 0;
}

function createInvoice(data) {
  var init = 初始化BillingRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = BILL_ctx_(data);
  if (!ctx.tenantId) return billingFail('缺少 tenantId，無法建立帳單。');

  try {
    var plan = String(data.plan || ctx.plan || 'FREE').toUpperCase();
    var amount = Number(data.amount !== undefined ? data.amount : getPlanPrice(plan));
    var taxAmount = Number(data.taxAmount !== undefined ? data.taxAmount : Math.round(amount * 0.05));
    var totalAmount = Number(data.totalAmount !== undefined ? data.totalAmount : amount + taxAmount);
    var invoiceId = data.invoiceId || BILL_id_('INV');

    var dueDate = data.dueDate || BILL_formatDate_(BILL_addDays_(new Date(), 7));
    var periodStart = data.periodStart || BILL_formatDate_(new Date());
    var periodEnd = data.periodEnd || BILL_formatDate_(BILL_addDays_(new Date(), 30));

    var row = {
      invoiceId: invoiceId,
      tenantId: ctx.tenantId,
      plan: plan,
      amount: amount,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      dueDate: dueDate,
      status: 'UNPAID',
      periodStart: periodStart,
      periodEnd: periodEnd,
      paymentId: '',
      paidAt: '',
      paymentMethod: '',
      createdAt: BILL_now_(),
      updatedAt: BILL_now_()
    };

    DAL_append(GOVOPS_BILLING_SHEETS.invoice, row, BILL_invoiceHeaders_());
    BILL_log_(ctx, 'createInvoice', 'success', '帳單已建立。');
    return billingResponse(true, '帳單已建立。', row);
  } catch (err) {
    return billingFail('帳單建立失敗。');
  }
}

function markInvoicePaid(data) {
  var init = 初始化BillingRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = BILL_ctx_(data);
  var invoiceId = data.invoiceId || data['帳單ID'] || '';
  if (!ctx.tenantId) return billingFail('缺少 tenantId。');
  if (!invoiceId) return billingFail('請提供 invoiceId。');

  try {
    var invoice = DAL_findOne(GOVOPS_BILLING_SHEETS.invoice, {
      tenantId: ctx.tenantId,
      filters: { invoiceId: invoiceId },
      cache: false
    });
    if (!invoice) return billingFail('查無帳單。');
    if (String(invoice.status) === 'PAID') return billingResponse(true, '帳單已是付款狀態。', invoice);

    var paymentId = data.paymentId || BILL_id_('PAY');
    var paidAt = data.paidAt || BILL_now_();
    var paymentMethod = data.paymentMethod || data['付款方式'] || 'manual';
    var amount = Number(data.amount || invoice.totalAmount || 0);

    DAL_append(GOVOPS_BILLING_SHEETS.payment, {
      paymentId: paymentId,
      invoiceId: invoiceId,
      tenantId: ctx.tenantId,
      amount: amount,
      paidAt: paidAt,
      paymentMethod: paymentMethod,
      status: 'PAID',
      note: data.note || '',
      createdAt: BILL_now_()
    }, BILL_paymentHeaders_());

    DAL_updateByRow(GOVOPS_BILLING_SHEETS.invoice, invoice._row, {
      paymentId: paymentId,
      paidAt: paidAt,
      paymentMethod: paymentMethod,
      status: 'PAID',
      updatedAt: BILL_now_()
    });

    DAL_append(GOVOPS_BILLING_SHEETS.ledger, {
      ledgerId: BILL_id_('LEDGER'),
      tenantId: ctx.tenantId,
      invoiceId: invoiceId,
      paymentId: paymentId,
      amount: amount,
      type: 'REVENUE',
      status: 'RECOGNIZED',
      recognizedAt: paidAt,
      createdAt: BILL_now_()
    }, BILL_ledgerHeaders_());

    BILL_log_(ctx, 'markInvoicePaid', 'success', '帳單已標記付款。');
    return billingResponse(true, '帳單已標記付款。', { invoiceId: invoiceId, paymentId: paymentId, status: 'PAID' });
  } catch (err) {
    return billingFail('付款標記失敗。');
  }
}

function markInvoiceOverdue(data) {
  var init = 初始化BillingRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = BILL_ctx_(data);
  var invoiceId = data.invoiceId || data['帳單ID'] || '';
  if (!ctx.tenantId) return billingFail('缺少 tenantId。');
  if (!invoiceId) return billingFail('請提供 invoiceId。');

  try {
    var invoice = DAL_findOne(GOVOPS_BILLING_SHEETS.invoice, { tenantId: ctx.tenantId, filters: { invoiceId: invoiceId }, cache: false });
    if (!invoice) return billingFail('查無帳單。');
    if (String(invoice.status) === 'PAID') return billingFail('已付款帳單不可標記逾期。');
    DAL_updateByRow(GOVOPS_BILLING_SHEETS.invoice, invoice._row, { status: 'OVERDUE', updatedAt: BILL_now_() });
    BILL_log_(ctx, 'markInvoiceOverdue', 'success', '帳單已標記逾期。');
    return billingResponse(true, '帳單已標記逾期。', { invoiceId: invoiceId, status: 'OVERDUE' });
  } catch (err) {
    return billingFail('帳單逾期標記失敗。');
  }
}

function cancelInvoice(data) {
  var init = 初始化BillingRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = BILL_ctx_(data);
  var invoiceId = data.invoiceId || data['帳單ID'] || '';
  if (!ctx.tenantId) return billingFail('缺少 tenantId。');
  if (!invoiceId) return billingFail('請提供 invoiceId。');

  try {
    var invoice = DAL_findOne(GOVOPS_BILLING_SHEETS.invoice, { tenantId: ctx.tenantId, filters: { invoiceId: invoiceId }, cache: false });
    if (!invoice) return billingFail('查無帳單。');
    if (String(invoice.status) === 'PAID') return billingFail('已付款帳單不可取消。');
    DAL_updateByRow(GOVOPS_BILLING_SHEETS.invoice, invoice._row, { status: 'CANCELED', updatedAt: BILL_now_() });
    BILL_log_(ctx, 'cancelInvoice', 'success', '帳單已取消。');
    return billingResponse(true, '帳單已取消。', { invoiceId: invoiceId, status: 'CANCELED' });
  } catch (err) {
    return billingFail('帳單取消失敗。');
  }
}

function scheduleRenewal(data) {
  var init = 初始化BillingRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = BILL_ctx_(data);
  if (!ctx.tenantId) return billingFail('缺少 tenantId。');

  try {
    var plan = String(data.plan || ctx.plan || 'FREE').toUpperCase();
    var nextBillingDate = data.nextBillingDate || BILL_formatDate_(BILL_addDays_(new Date(), 30));
    var existed = DAL_findOne(GOVOPS_BILLING_SHEETS.renewal, { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
    var row = {
      renewalId: existed ? existed.renewalId : BILL_id_('REN'),
      tenantId: ctx.tenantId,
      plan: plan,
      nextBillingDate: nextBillingDate,
      status: data.status || 'ACTIVE',
      lastInvoiceId: data.lastInvoiceId || (existed ? existed.lastInvoiceId : ''),
      createdAt: existed ? existed.createdAt : BILL_now_(),
      updatedAt: BILL_now_()
    };

    if (existed) DAL_updateByRow(GOVOPS_BILLING_SHEETS.renewal, existed._row, row);
    else DAL_append(GOVOPS_BILLING_SHEETS.renewal, row, BILL_renewalHeaders_());

    BILL_log_(ctx, 'scheduleRenewal', 'success', '續約排程已建立。');
    return billingResponse(true, '續約排程已建立。', row);
  } catch (err) {
    return billingFail('續約排程建立失敗。');
  }
}

function runRenewalBilling(data) {
  var init = 初始化BillingRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = BILL_ctx_(data);

  try {
    var rows = DAL_query(GOVOPS_BILLING_SHEETS.renewal, {
      tenantId: ctx.tenantId,
      filters: { status: 'ACTIVE' },
      limit: data.limit || 200,
      cache: false
    }).data.rows || [];

    var today = BILL_todayDate_();
    var created = [];

    rows.forEach(function(r) {
      var due = new Date(r.nextBillingDate);
      if (String(due) === 'Invalid Date') return;
      if (due > today) return;

      var invoice = createInvoice({
        tenantId: r.tenantId,
        userId: ctx.userId,
        plan: r.plan,
        periodStart: BILL_formatDate_(today),
        periodEnd: BILL_formatDate_(BILL_addDays_(today, 30)),
        dueDate: BILL_formatDate_(BILL_addDays_(today, 7))
      });

      if (invoice.success) {
        DAL_updateByRow(GOVOPS_BILLING_SHEETS.renewal, r._row, {
          lastInvoiceId: invoice.data.invoiceId,
          nextBillingDate: BILL_formatDate_(BILL_addDays_(today, 30)),
          updatedAt: BILL_now_()
        });
        created.push(invoice.data);
      }
    });

    BILL_log_(ctx, 'runRenewalBilling', 'success', '續約帳單已處理。');
    return billingResponse(true, '續約帳單已處理。', { 建立帳單數: created.length, invoices: created });
  } catch (err) {
    return billingFail('續約帳單處理失敗。');
  }
}

function getTenantBillingSummary(data) {
  var init = 初始化BillingRuntime();
  if (!init.success) return init;
  data = data || {};
  var ctx = BILL_ctx_(data);
  if (!ctx.tenantId) return billingFail('缺少 tenantId。');

  try {
    var invoices = DAL_query(GOVOPS_BILLING_SHEETS.invoice, { tenantId: ctx.tenantId, limit: 500, cache: false }).data.rows || [];
    var paidInvoices = invoices.filter(function(i) { return String(i.status) === 'PAID'; });
    var unpaidInvoices = invoices.filter(function(i) { return String(i.status) === 'UNPAID'; });
    var overdueInvoices = invoices.filter(function(i) { return String(i.status) === 'OVERDUE'; });
    var canceledInvoices = invoices.filter(function(i) { return String(i.status) === 'CANCELED'; });
    var renewal = DAL_findOne(GOVOPS_BILLING_SHEETS.renewal, { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });
    var sub = DAL_findOne('SaaS訂閱表', { tenantId: ctx.tenantId, filters: { tenantId: ctx.tenantId }, cache: false });

    var totalRevenue = paidInvoices.reduce(function(sum, i) { return sum + Number(i.totalAmount || 0); }, 0);
    var billingState = 'GOOD_STANDING';
    if (overdueInvoices.length > 0) billingState = 'PAST_DUE';
    if (sub && (String(sub.status || sub['訂閱狀態']) === 'canceled' || String(sub.status || sub['訂閱狀態']) === 'CANCELED')) billingState = 'CANCELED';

    return billingResponse(true, '租戶帳務摘要取得完成。', {
      tenantId: ctx.tenantId,
      plan: renewal ? renewal.plan : (sub ? (sub.plan || sub['方案名稱']) : ctx.plan),
      billingState: billingState,
      unpaidInvoices: unpaidInvoices.length,
      paidInvoices: paidInvoices.length,
      overdueInvoices: overdueInvoices.length,
      canceledInvoices: canceledInvoices.length,
      totalRevenue: totalRevenue,
      nextBillingDate: renewal ? renewal.nextBillingDate : ''
    });
  } catch (err) {
    return billingFail('租戶帳務摘要取得失敗。');
  }
}

function assertBillingGoodStanding(data) {
  var summary = getTenantBillingSummary(data || {});
  if (!summary.success) return summary;
  var state = summary.data.billingState;
  if (state === 'PAST_DUE') return billingFail('帳務狀態逾期，請先完成付款後再使用此功能。', summary.data);
  if (state === 'CANCELED') return billingFail('訂閱已取消，請重新啟用方案後再使用此功能。', summary.data);
  if (state === 'EXPIRED') return billingFail('訂閱已到期，請續約後再使用此功能。', summary.data);
  return billingResponse(true, '帳務狀態正常。', summary.data);
}

function billingRuntimeGuard(action, data) {
  var protectedActions = {
    '新增活動': true,
    '新增報名': true,
    '建立應收帳款': true,
    '登錄收款': true,
    '登錄支出': true,
    'AI秘書查詢': true,
    '建立Drive資料夾': true,
    '產生管理總報表': true
  };
  if (!protectedActions[action]) return billingResponse(true, '此 action 不需帳務檢查。');
  return assertBillingGoodStanding(data || {});
}

function handleBillingAction(action, data) {
  if (!GovOps_BillingActionMap[action]) return null;
  try {
    if (action === '初始化BillingRuntime') return 初始化BillingRuntime(data || {});
    if (action === 'createBillingAccount') return createBillingAccount(data || {});
    if (action === 'createInvoice') return createInvoice(data || {});
    if (action === 'markInvoicePaid') return markInvoicePaid(data || {});
    if (action === 'markInvoiceOverdue') return markInvoiceOverdue(data || {});
    if (action === 'cancelInvoice') return cancelInvoice(data || {});
    if (action === 'scheduleRenewal') return scheduleRenewal(data || {});
    if (action === 'runRenewalBilling') return runRenewalBilling(data || {});
    if (action === 'getTenantBillingSummary') return getTenantBillingSummary(data || {});
    return null;
  } catch (err) {
    return billingFail('帳務系統暫時無法完成操作，請稍後再試。');
  }
}

function BILL_addDays_(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function 測試_BillingAccount() {
  var ctx = { tenantId: 'QA-BILL', userId: 'QA-USER', plan: 'PRO' };
  return createBillingAccount(Object.assign({}, ctx, { billingName: 'QA 帳務帳戶', billingEmail: 'qa@example.com', paymentMethod: 'manual' }));
}

function 測試_CreateInvoice() {
  var ctx = { tenantId: 'QA-BILL', userId: 'QA-USER', plan: 'PRO' };
  createBillingAccount(Object.assign({}, ctx, { billingName: 'QA 帳務帳戶' }));
  return createInvoice(ctx);
}

function 測試_MarkInvoicePaid() {
  var ctx = { tenantId: 'QA-BILL', userId: 'QA-USER', plan: 'PRO' };
  var inv = createInvoice(ctx);
  return markInvoicePaid(Object.assign({}, ctx, { invoiceId: inv.data.invoiceId, paymentMethod: 'manual' }));
}

function 測試_RenewalBilling() {
  var ctx = { tenantId: 'QA-BILL', userId: 'QA-USER', plan: 'PRO' };
  scheduleRenewal(Object.assign({}, ctx, { nextBillingDate: BILL_formatDate_(BILL_addDays_(new Date(), -1)) }));
  return runRenewalBilling(ctx);
}

function 測試_BillingGuard() {
  var ctx = { tenantId: 'QA-BILL', userId: 'QA-USER', plan: 'PRO' };
  return billingRuntimeGuard('新增活動', ctx);
}
