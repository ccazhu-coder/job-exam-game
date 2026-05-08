/*
GovOps OS｜23_GovOps_QA_RuntimeTests.gs
版本：SaaS Runtime QA Tests v1.0.0
用途：驗證 SaaS Runtime 是否真的可用。

重要原則：
- 不修改既有功能
- 不重寫 router
- 不污染正式資料：固定使用 tenantId: QA-TENANT、userId: QA-USER
- 測試資料統一加上 QA_TEST 標記
- Logger.log 清楚顯示 PASS / FAIL
- 中文測試結果
- 不顯示技術堆疊
*/

var GOVOPS_QA_TENANT_ID = 'QA-TENANT';
var GOVOPS_QA_USER_ID = 'QA-USER';
var GOVOPS_QA_VERSION = '1.0.0';

function 測試_QA_健康檢查() {
  return runQaCase_('測試_QA_健康檢查', function() {
    var result = router('系統健康檢查', qaData_('FREE', 'owner'));
    return qaAssert_(result && result.success === true, '健康檢查應成功', result);
  });
}

function 測試_QA_FREE_新增活動限制() {
  return runQaCase_('測試_QA_FREE_新增活動限制', function() {
    var data = qaData_('FREE', 'owner');
    data['活動名稱'] = 'QA_TEST_FREE_新增活動限制';
    data['活動日期'] = qaToday_();
    data['活動地點'] = 'QA測試地點';

    qaSeedUsage_(data, '活動數', 3);
    var result = router('新增活動', data);
    return qaAssert_(result && result.success === false && containsChinese_(result.message, '上限'), 'FREE 活動數達上限時應禁止新增活動', result);
  });
}

function 測試_QA_STARTER_財務可用() {
  return runQaCase_('測試_QA_STARTER_財務可用', function() {
    var data = qaData_('STARTER', 'finance');
    var access = assertFeatureAccess(data, 'finance');
    return qaAssert_(access && access.success === true, 'STARTER + finance 角色應可使用財務功能', access);
  });
}

function 測試_QA_FREE_財務禁止() {
  return runQaCase_('測試_QA_FREE_財務禁止', function() {
    var data = qaData_('FREE', 'owner');
    var result = router('建立應收帳款', data);
    return qaAssert_(result && result.success === false && containsChinese_(result.message, '升級'), 'FREE 方案應禁止財務功能並提示升級', result);
  });
}

function 測試_QA_PRO_AI可用() {
  return runQaCase_('測試_QA_PRO_AI可用', function() {
    var data = qaData_('PRO', 'owner');
    var access = assertFeatureAccess(data, 'ai_secretary');
    return qaAssert_(access && access.success === true, 'PRO + owner 應可使用 AI 秘書', access);
  });
}

function 測試_QA_STARTER_AI禁止() {
  return runQaCase_('測試_QA_STARTER_AI禁止', function() {
    var data = qaData_('STARTER', 'owner');
    var result = router('AI秘書查詢', data);
    return qaAssert_(result && result.success === false && containsChinese_(result.message, '升級'), 'STARTER 應禁止 AI 秘書並提示升級 PRO', result);
  });
}

function 測試_QA_Tenant資料隔離() {
  return runQaCase_('測試_QA_Tenant資料隔離', function() {
    var data = qaData_('PRO', 'owner');
    var rows = [
      { 活動ID: 'QA-1', 活動名稱: 'QA可見', tenantId: GOVOPS_QA_TENANT_ID, userId: GOVOPS_QA_USER_ID, QA_TEST: 'Y' },
      { 活動ID: 'OTHER-1', 活動名稱: '其他租戶', tenantId: 'OTHER-TENANT', userId: 'OTHER-USER', QA_TEST: 'Y' },
      { 活動ID: 'LEGACY-1', 活動名稱: '舊資料無租戶', QA_TEST: 'Y' }
    ];
    var filtered = tenantFilterArray(rows, data);
    var ok = filtered.length === 2 && filtered.some(function(r){ return r.活動ID === 'QA-1'; }) && filtered.some(function(r){ return r.活動ID === 'LEGACY-1'; }) && !filtered.some(function(r){ return r.活動ID === 'OTHER-1'; });
    return qaAssert_(ok, 'tenantFilterArray 應只保留本租戶與舊資料，不可看到其他租戶', filtered);
  });
}

function 測試_QA_Usage增加() {
  return runQaCase_('測試_QA_Usage增加', function() {
    var data = qaData_('PRO', 'owner');
    初始化SaaS使用量();
    qaSeedUsage_(data, 'AI查詢數', 0);
    var before = readTenantUsage(data);
    var inc = incrementUsage(data, 'AI查詢數', 1);
    var after = readTenantUsage(data);
    var ok = Number(after['AI查詢數'] || 0) === Number(before['AI查詢數'] || 0) + 1 && inc.success === true;
    return qaAssert_(ok, 'AI查詢數應成功增加 1', { before: before, increment: inc, after: after });
  });
}

function 測試_QA_RouterFallback() {
  return runQaCase_('測試_QA_RouterFallback', function() {
    var data = qaData_('PRO', 'owner');
    var result = router('不存在的QA測試Action', data);
    return qaAssert_(result && result.success === false && containsChinese_(result.message, '找不到'), '不屬於 composer 的 action 應回到原 switch default', result);
  });
}

