/*
GovOps OS｜55_GovOps_DataWarehouseRuntime.gs
Enterprise Data Platform Runtime v1.0.0

用途：
1. 統一資料倉儲
2. KPI Aggregation
3. Historical Analytics
4. Multi-Module Analytics
5. AI Analytics Runtime
*/

var GOVOPS_DWH_VERSION = '1.0.0';
var GOVOPS_DWH_FACT_SHEET = '資料倉儲_Fact';
var GOVOPS_DWH_KPI_SHEET = '資料倉儲_KPI';
var GOVOPS_DWH_SNAPSHOT_SHEET = '資料倉儲_Snapshot';

function DWH_factHeaders_() {
  return ['factId','tenantId','module','metric','dimension','value','period','sourceId','createdAt'];
}

function DWH_kpiHeaders_() {
  return ['kpiId','tenantId','period','活動數','報名數','CRM數','應收總額','已收總額','支出總額','AI查詢數','流程數','完成流程數','建立時間'];
}

function DWH_snapshotHeaders_() {
  return ['snapshotId','tenantId','snapshotType','period','payloadJSON','建立時間'];
}

function DWH_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function DWH_period_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy-MM');
}

function DWH_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function DWH_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function DWH_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function DWH_ctx_(data) {
  data = data || {};
  return { tenantId: data.tenantId || data['組織ID'] || '', userId: data.userId || data['使用者ID'] || '' };
}

function 初始化資料倉儲() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_DWH_FACT_SHEET, DWH_factHeaders_());
    DAL_ensureHeaders_(GOVOPS_DWH_KPI_SHEET, DWH_kpiHeaders_());
    DAL_ensureHeaders_(GOVOPS_DWH_SNAPSHOT_SHEET, DWH_snapshotHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_DWH_FACT_SHEET, DWH_factHeaders_());
    ensureSheet(GOVOPS_DWH_KPI_SHEET, DWH_kpiHeaders_());
    ensureSheet(GOVOPS_DWH_SNAPSHOT_SHEET, DWH_snapshotHeaders_());
  }
  return DWH_success_('資料倉儲初始化完成。', { version: GOVOPS_DWH_VERSION });
}

function DWH_appendFact_(ctx, module, metric, dimension, value, period, sourceId) {
  if (typeof DAL_append !== 'function') return;
  DAL_append(GOVOPS_DWH_FACT_SHEET, {
    factId: DWH_id_('FACT'),
    tenantId: ctx.tenantId,
    module: module,
    metric: metric,
    dimension: dimension || '',
    value: value || 0,
    period: period || DWH_period_(),
    sourceId: sourceId || '',
    createdAt: DWH_now_()
  }, DWH_factHeaders_());
}

function 重建租戶資料倉儲(data) {
  初始化資料倉儲();
  data = data || {};
  if (typeof DAL_query !== 'function') return DWH_fail_('DataAccessLayer 尚未載入。');
  var ctx = DWH_ctx_(data);
  if (!ctx.tenantId) return DWH_fail_('缺少 tenantId。');
  var period = data.period || DWH_period_();

  var activities = DAL_query('招生活動管理', { tenantId: ctx.tenantId, limit: 1000, cache: false }).data.rows || [];
  var regs = DAL_query('報名資料庫', { tenantId: ctx.tenantId, limit: 1000, cache: false }).data.rows || [];
  var crm = DAL_query('學員CRM', { tenantId: ctx.tenantId, limit: 1000, cache: false }).data.rows || [];
  var ar = DAL_query('應收帳款', { tenantId: ctx.tenantId, limit: 1000, cache: false }).data.rows || [];
  var pay = DAL_query('收款紀錄', { tenantId: ctx.tenantId, limit: 1000, cache: false }).data.rows || [];
  var exp = DAL_query('支出紀錄', { tenantId: ctx.tenantId, limit: 1000, cache: false }).data.rows || [];
  var ai = DAL_query('AI任務紀錄表', { tenantId: ctx.tenantId, limit: 1000, cache: false }).data.rows || [];
  var wf = DAL_query('流程實例表', { tenantId: ctx.tenantId, limit: 1000, cache: false }).data.rows || [];

  var receivable = ar.reduce(function(s,r){ return s + Number(r['應收金額'] || 0); }, 0);
  var received = pay.reduce(function(s,r){ return s + Number(r['收款金額'] || 0); }, 0);
  var expense = exp.reduce(function(s,r){ return s + Number(r['支出金額'] || 0); }, 0);
  var wfDone = wf.filter(function(r){ return String(r['流程狀態']) === 'done'; }).length;

  DWH_appendFact_(ctx, 'activity', 'count', 'all', activities.length, period, '');
  DWH_appendFact_(ctx, 'registration', 'count', 'all', regs.length, period, '');
  DWH_appendFact_(ctx, 'crm', 'count', 'all', crm.length, period, '');
  DWH_appendFact_(ctx, 'finance', 'receivable', 'all', receivable, period, '');
  DWH_appendFact_(ctx, 'finance', 'received', 'all', received, period, '');
  DWH_appendFact_(ctx, 'finance', 'expense', 'all', expense, period, '');
  DWH_appendFact_(ctx, 'ai', 'task_count', 'all', ai.length, period, '');
  DWH_appendFact_(ctx, 'workflow', 'count', 'all', wf.length, period, '');

  var kpi = {
    kpiId: DWH_id_('KPI'),
    tenantId: ctx.tenantId,
    period: period,
    活動數: activities.length,
    報名數: regs.length,
    CRM數: crm.length,
    應收總額: receivable,
    已收總額: received,
    支出總額: expense,
    AI查詢數: ai.length,
    流程數: wf.length,
    完成流程數: wfDone,
    建立時間: DWH_now_()
  };
  DAL_append(GOVOPS_DWH_KPI_SHEET, kpi, DWH_kpiHeaders_());
  建立資料倉儲快照(Object.assign({}, ctx, { snapshotType: 'kpi', period: period, payload: kpi }));
  return DWH_success_('租戶資料倉儲已重建。', kpi);
}

