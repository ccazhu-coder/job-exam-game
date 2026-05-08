/*
GovOps OS｜19_GovOps_TenantCoreIntegration.gs
版本：Tenant Core Integration Wrapper v1.0.0
用途：將既有 15_GovOps_MVP_AllInOne.gs / core 後端逐步 tenant 化。

重要原則：
- 不修改 15_GovOps_MVP_AllInOne.gs
- 不重寫 router
- 不破壞原本回傳格式
- 只提供可插拔 wrapper
- 搭配 17_GovOps_TenantLayer.gs 與 18_GovOps_TenantRouterPatch.gs 使用

最小 router 接入片段：

在原 switch(action) 前加入：

var tenantHandled = handleTenantCoreAction(action, data);
if (tenantHandled) return outputJson(tenantHandled);

若原本函式叫 jsonOutput，則使用：

var tenantHandled = handleTenantCoreAction(action, data);
if (tenantHandled) return jsonOutput(tenantHandled);
*/

var GOVOPS_TENANT_CORE_INTEGRATION_VERSION = '1.0.0';

var GovOps_TenantCoreActionMap = {
  '新增活動': tenantAppendActivity,
  '新增報名': tenantAppendRegistration,
  '查詢學員': tenantQueryCRM,
  '查詢可行銷名單': tenantQueryCRM,
  '查詢未收款': tenantQueryFinance,
  '查詢專案損益': tenantQueryFinance,
  '查詢今日提醒': tenantQueryReminder,
  '建立Drive資料夾': tenantCreateDriveFolder
};

function handleTenantCoreAction(action, data) {
  try {
    action = String(action || '').trim();
    if (!GovOps_TenantCoreActionMap[action]) return null;

    if (typeof tenantRouterGuard === 'function') {
      var guard = tenantRouterGuard(action, data || {});
      if (!guard.success) {
        return {
          success: false,
          message: guard.message || '請先登入或重新整理頁面後再試。',
          data: { action: action, reason: 'TENANT_REQUIRED' }
        };
      }
      data = guard.data || data;
    }

    return GovOps_TenantCoreActionMap[action](data || {});
  } catch (err) {
    return {
      success: false,
      message: '系統暫時無法完成操作，請稍後再試。',
      data: { action: action, reason: 'TENANT_CORE_ERROR' }
    };
  }
}

function tenantAppendActivity(data) {
  return tenantCoreSafe_('新增活動', data, function(safeData) {
    if (typeof 新增活動 !== 'function') return tenantCoreFail_('找不到原本的「新增活動」函式。', safeData);
    safeData = attachTenantFields(safeData, safeData);
    var result = 新增活動(safeData);
    return tenantCoreKeepFormat_(result, safeData);
  });
}

function tenantAppendRegistration(data) {
  return tenantCoreSafe_('新增報名', data, function(safeData) {
    if (!safeData['活動ID'] && !safeData.activityId) {
      return tenantCoreFail_('請先提供活動ID，才能新增報名。', safeData);
    }
    if (typeof 新增報名 !== 'function') return tenantCoreFail_('找不到原本的「新增報名」函式。', safeData);
    safeData = attachTenantFields(safeData, safeData);
    safeData['活動ID'] = safeData['活動ID'] || safeData.activityId;
    var result = 新增報名(safeData);
    return tenantCoreKeepFormat_(result, safeData);
  });
}

function tenantQueryActivities(data) {
  return tenantCoreSafe_('查詢活動', data, function(safeData) {
    var rows = tenantCoreReadRows_('招生活動管理', safeData);
    return tenantAwareResponse('活動查詢完成。', { 結果: rows, 資料: rows }, safeData);
  });
}

function tenantQueryCRM(data) {
  return tenantCoreSafe_('查詢學員', data, function(safeData) {
    var rows = tenantCoreReadRows_('學員CRM', safeData);
    var keyword = String(safeData.keyword || safeData.query || safeData['關鍵字'] || '').trim();
    if (keyword) {
      rows = rows.filter(function(row) {
        return JSON.stringify(row).indexOf(keyword) >= 0;
      });
    }
    return tenantAwareResponse('學員CRM查詢完成。', { 結果: rows, 學員: rows, 資料: rows }, safeData);
  });
}

function tenantQueryFinance(data) {
  return tenantCoreSafe_('查詢財務', data, function(safeData) {
    var sheetNames = ['應收帳款', '收款紀錄', '支出明細'];
    var merged = [];
    sheetNames.forEach(function(name) {
      var rows = tenantCoreReadRows_(name, safeData);
      rows.forEach(function(row) {
        row['_資料表'] = name;
        merged.push(row);
      });
    });

    var keyword = String(safeData.keyword || safeData.query || safeData['活動ID'] || '').trim();
    if (keyword) {
      merged = merged.filter(function(row) {
        return JSON.stringify(row).indexOf(keyword) >= 0;
      });
    }

    return tenantAwareResponse('財務查詢完成。', { 結果: merged, 明細: merged, 資料: merged }, safeData);
  });
}

function tenantQueryReminder(data) {
  return tenantCoreSafe_('查詢提醒', data, function(safeData) {
    var rows = tenantCoreReadRows_('提醒中心', safeData);
    var todayText = tenantCoreToday_();
    rows = rows.filter(function(row) {
      var dateText = String(row['提醒日期'] || row['日期'] || row['執行日期'] || '');
      return !dateText || dateText === todayText || dateText.indexOf(todayText) >= 0;
    });
    return tenantAwareResponse('今日提醒查詢完成。', { 結果: rows, 提醒: rows, 資料: rows }, safeData);
  });
}

