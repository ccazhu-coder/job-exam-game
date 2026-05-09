/*
GovOps OS｜48_GovOps_MultiTenantIsolationAudit.gs
商用 SaaS ERP Multi-Tenant Isolation Audit v1.0.0

用途：
1. 多租戶隔離稽核
2. 跨租戶資料掃描
3. 權限與角色稽核
4. 敏感資料風險檢查
5. SaaS Security Runtime 基礎
*/

var GOVOPS_AUDIT_VERSION = '1.0.0';
var GOVOPS_AUDIT_SHEET = '系統安全稽核紀錄';

function AUD_headers_() {
  return ['auditId','tenantId','auditType','riskLevel','sheetName','rowNumber','問題摘要','建議處理','狀態','建立時間','更新時間'];
}

function AUD_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function AUD_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function AUD_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function AUD_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function 初始化安全稽核系統() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_AUDIT_SHEET, AUD_headers_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_AUDIT_SHEET, AUD_headers_());
  }
  return AUD_success_('安全稽核系統初始化完成。', { version: GOVOPS_AUDIT_VERSION });
}

function AUD_coreSheets_() {
  var fallback = ['招生活動管理','報名資料庫','學員CRM','當日工作任務表','物品清單','簽到表紀錄','文件歸檔紀錄','應收帳款','收款紀錄','支出紀錄'];
  if (typeof GOVOPS_CORE_SHEETS === 'undefined') return fallback;
  return Object.keys(GOVOPS_CORE_SHEETS).map(function(k){ return GOVOPS_CORE_SHEETS[k]; });
}

function AUD_record_(row) {
  初始化安全稽核系統();
  row = row || {};
  row.auditId = row.auditId || AUD_id_('AUD');
  row.狀態 = row.狀態 || 'open';
  row.建立時間 = row.建立時間 || AUD_now_();
  row.更新時間 = row.更新時間 || AUD_now_();
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_AUDIT_SHEET, row, AUD_headers_());
  return row;
}

function 執行Tenant隔離稽核(data) {
  初始化安全稽核系統();
  data = data || {};
  if (typeof DAL_query !== 'function') return AUD_fail_('DataAccessLayer 尚未載入。');
  var tenantId = data.tenantId || data['組織ID'] || '';
  var sheets = data.sheets || AUD_coreSheets_();
  var findings = [];

  sheets.forEach(function(sheetName) {
    try {
      var res = DAL_query(sheetName, { tenantId: tenantId, limit: 500, cache: false });
      var rows = res.data.rows || [];
      rows.forEach(function(row) {
        var rowTenant = row.tenantId || row['組織ID'] || '';
        if (!rowTenant) {
          findings.push(AUD_record_({ tenantId: tenantId, auditType: 'missing_tenant', riskLevel: 'high', sheetName: sheetName, rowNumber: row._row, 問題摘要: '資料列缺少 tenantId。', 建議處理: '補齊 tenantId 並確認資料所屬組織。' }));
        }
        if (tenantId && rowTenant && String(rowTenant) !== String(tenantId)) {
          findings.push(AUD_record_({ tenantId: tenantId, auditType: 'cross_tenant', riskLevel: 'critical', sheetName: sheetName, rowNumber: row._row, 問題摘要: '查詢結果疑似出現其他租戶資料。', 建議處理: '立即檢查資料隔離與查詢條件。' }));
        }
      });
    } catch (err) {
      findings.push(AUD_record_({ tenantId: tenantId, auditType: 'scan_error', riskLevel: 'medium', sheetName: sheetName, rowNumber: '', 問題摘要: '稽核掃描失敗。', 建議處理: '檢查資料表欄位與 DAL 狀態。' }));
    }
  });

  return AUD_success_('Tenant 隔離稽核完成。', { 發現風險數: findings.length, 風險: findings });
}

