/*
GovOps OS｜20_GovOps_SaaSUsageMetering.gs
版本：SaaS Usage Metering Backend v1.0.0
用途：GovOps OS SaaS 使用量計量、方案限制、用量攔截與 action wrapper。

重要原則：
- 不修改 15_GovOps_MVP_AllInOne.gs
- 不破壞 17 / 18 / 19 tenant patch
- 獨立補丁檔
- 所有錯誤中文化
- 不顯示技術錯誤

使用量資料表：SaaS使用量
欄位：tenantId、userId、月份、活動數、CRM筆數、AI查詢數、Drive建立數、財務操作數、提醒操作數、建立時間、更新時間
*/

var GOVOPS_USAGE_METERING_VERSION = '1.0.0';
var GOVOPS_USAGE_SHEET_NAME = 'SaaS使用量';
var GOVOPS_USAGE_HEADERS = ['tenantId','userId','月份','活動數','CRM筆數','AI查詢數','Drive建立數','財務操作數','提醒操作數','建立時間','更新時間'];

var GovOps_UsageActionMetricMap = {
  '新增活動': '活動數',
  '新增報名': 'CRM筆數',
  'AI秘書查詢': 'AI查詢數',
  '產生秘書摘要': 'AI查詢數',
  '建立Drive資料夾': 'Drive建立數',
  '建立應收帳款': '財務操作數',
  '登錄收款': '財務操作數',
  '登錄支出': '財務操作數',
  '建立活動提醒': '提醒操作數'
};

function 初始化SaaS使用量() {
  try {
    var sheet = getUsageSheet_();
    ensureUsageHeaders_(sheet);
    return usageSuccess_('SaaS使用量資料表初始化完成。', {
      資料表: GOVOPS_USAGE_SHEET_NAME,
      欄位: GOVOPS_USAGE_HEADERS,
      version: GOVOPS_USAGE_METERING_VERSION
    });
  } catch (err) {
    return usageFail_('SaaS使用量資料表初始化失敗，請稍後再試。');
  }
}

function getUsageContext(data) {
  data = data || {};
  var tenantId = firstUsageValue_(data.tenantId, data['組織ID'], data.organizationId, 'TENANT-LOCAL');
  var userId = firstUsageValue_(data.userId, data['使用者ID'], data.uid, data.lineUserId, 'USER-LOCAL');
  var plan = firstUsageValue_(data.plan, data['SaaS方案'], data.subscriptionPlan, data['方案'], 'FREE');
  var month = firstUsageValue_(data.month, data['月份'], getCurrentUsageMonth_());

  tenantId = String(tenantId || '').trim() || 'TENANT-LOCAL';
  userId = String(userId || '').trim() || 'USER-LOCAL';
  plan = String(plan || '').trim().toUpperCase() || 'FREE';
  month = String(month || '').trim() || getCurrentUsageMonth_();

  return {
    tenantId: tenantId,
    userId: userId,
    plan: plan,
    month: month,
    月份: month,
    組織ID: tenantId,
    使用者ID: userId,
    SaaS方案: plan
  };
}

function readTenantUsage(data) {
  try {
    var ctx = getUsageContext(data || {});
    var sheet = getUsageSheet_();
    ensureUsageHeaders_(sheet);
    var rowInfo = findUsageRow_(sheet, ctx);

    if (!rowInfo) {
      var created = createUsageRow_(sheet, ctx);
      return created.usage;
    }

    return rowInfo.usage;
  } catch (err) {
    return defaultUsage_(getUsageContext(data || {}));
  }
}