function tenantCreateDriveFolder(data) {
  return tenantCoreSafe_('建立Drive資料夾', data, function(safeData) {
    if (typeof 建立Drive資料夾 === 'function') {
      safeData = attachTenantFields(safeData, safeData);
      var result = 建立Drive資料夾(safeData);
      return tenantCoreKeepFormat_(result, safeData);
    }

    var folderName = 'GovOps_' + (safeData['活動ID'] || safeData.activityId || '未命名活動') + '_' + safeData.tenantId;
    var folder = DriveApp.createFolder(folderName);
    var row = attachTenantFields({
      '文件ID': tenantCoreId_('DOC'),
      '活動ID': safeData['活動ID'] || safeData.activityId || '',
      '文件類型': 'Drive資料夾',
      '文件名稱': folderName,
      'Drive連結': folder.getUrl(),
      '歸檔狀態': '已建立',
      '建立時間': tenantCoreNow_(),
      '更新時間': tenantCoreNow_()
    }, safeData);

    tenantCoreAppendRow_('文件歸檔紀錄', row, safeData);
    return tenantAwareResponse('Drive資料夾建立完成。', { 連結: folder.getUrl(), 文件: row }, safeData);
  });
}

function tenantCoreSafe_(action, data, callback) {
  try {
    var safeData = tenantCoreNormalize_(data || {});
    if (typeof assertTenant === 'function') assertTenant(safeData);
    return callback(safeData);
  } catch (err) {
    return {
      success: false,
      message: '系統暫時無法完成「' + action + '」，請稍後再試。',
      data: { action: action, reason: 'TENANT_CORE_SAFE_ERROR' }
    };
  }
}

function tenantCoreNormalize_(data) {
  if (typeof normalizeTenantData === 'function') return normalizeTenantData(data || {});
  if (typeof getTenantContext === 'function') {
    var ctx = getTenantContext(data || {});
    var copy = tenantCoreCopy_(data || {});
    copy.tenantId = ctx.tenantId;
    copy.userId = ctx.userId;
    copy.userRole = ctx.userRole;
    copy.plan = ctx.plan;
    copy['組織ID'] = ctx.tenantId;
    copy['使用者ID'] = ctx.userId;
    copy['使用者角色'] = ctx.userRole;
    copy['SaaS方案'] = ctx.plan;
    return copy;
  }
  return data || {};
}

function tenantCoreKeepFormat_(result, data) {
  if (!result || typeof result !== 'object') return result;
  if (typeof tenantFilterResult === 'function') result = tenantFilterResult(result, data);
  if (result.data && typeof result.data === 'object') {
    result.data.tenant = {
      tenantId: data.tenantId,
      userId: data.userId,
      userRole: data.userRole,
      plan: data.plan,
      '組織ID': data.tenantId,
      '使用者ID': data.userId
    };
  }
  return result;
}

function tenantCoreReadRows_(sheetName, data) {
  if (typeof readRowsByTenant === 'function') return readRowsByTenant(sheetName, data);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var rows = values.map(function(row, index) {
    var obj = { _row: index + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
  if (typeof filterRowsByTenant === 'function') return filterRowsByTenant(rows, headers, data);
  return rows;
}

function tenantCoreAppendRow_(sheetName, rowObject, data) {
  if (typeof appendObjectWithTenant === 'function') return appendObjectWithTenant(sheetName, rowObject, data);
  rowObject = attachTenantFields(rowObject || {}, data || {});
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  if (typeof 補齊租戶欄位_ === 'function') 補齊租戶欄位_(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var row = headers.map(function(h) { return rowObject[h] !== undefined ? rowObject[h] : ''; });
  sheet.appendRow(row);
  return rowObject;
}

function tenantCoreFail_(message, data) {
  if (typeof tenantFailResponse === 'function') return tenantFailResponse(message, data || {});
  return { success: false, message: message || '操作失敗。', data: {} };
}

function tenantCoreNow_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function tenantCoreToday_() {
  if (typeof today === 'function') return today();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function tenantCoreId_(prefix) {
  if (typeof generateId === 'function') return generateId('文件');
  return prefix + '-' + new Date().getTime();
}

function tenantCoreCopy_(obj) {
  var copy = {};
  Object.keys(obj || {}).forEach(function(k) { copy[k] = obj[k]; });
  return copy;
}

function 測試_TenantAppendActivity() {
  var data = {
    tenantId: 'TENANT-TEST',
    userId: 'USER-TEST',
    userRole: 'owner',
    plan: 'PRO',
    '活動名稱': 'Tenant Core 測試活動',
    '活動日期': tenantCoreToday_(),
    '活動地點': '測試地點'
  };
  return tenantAppendActivity(data);
}

function 測試_TenantQueryCRM() {
  return tenantQueryCRM({
    tenantId: 'TENANT-TEST',
    userId: 'USER-TEST',
    userRole: 'owner',
    plan: 'PRO',
    keyword: ''
  });
}

function 測試_TenantQueryFinance() {
  return tenantQueryFinance({
    tenantId: 'TENANT-TEST',
    userId: 'USER-TEST',
    userRole: 'finance',
    plan: 'PRO',
    keyword: ''
  });
}
