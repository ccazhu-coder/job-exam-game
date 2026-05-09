/*
GovOps OS｜56_GovOps_AutomationRuntime.gs
Autonomous Enterprise SaaS ERP Automation Runtime v1.0.0

用途：
1. 自動規則引擎
2. ERP Automation Runtime
3. Trigger Rule Runtime
4. AI Automation Runtime
5. Cross Module Automation
*/

var GOVOPS_AUTOMATION_VERSION = '1.0.0';
var GOVOPS_AUTOMATION_RULE_SHEET = '自動化規則表';
var GOVOPS_AUTOMATION_LOG_SHEET = '自動化執行紀錄';

function AUTO_ruleHeaders_() {
  return ['ruleId','tenantId','規則名稱','觸發類型','觸發條件JSON','執行Action','執行模式','狀態','建立時間','更新時間','備註'];
}

function AUTO_logHeaders_() {
  return ['logId','ruleId','tenantId','userId','觸發來源','執行Action','執行狀態','執行訊息','建立時間'];
}

function AUTO_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function AUTO_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function AUTO_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function AUTO_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function AUTO_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化自動化引擎() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_AUTOMATION_RULE_SHEET, AUTO_ruleHeaders_());
    DAL_ensureHeaders_(GOVOPS_AUTOMATION_LOG_SHEET, AUTO_logHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_AUTOMATION_RULE_SHEET, AUTO_ruleHeaders_());
    ensureSheet(GOVOPS_AUTOMATION_LOG_SHEET, AUTO_logHeaders_());
  }
  return AUTO_success_('自動化引擎初始化完成。', { version: GOVOPS_AUTOMATION_VERSION });
}

function 建立自動化規則(data) {
  初始化自動化引擎();
  data = data || {};
  if (typeof DAL_append !== 'function') return AUTO_fail_('DataAccessLayer 尚未載入。');
  var ctx = AUTO_ctx_(data);
  var ruleId = AUTO_id_('RULE');
  var action = data.action || data['執行Action'] || '';
  if (!action) return AUTO_fail_('請提供執行 Action。');
  var row = {
    ruleId: ruleId,
    tenantId: ctx.tenantId,
    規則名稱: data.ruleName || data['規則名稱'] || '自動化規則',
    觸發類型: data.triggerType || data['觸發類型'] || 'manual',
    觸發條件JSON: JSON.stringify(data.conditions || data['觸發條件'] || {}),
    執行Action: action,
    執行模式: data.mode || data['執行模式'] || 'sync',
    狀態: 'active',
    建立時間: AUTO_now_(),
    更新時間: AUTO_now_(),
    備註: data.note || data['備註'] || ''
  };
  DAL_append(GOVOPS_AUTOMATION_RULE_SHEET, row, AUTO_ruleHeaders_());
  return AUTO_success_('自動化規則已建立。', { ruleId: ruleId });
}

function 查詢自動化規則(data) {
  初始化自動化引擎();
  data = data || {};
  if (typeof DAL_query !== 'function') return AUTO_fail_('DataAccessLayer 尚未載入。');
  var ctx = AUTO_ctx_(data);
  var filters = {};
  if (data.triggerType) filters['觸發類型'] = data.triggerType;
  if (data.status) filters['狀態'] = data.status;
  var res = DAL_query(GOVOPS_AUTOMATION_RULE_SHEET, {
    tenantId: ctx.tenantId,
    keyword: data.keyword || data['關鍵字'] || '',
    filters: filters,
    limit: data.limit || 100,
    page: data.page || 1,
    cache: false
  });
  return AUTO_success_('自動化規則查詢完成。', { 規則: res.data.rows, 筆數: res.data.total });
}

function 執行自動化規則(data) {
  初始化自動化引擎();
  data = data || {};
  if (typeof DAL_findOne !== 'function') return AUTO_fail_('DataAccessLayer 尚未載入。');
  var ctx = AUTO_ctx_(data);
  var ruleId = data.ruleId || data['規則ID'] || '';
  if (!ruleId) return AUTO_fail_('請提供規則ID。');
  var rule = DAL_findOne(GOVOPS_AUTOMATION_RULE_SHEET, { tenantId: ctx.tenantId, filters: { ruleId: ruleId, 狀態: 'active' }, cache: false });
  if (!rule) return AUTO_fail_('查無可執行規則。');
  return AUTO_executeRule_(rule, data);
}