function incrementUsage(data, metric, amount) {
  try {
    amount = Number(amount || 1);
    if (!metric) return usageFail_('缺少使用量指標。');
    if (GOVOPS_USAGE_HEADERS.indexOf(metric) < 0) return usageFail_('找不到使用量指標：' + metric);

    var ctx = getUsageContext(data || {});
    var sheet = getUsageSheet_();
    ensureUsageHeaders_(sheet);
    var rowInfo = findUsageRow_(sheet, ctx) || createUsageRow_(sheet, ctx);
    var headers = getUsageHeaders_(sheet);
    var metricCol = headers.indexOf(metric) + 1;
    var updateCol = headers.indexOf('更新時間') + 1;
    var current = Number(sheet.getRange(rowInfo.row, metricCol).getValue() || 0);
    var next = current + amount;
    sheet.getRange(rowInfo.row, metricCol).setValue(next);
    if (updateCol > 0) sheet.getRange(rowInfo.row, updateCol).setValue(usageNow_());

    var usage = readTenantUsage(ctx);
    return usageSuccess_('使用量已更新。', {
      metric: metric,
      amount: amount,
      current: next,
      usage: usage,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      月份: ctx.month
    });
  } catch (err) {
    return usageFail_('使用量更新失敗，請稍後再試。');
  }
}

function getPlanLimit(plan) {
  plan = String(plan || 'FREE').toUpperCase();
  var enterprise = {
    '活動數': 999999,
    'CRM筆數': 999999,
    'AI查詢數': 999999,
    'Drive建立數': 999999,
    '財務操作數': 999999,
    '提醒操作數': 999999
  };

  var limits = {
    FREE: {
      '活動數': 3,
      'CRM筆數': 50,
      'AI查詢數': 0,
      'Drive建立數': 0,
      '財務操作數': 0,
      '提醒操作數': 3
    },
    STARTER: {
      '活動數': 20,
      'CRM筆數': 500,
      'AI查詢數': 0,
      'Drive建立數': 20,
      '財務操作數': 50,
      '提醒操作數': 100
    },
    PRO: {
      '活動數': 100,
      'CRM筆數': 5000,
      'AI查詢數': 300,
      'Drive建立數': 100,
      '財務操作數': 500,
      '提醒操作數': 500
    },
    ENTERPRISE: enterprise
  };

  return limits[plan] || limits.FREE;
}

function assertPlanLimit(data, metric) {
  var ctx = getUsageContext(data || {});
  var usage = readTenantUsage(ctx);
  var limits = getPlanLimit(ctx.plan);
  var limit = Number(limits[metric]);
  var current = Number(usage[metric] || 0);

  if (limit === undefined || isNaN(limit)) {
    return {
      success: false,
      message: '找不到方案限制指標：' + metric,
      data: { metric: metric, plan: ctx.plan }
    };
  }

  if (current >= limit) {
    return {
      success: false,
      message: '目前方案的「' + metric + '」已達上限，請升級方案後繼續使用。',
      data: {
        metric: metric,
        plan: ctx.plan,
        current: current,
        limit: limit,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        月份: ctx.month
      }
    };
  }

  return {
    success: true,
    message: '方案使用量檢查通過。',
    data: {
      metric: metric,
      plan: ctx.plan,
      current: current,
      limit: limit,
      remaining: limit - current,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      月份: ctx.month
    }
  };
}

function usageAwareAction(action, data, handler, metric) {
  try {
    action = String(action || '').trim();
    metric = metric || GovOps_UsageActionMetricMap[action];

    if (!metric) {
      if (typeof handler === 'function') return handler(data || {});
      return usageFail_('找不到使用量指標，也未提供處理函式。');
    }

    var check = assertPlanLimit(data || {}, metric);
    if (!check.success) return check;

    if (typeof handler !== 'function') {
      return usageFail_('系統尚未設定此功能處理器。');
    }

    var result = handler(data || {});

    if (result && result.success === false) {
      return result;
    }

    var inc = incrementUsage(data || {}, metric, 1);
    if (result && typeof result === 'object') {
      result.data = result.data || {};
      result.data.usage = inc.data || {};
    }

    return result;
  } catch (err) {
    return usageFail_('系統暫時無法完成操作，請稍後再試。');
  }
}

function handleUsageAwareAction(action, data, handler) {
  return usageAwareAction(action, data, handler, GovOps_UsageActionMetricMap[action]);
}

