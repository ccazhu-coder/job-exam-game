/*
GovOps OS｜50_GovOps_AIOrchestratorRuntime.gs
AI SaaS ERP Orchestrator Runtime v1.0.0

用途：
1. AI 任務路由
2. AI 上下文記憶
3. AI Workflow Integration
4. AI Queue Runtime
5. ERP AI Assistant Runtime
*/

var GOVOPS_AI_ORCH_VERSION = '1.0.0';
var GOVOPS_AI_MEMORY_SHEET = 'AI上下文記憶表';
var GOVOPS_AI_TASK_SHEET = 'AI任務紀錄表';

function AIOR_memoryHeaders_() {
  return ['memoryId','tenantId','userId','記憶類型','關鍵字','內容','來源','狀態','建立時間','更新時間'];
}

function AIOR_taskHeaders_() {
  return ['aiTaskId','tenantId','userId','輸入內容','判斷意圖','路由Action','執行狀態','執行結果','建立時間','更新時間'];
}

function AIOR_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function AIOR_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function AIOR_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function AIOR_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function AIOR_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function 初始化AI協調器() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_AI_MEMORY_SHEET, AIOR_memoryHeaders_());
    DAL_ensureHeaders_(GOVOPS_AI_TASK_SHEET, AIOR_taskHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_AI_MEMORY_SHEET, AIOR_memoryHeaders_());
    ensureSheet(GOVOPS_AI_TASK_SHEET, AIOR_taskHeaders_());
  }
  return AIOR_success_('AI 協調器初始化完成。', { version: GOVOPS_AI_ORCH_VERSION });
}

function AI任務路由(data) {
  初始化AI協調器();
  data = data || {};
  var ctx = AIOR_ctx_(data);
  var text = data.text || data.message || data['指令'] || '';
  if (!text) return AIOR_fail_('請輸入 AI 指令。');

  var route = AIOR_detectIntent_(text);
  var aiTaskId = AIOR_id_('AIT');
  var result;

  try {
    if (route.async && typeof 建立非同步任務 === 'function') {
      result = 建立非同步任務(Object.assign({}, ctx, {
        taskType: 'ai',
        targetAction: route.action,
        payload: Object.assign({}, ctx, { text: text, keyword: text })
      }));
    } else if (typeof router === 'function') {
      result = router(route.action, Object.assign({}, ctx, { text: text, keyword: text }));
    } else {
      result = AIOR_fail_('router 尚未載入。');
    }
  } catch (err) {
    result = AIOR_fail_('AI 任務執行失敗。');
  }

  AIOR_recordTask_(ctx, aiTaskId, text, route.intent, route.action, result);
  AIOR_remember_(Object.assign({}, ctx, {
    記憶類型: 'last_ai_command',
    關鍵字: route.intent,
    內容: text,
    來源: 'AI任務路由'
  }));

  return AIOR_success_('AI 任務已處理。', {
    aiTaskId: aiTaskId,
    intent: route.intent,
    action: route.action,
    result: result
  });
}

function AIOR_detectIntent_(text) {
  text = String(text || '');
  if (text.indexOf('未收款') >= 0 || text.indexOf('應收') >= 0) return { intent: 'finance_unpaid', action: '查詢未收款', async: false };
  if (text.indexOf('損益') >= 0 || text.indexOf('收入') >= 0 || text.indexOf('支出') >= 0) return { intent: 'finance_pl', action: '查詢專案損益', async: false };
  if (text.indexOf('提醒') >= 0) return { intent: 'reminder', action: '查詢今日提醒', async: false };
  if (text.indexOf('任務') >= 0) return { intent: 'task', action: '查詢今日任務', async: false };
  if (text.indexOf('流程') >= 0 || text.indexOf('SLA') >= 0) return { intent: 'workflow', action: '查詢流程任務', async: false };
  if (text.indexOf('學員') >= 0 || text.indexOf('CRM') >= 0 || text.indexOf('名單') >= 0) return { intent: 'crm', action: '查詢學員', async: false };
  if (text.indexOf('缺件') >= 0 || text.indexOf('核銷') >= 0) return { intent: 'missing_check', action: 'AI缺件檢查', async: true };
  if (text.indexOf('摘要') >= 0 || text.indexOf('今日') >= 0) return { intent: 'daily_summary', action: '產生秘書摘要', async: true };
  return { intent: 'general_secretary', action: 'AI秘書查詢', async: false };
}