function 觸發自動化(data) {
  初始化自動化引擎();
  data = data || {};
  if (typeof DAL_query !== 'function') return AUTO_fail_('DataAccessLayer 尚未載入。');
  var ctx = AUTO_ctx_(data);
  var triggerType = data.triggerType || data['觸發類型'] || '';
  if (!triggerType) return AUTO_fail_('請提供觸發類型。');
  var res = DAL_query(GOVOPS_AUTOMATION_RULE_SHEET, { tenantId: ctx.tenantId, filters: { 觸發類型: triggerType, 狀態: 'active' }, limit: 50, cache: false });
  var rows = res.data.rows || [];
  var results = [];
  rows.forEach(function(rule) {
    if (AUTO_matchConditions_(rule, data)) results.push(AUTO_executeRule_(rule, data));
  });
  return AUTO_success_('自動化觸發完成。', { 執行數: results.length, 結果: results });
}

function AUTO_matchConditions_(rule, data) {
  var conditions = {};
  try { conditions = rule['觸發條件JSON'] ? JSON.parse(rule['觸發條件JSON']) : {}; } catch (err) { conditions = {}; }
  return Object.keys(conditions).every(function(k) {
    if (conditions[k] === undefined || conditions[k] === null || conditions[k] === '') return true;
    return String(data[k] || data['payload'] && data['payload'][k] || '') === String(conditions[k]);
  });
}

function AUTO_executeRule_(rule, data) {
  var ctx = AUTO_ctx_(data || {});
  var action = rule['執行Action'];
  var mode = String(rule['執行模式'] || 'sync');
  var payload = Object.assign({}, data || {}, { tenantId: ctx.tenantId || rule.tenantId, userId: ctx.userId, automationRuleId: rule.ruleId });
  var result;
  if (mode === 'async' && typeof 建立非同步任務 === 'function') {
    result = 建立非同步任務({ tenantId: payload.tenantId, userId: payload.userId, taskType: 'automation', targetAction: action, payload: payload });
  } else if (typeof router === 'function') {
    result = router(action, payload);
  } else {
    result = AUTO_fail_('router 尚未載入。');
  }
  AUTO_log_(rule, payload, result);
  return result;
}

function AUTO_log_(rule, data, result) {
  if (typeof DAL_append !== 'function') return;
  var ctx = AUTO_ctx_(data || {});
  DAL_append(GOVOPS_AUTOMATION_LOG_SHEET, {
    logId: AUTO_id_('ALOG'),
    ruleId: rule.ruleId,
    tenantId: ctx.tenantId || rule.tenantId,
    userId: ctx.userId,
    觸發來源: data.triggerType || data['觸發類型'] || 'manual',
    執行Action: rule['執行Action'],
    執行狀態: result && result.success === false ? 'failed' : 'success',
    執行訊息: result && result.message ? result.message : '',
    建立時間: AUTO_now_()
  }, AUTO_logHeaders_());
}

function 安裝自動化觸發器() {
  初始化自動化引擎();
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === '執行定時自動化') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('執行定時自動化').timeBased().everyMinutes(10).create();
  return AUTO_success_('自動化觸發器已安裝。');
}

function 執行定時自動化() {
  return 觸發自動化({ triggerType: 'scheduled' });
}

function 查詢自動化執行紀錄(data) {
  初始化自動化引擎();
  data = data || {};
  if (typeof DAL_query !== 'function') return AUTO_fail_('DataAccessLayer 尚未載入。');
  var ctx = AUTO_ctx_(data);
  var res = DAL_query(GOVOPS_AUTOMATION_LOG_SHEET, { tenantId: ctx.tenantId, keyword: data.keyword || data['關鍵字'] || '', limit: data.limit || 100, page: data.page || 1, cache: false });
  return AUTO_success_('自動化執行紀錄查詢完成。', { 紀錄: res.data.rows, 筆數: res.data.total });
}

function 建立預設自動化規則(data) {
  data = data || {};
  var ctx = AUTO_ctx_(data);
  var rules = [];
  rules.push(建立自動化規則(Object.assign({}, ctx, { ruleName: 'SLA逾期自動通知', triggerType: 'scheduled', action: '建立SLA逾期通知', mode: 'sync' })));
  rules.push(建立自動化規則(Object.assign({}, ctx, { ruleName: '每日管理總報表', triggerType: 'scheduled', action: '產生管理總報表', mode: 'async' })));
  rules.push(建立自動化規則(Object.assign({}, ctx, { ruleName: '每日資料倉儲重建', triggerType: 'scheduled', action: '重建租戶資料倉儲', mode: 'async' })));
  return AUTO_success_('預設自動化規則已建立。', { rules: rules });
}

function 測試_AutomationRuntime() {
  初始化自動化引擎();
  var ctx = { tenantId: 'QA-AUTO', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' };
  var rule = 建立自動化規則(Object.assign({}, ctx, { ruleName: '測試自動化', triggerType: 'manual_test', action: '查詢今日任務', mode: 'sync' }));
  var run = 觸發自動化(Object.assign({}, ctx, { triggerType: 'manual_test' }));
  var log = 查詢自動化執行紀錄(ctx);
  return AUTO_success_('Automation Runtime 測試完成。', { rule: rule, run: run, log: log });
}