function 建立資料倉儲快照(data) {
  初始化資料倉儲();
  data = data || {};
  var ctx = DWH_ctx_(data);
  if (typeof DAL_append !== 'function') return DWH_fail_('DataAccessLayer 尚未載入。');
  var row = {
    snapshotId: DWH_id_('DWS'),
    tenantId: ctx.tenantId,
    snapshotType: data.snapshotType || 'general',
    period: data.period || DWH_period_(),
    payloadJSON: JSON.stringify(data.payload || {}),
    建立時間: DWH_now_()
  };
  DAL_append(GOVOPS_DWH_SNAPSHOT_SHEET, row, DWH_snapshotHeaders_());
  return DWH_success_('資料倉儲快照已建立。', { snapshotId: row.snapshotId });
}

function 查詢資料倉儲KPI(data) {
  初始化資料倉儲();
  data = data || {};
  if (typeof DAL_query !== 'function') return DWH_fail_('DataAccessLayer 尚未載入。');
  var ctx = DWH_ctx_(data);
  var res = DAL_query(GOVOPS_DWH_KPI_SHEET, { tenantId: ctx.tenantId, keyword: data.keyword || data['關鍵字'] || '', limit: data.limit || 50, page: data.page || 1, cache: false });
  return DWH_success_('資料倉儲 KPI 查詢完成。', { KPI: res.data.rows, 筆數: res.data.total });
}

function 查詢資料倉儲Fact(data) {
  初始化資料倉儲();
  data = data || {};
  if (typeof DAL_query !== 'function') return DWH_fail_('DataAccessLayer 尚未載入。');
  var ctx = DWH_ctx_(data);
  var filters = {};
  if (data.module) filters.module = data.module;
  if (data.metric) filters.metric = data.metric;
  var res = DAL_query(GOVOPS_DWH_FACT_SHEET, { tenantId: ctx.tenantId, filters: filters, keyword: data.keyword || '', limit: data.limit || 100, page: data.page || 1, cache: false });
  return DWH_success_('資料倉儲 Fact 查詢完成。', { Fact: res.data.rows, 筆數: res.data.total });
}

function AI分析資料倉儲(data) {
  var kpi = 查詢資料倉儲KPI(data || {});
  var rows = kpi.data && kpi.data.KPI ? kpi.data.KPI : [];
  var latest = rows[0] || {};
  var insight = [];
  if (Number(latest['未收總額'] || 0) > 0) insight.push('目前仍有未收款，建議建立收款追蹤。');
  if (Number(latest['AI查詢數'] || 0) > 100) insight.push('AI 使用量偏高，建議檢查是否需要升級方案。');
  if (!insight.length) insight.push('目前營運數據無明顯異常。');
  return DWH_success_('AI 資料倉儲分析完成。', { insight: insight, latest: latest });
}

function 測試_DataWarehouseRuntime() {
  初始化資料倉儲();
  var ctx = { tenantId: 'QA-DWH', userId: 'QA-USER' };
  var snap = 建立資料倉儲快照(Object.assign({}, ctx, { snapshotType: 'test', payload: { ok: true } }));
  var kpi = 查詢資料倉儲KPI(ctx);
  return DWH_success_('Data Warehouse Runtime 測試完成。', { 快照: snap, KPI: kpi });
}