function 測試_QA_中文錯誤訊息() {
  return runQaCase_('測試_QA_中文錯誤訊息', function() {
    var data = qaData_('FREE', 'owner');
    var result = router('AI秘書查詢', data);
    var text = String(result && result.message || '');
    var ok = result && result.success === false && /[\u4e00-\u9fff]/.test(text) && text.indexOf('Error') === -1 && text.indexOf('Exception') === -1 && text.indexOf('TypeError') === -1;
    return qaAssert_(ok, '錯誤訊息應為中文且不顯示技術堆疊', result);
  });
}

function 測試_QA_全部Runtime() {
  var tests = [
    測試_QA_健康檢查,
    測試_QA_FREE_新增活動限制,
    測試_QA_STARTER_財務可用,
    測試_QA_FREE_財務禁止,
    測試_QA_PRO_AI可用,
    測試_QA_STARTER_AI禁止,
    測試_QA_Tenant資料隔離,
    測試_QA_Usage增加,
    測試_QA_RouterFallback,
    測試_QA_中文錯誤訊息
  ];

  var results = tests.map(function(fn) { return fn(); });
  var pass = results.filter(function(r) { return r.success; }).length;
  var fail = results.length - pass;
  Logger.log('GovOps QA 總結：PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + results.length);
  return {
    success: fail === 0,
    message: fail === 0 ? 'GovOps SaaS Runtime QA 全部通過。' : 'GovOps SaaS Runtime QA 有測試未通過。',
    data: {
      PASS: pass,
      FAIL: fail,
      TOTAL: results.length,
      結果: results
    }
  };
}

function runQaCase_(name, fn) {
  try {
    var result = fn();
    var status = result && result.success ? 'PASS' : 'FAIL';
    Logger.log(status + '｜' + name + '｜' + (result && result.message ? result.message : ''));
    return {
      success: !!(result && result.success),
      testName: name,
      message: result && result.message ? result.message : '測試完成。',
      data: result && result.data !== undefined ? result.data : result
    };
  } catch (err) {
    Logger.log('FAIL｜' + name + '｜系統暫時無法完成測試，請稍後再試。');
    return {
      success: false,
      testName: name,
      message: '系統暫時無法完成測試，請稍後再試。',
      data: { reason: 'QA_TEST_ERROR' }
    };
  }
}

function qaAssert_(condition, message, data) {
  return {
    success: !!condition,
    message: (condition ? 'PASS：' : 'FAIL：') + message,
    data: data || {}
  };
}

function qaData_(plan, role) {
  return {
    tenantId: GOVOPS_QA_TENANT_ID,
    userId: GOVOPS_QA_USER_ID,
    userRole: role || 'owner',
    plan: plan || 'PRO',
    '組織ID': GOVOPS_QA_TENANT_ID,
    '使用者ID': GOVOPS_QA_USER_ID,
    '使用者角色': role || 'owner',
    'SaaS方案': plan || 'PRO',
    QA_TEST: 'Y',
    備註: 'QA_TEST_ONLY'
  };
}

function qaSeedUsage_(data, metric, value) {
  try {
    初始化SaaS使用量();
    var ctx = getUsageContext(data || {});
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_USAGE_SHEET_NAME);
    ensureUsageHeaders_(sheet);
    var info = findUsageRow_(sheet, ctx) || createUsageRow_(sheet, ctx);
    var headers = getUsageHeaders_(sheet);
    var metricCol = headers.indexOf(metric) + 1;
    var updateCol = headers.indexOf('更新時間') + 1;
    if (metricCol > 0) sheet.getRange(info.row, metricCol).setValue(value);
    if (updateCol > 0) sheet.getRange(info.row, updateCol).setValue(qaNow_());
    return true;
  } catch (err) {
    return false;
  }
}

function 清理_QA_Usage資料() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_USAGE_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return { success: true, message: '沒有 QA 使用量資料需要清理。' };
    var headers = getUsageHeaders_(sheet);
    var tenantCol = headers.indexOf('tenantId');
    var userCol = headers.indexOf('userId');
    var deleted = 0;
    for (var r = sheet.getLastRow(); r >= 2; r--) {
      var row = sheet.getRange(r, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (String(row[tenantCol]) === GOVOPS_QA_TENANT_ID && String(row[userCol]) === GOVOPS_QA_USER_ID) {
        sheet.deleteRow(r);
        deleted++;
      }
    }
    Logger.log('PASS｜清理_QA_Usage資料｜已清理 ' + deleted + ' 筆 QA 使用量資料。');
    return { success: true, message: 'QA 使用量資料清理完成。', data: { deleted: deleted } };
  } catch (err) {
    Logger.log('FAIL｜清理_QA_Usage資料｜清理失敗。');
    return { success: false, message: 'QA 使用量資料清理失敗。', data: { reason: 'QA_CLEANUP_ERROR' } };
  }
}

function containsChinese_(text, keyword) {
  text = String(text || '');
  return text.indexOf(keyword) >= 0 && /[\u4e00-\u9fff]/.test(text);
}

function qaToday_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function qaNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}
