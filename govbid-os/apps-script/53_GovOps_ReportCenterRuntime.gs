/*
GovOps OS｜53_GovOps_ReportCenterRuntime.gs
Enterprise Management SaaS ERP Report Center Runtime v1.0.0

用途：
1. 財務報表
2. CRM 統計
3. Workflow KPI
4. SaaS Usage Report
5. Executive Report Runtime
*/

var GOVOPS_REPORT_VERSION = '1.0.0';
var GOVOPS_REPORT_SHEET = '系統報表紀錄';

function RPT_headers_() {
  return ['reportId','tenantId','userId','報表類型','報表期間','報表摘要','報表JSON','建立時間'];
}

function RPT_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function RPT_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function RPT_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function RPT_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function RPT_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化報表中心() {
  if (typeof DAL_ensureHeaders_ === 'function') DAL_ensureHeaders_(GOVOPS_REPORT_SHEET, RPT_headers_());
  else if (typeof ensureSheet === 'function') ensureSheet(GOVOPS_REPORT_SHEET, RPT_headers_());
  return RPT_success_('報表中心初始化完成。', { version: GOVOPS_REPORT_VERSION });
}

function 產生財務報表(data) {
  初始化報表中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return RPT_fail_('DataAccessLayer 尚未載入。');
  var ctx = RPT_ctx_(data);
  var filters = {};
  if (data['活動ID'] || data.activityId) filters['活動ID'] = data['活動ID'] || data.activityId;

  var ar = DAL_query('應收帳款', Object.assign({}, ctx, { filters: filters, limit: 500, cache: false })).data.rows || [];
  var pay = DAL_query('收款紀錄', Object.assign({}, ctx, { filters: filters, limit: 500, cache: false })).data.rows || [];
  var exp = DAL_query('支出紀錄', Object.assign({}, ctx, { filters: filters, limit: 500, cache: false })).data.rows || [];

  var receivable = ar.reduce(function(sum, r){ return sum + Number(r['應收金額'] || 0); }, 0);
  var received = pay.reduce(function(sum, r){ return sum + Number(r['收款金額'] || 0); }, 0);
  var expense = exp.reduce(function(sum, r){ return sum + Number(r['支出金額'] || 0); }, 0);
  var unpaid = ar.reduce(function(sum, r){ return sum + Number(r['未收金額'] || 0); }, 0);
  var report = { 應收總額: receivable, 已收總額: received, 未收總額: unpaid, 支出總額: expense, 損益: received - expense, 應收筆數: ar.length, 收款筆數: pay.length, 支出筆數: exp.length };
  RPT_save_(ctx, 'financial', data.period || '', '財務報表已產生。', report);
  return RPT_success_('財務報表已產生。', report);
}

function 產生CRM報表(data) {
  初始化報表中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return RPT_fail_('DataAccessLayer 尚未載入。');
  var ctx = RPT_ctx_(data);
  var crm = DAL_query('學員CRM', Object.assign({}, ctx, { limit: 1000, cache: false })).data.rows || [];
  var regs = DAL_query('報名資料庫', Object.assign({}, ctx, { limit: 1000, cache: false })).data.rows || [];
  var report = {
    CRM總數: crm.length,
    報名總數: regs.length,
    可行銷名單: crm.filter(function(r){ return String(r['行銷同意'] || '').indexOf('否') < 0; }).length,
    LINE好友數: crm.filter(function(r){ return String(r['LINE好友狀態'] || '').indexOf('好友') >= 0; }).length,
    Email訂閱數: crm.filter(function(r){ return String(r['Email訂閱狀態'] || '').indexOf('否') < 0; }).length
  };
  RPT_save_(ctx, 'crm', data.period || '', 'CRM 報表已產生。', report);
  return RPT_success_('CRM 報表已產生。', report);
}

