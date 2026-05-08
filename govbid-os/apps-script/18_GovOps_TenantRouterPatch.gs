/*
GovOps OS｜18_GovOps_TenantRouterPatch.gs
版本：Tenant Router Guard Patch v1.0.0
用途：讓現有 router / 15_GovOps_MVP_AllInOne.gs 逐步支援 tenantId / userId。

重要原則：
- 不重寫 15_GovOps_MVP_AllInOne.gs
- 不覆蓋 core router
- 只提供安全 wrapper、guard、filter helper
- 可與 17_GovOps_TenantLayer.gs 搭配使用

建議貼上方式：
1. Apps Script 新增檔案：18_GovOps_TenantRouterPatch
2. 貼上本檔全部內容
3. 執行：測試_TenantRouterGuard()
4. 執行：測試_TenantFilterResult()
*/

var GOVOPS_TENANT_ROUTER_PATCH_VERSION = '1.0.0';

var GovOps_TenantActionMap = {
  '取得儀表板': true,
  '新增活動': true,
  '生成活動作業包': true,
  '更新活動狀態': true,
  '更新活動報名表單連結': true,
  '從報名表單同步報名資料': true,
  '新增報名': true,
  '審核報名': true,
  '查詢': true,
  '查詢學員': true,
  '查詢可行銷名單': true,
  '查詢今日任務': true,
  '更新任務狀態': true,
  '查詢物品': true,
  '更新物品狀態': true,
  '更新餐點狀態': true,
  '生成簽到表': true,
  '查詢簽到名單': true,
  'AI缺件檢查': true,
  '更新核銷狀態': true,
  '建立Drive資料夾': true,
  '查詢文件歸檔': true,
  'LINE測試': true,
  '建立應收帳款': true,
  '登錄收款': true,
  '登錄支出': true,
  '查詢未收款': true,
  '查詢專案損益': true,
  '建立活動提醒': true,
  '查詢今日提醒': true,
  '執行提醒檢查': true,
  'AI秘書查詢': true,
  '產生秘書摘要': true,
  '儲存使用者設定': true,

  '初始化系統': false,
  '系統健康檢查': false,
  '初始化財務資料表': false,
  '初始化提醒中心': false
};

function normalizeTenantData(data) {
  data = data || {};

  var tenantId = firstNonEmptyTenantRouter_(
    data.tenantId,
    data['組織ID'],
    data.organizationId,
    data.orgId,
    data.companyId
  );

  var userId = firstNonEmptyTenantRouter_(
    data.userId,
    data['使用者ID'],
    data.uid,
    data.lineUserId,
    data.LINE_UID
  );

  var userRole = firstNonEmptyTenantRouter_(
    data.userRole,
    data['使用者角色'],
    data.role,
    'owner'
  );

  var plan = firstNonEmptyTenantRouter_(
    data.plan,
    data['SaaS方案'],
    data.subscriptionPlan,
    data['方案'],
    'FREE'
  );

  tenantId = String(tenantId || '').trim();
  userId = String(userId || '').trim();
  userRole = String(userRole || '').trim() || 'owner';
  plan = String(plan || '').trim().toUpperCase() || 'FREE';

  var normalized = copyObjectTenantRouter_(data);
  normalized.tenantId = tenantId;
  normalized.userId = userId;
  normalized.userRole = userRole;
  normalized.plan = plan;
  normalized['組織ID'] = tenantId;
  normalized['使用者ID'] = userId;
  normalized['使用者角色'] = userRole;
  normalized['SaaS方案'] = plan;

  return normalized;
}

function tenantRouterGuard(action, data) {
  action = String(action || '').trim();
  var normalized = normalizeTenantData(data || {});
  var needTenant = !!GovOps_TenantActionMap[action];

  if (!needTenant) {
    return {
      success: true,
      required: false,
      action: action,
      data: normalized,
      tenant: {
        tenantId: normalized.tenantId || 'TENANT-OPTIONAL',
        userId: normalized.userId || 'USER-OPTIONAL',
        userRole: normalized.userRole,
        plan: normalized.plan
      }
    };
  }

  if (!normalized.tenantId) {
    return {
      success: false,
      required: true,
      action: action,
      message: '缺少組織ID，請先登入或重新整理頁面後再試。',
      data: normalized
    };
  }

  if (!normalized.userId) {
    return {
      success: false,
      required: true,
      action: action,
      message: '缺少使用者ID，請先登入或重新整理頁面後再試。',
      data: normalized
    };
  }

  return {
    success: true,
    required: true,
    action: action,
    data: normalized,
    tenant: {
      tenantId: normalized.tenantId,
      userId: normalized.userId,
      userRole: normalized.userRole,
      plan: normalized.plan,
      '組織ID': normalized.tenantId,
      '使用者ID': normalized.userId,
      '使用者角色': normalized.userRole,
      'SaaS方案': normalized.plan
    }
  };
}

function withTenantAction(action, data, handler) {
  try {
    var guard = tenantRouterGuard(action, data || {});
    if (!guard.success) {
      return {
        success: false,
        message: guard.message || '目前無法執行此操作，請重新登入後再試。',
        data: {
          action: action,
          reason: 'TENANT_GUARD_FAILED'
        }
      };
    }

    if (typeof handler !== 'function') {
      return {
        success: false,
        message: '系統尚未設定此功能處理器。',
        data: { action: action }
      };
    }

    var safeData = guard.data || normalizeTenantData(data || {});
    var result = handler(safeData);
    result = tenantFilterObjectData(result, safeData);

    if (result && result.data && typeof result.data === 'object') {
      result.data.tenant = guard.tenant;
    }

    return result;
  } catch (err) {
    return {
      success: false,
      message: '系統暫時無法完成操作，請稍後再試。',
      data: {
        action: action,
        reason: 'TENANT_ACTION_ERROR'
      }
    };
  }
}