function AIOR_recordTask_(ctx, aiTaskId, text, intent, action, result) {
  var row = {
    aiTaskId: aiTaskId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    輸入內容: text,
    判斷意圖: intent,
    路由Action: action,
    執行狀態: result && result.success === false ? 'failed' : 'done',
    執行結果: result && result.message ? result.message : '',
    建立時間: AIOR_now_(),
    更新時間: AIOR_now_()
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_AI_TASK_SHEET, row, AIOR_taskHeaders_());
}

function AIOR_remember_(data) {
  data = data || {};
  var ctx = AIOR_ctx_(data);
  var row = {
    memoryId: AIOR_id_('MEM'),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    記憶類型: data['記憶類型'] || data.memoryType || 'general',
    關鍵字: data['關鍵字'] || data.keyword || '',
    內容: data['內容'] || data.content || '',
    來源: data['來源'] || data.source || 'system',
    狀態: 'active',
    建立時間: AIOR_now_(),
    更新時間: AIOR_now_()
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_AI_MEMORY_SHEET, row, AIOR_memoryHeaders_());
  return row;
}

function 查詢AI記憶(data) {
  初始化AI協調器();
  data = data || {};
  if (typeof DAL_query !== 'function') return AIOR_fail_('DataAccessLayer 尚未載入。');
  var ctx = AIOR_ctx_(data);
  var res = DAL_query(GOVOPS_AI_MEMORY_SHEET, {
    tenantId: ctx.tenantId,
    keyword: data.keyword || data['關鍵字'] || '',
    limit: data.limit || 50,
    page: data.page || 1,
    cache: false
  });
  return AIOR_success_('AI 記憶查詢完成。', { 記憶: res.data.rows, 筆數: res.data.total });
}

function 查詢AI任務紀錄(data) {
  初始化AI協調器();
  data = data || {};
  if (typeof DAL_query !== 'function') return AIOR_fail_('DataAccessLayer 尚未載入。');
  var ctx = AIOR_ctx_(data);
  var res = DAL_query(GOVOPS_AI_TASK_SHEET, {
    tenantId: ctx.tenantId,
    keyword: data.keyword || data['關鍵字'] || '',
    limit: data.limit || 50,
    page: data.page || 1,
    cache: false
  });
  return AIOR_success_('AI 任務紀錄查詢完成。', { 任務: res.data.rows, 筆數: res.data.total });
}

function AI工作流建議(data) {
  data = data || {};
  var text = data.text || data.message || data['指令'] || '';
  var suggestions = [];
  if (text.indexOf('活動') >= 0) suggestions.push('建議啟動標準活動流程，並建立活動前置任務。');
  if (text.indexOf('收款') >= 0 || text.indexOf('未收款') >= 0) suggestions.push('建議檢查應收帳款，並建立收款追蹤提醒。');
  if (text.indexOf('結案') >= 0 || text.indexOf('核銷') >= 0) suggestions.push('建議執行缺件檢查，確認簽到表、成果照片、核銷資料與成果報告。');
  if (!suggestions.length) suggestions.push('建議先查詢今日任務、提醒與未收款狀態。');
  return AIOR_success_('AI 工作流建議已產生。', { 建議: suggestions });
}

function AI秘書查詢(data) {
  return AI任務路由(data || {});
}

function 測試_AIOrchestratorRuntime() {
  初始化AI協調器();
  var ctx = { tenantId: 'QA-AI', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' };
  var r1 = AI任務路由(Object.assign({}, ctx, { text: '查詢未收款' }));
  var r2 = AI工作流建議(Object.assign({}, ctx, { text: '活動結案核銷要注意什麼' }));
  var mem = 查詢AI記憶(ctx);
  return AIOR_success_('AI Orchestrator Runtime 測試完成。', { 路由: r1, 建議: r2, 記憶: mem });
}