function 產生Workflow報表(data) {
  初始化報表中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return RPT_fail_('DataAccessLayer 尚未載入。');
  var ctx = RPT_ctx_(data);
  var inst = DAL_query('流程實例表', Object.assign({}, ctx, { limit: 1000, cache: false })).data.rows || [];
  var tasks = DAL_query('流程任務表', Object.assign({}, ctx, { limit: 1000, cache: false })).data.rows || [];
  var report = {
    流程總數: inst.length,
    執行中: inst.filter(function(r){ return String(r['流程狀態']) === 'running'; }).length,
    已完成: inst.filter(function(r){ return String(r['流程狀態']) === 'done'; }).length,
    任務總數: tasks.length,
    待處理任務: tasks.filter(function(r){ return String(r['任務狀態']) === 'pending'; }).length,
    已完成任務: tasks.filter(function(r){ return String(r['任務狀態']) === 'done'; }).length
  };
  RPT_save_(ctx, 'workflow', data.period || '', 'Workflow 報表已產生。', report);
  return RPT_success_('Workflow 報表已產生。', report);
}

function 產生SaaS使用量報表(data) {
  初始化報表中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return RPT_fail_('DataAccessLayer 尚未載入。');
  var ctx = RPT_ctx_(data);
  var usage = DAL_query('SaaS使用量', Object.assign({}, ctx, { limit: 100, cache: false })).data.rows || [];
  var report = {
    使用量紀錄數: usage.length,
    活動數: usage.reduce(function(s,r){ return s + Number(r['活動數'] || 0); }, 0),
    CRM筆數: usage.reduce(function(s,r){ return s + Number(r['CRM筆數'] || 0); }, 0),
    AI查詢數: usage.reduce(function(s,r){ return s + Number(r['AI查詢數'] || 0); }, 0),
    財務操作數: usage.reduce(function(s,r){ return s + Number(r['財務操作數'] || 0); }, 0),
    提醒操作數: usage.reduce(function(s,r){ return s + Number(r['提醒操作數'] || 0); }, 0)
  };
  RPT_save_(ctx, 'saas_usage', data.period || '', 'SaaS 使用量報表已產生。', report);
  return RPT_success_('SaaS 使用量報表已產生。', report);
}

function 產生管理總報表(data) {
  var finance = 產生財務報表(data || {});
  var crm = 產生CRM報表(data || {});
  var wf = 產生Workflow報表(data || {});
  var usage = 產生SaaS使用量報表(data || {});
  var report = { 財務: finance.data, CRM: crm.data, Workflow: wf.data, 使用量: usage.data };
  RPT_save_(RPT_ctx_(data || {}), 'executive', (data && data.period) || '', '管理總報表已產生。', report);
  return RPT_success_('管理總報表已產生。', report);
}

function 查詢報表紀錄(data) {
  初始化報表中心();
  data = data || {};
  if (typeof DAL_query !== 'function') return RPT_fail_('DataAccessLayer 尚未載入。');
  var ctx = RPT_ctx_(data);
  var res = DAL_query(GOVOPS_REPORT_SHEET, { tenantId: ctx.tenantId, keyword: data.keyword || data['關鍵字'] || '', limit: data.limit || 100, page: data.page || 1, cache: false });
  return RPT_success_('報表紀錄查詢完成。', { 報表: res.data.rows, 筆數: res.data.total });
}

function RPT_save_(ctx, type, period, summary, report) {
  if (typeof DAL_append !== 'function') return;
  var row = { reportId: RPT_id_('RPT'), tenantId: ctx.tenantId, userId: ctx.userId, 報表類型: type, 報表期間: period || '', 報表摘要: summary || '', 報表JSON: JSON.stringify(report || {}), 建立時間: RPT_now_() };
  DAL_append(GOVOPS_REPORT_SHEET, row, RPT_headers_());
}

function 測試_ReportCenterRuntime() {
  初始化報表中心();
  var ctx = { tenantId: 'QA-RPT', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' };
  var r = 產生管理總報表(ctx);
  var list = 查詢報表紀錄(ctx);
  return RPT_success_('Report Center Runtime 測試完成。', { 總報表: r, 報表紀錄: list });
}