function tenantFilterResult(result, data) {
  return tenantFilterObjectData(result, data);
}

function tenantFilterArray(array, data) {
  array = array || [];
  var normalized = normalizeTenantData(data || {});
  if (!normalized.tenantId) return [];

  return array.filter(function(item) {
    if (!item || typeof item !== 'object') return true;
    var itemTenant = firstNonEmptyTenantRouter_(item.tenantId, item['組織ID'], '');
    if (!itemTenant) return true;
    return String(itemTenant) === String(normalized.tenantId);
  });
}

function tenantFilterObjectData(response, data) {
  if (!response || typeof response !== 'object') return response;

  var normalized = normalizeTenantData(data || {});
  var cloned = copyObjectTenantRouter_(response);

  if (Array.isArray(cloned)) return tenantFilterArray(cloned, normalized);

  if (cloned.data && typeof cloned.data === 'object') {
    cloned.data = filterNestedTenantData_(cloned.data, normalized);
  } else {
    cloned = filterNestedTenantData_(cloned, normalized);
  }

  return cloned;
}

function filterNestedTenantData_(obj, data) {
  if (Array.isArray(obj)) return tenantFilterArray(obj, data);
  if (!obj || typeof obj !== 'object') return obj;

  var result = copyObjectTenantRouter_(obj);
  Object.keys(result).forEach(function(key) {
    if (Array.isArray(result[key])) {
      result[key] = tenantFilterArray(result[key], data);
    } else if (result[key] && typeof result[key] === 'object') {
      result[key] = filterNestedTenantData_(result[key], data);
    }
  });
  return result;
}

function tenantGuardResponse(action, data) {
  var guard = tenantRouterGuard(action, data || {});
  if (guard.success) {
    return {
      success: true,
      message: 'Tenant Router Guard 通過。',
      data: {
        action: action,
        required: guard.required,
        tenant: guard.tenant || {}
      }
    };
  }

  return {
    success: false,
    message: guard.message || 'Tenant Router Guard 未通過。',
    data: {
      action: action,
      required: guard.required,
      reason: 'TENANT_REQUIRED'
    }
  };
}

function 測試_TenantRouterGuard() {
  var okData = {
    tenantId: 'TENANT-TEST',
    userId: 'USER-TEST',
    userRole: 'owner',
    plan: 'PRO'
  };

  var missingTenantData = {
    userId: 'USER-TEST',
    userRole: 'owner',
    plan: 'PRO'
  };

  return {
    success: true,
    message: 'Tenant Router Guard 測試完成。',
    data: {
      需要租戶_通過: tenantRouterGuard('新增活動', okData),
      需要租戶_缺少tenantId: tenantRouterGuard('新增活動', missingTenantData),
      不強制租戶_健康檢查: tenantRouterGuard('系統健康檢查', {})
    }
  };
}

function 測試_TenantFilterResult() {
  var data = {
    tenantId: 'TENANT-A',
    userId: 'USER-A',
    userRole: 'owner',
    plan: 'PRO'
  };

  var result = {
    success: true,
    message: '查詢完成。',
    data: {
      結果: [
        { 活動ID: 'A1', 活動名稱: 'A租戶活動', tenantId: 'TENANT-A', userId: 'USER-A' },
        { 活動ID: 'B1', 活動名稱: 'B租戶活動', tenantId: 'TENANT-B', userId: 'USER-B' },
        { 活動ID: 'LEGACY1', 活動名稱: '舊資料無租戶' }
      ],
      明細: [
        { 項目: '可見資料', '組織ID': 'TENANT-A' },
        { 項目: '不可見資料', '組織ID': 'TENANT-B' }
      ]
    }
  };

  return {
    success: true,
    message: 'Tenant Filter Result 測試完成。',
    data: tenantFilterResult(result, data)
  };
}

/*
最小接入片段：

在 doGet / doPost 或 handleRequest 解析 action 與 data 後，原 router 前加入：

var guard = tenantRouterGuard(action, data);
if (!guard.success) {
  return jsonOutput({
    success: false,
    message: guard.message,
    data: { action: action, reason: 'TENANT_REQUIRED' }
  });
}
data = guard.data;

如果要逐步包住單一 action：

case '新增活動':
  return withTenantAction(action, data, 新增活動);

如果原本 handler 已回傳查詢結果，可在回傳前加：

return tenantFilterResult(result, data);

*/

function firstNonEmptyTenantRouter_() {
  for (var i = 0; i < arguments.length; i++) {
    var value = arguments[i];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function copyObjectTenantRouter_(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(function(item) { return copyObjectTenantRouter_(item); });
  var copy = {};
  Object.keys(obj).forEach(function(key) {
    var value = obj[key];
    if (Array.isArray(value)) {
      copy[key] = value.map(function(item) { return copyObjectTenantRouter_(item); });
    } else if (value && typeof value === 'object') {
      copy[key] = copyObjectTenantRouter_(value);
    } else {
      copy[key] = value;
    }
  });
  return copy;
}