function 執行角色權限稽核(data) {
  初始化安全稽核系統();
  data = data || {};
  if (typeof DAL_query !== 'function') return AUD_fail_('DataAccessLayer 尚未載入。');
  var tenantId = data.tenantId || data['組織ID'] || '';
  var res = DAL_query('使用者帳號表', { tenantId: tenantId, limit: 500, cache: false });
  var users = res.data.rows || [];
  var findings = [];
  var ownerCount = 0;
  var validRoles = ['owner','admin','finance','staff','viewer'];

  users.forEach(function(u) {
    var role = String(u.userRole || '').toLowerCase();
    if (role === 'owner') ownerCount++;
    if (validRoles.indexOf(role) < 0) {
      findings.push(AUD_record_({ tenantId: tenantId, auditType: 'invalid_role', riskLevel: 'high', sheetName: '使用者帳號表', rowNumber: u._row, 問題摘要: '使用者角色不在允許清單內。', 建議處理: '調整為 owner/admin/finance/staff/viewer。' }));
    }
    if (String(u['狀態'] || '').toLowerCase() !== 'active' && role === 'owner') {
      findings.push(AUD_record_({ tenantId: tenantId, auditType: 'disabled_owner', riskLevel: 'critical', sheetName: '使用者帳號表', rowNumber: u._row, 問題摘要: 'owner 帳號非啟用狀態。', 建議處理: '確認組織是否仍有可用管理者。' }));
    }
  });

  if (ownerCount === 0) {
    findings.push(AUD_record_({ tenantId: tenantId, auditType: 'missing_owner', riskLevel: 'critical', sheetName: '使用者帳號表', rowNumber: '', 問題摘要: '租戶沒有 owner 帳號。', 建議處理: '指定至少一位 owner。' }));
  }

  return AUD_success_('角色權限稽核完成。', { 使用者數: users.length, owner數: ownerCount, 發現風險數: findings.length, 風險: findings });
}

function 執行敏感資料稽核(data) {
  初始化安全稽核系統();
  data = data || {};
  if (typeof DAL_query !== 'function') return AUD_fail_('DataAccessLayer 尚未載入。');
  var tenantId = data.tenantId || data['組織ID'] || '';
  var sheets = ['報名資料庫','學員CRM','使用者帳號表'];
  var findings = [];

  sheets.forEach(function(sheetName) {
    var res = DAL_query(sheetName, { tenantId: tenantId, limit: 500, cache: false });
    var rows = res.data.rows || [];
    rows.forEach(function(row) {
      Object.keys(row).forEach(function(k) {
        var v = String(row[k] || '');
        if (/\d{10,}/.test(v) && ['電話','手機'].indexOf(k) < 0) {
          findings.push(AUD_record_({ tenantId: tenantId, auditType: 'sensitive_data', riskLevel: 'medium', sheetName: sheetName, rowNumber: row._row, 問題摘要: '欄位可能包含未分類的敏感數字資料。', 建議處理: '確認是否為電話、身分資料或其他個資。' }));
        }
      });
    });
  });

  return AUD_success_('敏感資料稽核完成。', { 發現風險數: findings.length, 風險: findings });
}

function 執行完整安全稽核(data) {
  var tenant = 執行Tenant隔離稽核(data || {});
  var role = 執行角色權限稽核(data || {});
  var sensitive = 執行敏感資料稽核(data || {});
  return AUD_success_('完整安全稽核完成。', { Tenant隔離: tenant, 角色權限: role, 敏感資料: sensitive });
}

function 查詢安全稽核紀錄(data) {
  初始化安全稽核系統();
  data = data || {};
  if (typeof DAL_query !== 'function') return AUD_fail_('DataAccessLayer 尚未載入。');
  var res = DAL_query(GOVOPS_AUDIT_SHEET, { tenantId: data.tenantId || data['組織ID'] || '', keyword: data.keyword || data['關鍵字'] || '', limit: data.limit || 100, page: data.page || 1, cache: false });
  return AUD_success_('安全稽核紀錄查詢完成。', { 稽核紀錄: res.data.rows, 筆數: res.data.total });
}

function 測試_MultiTenantIsolationAudit() {
  初始化安全稽核系統();
  var tenantId = 'QA-AUDIT';
  var role = 執行角色權限稽核({ tenantId: tenantId });
  var list = 查詢安全稽核紀錄({ tenantId: tenantId });
  return AUD_success_('MultiTenant Isolation Audit 測試完成。', { 角色稽核: role, 稽核紀錄: list });
}