function 測試_UsageMetering() {
  var data = {
    tenantId: 'TENANT-USAGE-TEST',
    userId: 'USER-USAGE-TEST',
    plan: 'PRO'
  };

  初始化SaaS使用量();
  var before = readTenantUsage(data);
  var inc = incrementUsage(data, '活動數', 1);
  var after = readTenantUsage(data);

  return usageSuccess_('Usage Metering 測試完成。', {
    before: before,
    increment: inc,
    after: after
  });
}

function 測試_PlanLimit() {
  var freeData = {
    tenantId: 'TENANT-LIMIT-FREE',
    userId: 'USER-LIMIT-FREE',
    plan: 'FREE'
  };

  var proData = {
    tenantId: 'TENANT-LIMIT-PRO',
    userId: 'USER-LIMIT-PRO',
    plan: 'PRO'
  };

  初始化SaaS使用量();

  return usageSuccess_('Plan Limit 測試完成。', {
    FREE限制: getPlanLimit('FREE'),
    STARTER限制: getPlanLimit('STARTER'),
    PRO限制: getPlanLimit('PRO'),
    ENTERPRISE限制: getPlanLimit('ENTERPRISE'),
    FREE_AI檢查: assertPlanLimit(freeData, 'AI查詢數'),
    PRO_AI檢查: assertPlanLimit(proData, 'AI查詢數')
  });
}

function getUsageSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GOVOPS_USAGE_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(GOVOPS_USAGE_SHEET_NAME);
  return sheet;
}

function ensureUsageHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, GOVOPS_USAGE_HEADERS.length).setValues([GOVOPS_USAGE_HEADERS]);
    return;
  }

  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(v) { return String(v || '').trim(); });
  var changed = false;

  GOVOPS_USAGE_HEADERS.forEach(function(h) {
    if (headers.indexOf(h) < 0) {
      headers.push(h);
      changed = true;
    }
  });

  if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function getUsageHeaders_(sheet) {
  ensureUsageHeaders_(sheet);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function findUsageRow_(sheet, ctx) {
  var headers = getUsageHeaders_(sheet);
  var tenantCol = headers.indexOf('tenantId');
  var userCol = headers.indexOf('userId');
  var monthCol = headers.indexOf('月份');

  if (sheet.getLastRow() < 2) return null;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[tenantCol]) === String(ctx.tenantId) && String(row[userCol]) === String(ctx.userId) && String(row[monthCol]) === String(ctx.month)) {
      return {
        row: i + 2,
        usage: rowToUsage_(headers, row)
      };
    }
  }

  return null;
}

function createUsageRow_(sheet, ctx) {
  var nowText = usageNow_();
  var rowObject = defaultUsage_(ctx);
  rowObject['建立時間'] = nowText;
  rowObject['更新時間'] = nowText;

  var headers = getUsageHeaders_(sheet);
  var row = headers.map(function(h) { return rowObject[h] !== undefined ? rowObject[h] : ''; });
  sheet.appendRow(row);

  return {
    row: sheet.getLastRow(),
    usage: rowObject
  };
}

function rowToUsage_(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) {
    obj[h] = row[i];
  });
  return obj;
}

function defaultUsage_(ctx) {
  ctx = ctx || getUsageContext({});
  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    '月份': ctx.month || ctx['月份'] || getCurrentUsageMonth_(),
    '活動數': 0,
    'CRM筆數': 0,
    'AI查詢數': 0,
    'Drive建立數': 0,
    '財務操作數': 0,
    '提醒操作數': 0,
    '建立時間': '',
    '更新時間': ''
  };
}

function getCurrentUsageMonth_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy-MM');
}

function usageNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function usageSuccess_(message, data) {
  return {
    success: true,
    message: message || '操作完成。',
    data: data || {}
  };
}

function usageFail_(message, data) {
  return {
    success: false,
    message: message || '系統暫時無法完成操作，請稍後再試。',
    data: data || {}
  };
}

function firstUsageValue_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}
