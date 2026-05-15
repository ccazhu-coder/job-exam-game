/**
 * 重大修正：
 * - govopsFilter_ 加入 tenantId 租戶隔離過濾（所有舊中文 API 一次修正）
 * - VENDOR_HEADERS、INSTRUCTOR_HEADERS、STAFF_HEADERS 補 tenantId/workspaceId/createdBy
 * - 講師/廠商/工作人員 create routes 寫入 tenantId
 * - INSTRUCTOR_HEADERS 欄位對齊 master-data.html（服務單位、費率、身分證字號、地址）
 * - 儲存講師 / 儲存工作人員 action 名稱支援（upsert 邏輯）
 * - MPOWER 所有 headers 補 tenantId/workspaceId
 * - 人力需求/支援人員查詢加入 tenantId 過濾，create 寫入 tenantId
 * - 移除廢棄路由：govopsCourseOpsRoute_、govopsSopRoute_、govopsModifyRoute_、govopsArchiveDocRoute_、govopsFinanceRoute_、govopsSimpleFallbackRoute_
 * 部署方式：貼上後 → 管理部署作業 → 新增版本 → 部署（所有人）
 */

var GOVOPS_SHEET_ID = '1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY';

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  return govopsMainRouter_(params);
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var parsed = JSON.parse(raw);
    if (parsed && parsed.events && Array.isArray(parsed.events)) {
      if (typeof govopsLineHandleWebhook_ === 'function') {
        return ContentService.createTextOutput(JSON.stringify(govopsLineHandleWebhook_(raw))).setMimeType(ContentService.MimeType.JSON);
      }
    }
    var params = parsed.action ? parsed : ((e && e.parameter) ? e.parameter : {});
    return govopsMainRouter_(params);
  } catch (err) {
    return govopsMainRouter_((e && e.parameter) ? e.parameter : {});
  }
}

// SaaS 不需要 session 的公開 action 清單
var GOVOPS_PUBLIC_ACTIONS = ['registerTenant','loginUser','logoutUser','getPlans','getPlanDetail','devClearSaasData','正式平台初始化','正式平台健康檢查','健康檢查','initSaasSheets'];

function govopsMainRouter_(params) {
  params = params || {};
  var action = String(params.action || '');
  var result = null;

  // SaaS 路由（公開，優先）
  result = govopsSaasRoute_(params, action);
  if (result) return jsonOutput(result);

  // Session 驗證 + 租戶上下文注入
  var _sess = govopsValidateSession_(params);
  if (_sess) {
    params._tenantId    = _sess.tenantId;
    params._workspaceId = _sess.workspaceId;
    params._userId      = _sess.userId;
    params._role        = _sess.role;
  } else if (GOVOPS_PUBLIC_ACTIONS.indexOf(action) === -1) {
    return jsonOutput({ success:false, error:'UNAUTHORIZED', message:'請先登入。如尚未有帳號，請先至 register.html 註冊。', timestamp:govopsNow_() });
  }

  result = govopsVendorRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsEnrollmentRoute_(params, action);
  if (result) return jsonOutput(result);

  // ── 移除廢棄路由：govopsCourseOpsRoute_, govopsSopRoute_, govopsModifyRoute_, govopsArchiveDocRoute_, govopsFinanceRoute_ ──

  result = govopsProjectActivityRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsProductionRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsTenderRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsResourceRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsReviewNotifRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsDocumentRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsBudgetRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsCaseReqRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsChangeLogRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsImportRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsFileManagerRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsCalendarRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsFinanceV1Route_(params, action);
  if (result) return jsonOutput(result);

  result = govopsClosingRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsOfficialDocRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsManpowerRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsTaskRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsDriveRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsDocGenRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsFormSyncRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsNotifyRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsPaymentRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsSettingsRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsAuthRoute_(params, action);
  if (result) return jsonOutput(result);

  return jsonOutput({ success: false, message: '找不到對應功能：' + action, action: action });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function govopsSS_() {
  try { return SpreadsheetApp.openById(GOVOPS_SHEET_ID); } catch (e) { return SpreadsheetApp.getActiveSpreadsheet(); }
}

function govopsNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function govopsId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 10000);
}

function govopsEnsureSheet_(sheetName, headers) {
  var ss = govopsSS_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  headers = headers || ['ID', '名稱', '狀態', '備註', '建立時間', '更新時間'];
  var colCount = Math.max(sh.getLastColumn(), headers.length);
  var first = sh.getRange(1, 1, 1, colCount).getValues()[0].map(function(v){ return String(v || '').trim(); });
  var empty = first.every(function(v){ return !v; });
  if (empty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    var missing = headers.filter(function(h){ return first.indexOf(h) === -1; });
    if (missing.length) sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]);
  }
  return sh;
}

function govopsHeaders_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(v){ return String(v || '').trim(); });
}

function govopsRows_(sheetName, headers) {
  var sh = govopsEnsureSheet_(sheetName, headers);
  var hs = govopsHeaders_(sh);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().map(function(row, i){
    var obj = { _row: i + 2 };
    hs.forEach(function(h, idx){ obj[h] = row[idx]; });
    return obj;
  });
}

function govopsAppend_(sheetName, headers, obj) {
  var sh = govopsEnsureSheet_(sheetName, headers);
  var hs = govopsHeaders_(sh);
  sh.appendRow(hs.map(function(h){ return obj[h] !== undefined ? obj[h] : ''; }));
  return obj;
}

function govopsUpdate_(sheetName, headers, rowNumber, patch) {
  var sh = govopsEnsureSheet_(sheetName, headers);
  var hs = govopsHeaders_(sh);
  var row = sh.getRange(rowNumber, 1, 1, hs.length).getValues()[0];
  hs.forEach(function(h, i){ if (patch[h] !== undefined) row[i] = patch[h]; });
  sh.getRange(rowNumber, 1, 1, hs.length).setValues([row]);
}

function govopsDeleteRow_(sheetName, rowNumber) {
  var sh = govopsSS_().getSheetByName(sheetName);
  if (sh && rowNumber >= 2) sh.deleteRow(rowNumber);
}

function govopsClearSheet_(sheetName) {
  var sh = govopsSS_().getSheetByName(sheetName);
  if (!sh) return 0;
  var last = sh.getLastRow();
  if (last >= 2) { sh.deleteRows(2, last - 1); return last - 1; }
  return 0;
}

function govopsFilter_(rows, params) {
  params = params || {};
  // 租戶隔離（最優先）：有 _tenantId 時只回傳同租戶資料
  var _tid = String(params._tenantId || '').trim();
  if (_tid) rows = rows.filter(function(r){ return String(r['tenantId']||'') === _tid; });
  var kw = String(params.keyword || params.q || params['關鍵字'] || '').trim();
  if (kw) rows = rows.filter(function(r){ return JSON.stringify(r).indexOf(kw) >= 0; });
  return rows;
}

// ── CacheService 快取 (5分鐘) ─────────────────────────────────
function govopsCache_() { return CacheService.getScriptCache(); }
function govopsCacheKey_(sheetName) { return 'gs_rows_' + sheetName.replace(/\s/g,'_'); }
function govopsRowsCached_(sheetName, headers) {
  var key = govopsCacheKey_(sheetName);
  var cached = govopsCache_().get(key);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }
  var rows = govopsRows_(sheetName, headers);
  try { govopsCache_().put(key, JSON.stringify(rows), 300); } catch(e) {}
  return rows;
}
function govopsCacheInvalidate_(sheetName) {
  try { govopsCache_().remove(govopsCacheKey_(sheetName)); } catch(e) {}
}

// ── 分頁 helper ───────────────────────────────────────────────
function govopsPaginate_(rows, params) {
  var limit  = Math.max(1, Math.min(500, parseInt(params.limit  || params['每頁筆數'] || '200', 10) || 200));
  var offset = Math.max(0, parseInt(params.offset || params['偏移'] || '0', 10) || 0);
  var total  = rows.length;
  var paged  = rows.slice(offset, offset + limit);
  return { rows: paged, total: total, limit: limit, offset: offset, hasMore: offset + paged.length < total };
}

var VENDOR_HEADERS = ['廠商編號','名稱','類型','聯絡人','電話','地址','Email','支付方式','銀行','帳號','戶名','統編/身分證','是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註','建立時間','更新時間','tenantId','workspaceId','createdBy'];
var PROJECT_HEADERS = ['專案ID','專案計畫名稱','專案類型','主辦單位','開始日期','結束日期','契約金額','狀態','專案說明','備註','建立時間','更新時間'];
// CASE_HEADERS = PROJECT_HEADERS 原有12欄 + 擴充9欄（第13~21欄），govopsEnsureSheet_會自動補欄
var CASE_HEADERS = ['專案ID','專案計畫名稱','專案類型','主辦單位','開始日期','結束日期','契約金額','狀態','專案說明','備註','建立時間','更新時間','承辦窗口','聯絡電話','Email','結案期限','預估成本','付款狀態','結案狀態','Drive連結','Calendar連結','tenantId','workspaceId','createdBy','visibility'];
var ACTIVITY_HEADERS = ['活動ID','專案ID','專案計畫名稱','活動名稱','活動日期','活動類型','開始時間','結束時間','活動地點','講師','聯絡電話','聯絡人','工作人員','狀態','備註','建立時間','更新時間'];
// SESSION_HEADERS = ACTIVITY_HEADERS 原有17欄 + v0.1擴充14欄，govopsEnsureSheet_自動補欄
var SESSION_HEADERS = ['活動ID','專案ID','專案計畫名稱','活動名稱','活動日期','活動類型','開始時間','結束時間','活動地點','講師','聯絡電話','聯絡人','工作人員','狀態','備註','建立時間','更新時間','報名截止日','預計人數','實際人數','是否需簽到表','是否需簽退表','是否需便當','是否需保險','是否需問卷','是否需成果照片','是否需講師領據','是否需工作人員','CalendarEventID','CalendarLink','已同步日曆','日曆同步狀態','變更狀態','tenantId','workspaceId','createdBy'];
var CAMPAIGN_HEADERS = ['招生活動ID','專案ID','活動ID','課程名稱','招生狀態','報名開始日','報名截止日','開課日期','招生名額','候補名額','報名連結','招生渠道','主辦單位','聯絡人','聯絡電話','備註','建立時間','更新時間'];
var REG_HEADERS = ['報名ID','招生活動ID','活動ID','姓名','電話','Email','身分別','服務單位','用餐習慣','報名狀態','審核狀態','出席狀態','完訓狀態','報名來源','報名時間','通知狀態','備註','CRM_ID','建立時間','更新時間'];
// REG_EXT_HEADERS = REG_HEADERS 原有20欄 + v0.1擴充13欄
var REG_EXT_HEADERS = ['報名ID','招生活動ID','活動ID','姓名','電話','Email','身分別','服務單位','用餐習慣','報名狀態','審核狀態','出席狀態','完訓狀態','報名來源','報名時間','通知狀態','備註','CRM_ID','建立時間','更新時間','案件ID','性別','出生日期','身分證字號','地址','職稱','資格審查狀態','審查結果','補件項目','補件期限','通知日期','錄取狀態','匯入批次ID','tenantId','workspaceId'];
var CRM_HEADERS = ['CRM_ID','姓名','電話','Email','服務單位','身分別','標籤','最近參與活動','累積報名次數','累積出席次數','累積完訓次數','是否回流學員','行銷同意','備註','建立時間','更新時間'];
var ATT_HEADERS = ['簽到ID','招生活動ID','活動ID','報名ID','CRM_ID','姓名','電話','Email','服務單位','簽到狀態','簽到時間','簽名連結','備註','建立時間','更新時間'];
var ATT_LOG_HEADERS = ['紀錄ID','簽到ID','報名ID','活動ID','姓名','簽到狀態','操作時間','操作人','備註'];

function govopsVendorRoute_(params, action) {
  if (action === '初始化合作廠商主檔') {
    govopsEnsureSheet_('23_合作廠商主檔', VENDOR_HEADERS);
    return { success: true, message: '23_合作廠商主檔初始化完成' };
  }
  if (action === '查詢合作廠商') {
    var rows = govopsFilter_(govopsRows_('23_合作廠商主檔', VENDOR_HEADERS), params);
    return { success: true, message: '合作廠商查詢完成', data: { rows: rows, 廠商: rows, count: rows.length } };
  }
  if (action === '新增合作廠商' || action === '儲存合作廠商') {
    var name = params['名稱'] || params['廠商名稱'] || params.name || params.vendorName;
    if (!name) return { success: false, message: '請填寫廠商名稱' };
    var obj = {
      '廠商編號': params['廠商編號'] || govopsId_('VEN'),
      '名稱': name,
      '類型': params['類型'] || params['廠商類型'] || '其他廠商',
      '聯絡人': params['聯絡人'] || '',
      '電話': params['電話'] || params['聯絡電話'] || '',
      'tenantId': params._tenantId || '',
      'workspaceId': params._workspaceId || '',
      'createdBy': params._userId || '',
      'Email': params['Email'] || '',
      '支付方式': params['支付方式'] || params['付款方式'] || '匯款',
      '銀行': params['銀行'] || '',
      '帳號': params['帳號'] || '',
      '戶名': params['戶名'] || name,
      '統編/身分證': params['統編/身分證'] || params['統一編號'] || '',
      '是否開發票': params['是否開發票'] || '',
      '是否扣繳': params['是否扣繳'] || '',
      '扣繳類型': params['扣繳類型'] || '',
      '預設單價': params['預設單價'] || '',
      '評價': params['評價'] || '',
      '常用': params['常用'] || '',
      '備註': params['備註'] || '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_()
    };
    govopsAppend_('23_合作廠商主檔', VENDOR_HEADERS, obj);
    return { success: true, message: '合作廠商已新增', data: { 廠商編號: obj['廠商編號'], row: obj } };
  }
  return null;
}

function govopsProjectActivityRoute_(params, action) {
  if (action === '查詢專案') {
    var pr = govopsFilter_(govopsRows_('01_專案主檔', PROJECT_HEADERS), params);
    return { success: true, message: '專案查詢完成', data: { rows: pr, 專案: pr, count: pr.length } };
  }
  if (action === '新增專案') {
    var pname = params['專案計畫名稱'] || params.projectName || params.name;
    if (!pname) return { success: false, message: '請填寫專案計畫名稱' };
    var pobj = {'專案ID': params['專案ID'] || govopsId_('PROJ'),'專案計畫名稱': pname,'專案類型': params['專案類型'] || '','主辦單位': params['主辦單位'] || '','開始日期': params['開始日期'] || '','結束日期': params['結束日期'] || '','契約金額': params['契約金額'] || '','狀態': params['狀態'] || '進行中','專案說明': params['專案說明'] || '','備註': params['備註'] || '','建立時間': govopsNow_(),'更新時間': govopsNow_()};
    govopsAppend_('01_專案主檔', PROJECT_HEADERS, pobj);
    return { success: true, message: '專案已新增', data: { 專案ID: pobj['專案ID'], row: pobj } };
  }
  if (action === '查詢活動') {
    var ar = govopsFilter_(govopsRows_('02_場次活動', ACTIVITY_HEADERS), params);
    return { success: true, message: '活動查詢完成', data: { rows: ar, 活動: ar, count: ar.length } };
  }
  if (action === '新增活動') {
    var aname = params['活動名稱'] || params.activityName || params.name;
    if (!aname) return { success: false, message: '請填寫活動名稱' };
    var aobj = {'活動ID': params['活動ID'] || govopsId_('ACT'),'專案ID': params['專案ID'] || '','專案計畫名稱': params['專案計畫名稱'] || '','活動名稱': aname,'活動日期': params['活動日期'] || '','活動類型': params['活動類型'] || '','開始時間': params['開始時間'] || '','結束時間': params['結束時間'] || '','活動地點': params['活動地點'] || params['地點'] || '','講師': params['講師'] || '','聯絡人': params['聯絡人'] || '','聯絡電話': params['聯絡電話'] || '','狀態': params['狀態'] || '規劃中','備註': params['備註'] || '','建立時間': govopsNow_(),'更新時間': govopsNow_()};
    govopsAppend_('02_場次活動', ACTIVITY_HEADERS, aobj);
    return { success: true, message: '活動已新增', data: { 活動ID: aobj['活動ID'], row: aobj } };
  }

  // ── Case API v0.1 ─────────────────────────────────────────
  // getCases: 查詢案件（支援多條件篩選，預設排除封存）
  if (action === 'getCases') {
    var rows = govopsRowsCached_('01_專案主檔', CASE_HEADERS);
    // 租戶隔離：只回傳同租戶資料（無 tenantId 的舊資料為 legacy，不顯示）
    var _tid = String(params._tenantId || '');
    if (_tid) rows = rows.filter(function(r){ return String(r['tenantId']||'') === _tid; });
    var incArch = String(params.includeArchived || '').toLowerCase() === 'true';
    if (!incArch) rows = rows.filter(function(r){ return String(r['狀態'] || '') !== '封存'; });
    var kw = String(params.keyword || params.q || '').trim();
    if (kw) rows = rows.filter(function(r){ return String(r['專案計畫名稱']).indexOf(kw) >= 0 || String(r['主辦單位']).indexOf(kw) >= 0; });
    var typeF = String(params.type || params['案件類型'] || '').trim();
    if (typeF) rows = rows.filter(function(r){ return String(r['專案類型']) === typeF; });
    var statusF = String(params.status || params['狀態'] || '').trim();
    if (statusF) rows = rows.filter(function(r){ return String(r['狀態']) === statusF; });
    var dateFrom = String(params.dateFrom || '').trim();
    var dateTo = String(params.dateTo || '').trim();
    if (dateFrom) rows = rows.filter(function(r){ return String(r['開始日期']) >= dateFrom; });
    if (dateTo) rows = rows.filter(function(r){ return String(r['開始日期']) <= dateTo; });
    var payF = String(params.payStatus || params['付款狀態'] || '').trim();
    if (payF) rows = rows.filter(function(r){ return String(r['付款狀態']) === payF; });
    var clean = rows.map(function(r){ var o = {}; Object.keys(r).forEach(function(k){ if (k !== '_row') o[k] = r[k]; }); return o; });
    var pg = govopsPaginate_(clean, params);
    return { success: true, data: pg.rows, total: pg.total, limit: pg.limit, offset: pg.offset, hasMore: pg.hasMore, message: '案件查詢完成，共 ' + pg.total + ' 筆（本頁 ' + pg.rows.length + ' 筆）', timestamp: govopsNow_() };
  }

  // createCase: 新增案件（含方案用量檢查）
  if (action === 'createCase') {
    var cname = params['案件名稱'] || params['專案計畫名稱'] || params.name;
    if (!cname) return { success: false, error: 'MISSING_REQUIRED', message: '案件名稱為必填', timestamp: govopsNow_() };
    var ctype = params['案件類型'] || params['專案類型'] || '';
    if (!ctype) return { success: false, error: 'MISSING_REQUIRED', message: '案件類型為必填', timestamp: govopsNow_() };
    // 方案用量執法：檢查 maxCases
    if (params._tenantId) {
      var tenantRow = (govopsRows_('S01_租戶', TENANT_HEADERS).filter(function(t){ return t['tenantId']===params._tenantId; })[0]) || {};
      var planId = tenantRow['planId'] || 'free';
      var plan = (GOVOPS_PLANS.filter(function(p){ return p.planId===planId; })[0]) || GOVOPS_PLANS[0];
      var existingCases = govopsRows_('01_專案主檔', CASE_HEADERS).filter(function(r){ return String(r['tenantId']||'')===params._tenantId && String(r['狀態']||'')!=='封存'; });
      if (existingCases.length >= plan.maxCases) {
        return { success:false, error:'QUOTA_EXCEEDED', message:'已達方案案件數上限（'+plan.maxCases+' 件）。如需新增，請升級方案或封存舊案件。', timestamp:govopsNow_() };
      }
    }
    var cobj = {
      '專案ID': govopsId_('PROJ'),
      '專案計畫名稱': cname,
      '專案類型': ctype,
      '主辦單位': params['主辦單位'] || params['客戶'] || '',
      '開始日期': params['開始日期'] || '',
      '結束日期': params['結束日期'] || '',
      '契約金額': params['預估收入'] || params['契約金額'] || '',
      '狀態': params['案件狀態'] || params['狀態'] || '草稿',
      '專案說明': params['重要備註'] || params['專案說明'] || '',
      '備註': params['備註'] || '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_(),
      '承辦窗口': params['承辦窗口'] || '',
      '聯絡電話': params['聯絡電話'] || '',
      'Email': params['Email'] || '',
      '結案期限': params['結案期限'] || '',
      '預估成本': params['預估成本'] || '',
      '付款狀態': params['付款狀態'] || '未請款',
      '結案狀態': params['結案狀態'] || '未結案',
      'Drive連結': params['Drive連結'] || '',
      'Calendar連結': params['Calendar連結'] || '',
      'tenantId': params._tenantId || '',
      'workspaceId': params._workspaceId || '',
      'createdBy': params._userId || '',
      'visibility': 'workspace'
    };
    govopsAppend_('01_專案主檔', CASE_HEADERS, cobj);
    govopsCacheInvalidate_('01_專案主檔');
    return { success: true, data: { caseId: cobj['專案ID'], row: cobj }, message: '案件已新增', timestamp: govopsNow_() };
  }

  // updateCase: 更新案件（接受新舊欄位名稱，不影響 修改專案 路由）
  if (action === 'updateCase') {
    var caseId = params['caseId'] || params['案件ID'] || params['專案ID'];
    if (!caseId) return { success: false, error: 'MISSING_ID', message: '缺少案件ID（caseId）', timestamp: govopsNow_() };
    var allRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var found = null;
    for (var i = 0; i < allRows.length; i++) { if (allRows[i]['專案ID'] === caseId) { found = allRows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到案件：' + caseId, timestamp: govopsNow_() };
    if (params._tenantId && String(found['tenantId']||'') && String(found['tenantId']||'') !== params._tenantId) return { success:false, error:'FORBIDDEN', message:'無權限修改此案件', timestamp:govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    var oldFields = ['專案計畫名稱','專案類型','主辦單位','契約金額','開始日期','結束日期','狀態','專案說明','備註'];
    var newFields = ['承辦窗口','聯絡電話','Email','結案期限','預估成本','付款狀態','結案狀態','Drive連結','Calendar連結'];
    oldFields.concat(newFields).forEach(function(f){ if (params[f] !== undefined && params[f] !== '') patch[f] = params[f]; });
    // 接受新式 UI 欄位名稱
    if (params['案件名稱']) patch['專案計畫名稱'] = params['案件名稱'];
    if (params['案件類型']) patch['專案類型'] = params['案件類型'];
    if (params['案件狀態']) patch['狀態'] = params['案件狀態'];
    if (params['預估收入']) patch['契約金額'] = params['預估收入'];
    if (params['重要備註']) patch['專案說明'] = params['重要備註'];
    govopsUpdate_('01_專案主檔', CASE_HEADERS, found._row, patch);
    govopsCacheInvalidate_('01_專案主檔');
    return { success: true, data: { caseId: caseId, updated: patch }, message: '案件已更新', timestamp: govopsNow_() };
  }

  // archiveCase: 封存案件（軟刪除，狀態設為封存）
  if (action === 'archiveCase') {
    var caseId = params['caseId'] || params['案件ID'] || params['專案ID'];
    if (!caseId) return { success: false, error: 'MISSING_ID', message: '缺少案件ID（caseId）', timestamp: govopsNow_() };
    var allRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var found = null;
    for (var i = 0; i < allRows.length; i++) { if (allRows[i]['專案ID'] === caseId) { found = allRows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到案件：' + caseId, timestamp: govopsNow_() };
    if (params._tenantId && String(found['tenantId']||'') && String(found['tenantId']||'') !== params._tenantId) return { success:false, error:'FORBIDDEN', message:'無權限封存此案件', timestamp:govopsNow_() };
    govopsUpdate_('01_專案主檔', CASE_HEADERS, found._row, { '狀態': '封存', '更新時間': govopsNow_() });
    govopsCacheInvalidate_('01_專案主檔');
    return { success: true, data: { caseId: caseId, status: '封存' }, message: '案件已封存', timestamp: govopsNow_() };
  }

  // getCaseStats: 案件統計（供 Dashboard 使用）
  if (action === 'getCaseStats') {
    var allRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var _tid = String(params._tenantId || '');
    if (_tid) allRows = allRows.filter(function(r){ return String(r['tenantId']||'') === _tid; });
    var STATUS_LIST = ['草稿','洽談中','提案中','已簽約','執行中','待請款','待收款','待結案','已結案','暫停','取消','封存'];
    var byStatus = {};
    STATUS_LIST.forEach(function(s){ byStatus[s] = 0; });
    allRows.forEach(function(r){
      var s = String(r['狀態'] || '').trim();
      if (byStatus[s] !== undefined) byStatus[s]++;
    });
    var active = (byStatus['執行中'] || 0) + (byStatus['已簽約'] || 0) + (byStatus['洽談中'] || 0) + (byStatus['提案中'] || 0);
    var urgent = (byStatus['待請款'] || 0) + (byStatus['待收款'] || 0) + (byStatus['待結案'] || 0);
    var total = allRows.length;
    var archived = byStatus['封存'] || 0;
    return {
      success: true,
      data: { byStatus: byStatus, active: active, urgent: urgent, total: total, archived: archived },
      message: '案件統計完成',
      timestamp: govopsNow_()
    };
  }
  // getCase: 取得單筆案件（by ID，供 edit modal 使用）
  if (action === 'getCase') {
    var caseId = params.caseId || params['專案ID'];
    if (!caseId) return { success: false, error: 'MISSING_ID', message: '缺少 caseId', timestamp: govopsNow_() };
    var rows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var found = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i]['專案ID'] === caseId) { found = rows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到案件：' + caseId, timestamp: govopsNow_() };
    var clean = {}; Object.keys(found).forEach(function(k){ if (k !== '_row') clean[k] = found[k]; });
    return { success: true, data: clean, message: '案件查詢完成', timestamp: govopsNow_() };
  }

  // getSession: 取得單筆場次（by ID）
  if (action === 'getSession') {
    var sesId = params.sessionId || params['活動ID'];
    if (!sesId) return { success: false, error: 'MISSING_ID', message: '缺少 sessionId', timestamp: govopsNow_() };
    var rows = govopsRows_('02_場次活動', SESSION_HEADERS);
    var found = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i]['活動ID'] === sesId) { found = rows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到場次：' + sesId, timestamp: govopsNow_() };
    var clean = {}; Object.keys(found).forEach(function(k){ if (k !== '_row') clean[k] = found[k]; });
    return { success: true, data: clean, message: '場次查詢完成', timestamp: govopsNow_() };
  }

  // ── End Case API v0.1 ─────────────────────────────────────

  // ── Session API v0.1 ──────────────────────────────────────
  // getSessions: 查詢場次（支援 caseId、keyword、status、日期篩選）
  if (action === 'getSessions') {
    var rows = govopsRowsCached_('02_場次活動', SESSION_HEADERS);
    var _tid = String(params._tenantId || '');
    if (_tid) rows = rows.filter(function(r){ return String(r['tenantId']||'') === _tid; });
    var caseIdF = String(params.caseId || params['專案ID'] || '').trim();
    if (caseIdF) rows = rows.filter(function(r){ return String(r['專案ID']) === caseIdF; });
    var kw = String(params.keyword || params.q || '').trim();
    if (kw) rows = rows.filter(function(r){ return String(r['活動名稱']).indexOf(kw) >= 0 || String(r['活動地點']).indexOf(kw) >= 0 || String(r['講師']).indexOf(kw) >= 0; });
    var statusF = String(params.status || params['狀態'] || '').trim();
    if (statusF) rows = rows.filter(function(r){ return String(r['狀態']) === statusF; });
    var dateFrom = String(params.dateFrom || '').trim();
    var dateTo = String(params.dateTo || '').trim();
    if (dateFrom) rows = rows.filter(function(r){ return String(r['活動日期']) >= dateFrom; });
    if (dateTo) rows = rows.filter(function(r){ return String(r['活動日期']) <= dateTo; });
    var incArch = String(params.includeArchived || '').toLowerCase() === 'true';
    if (!incArch) rows = rows.filter(function(r){ return String(r['狀態'] || '') !== '封存'; });
    var clean = rows.map(function(r){ var o = {}; Object.keys(r).forEach(function(k){ if (k !== '_row') o[k] = r[k]; }); return o; });
    var pg = govopsPaginate_(clean, params);
    return { success: true, data: pg.rows, total: pg.total, limit: pg.limit, offset: pg.offset, hasMore: pg.hasMore, message: '場次查詢完成，共 ' + pg.total + ' 筆（本頁 ' + pg.rows.length + ' 筆）', timestamp: govopsNow_() };
  }

  // createSession: 新增場次（寫入擴充欄位）
  if (action === 'createSession') {
    var sname = params['場次名稱'] || params['活動名稱'] || params.name;
    if (!sname) return { success: false, error: 'MISSING_REQUIRED', message: '場次名稱為必填', timestamp: govopsNow_() };
    var scaseId = params['caseId'] || params['專案ID'] || '';
    if (!scaseId) return { success: false, error: 'MISSING_REQUIRED', message: '案件ID（caseId）為必填', timestamp: govopsNow_() };
    // 取得案件名稱（自動帶入）
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var caseRow = null;
    for (var i = 0; i < caseRows.length; i++) { if (caseRows[i]['專案ID'] === scaseId) { caseRow = caseRows[i]; break; } }
    var sobj = {
      '活動ID': govopsId_('SES'),
      '專案ID': scaseId,
      '專案計畫名稱': caseRow ? caseRow['專案計畫名稱'] : (params['案件名稱'] || ''),
      '活動名稱': sname,
      '活動日期': params['場次日期'] || params['活動日期'] || '',
      '活動類型': params['場次類型'] || params['活動類型'] || '課程',
      '開始時間': params['開始時間'] || '',
      '結束時間': params['結束時間'] || '',
      '活動地點': params['活動地點'] || params['場次地點'] || '',
      '講師': params['講師'] || '',
      '聯絡電話': params['聯絡電話'] || '',
      '聯絡人': params['聯絡人'] || '',
      '工作人員': params['工作人員'] || '',
      '狀態': params['狀態'] || params['場次狀態'] || '規劃中',
      '備註': params['備註'] || '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_(),
      // v0.1 擴充欄位
      '報名截止日': params['報名截止日'] || '',
      '預計人數': params['預計人數'] || '',
      '實際人數': '',
      '是否需簽到表': params['是否需簽到表'] || '',
      '是否需簽退表': params['是否需簽退表'] || '',
      '是否需便當': params['是否需便當'] || '',
      '是否需保險': params['是否需保險'] || '',
      '是否需問卷': params['是否需問卷'] || '',
      '是否需成果照片': params['是否需成果照片'] || '',
      '是否需講師領據': params['是否需講師領據'] || '',
      '是否需工作人員': params['是否需工作人員'] || '',
      'CalendarEventID': '',
      'CalendarLink': '',
      '已同步日曆': '否',
      '日曆同步狀態': '',
      '變更狀態': ''
    };
    sobj['tenantId']   = params._tenantId || '';
    sobj['workspaceId'] = params._workspaceId || '';
    sobj['createdBy']  = params._userId || '';
    govopsAppend_('02_場次活動', SESSION_HEADERS, sobj);
    govopsCacheInvalidate_('02_場次活動');
    return { success: true, data: { sessionId: sobj['活動ID'], caseId: scaseId, row: sobj }, message: '場次已新增', timestamp: govopsNow_() };
  }

  // updateSession: 更新場次（接受新舊欄位名稱）
  if (action === 'updateSession') {
    var sesId = params['sessionId'] || params['活動ID'];
    if (!sesId) return { success: false, error: 'MISSING_ID', message: '缺少場次ID（sessionId）', timestamp: govopsNow_() };
    var allSes = govopsRows_('02_場次活動', SESSION_HEADERS);
    var foundSes = null;
    for (var i = 0; i < allSes.length; i++) { if (allSes[i]['活動ID'] === sesId) { foundSes = allSes[i]; break; } }
    if (!foundSes) return { success: false, error: 'NOT_FOUND', message: '找不到場次：' + sesId, timestamp: govopsNow_() };
    if (params._tenantId && String(foundSes['tenantId']||'') && String(foundSes['tenantId']||'') !== params._tenantId) return { success:false, error:'FORBIDDEN', message:'無權限修改此場次', timestamp:govopsNow_() };
    var sesPatch = { '更新時間': govopsNow_() };
    var sesAllowedOld = ['活動名稱','活動類型','活動日期','開始時間','結束時間','活動地點','講師','聯絡電話','聯絡人','工作人員','狀態','備註'];
    var sesAllowedNew = ['報名截止日','預計人數','實際人數','是否需簽到表','是否需簽退表','是否需便當','是否需保險','是否需問卷','是否需成果照片','是否需講師領據','是否需工作人員','CalendarEventID','CalendarLink','已同步日曆','日曆同步狀態','變更狀態'];
    sesAllowedOld.concat(sesAllowedNew).forEach(function(f){ if (params[f] !== undefined && params[f] !== '') sesPatch[f] = params[f]; });
    // 接受新式名稱
    if (params['場次名稱']) sesPatch['活動名稱'] = params['場次名稱'];
    if (params['場次類型']) sesPatch['活動類型'] = params['場次類型'];
    if (params['場次日期']) sesPatch['活動日期'] = params['場次日期'];
    if (params['場次狀態']) sesPatch['狀態'] = params['場次狀態'];
    if (params['場次地點']) sesPatch['活動地點'] = params['場次地點'];
    govopsUpdate_('02_場次活動', SESSION_HEADERS, foundSes._row, sesPatch);
    govopsCacheInvalidate_('02_場次活動');
    return { success: true, data: { sessionId: sesId, updated: sesPatch }, message: '場次已更新', timestamp: govopsNow_() };
  }

  // archiveSession: 封存場次
  if (action === 'archiveSession') {
    var sesId = params['sessionId'] || params['活動ID'];
    if (!sesId) return { success: false, error: 'MISSING_ID', message: '缺少場次ID（sessionId）', timestamp: govopsNow_() };
    var allSes = govopsRows_('02_場次活動', SESSION_HEADERS);
    var foundSes = null;
    for (var i = 0; i < allSes.length; i++) { if (allSes[i]['活動ID'] === sesId) { foundSes = allSes[i]; break; } }
    if (!foundSes) return { success: false, error: 'NOT_FOUND', message: '找不到場次：' + sesId, timestamp: govopsNow_() };
    if (params._tenantId && String(foundSes['tenantId']||'') && String(foundSes['tenantId']||'') !== params._tenantId) return { success:false, error:'FORBIDDEN', message:'無權限封存此場次', timestamp:govopsNow_() };
    govopsUpdate_('02_場次活動', SESSION_HEADERS, foundSes._row, { '狀態': '封存', '更新時間': govopsNow_() });
    govopsCacheInvalidate_('02_場次活動');
    return { success: true, data: { sessionId: sesId, status: '封存' }, message: '場次已封存', timestamp: govopsNow_() };
  }

  // getSessionStats: 場次統計（供 cases.html 顯示場次數量）
  if (action === 'getSessionStats') {
    var caseIdF = String(params.caseId || params['專案ID'] || '').trim();
    var allSes = govopsRows_('02_場次活動', SESSION_HEADERS);
    if (caseIdF) allSes = allSes.filter(function(r){ return String(r['專案ID']) === caseIdF; });
    var sesStats = {};
    var sesStatusList = ['規劃中','確認中','執行中','已完成','取消','封存'];
    sesStatusList.forEach(function(s){ sesStats[s] = 0; });
    allSes.forEach(function(r){
      var s = String(r['狀態'] || '').trim();
      if (sesStats[s] !== undefined) sesStats[s]++;
    });
    return { success: true, data: { byStatus: sesStats, total: allSes.length, caseId: caseIdF }, message: '場次統計完成', timestamp: govopsNow_() };
  }
  // ── End Session API v0.1 ───────────────────────────────────

  return null;
}

function govopsEnrollmentRoute_(params, action) {
  if (action === '初始化招生報名系統') {
    govopsEnsureSheet_('招生活動管理', CAMPAIGN_HEADERS);
    govopsEnsureSheet_('報名資料庫', REG_HEADERS);
    govopsEnsureSheet_('學員CRM', CRM_HEADERS);
    govopsEnsureSheet_('簽到表', ATT_HEADERS);
    govopsEnsureSheet_('簽到表紀錄', ATT_LOG_HEADERS);
    return { success: true, message: '招生／報名／CRM／簽到系統初始化完成' };
  }
  if (action === '查詢招生活動') {
    var c = govopsFilter_(govopsRows_('招生活動管理', CAMPAIGN_HEADERS), params);
    return { success: true, message: '招生活動查詢完成', data: { rows: c, 資料: c, count: c.length } };
  }
  if (action === '新增招生活動' || action === '招生設定') {
    var title = params['課程名稱'] || params.courseName || params['活動名稱'];
    if (!title) return { success: false, message: '請填寫課程名稱' };
    // 去重檢查：同一 課程名稱 + 活動ID（或專案ID）不允許重複建立
    var existList = govopsRows_('招生活動管理', CAMPAIGN_HEADERS);
    var actIdChk = String(params['活動ID'] || '').trim();
    var projIdChk = String(params['專案ID'] || '').trim();
    var dup = null;
    for (var di = 0; di < existList.length; di++) {
      var e = existList[di];
      var titleMatch = String(e['課程名稱']).trim() === title.trim();
      var actMatch = actIdChk ? String(e['活動ID']).trim() === actIdChk : true;
      var projMatch = projIdChk ? String(e['專案ID']).trim() === projIdChk : true;
      if (titleMatch && actMatch && projMatch) { dup = e; break; }
    }
    if (dup) return { success: false, message: '此招生活動已存在，請勿重複建立', data: { 招生活動ID: dup['招生活動ID'], existing: dup } };
    var obj = {'招生活動ID': params['招生活動ID'] || govopsId_('ENR'),'專案ID': params['專案ID'] || '','活動ID': params['活動ID'] || '','課程名稱': title,'招生狀態': params['招生狀態'] || '招生中','報名開始日': params['報名開始日'] || '','報名截止日': params['報名截止日'] || '','開課日期': params['開課日期'] || '','招生名額': params['招生名額'] || '','候補名額': params['候補名額'] || '','報名連結': params['報名連結'] || '','招生渠道': params['招生渠道'] || '','主辦單位': params['主辦單位'] || '','聯絡人': params['聯絡人'] || '','聯絡電話': params['聯絡電話'] || '','備註': params['備註'] || '','建立時間': govopsNow_(),'更新時間': govopsNow_()};
    govopsAppend_('招生活動管理', CAMPAIGN_HEADERS, obj);
    return { success: true, message: '招生活動已新增', data: { 招生活動ID: obj['招生活動ID'], row: obj } };
  }
  if (action === '修改招生活動') {
    var id = params['招生活動ID'];
    if (!id) return { success: false, message: '招生活動ID必填' };
    var rows = govopsRows_('招生活動管理', CAMPAIGN_HEADERS);
    var found = rows.find(function(r){ return r['招生活動ID'] === id; });
    if (!found) return { success: false, message: '找不到招生活動：' + id };
    var patch = { '更新時間': govopsNow_() };
    ['課程名稱','招生狀態','報名開始日','報名截止日','開課日期','招生名額','候補名額','報名連結','招生渠道','主辦單位','聯絡人','聯絡電話','備註'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
    govopsUpdate_('招生活動管理', CAMPAIGN_HEADERS, found._row, patch);
    return { success: true, message: '招生活動已更新', data: { 招生活動ID: id } };
  }
  if (action === '查詢報名資料庫' || action === '學員名冊') {
    var r = govopsFilter_(govopsRows_('報名資料庫', REG_HEADERS), params);
    return { success: true, message: '報名資料庫查詢完成', data: { rows: r, 資料: r, count: r.length } };
  }
  if (action === '查詢學員CRM' || action === '學員資料庫') {
    var crm = govopsFilter_(govopsRows_('學員CRM', CRM_HEADERS), params);
    return { success: true, message: '學員CRM查詢完成', data: { rows: crm, 學員: crm, count: crm.length } };
  }
  if (action === '查詢簽到表' || action === '出席統計') {
    var att = govopsFilter_(govopsRows_('簽到表', ATT_HEADERS), params);
    return { success: true, message: '簽到表查詢完成', data: { rows: att, 簽到表: att, count: att.length } };
  }
  if (action === '行銷名單') {
    var ml = govopsRows_('學員CRM', CRM_HEADERS).filter(function(r){ return String(r['行銷同意']) === '是'; });
    return { success: true, message: '行銷名單查詢完成', data: { rows: ml, count: ml.length } };
  }
  if (action === '回流學員分析') {
    var rs = govopsRows_('學員CRM', CRM_HEADERS).filter(function(r){ return Number(r['累積報名次數'] || 0) > 1; });
    return { success: true, message: '回流學員分析完成', data: { rows: rs, count: rs.length } };
  }
  if (action === '新增報名') {
    var regName = params['姓名'] || '';
    var regPhone = params['電話'] || '';
    var camId = params['招生活動ID'] || '';
    if (!regName || !regPhone) return { success: false, message: '姓名和電話必填' };
    if (!camId) return { success: false, message: '招生活動ID必填' };
    // 去重：同一招生活動已有此電話
    var dupReg = govopsRows_('報名資料庫', REG_HEADERS).find(function(r){ return r['招生活動ID'] === camId && String(r['電話']).trim() === regPhone; });
    if (dupReg) return { success: false, message: '此電話已在本招生活動中報名（報名ID：'+dupReg['報名ID']+'）', data: { 報名ID: dupReg['報名ID'] } };
    var crmRows = govopsRows_('學員CRM', CRM_HEADERS);
    var existCrm = crmRows.find(function(r){ return String(r['電話']) === regPhone || (params['Email'] && params['Email'] === String(r['Email'])); });
    var crmId;
    if (existCrm) {
      crmId = existCrm['CRM_ID'];
      govopsUpdate_('學員CRM', CRM_HEADERS, existCrm._row, { '更新時間': govopsNow_(), '最近參與活動': camId, '累積報名次數': (parseInt(existCrm['累積報名次數'] || 0) + 1) });
    } else {
      crmId = govopsId_('CRM');
      var newCrm = { 'CRM_ID': crmId, '姓名': regName, '電話': regPhone, 'Email': params['Email'] || '', '服務單位': params['服務單位'] || '', '身分別': params['身分別'] || '', '標籤': '', '最近參與活動': camId, '累積報名次數': 1, '累積出席次數': 0, '累積完訓次數': 0, '是否回流學員': '否', '行銷同意': '', '備註': '', '建立時間': govopsNow_(), '更新時間': govopsNow_() };
      govopsAppend_('學員CRM', CRM_HEADERS, newCrm);
    }
    var regObj = { '報名ID': govopsId_('REG'), '招生活動ID': camId, '活動ID': params['活動ID'] || '', '姓名': regName, '電話': regPhone, 'Email': params['Email'] || '', '身分別': params['身分別'] || '', '服務單位': params['服務單位'] || '', '用餐習慣': params['用餐習慣'] || '', '報名狀態': '待審查', '審核狀態': '待審查', '出席狀態': '', '完訓狀態': '', '報名來源': params['報名來源'] || '系統', '報名時間': govopsNow_(), '通知狀態': '', '備註': params['備註'] || '', 'CRM_ID': crmId, '建立時間': govopsNow_(), '更新時間': govopsNow_() };
    govopsAppend_('報名資料庫', REG_HEADERS, regObj);
    return { success: true, message: '報名新增完成，進入待審查', data: { 報名ID: regObj['報名ID'], CRM_ID: crmId, 審核狀態: '待審查' } };
  }
  if (action === '產出簽到表') {
    var attCamId = params['招生活動ID'] || '';
    if (!attCamId) return { success: false, message: '招生活動ID必填' };
    var _approved = ['核准','已入選','已確認參加'];
    var approvedRegs = govopsRows_('報名資料庫', REG_HEADERS).filter(function(r){ return r['招生活動ID'] === attCamId && (_approved.indexOf(String(r['審核狀態'])) >= 0 || _approved.indexOf(String(r['報名狀態'])) >= 0); });
    var existingAtt = govopsRows_('簽到表', ATT_HEADERS);
    var created = 0;
    approvedRegs.forEach(function(reg){
      var dup = existingAtt.find(function(a){ return a['報名ID'] === reg['報名ID']; });
      if (!dup) {
        var attObj = { '簽到ID': govopsId_('ATT'), '招生活動ID': attCamId, '活動ID': reg['活動ID'] || '', '報名ID': reg['報名ID'], 'CRM_ID': reg['CRM_ID'] || '', '姓名': reg['姓名'], '電話': reg['電話'], 'Email': reg['Email'] || '', '服務單位': reg['服務單位'] || '', '簽到狀態': '未到', '簽到時間': '', '簽名連結': '', '備註': '', '建立時間': govopsNow_(), '更新時間': govopsNow_() };
        govopsAppend_('簽到表', ATT_HEADERS, attObj);
        created++;
      }
    });
    return { success: true, message: '簽到表產出完成，新增 ' + created + ' 筆', data: { created: created, total: approvedRegs.length } };
  }

  // ── 刪除與清空 Actions ────────────────────────────────────
  // 刪除單筆招生活動
  if (action === '刪除招生活動' || action === 'deleteCampaign') {
    var id = params['招生活動ID'] || params.campaignId;
    if (!id) return { success: false, message: '缺少招生活動ID', timestamp: govopsNow_() };
    var rows = govopsRows_('招生活動管理', CAMPAIGN_HEADERS);
    var found = rows.find(function(r){ return r['招生活動ID'] === id; });
    if (!found) return { success: false, message: '找不到招生活動：' + id, timestamp: govopsNow_() };
    govopsDeleteRow_('招生活動管理', found._row);
    return { success: true, message: '招生活動已刪除', data: { 招生活動ID: id }, timestamp: govopsNow_() };
  }

  // 刪除單筆報名資料
  if (action === '刪除報名' || action === 'deleteRegistration') {
    var id = params['報名ID'] || params.regId;
    if (!id) return { success: false, message: '缺少報名ID', timestamp: govopsNow_() };
    var rows = govopsRows_('報名資料庫', REG_EXT_HEADERS);
    var found = rows.find(function(r){ return r['報名ID'] === id; });
    if (!found) return { success: false, message: '找不到報名資料：' + id, timestamp: govopsNow_() };
    govopsDeleteRow_('報名資料庫', found._row);
    return { success: true, message: '報名資料已刪除', data: { 報名ID: id }, timestamp: govopsNow_() };
  }

  // 刪除單筆學員 CRM
  if (action === '刪除學員' || action === 'deleteCrm') {
    var id = params['CRM_ID'] || params.crmId;
    if (!id) return { success: false, message: '缺少CRM_ID', timestamp: govopsNow_() };
    var rows = govopsRows_('學員CRM', CRM_HEADERS);
    var found = rows.find(function(r){ return r['CRM_ID'] === id; });
    if (!found) return { success: false, message: '找不到學員：' + id, timestamp: govopsNow_() };
    govopsDeleteRow_('學員CRM', found._row);
    return { success: true, message: '學員已刪除', data: { CRM_ID: id }, timestamp: govopsNow_() };
  }

  // 清空指定 sheet（保留表頭）
  if (action === 'clearSheetData') {
    var allowed = ['招生活動管理','報名資料庫','學員CRM','財務收支','結案檢核','簽到表','簽到表紀錄'];
    var sheetName = params.sheetName || params['表格名稱'];
    if (!sheetName || allowed.indexOf(sheetName) < 0) return { success: false, message: '不允許清空：' + (sheetName||'(未指定)'), timestamp: govopsNow_() };
    var cleared = govopsClearSheet_(sheetName);
    return { success: true, message: sheetName + ' 已清空，共刪除 ' + cleared + ' 列', data: { sheet: sheetName, clearedRows: cleared }, timestamp: govopsNow_() };
  }

  // 清空全部報名相關資料（招生活動 + 報名資料庫 + 學員CRM）
  if (action === 'clearAllEnrollmentData') {
    var results = {};
    ['招生活動管理','報名資料庫','學員CRM','簽到表','簽到表紀錄'].forEach(function(s){ results[s] = govopsClearSheet_(s); });
    return { success: true, message: '全部報名相關資料已清空', data: results, timestamp: govopsNow_() };
  }

  // 去重工具：找出並刪除招生活動重複列（保留最早一筆）
  if (action === 'deduplicateCampaigns') {
    var rows = govopsRows_('招生活動管理', CAMPAIGN_HEADERS);
    var seen = {};
    var deleted = 0;
    // 從最後一列往前刪（避免 row number 偏移）
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      var key = String(r['課程名稱']).trim() + '|' + String(r['活動ID']).trim() + '|' + String(r['專案ID']).trim();
      if (seen[key]) {
        govopsDeleteRow_('招生活動管理', r._row);
        deleted++;
      } else {
        seen[key] = true;
      }
    }
    return { success: true, message: '去重完成，刪除 ' + deleted + ' 筆重複招生活動', data: { deleted: deleted }, timestamp: govopsNow_() };
  }
  // ── End 刪除與清空 ─────────────────────────────────────────

  // ── Registration API v0.1 ─────────────────────────────────
  // getRegistrations: 多條件查詢報名資料
  if (action === 'getRegistrations') {
    var rows = govopsRowsCached_('報名資料庫', REG_EXT_HEADERS);
    var _tid = String(params._tenantId || '');
    if (_tid) rows = rows.filter(function(r){ return String(r['tenantId']||'') === _tid; });
    var sessionIdF = String(params.sessionId || params['活動ID'] || '').trim();
    var caseIdF = String(params.caseId || params['案件ID'] || '').trim();
    var statusF = String(params.status || params['審核狀態'] || '').trim();
    var reviewF = String(params.reviewStatus || params['資格審查狀態'] || '').trim();
    var kw = String(params.keyword || params.q || '').trim();
    if (sessionIdF) rows = rows.filter(function(r){ return String(r['活動ID']) === sessionIdF; });
    if (caseIdF) rows = rows.filter(function(r){ return String(r['案件ID']) === caseIdF || String(r['招生活動ID']) === caseIdF; });
    if (statusF) rows = rows.filter(function(r){ return String(r['審核狀態']) === statusF; });
    if (reviewF) rows = rows.filter(function(r){ return String(r['資格審查狀態']) === reviewF; });
    if (kw) rows = rows.filter(function(r){ return String(r['姓名']).indexOf(kw) >= 0 || String(r['電話']).indexOf(kw) >= 0 || String(r['Email']).indexOf(kw) >= 0 || String(r['服務單位']).indexOf(kw) >= 0; });
    var clean = rows.map(function(r){ var o = {}; Object.keys(r).forEach(function(k){ if (k !== '_row') o[k] = r[k]; }); return o; });
    var pg = govopsPaginate_(clean, params);
    return { success: true, data: pg.rows, total: pg.total, limit: pg.limit, offset: pg.offset, hasMore: pg.hasMore, message: '報名查詢完成，共 ' + pg.total + ' 筆（本頁 ' + pg.rows.length + ' 筆）', timestamp: govopsNow_() };
  }

  // createRegistration: 手動新增報名
  if (action === 'createRegistration') {
    var rname = params['姓名'] || params.name;
    if (!rname) return { success: false, error: 'MISSING_REQUIRED', message: '姓名為必填', timestamp: govopsNow_() };
    if (!params['電話'] && !params['Email']) return { success: false, error: 'MISSING_REQUIRED', message: '電話或 Email 至少填一項', timestamp: govopsNow_() };
    var robj = {
      '報名ID': govopsId_('REG'),
      '招生活動ID': params['招生活動ID'] || params['sessionId'] || params['活動ID'] || '',
      '活動ID': params['sessionId'] || params['活動ID'] || '',
      '姓名': rname,
      '電話': params['電話'] || '',
      'Email': params['Email'] || '',
      '身分別': params['身分別'] || '',
      '服務單位': params['服務單位'] || '',
      '用餐習慣': params['用餐習慣'] || '',
      '報名狀態': params['報名狀態'] || '已報名',
      '審核狀態': params['審核狀態'] || '待審核',
      '出席狀態': '',
      '完訓狀態': '',
      '報名來源': params['報名來源'] || '手動新增',
      '報名時間': govopsNow_(),
      '通知狀態': '未通知',
      '備註': params['備註'] || '',
      'CRM_ID': '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_(),
      // v0.1 擴充欄位
      '案件ID': params['caseId'] || params['案件ID'] || '',
      '性別': params['性別'] || '',
      '出生日期': params['出生日期'] || '',
      '身分證字號': params['身分證字號'] || '',
      '地址': params['地址'] || '',
      '職稱': params['職稱'] || '',
      '資格審查狀態': params['資格審查狀態'] || '待審查',
      '審查結果': '',
      '補件項目': '',
      '補件期限': '',
      '通知日期': '',
      '錄取狀態': params['錄取狀態'] || '',
      '匯入批次ID': params['匯入批次ID'] || ''
    };
    robj['tenantId']    = params._tenantId || '';
    robj['workspaceId'] = params._workspaceId || '';
    govopsAppend_('報名資料庫', REG_EXT_HEADERS, robj);
    govopsCacheInvalidate_('報名資料庫');
    return { success: true, data: { regId: robj['報名ID'], row: robj }, message: '報名已新增', timestamp: govopsNow_() };
  }

  // updateRegistrationStatus: 更新單筆報名狀態（審查/錄取/通知）
  if (action === 'updateRegistrationStatus') {
    var regId = params['regId'] || params['報名ID'];
    if (!regId) return { success: false, error: 'MISSING_ID', message: '缺少報名ID（regId）', timestamp: govopsNow_() };
    var allRegs = govopsRows_('報名資料庫', REG_EXT_HEADERS);
    var foundReg = null;
    for (var i = 0; i < allRegs.length; i++) { if (allRegs[i]['報名ID'] === regId) { foundReg = allRegs[i]; break; } }
    if (!foundReg) return { success: false, error: 'NOT_FOUND', message: '找不到報名資料：' + regId, timestamp: govopsNow_() };
    if (params._tenantId && String(foundReg['tenantId']||'') && String(foundReg['tenantId']||'') !== params._tenantId) return { success:false, error:'FORBIDDEN', message:'無權限修改此報名資料', timestamp:govopsNow_() };
    var regPatch = { '更新時間': govopsNow_() };
    var regUpdatable = ['審核狀態','報名狀態','資格審查狀態','審查結果','補件項目','補件期限','錄取狀態','出席狀態','完訓狀態','通知狀態','通知日期','備註','用餐習慣','身分別','服務單位','職稱'];
    regUpdatable.forEach(function(f){ if (params[f] !== undefined && params[f] !== '') regPatch[f] = params[f]; });
    govopsUpdate_('報名資料庫', REG_EXT_HEADERS, foundReg._row, regPatch);
    govopsCacheInvalidate_('報名資料庫');
    return { success: true, data: { regId: regId, updated: regPatch }, message: '報名狀態已更新', timestamp: govopsNow_() };
  }

  // batchUpdateStatus: 批次更新多筆報名狀態
  if (action === 'batchUpdateStatus') {
    var regIdsRaw = String(params.regIds || params['報名IDs'] || '');
    var targetStatus = params['status'] || params['審核狀態'] || params['資格審查狀態'];
    var statusField = params['statusField'] || '審核狀態';
    if (!regIdsRaw || !targetStatus) return { success: false, error: 'MISSING_PARAM', message: 'regIds 和 status 為必填', timestamp: govopsNow_() };
    var regIds = regIdsRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    var allRegs = govopsRows_('報名資料庫', REG_EXT_HEADERS);
    var updated = 0;
    allRegs.forEach(function(r){
      if (regIds.indexOf(r['報名ID']) >= 0) {
        var patch = { '更新時間': govopsNow_() };
        patch[statusField] = targetStatus;
        govopsUpdate_('報名資料庫', REG_EXT_HEADERS, r._row, patch);
        updated++;
      }
    });
    govopsCacheInvalidate_('報名資料庫');
    return { success: true, data: { updated: updated, total: regIds.length }, message: '批次更新完成：' + updated + ' 筆', timestamp: govopsNow_() };
  }

  // getRegistrationStats: 統計各狀態數量
  if (action === 'getRegistrationStats') {
    var caseIdF = String(params.caseId || '').trim();
    var sessionIdF = String(params.sessionId || '').trim();
    var allRegs = govopsRows_('報名資料庫', REG_EXT_HEADERS);
    if (caseIdF) allRegs = allRegs.filter(function(r){ return String(r['案件ID']) === caseIdF || String(r['招生活動ID']) === caseIdF; });
    if (sessionIdF) allRegs = allRegs.filter(function(r){ return String(r['活動ID']) === sessionIdF; });
    var reviewStats = {};
    ['待審查','符合資格','不符合資格','需補件','已錄取','備取','未錄取','取消報名'].forEach(function(s){ reviewStats[s] = 0; });
    allRegs.forEach(function(r){ var s = String(r['資格審查狀態'] || '待審查').trim(); if (reviewStats[s] !== undefined) reviewStats[s]++; });
    var admitCount = reviewStats['已錄取'] || 0;
    var pendingCount = (reviewStats['待審查'] || 0) + (reviewStats['需補件'] || 0);
    return { success: true, data: { byReviewStatus: reviewStats, total: allRegs.length, admitted: admitCount, pending: pendingCount }, message: '報名統計完成', timestamp: govopsNow_() };
  }
  // ── End Registration API v0.1 ─────────────────────────────

  return null;
}

var COURSE_MODULES = {
  '課程執行紀錄': ['紀錄ID','活動ID','課程名稱','執行日期','執行狀態','講師','地點','人數','異常狀況','處理紀錄','備註','建立時間','更新時間'],
  '場地設備確認': ['確認ID','活動ID','場地名稱','設備項目','確認狀態','負責人','確認時間','缺漏事項','處理狀態','備註','建立時間','更新時間'],
  '教材與物資準備': ['物資ID','活動ID','項目名稱','類型','數量','單位','準備狀態','負責人','完成時間','備註','建立時間','更新時間'],
  '領據管理': ['領據ID','活動ID','對象類型','對象名稱','金額','身分證/統編','銀行','帳號','戶名','領據狀態','付款狀態','備註','建立時間','更新時間'],
  '核銷文件管理': ['核銷文件ID','活動ID','文件類型','文件名稱','金額','文件狀態','缺件說明','Drive連結','負責人','備註','建立時間','更新時間'],
  '當日工作任務表': ['任務ID','活動ID','任務名稱','任務區域','負責人','開始時間','完成時間','狀態','優先度','備註','建立時間','更新時間'],
  '當日注意事項': ['注意事項ID','活動ID','注意事項','類型','提醒對象','重要性','狀態','備註','建立時間','更新時間'],
  '報到處任務': ['報到任務ID','活動ID','任務名稱','負責人','所需物品','狀態','異常紀錄','備註','建立時間','更新時間'],
  '餐點管理': ['餐點ID','活動ID','餐點類型','廠商','數量','葷素','送達時間','確認狀態','費用','備註','建立時間','更新時間'],
  '物品清單': ['物品ID','活動ID','物品名稱','數量','單位','保管人','攜出狀態','回收狀態','備註','建立時間','更新時間'],
  '現場聯絡人': ['聯絡人ID','活動ID','姓名','角色','電話','Email','單位','備註','建立時間','更新時間'],
  '現場照片紀錄': ['照片ID','活動ID','照片類型','照片說明','Drive連結','拍攝者','拍攝時間','核銷可用','備註','建立時間','更新時間'],
  '課後回收檢核': ['檢核ID','活動ID','檢核項目','檢核狀態','負責人','完成時間','異常說明','備註','建立時間','更新時間']
};
function govopsCourseSheetName_(params) { return params['模組'] || params.module || params['表單類型'] || '課程執行紀錄'; }
function govopsCourseOpsRoute_(params, action) {
  if (action === '初始化課程執行系統') {
    Object.keys(COURSE_MODULES).forEach(function(name){ govopsEnsureSheet_(name, COURSE_MODULES[name]); });
    return { success: true, message: '課程執行現場管理系統初始化完成' };
  }
  if (action === '查詢課程執行資料') {
    var name = govopsCourseSheetName_(params);
    var headers = COURSE_MODULES[name] || COURSE_MODULES['課程執行紀錄'];
    var rows = govopsFilter_(govopsRows_(name, headers), params);
    return { success: true, message: '查詢完成：' + name, data: { rows: rows, 資料: rows, count: rows.length } };
  }
  return null;
}

function govopsProductionRoute_(params, action) {
  if (action === '正式平台初始化') {
    // 核心 Sheets（v0.1 擴充版）
    govopsEnsureSheet_('01_專案主檔', CASE_HEADERS);
    govopsEnsureSheet_('02_場次活動', SESSION_HEADERS);
    govopsEnsureSheet_('23_合作廠商主檔', VENDOR_HEADERS);
    // 報名系統
    govopsEnrollmentRoute_(params, '初始化招生報名系統');
    // 課程執行
    govopsCourseOpsRoute_(params, '初始化課程執行系統');
    // v0.1 新增 Sheets
    govopsEnsureSheet_('報名資料庫', REG_EXT_HEADERS);
    govopsEnsureSheet_('財務收支', FINANCE_HEADERS);
    govopsEnsureSheet_('結案檢核', CLOSING_CHECK_HEADERS);
    govopsEnsureSheet_('28_報名審查紀錄', ['審查ID','報名ID','招生活動ID','審查結果','審查原因','審查人','審查時間','建立時間']);
    govopsEnsureSheet_('29_通知紀錄', ['通知ID','招生活動ID','報名ID','姓名','電話','LINE_ID','通知類型','通知內容','發送狀態','發送時間','建立時間']);
    return { success: true, message: '正式平台初始化完成（v0.1）', data: { sheets: ['01_專案主檔','02_場次活動','報名資料庫','財務收支','結案檢核'] } };
  }
  if (action === '正式平台健康檢查') {
    return { success: true, message: '正式平台健康檢查完成', data: { status: 'ready', checkedAt: govopsNow_() } };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// 開課前SOP 路由
// ════════════════════════════════════════════════════════
var SOP_HEADERS = ['SOP_ID','活動ID','活動名稱','開課日期','階段','D_天數','類別','任務名稱','說明','負責類型','完成狀態','完成時間','完成人員','備註','建立時間','更新時間'];

var SOP_TEMPLATE = [
  {d:15, cat:'講師', task:'確認教材設備－設備', desc:'電腦設備、簡報筆、麥克風、延長線'},
  {d:15, cat:'講師', task:'確認教材設備－教材', desc:'壁報紙、彩色筆、便利貼、白板筆、工具'},
  {d:15, cat:'講師', task:'確認交通方式及開課時間', desc:'是否有接駁問題'},
  {d:15, cat:'講師', task:'確認課程講義／課本', desc:'自印講義需預留印刷時間'},
  {d:15, cat:'場地', task:'確認場地佈置物品', desc:'布條、海報'},
  {d:7,  cat:'場地', task:'確認上課時間', desc:'含開關門時間及負責人員'},
  {d:7,  cat:'場地', task:'確認教學設備', desc:'現場設備可用狀態'},
  {d:7,  cat:'場地', task:'確認停車管理方式', desc:''},
  {d:5,  cat:'長官', task:'確認主辦單位出席人員', desc:''},
  {d:5,  cat:'長官', task:'確認公司出席者', desc:''},
  {d:5,  cat:'學員', task:'發送開課通知', desc:'通知學員開課時間、地點、交通方式'},
  {d:5,  cat:'學員', task:'確認出席人數', desc:''},
  {d:5,  cat:'學員', task:'確認用餐習慣', desc:'視課程需求確認葷素'},
  {d:5,  cat:'學員', task:'確認學員交通方式', desc:''},
  {d:2,  cat:'物品', task:'準備教學設備', desc:''},
  {d:2,  cat:'物品', task:'準備教學材料／講義', desc:''},
  {d:2,  cat:'物品', task:'準備學員名牌', desc:''},
  {d:2,  cat:'物品', task:'準備簽到表與領料簽收單', desc:''},
  {d:2,  cat:'場地', task:'場地佈置', desc:'海報、布條、膠帶、剪刀、美工刀'},
  {d:2,  cat:'餐點', task:'確認素食類型', desc:'蛋奶素？還是全素？'},
  {d:2,  cat:'餐點', task:'確認長官及工作人員用餐', desc:''},
  {d:2,  cat:'餐點', task:'確認餐點數量（葷／素）', desc:''},
  {d:2,  cat:'餐點', task:'確認費用支付方式', desc:'現金或事後匯款，含帳號日期'},
  {d:2,  cat:'餐點', task:'跟店家說明發票／收據張數', desc:''}
];

function govopsSopRoute_(params, action) {
  if (action === '初始化SOP') {
    govopsEnsureSheet_('30_開課前SOP', SOP_HEADERS);
    return { success: true, message: '30_開課前SOP 初始化完成' };
  }
  if (action === '產生SOP作業清單') {
    var actId = params['活動ID'] || '';
    if (!actId) return { success: false, message: '活動ID必填' };
    var actRows = govopsRows_('02_場次活動', ACTIVITY_HEADERS);
    var act = actRows.find(function(r){ return r['活動ID'] === actId; });
    if (!act) return { success: false, message: '找不到活動：' + actId };
    var courseDate = act['活動日期'] || '';
    if (!courseDate) return { success: false, message: '此活動尚未設定活動日期' };

    // 確認是否已產生過
    var existing = govopsRows_('30_開課前SOP', SOP_HEADERS).filter(function(r){ return r['活動ID'] === actId; });
    if (existing.length > 0) return { success: false, message: '此活動已有 SOP 清單（共 '+existing.length+' 項），請改用「查詢SOP」', data: { rows: existing } };

    govopsEnsureSheet_('30_開課前SOP', SOP_HEADERS);
    var now = govopsNow_();
    SOP_TEMPLATE.forEach(function(t){
      var obj = {
        'SOP_ID': govopsId_('SOP'), '活動ID': actId, '活動名稱': act['活動名稱'] || '',
        '開課日期': courseDate, '階段': 'D-'+t.d, 'D_天數': t.d,
        '類別': t.cat, '任務名稱': t.task, '說明': t.desc,
        '負責類型': t.cat, '完成狀態': '待辦', '完成時間': '', '完成人員': '', '備註': '',
        '建立時間': now, '更新時間': now
      };
      govopsAppend_('30_開課前SOP', SOP_HEADERS, obj);
    });
    return { success: true, message: '已產生 '+SOP_TEMPLATE.length+' 項開課前SOP作業（活動：'+act['活動名稱']+'）', data: { count: SOP_TEMPLATE.length, 活動名稱: act['活動名稱'], 開課日期: courseDate } };
  }
  if (action === '查詢SOP') {
    var actId = params['活動ID'] || '';
    if (!actId) return { success: false, message: '活動ID必填' };
    var rows = govopsRows_('30_開課前SOP', SOP_HEADERS).filter(function(r){ return r['活動ID'] === actId; });
    return { success: true, message: 'SOP查詢完成，共 '+rows.length+' 項', data: { rows: rows, count: rows.length } };
  }
  if (action === '更新SOP完成狀態') {
    var sopId = params['SOP_ID'] || '';
    if (!sopId) return { success: false, message: 'SOP_ID必填' };
    var rows = govopsRows_('30_開課前SOP', SOP_HEADERS);
    var found = rows.find(function(r){ return r['SOP_ID'] === sopId; });
    if (!found) return { success: false, message: '找不到SOP項目：' + sopId };
    var status = params['完成狀態'] || '已完成';
    var patch = { '完成狀態': status, '更新時間': govopsNow_() };
    if (status === '已完成') { patch['完成時間'] = govopsNow_(); patch['完成人員'] = params['完成人員'] || ''; }
    if (params['備註']) patch['備註'] = params['備註'];
    govopsUpdate_('30_開課前SOP', SOP_HEADERS, found._row, patch);
    return { success: true, message: '已更新：' + found['任務名稱'] + ' → ' + status, data: { SOP_ID: sopId, 完成狀態: status } };
  }
  if (action === '批次完成SOP') {
    var ids = String(params['SOP_IDs'] || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    if (!ids.length) return { success: false, message: 'SOP_IDs必填（逗號分隔）' };
    var rows = govopsRows_('30_開課前SOP', SOP_HEADERS);
    var done = 0;
    rows.forEach(function(r){
      if (ids.indexOf(r['SOP_ID']) >= 0) {
        govopsUpdate_('30_開課前SOP', SOP_HEADERS, r._row, { '完成狀態': '已完成', '完成時間': govopsNow_(), '完成人員': params['完成人員'] || '', '更新時間': govopsNow_() });
        done++;
      }
    });
    return { success: true, message: '批次完成 '+done+' 項', data: { done: done } };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// 標案池路由
// ════════════════════════════════════════════════════════
var TENDER_HEADERS = ['標案ID','機關名稱','標案案號','標案名稱','採購性質','招標方式','預算金額','押標金','截止投標日','開標日期','履約期間','評選方式','標案網址','狀態','投標決策','分析備註','得標金額','得標日期','備註','建立時間','更新時間'];

function govopsTenderRoute_(params, action) {
  if (action === '初始化標案池') {
    govopsEnsureSheet_('31_標案池', TENDER_HEADERS);
    return { success: true, message: '31_標案池 初始化完成' };
  }
  if (action === '新增標案') {
    var name = params['標案名稱'] || '';
    var org  = params['機關名稱'] || '';
    if (!name || !org) return { success: false, message: '機關名稱和標案名稱必填' };
    govopsEnsureSheet_('31_標案池', TENDER_HEADERS);
    var obj = {
      '標案ID': govopsId_('TDR'),
      '機關名稱': org,
      '標案案號': params['標案案號'] || '',
      '標案名稱': name,
      '採購性質': params['採購性質'] || '勞務',
      '招標方式': params['招標方式'] || '最有利標',
      '預算金額': params['預算金額'] || '',
      '押標金': params['押標金'] || '',
      '截止投標日': params['截止投標日'] || '',
      '開標日期': params['開標日期'] || '',
      '履約期間': params['履約期間'] || '',
      '評選方式': params['評選方式'] || '',
      '標案網址': params['標案網址'] || '',
      '狀態': params['狀態'] || '新增',
      '投標決策': '',
      '分析備註': params['分析備註'] || '',
      '得標金額': '',
      '得標日期': '',
      '備註': params['備註'] || '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_()
    };
    govopsAppend_('31_標案池', TENDER_HEADERS, obj);
    return { success: true, message: '標案已新增至標案池', data: { 標案ID: obj['標案ID'], 標案名稱: name } };
  }
  if (action === '查詢標案池') {
    govopsEnsureSheet_('31_標案池', TENDER_HEADERS);
    var rows = govopsFilter_(govopsRows_('31_標案池', TENDER_HEADERS), params);
    var status = params['狀態'] || '';
    if (status) rows = rows.filter(function(r){ return String(r['狀態'] || '') === status; });
    rows.sort(function(a, b){ return String(b['建立時間'] || '') > String(a['建立時間'] || '') ? 1 : -1; });
    return { success: true, message: '標案池查詢完成，共 ' + rows.length + ' 筆', data: { rows: rows, count: rows.length } };
  }
  if (action === '更新標案狀態') {
    var id = params['標案ID'];
    if (!id) return { success: false, message: '標案ID必填' };
    var rows = govopsRows_('31_標案池', TENDER_HEADERS);
    var found = rows.find(function(r){ return r['標案ID'] === id; });
    if (!found) return { success: false, message: '找不到標案：' + id };
    var patch = { '狀態': params['狀態'] || found['狀態'], '更新時間': govopsNow_() };
    ['投標決策','分析備註','得標金額','得標日期','備註','預算金額','截止投標日'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
    govopsUpdate_('31_標案池', TENDER_HEADERS, found._row, patch);
    return { success: true, message: '標案狀態已更新：' + patch['狀態'], data: { 標案ID: id } };
  }
  if (action === '查詢採購公告') {
    // 嘗試從政府採購網取得標案基本資料
    var caseNo = params['標案案號'] || '';
    if (!caseNo) return { success: false, message: '標案案號必填' };
    try {
      var url = 'https://web.pcc.gov.tw/tps/pss/tender.do?action=search&searchMode=common&searchType=basic&tenderCaseNo=' + encodeURIComponent(caseNo) + '&pageIndex=1';
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      var html = resp.getContentText('UTF-8');
      // 嘗試解析基本欄位
      function extractField(pattern) {
        var m = html.match(pattern);
        return m ? m[1].trim() : '';
      }
      var orgName   = extractField(/機關名稱[^<]*<[^>]+>([^<]{3,40})</);
      var caseName  = extractField(/標案名稱[^<]*<[^>]+>([^<]{5,100})</);
      var budget    = extractField(/預算金額[^<]*<[^>]+>([0-9,]+)/);
      var deadline  = extractField(/截止(?:投標)?(?:日期)?[^<]*<[^>]+>(\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
      if (caseName || orgName) {
        return { success: true, message: '採購公告解析完成', data: { row: { '機關名稱': orgName, '標案案號': caseNo, '標案名稱': caseName, '預算金額': budget.replace(/,/g,''), '截止投標日': deadline } } };
      }
      return { success: false, message: '無法從採購網解析此案號，請手動填寫' };
    } catch(e) {
      return { success: false, message: '採購網查詢失敗：' + e.message };
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════
// Document Generator Route v0.1
// 產生：簽到表資料、錄取名冊、便當統計、地址標籤、人力清單
// ════════════════════════════════════════════════════════
function govopsDocumentRoute_(params, action) {

  // generateAttendanceList: 產生簽到表資料（從報名資料庫篩出已錄取名單）
  if (action === 'generateAttendanceList') {
    var sessionId = params.sessionId || params['活動ID'];
    if (!sessionId) return { success: false, error: 'MISSING_PARAM', message: '缺少 sessionId', timestamp: govopsNow_() };
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){
      return String(r['活動ID']) === sessionId && ['已錄取','備取','符合資格'].indexOf(String(r['資格審查狀態'])) >= 0;
    });
    var list = regs.map(function(r, i){
      return { 序號: i + 1, 姓名: r['姓名'], 服務單位: r['服務單位'] || '', 職稱: r['職稱'] || '', 電話: r['電話'] || '', 用餐: r['用餐習慣'] || '', 簽到: '', 簽退: '', 備註: r['備註'] || '' };
    });
    return { success: true, data: { list: list, count: list.length, sessionId: sessionId }, message: '簽到表資料產生完成，共 ' + list.length + ' 人', timestamp: govopsNow_() };
  }

  // generateAdmissionList: 產生錄取名冊（已錄取+備取）
  if (action === 'generateAdmissionList') {
    var sessionId = params.sessionId || params['活動ID'];
    var caseId = params.caseId || params['案件ID'];
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){
      var sesMatch = sessionId ? String(r['活動ID']) === sessionId : true;
      var caseMatch = caseId ? (String(r['案件ID']) === caseId || String(r['招生活動ID']) === caseId) : true;
      var admitted = ['已錄取','備取'].indexOf(String(r['資格審查狀態'])) >= 0 || ['已錄取','備取'].indexOf(String(r['錄取狀態'])) >= 0;
      return sesMatch && caseMatch && admitted;
    });
    var list = regs.map(function(r, i){
      var type = (String(r['資格審查狀態']) === '備取' || String(r['錄取狀態']) === '備取') ? '備取' : '正取';
      return { 序號: i + 1, 姓名: r['姓名'], 性別: r['性別'] || '', 服務單位: r['服務單位'] || '', 身分別: r['身分別'] || '', 電話: r['電話'] || '', Email: r['Email'] || '', 錄取別: type, 備註: r['備註'] || '' };
    });
    return { success: true, data: { list: list, count: list.length }, message: '錄取名冊產生完成，共 ' + list.length + ' 人', timestamp: govopsNow_() };
  }

  // generateMealCount: 便當統計表
  if (action === 'generateMealCount') {
    var sessionId = params.sessionId || params['活動ID'];
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){
      var sesMatch = sessionId ? String(r['活動ID']) === sessionId : true;
      return sesMatch && ['已錄取','備取','符合資格'].indexOf(String(r['資格審查狀態'])) >= 0;
    });
    var counts = {};
    regs.forEach(function(r){
      var meal = String(r['用餐習慣'] || '未填').trim();
      counts[meal] = (counts[meal] || 0) + 1;
    });
    var list = Object.keys(counts).map(function(k){ return { 用餐習慣: k, 人數: counts[k] }; });
    return { success: true, data: { summary: counts, list: list, total: regs.length }, message: '便當統計完成', timestamp: govopsNow_() };
  }

  // generateAddressLabels: 地址標籤資料
  if (action === 'generateAddressLabels') {
    var sessionId = params.sessionId || params['活動ID'];
    var caseId = params.caseId || params['案件ID'];
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){
      var sesMatch = sessionId ? String(r['活動ID']) === sessionId : true;
      var caseMatch = caseId ? (String(r['案件ID']) === caseId || String(r['招生活動ID']) === caseId) : true;
      return sesMatch && caseMatch && r['地址'];
    });
    var list = regs.map(function(r){ return { 姓名: r['姓名'], 地址: r['地址'] || '', 電話: r['電話'] || '', 郵遞區號: '' }; });
    return { success: true, data: { list: list, count: list.length }, message: '地址標籤資料產生完成', timestamp: govopsNow_() };
  }

  // getDocumentableData: 取得可產文件的彙整資料（for documents.html）
  if (action === 'getDocumentableData') {
    var sessionId = params.sessionId || '';
    var caseId = params.caseId || '';
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS);
    var filtered = regs.filter(function(r){
      var sm = sessionId ? String(r['活動ID']) === sessionId : true;
      var cm = caseId ? (String(r['案件ID']) === caseId || String(r['招生活動ID']) === caseId) : true;
      return sm && cm;
    });
    var total = filtered.length;
    var admitted = filtered.filter(function(r){ return ['已錄取','備取'].indexOf(String(r['資格審查狀態'])) >= 0 || ['已錄取','備取'].indexOf(String(r['錄取狀態'])) >= 0; }).length;
    var withAddr = filtered.filter(function(r){ return !!r['地址']; }).length;
    var needMeal = filtered.filter(function(r){ return r['用餐習慣'] && r['用餐習慣'] !== '不需要'; }).length;
    // Manpower counts
    var staffCount = 0, lecCount = 0;
    try {
      var staffRows = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS);
      var sf = sessionId ? staffRows.filter(function(r){ return String(r['場次ID'])===sessionId; }) : staffRows.filter(function(r){ return String(r['案件ID'])===caseId; });
      staffCount = sf.filter(function(r){ return r['審核狀態']==='已錄取'; }).length;
    } catch(e) {}
    // Session info for 講師
    var sesInfo = null;
    if (sessionId) {
      var sesRows = govopsRows_('02_場次活動', SESSION_HEADERS);
      sesInfo = sesRows.filter(function(r){ return String(r['活動ID'])===sessionId; })[0] || null;
      if (sesInfo) lecCount = sesInfo['講師'] ? 1 : 0;
    }
    // Tasks for work checklist
    var taskCount = 0;
    try { taskCount = govopsRows_('案件任務清單', TASK_HEADERS).filter(function(r){ return caseId ? String(r['案件ID'])===caseId : true; }).length; } catch(e) {}
    // Budget items
    var budgetCount = 0;
    try { budgetCount = govopsRows_('案件預算明細', BUDGET_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; }).length; } catch(e) {}
    return { success: true, data: {
      total: total, admitted: admitted, withAddress: withAddr, needMeal: needMeal,
      staffCount: staffCount, lecCount: lecCount, taskCount: taskCount, budgetCount: budgetCount,
      sessionInfo: sesInfo ? { 活動名稱: sesInfo['活動名稱'], 活動日期: sesInfo['活動日期'], 活動地點: sesInfo['活動地點'], 開始時間: sesInfo['開始時間'], 結束時間: sesInfo['結束時間'], 講師: sesInfo['講師'], 工作人員: sesInfo['工作人員'] } : null
    }, message: '文件資料彙整完成', timestamp: govopsNow_() };
  }

  // generateLecturerReceipt: 講師鐘點費領據資料
  if (action === 'generateLecturerReceipt') {
    var sessionId = params.sessionId || params['活動ID'];
    if (!sessionId) return { success: false, error: 'MISSING_PARAM', message: '缺少 sessionId', timestamp: govopsNow_() };
    var sesRows = govopsRows_('02_場次活動', SESSION_HEADERS);
    var ses = sesRows.filter(function(r){ return String(r['活動ID'])===sessionId; })[0];
    if (!ses) return { success: false, error: 'NOT_FOUND', message: '找不到場次', timestamp: govopsNow_() };
    // Get case info for 承辦單位
    var caseId = ses['專案ID'] || params.caseId || '';
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var caseInfo = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    // Get lecturer info from 講師資料 or from manpower
    var lecName = ses['講師'] || '';
    var hours = parseFloat(params.hours) || 0;
    var hourlyRate = parseFloat(params.hourlyRate) || 0;
    var amount = Math.round(hours * hourlyRate);
    // Try to find lecturer in resource master
    var lecInfo = {};
    try {
      var lecRows = govopsRows_('18_講師資料', ['講師ID','姓名','電話','Email','身分證字號','出生日期','地址','銀行','帳號','戶名','備註']);
      var found = lecRows.filter(function(r){ return String(r['姓名'])===lecName; })[0];
      if (found) lecInfo = found;
    } catch(e) {}
    var receipt = {
      承辦單位名稱: caseInfo['主辦單位'] || params.orgName || '',
      計畫名稱: caseInfo['專案計畫名稱'] || ses['專案計畫名稱'] || '',
      場次名稱: ses['活動名稱'] || '',
      場次日期: ses['活動日期'] || '',
      上課時間: (ses['開始時間']||'') + (ses['結束時間']?' ~ '+ses['結束時間']:''),
      領款人: lecName,
      身份證字號: lecInfo['身分證字號'] || params.idNumber || '',
      出生年月日: lecInfo['出生日期'] || params.birthDate || '',
      戶籍地址: lecInfo['地址'] || params.address || '',
      扣繳憑單地址: lecInfo['地址'] || params.address || '',
      小時數: hours || '',
      時薪: hourlyRate || '',
      金額: amount || (parseFloat(params.amount)||0),
      銀行名稱: lecInfo['銀行'] || params.bank || '',
      戶名: lecInfo['戶名'] || params.accountName || lecName,
      銀行帳號: lecInfo['帳號'] || params.account || '',
      費用類型: '講師鐘點費'
    };
    return { success: true, data: receipt, message: '講師領據資料產生完成', timestamp: govopsNow_() };
  }

  // generateStaffReceipts: 工作人員領據資料（批次，一次產所有已錄取人員）
  if (action === 'generateStaffReceipts') {
    var sessionId = params.sessionId || params['活動ID'];
    var needId = params.needId || '';
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    govopsEnsureSheet_('支援人員工時', MPOWER_HOURS_HEADERS);
    var staffRows = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS);
    var hoursRows = govopsRows_('支援人員工時', MPOWER_HOURS_HEADERS);
    var filtered = staffRows.filter(function(r){
      if (r['審核狀態'] !== '已錄取') return false;
      if (sessionId && String(r['場次ID']) !== sessionId) return false;
      if (needId && String(r['需求ID']) !== needId) return false;
      return true;
    });
    var caseId = params.caseId || (filtered[0] ? filtered[0]['案件ID'] : '');
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var caseInfo = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    var receipts = filtered.map(function(s) {
      var myHours = hoursRows.filter(function(h){ return h['人員ID']===s['人員ID'] && h['工作狀態']==='已確認'; });
      var totalHours = myHours.reduce(function(sum,h){ return sum+(parseFloat(h['工時'])||0); }, 0);
      var hourlyRate = parseFloat(params.hourlyRate) || 190;
      var amount = Math.round(totalHours * hourlyRate);
      return {
        承辦單位名稱: caseInfo['主辦單位'] || params.orgName || '',
        計畫名稱: caseInfo['專案計畫名稱'] || '',
        領款人: s['姓名'] || '',
        身份證字號: s['身分證'] || '',
        出生年月日: '',
        戶籍地址: '',
        身分別: s['身分別'] || '工作人員',
        小時數: totalHours,
        時薪: hourlyRate,
        金額: amount,
        銀行名稱: s['銀行'] || '',
        戶名: s['戶名'] || s['姓名'] || '',
        銀行帳號: s['帳號'] || '',
        費用類型: '工作人員鐘點費'
      };
    });
    return { success: true, data: { receipts: receipts, count: receipts.length }, message: '工作人員領據資料產生完成，共 '+receipts.length+' 筆', timestamp: govopsNow_() };
  }

  // generateWorkChecklist: 工作檢核表（從結案檢核 + 任務清單）
  if (action === 'generateWorkChecklist') {
    var caseId = params.caseId || '';
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    govopsEnsureSheet_('結案檢核', CLOSING_CHECK_HEADERS);
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var checks = govopsRows_('結案檢核', CLOSING_CHECK_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    var tasks = govopsRows_('案件任務清單', TASK_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    return { success: true, data: { checks: checks, tasks: tasks, checkCount: checks.length, taskCount: tasks.length }, message: '工作檢核表資料產生完成', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Budget Route — 案件預算明細（核銷依據）
// 每個案件的標價清單項目不同，由使用者逐案建立
// ════════════════════════════════════════════════════════
var BUDGET_HEADERS = ['預算ID','案件ID','項目編號','支出項目','單位','數量','單價','場次數','預算金額','實際支出','核銷狀態','憑證連結','備註','建立時間','更新時間'];

function govopsBudgetRoute_(params, action) {

  if (action === 'getBudgetItems') {
    govopsEnsureSheet_('案件預算明細', BUDGET_HEADERS);
    var rows = govopsRows_('案件預算明細', BUDGET_HEADERS);
    if (params.caseId) rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    // 計算合計
    var totalBudget = rows.reduce(function(s,r){ return s+(parseFloat(r['預算金額'])||0); }, 0);
    var totalActual = rows.reduce(function(s,r){ return s+(parseFloat(r['實際支出'])||0); }, 0);
    return { success: true, data: { rows: rows, count: rows.length, totalBudget: totalBudget, totalActual: totalActual, balance: totalBudget-totalActual }, message: '預算明細查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createBudgetItem') {
    if (!params.caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    govopsEnsureSheet_('案件預算明細', BUDGET_HEADERS);
    var rows = govopsRows_('案件預算明細', BUDGET_HEADERS);
    var num = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; }).length + 1;
    var qty = parseFloat(params.quantity)||1, price = parseFloat(params.unitPrice)||0, ses = parseFloat(params.sessions)||1;
    var amount = qty * price * ses;
    var now = govopsNow_();
    var obj = {
      '預算ID': govopsId_('BDG'), '案件ID': params.caseId,
      '項目編號': num, '支出項目': params.itemName || '',
      '單位': params.unit || '式', '數量': qty, '單價': price, '場次數': ses,
      '預算金額': amount, '實際支出': 0, '核銷狀態': '未核銷',
      '憑證連結': '', '備註': params.remark || '',
      '建立時間': now, '更新時間': now
    };
    govopsAppend_('案件預算明細', BUDGET_HEADERS, obj);
    return { success: true, data: obj, message: '預算項目已新增', timestamp: now };
  }

  if (action === 'updateBudgetItem') {
    var id = params.budgetId;
    if (!id) return { success: false, error: 'MISSING_PARAM', message: '缺少 budgetId', timestamp: govopsNow_() };
    govopsEnsureSheet_('案件預算明細', BUDGET_HEADERS);
    var rows = govopsRows_('案件預算明細', BUDGET_HEADERS);
    var found = null; for(var i=0;i<rows.length;i++){if(rows[i]['預算ID']===id){found=rows[i];break;}}
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到預算項目', timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['支出項目','單位','數量','單價','場次數','預算金額','實際支出','核銷狀態','憑證連結','備註'].forEach(function(k){ if(params[k]!==undefined) patch[k]=params[k]; });
    // 重算金額
    var q = parseFloat(patch['數量']||found['數量']||1);
    var p2 = parseFloat(patch['單價']||found['單價']||0);
    var s2 = parseFloat(patch['場次數']||found['場次數']||1);
    if (patch['數量']||patch['單價']||patch['場次數']) patch['預算金額'] = q*p2*s2;
    govopsUpdate_('案件預算明細', BUDGET_HEADERS, found._row, patch);
    return { success: true, data: patch, message: '預算項目已更新', timestamp: patch['更新時間'] };
  }

  if (action === 'deleteBudgetItem') {
    var id = params.budgetId;
    govopsEnsureSheet_('案件預算明細', BUDGET_HEADERS);
    var rows = govopsRows_('案件預算明細', BUDGET_HEADERS);
    var found = null; for(var i=0;i<rows.length;i++){if(rows[i]['預算ID']===id){found=rows[i];break;}}
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到預算項目', timestamp: govopsNow_() };
    govopsDeleteRow_('案件預算明細', found._row);
    return { success: true, data: { budgetId: id }, message: '預算項目已刪除', timestamp: govopsNow_() };
  }

  if (action === 'generateReimbursementList') {
    // 核銷清單：預算項目 + 實際財務支出對比
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    govopsEnsureSheet_('案件預算明細', BUDGET_HEADERS);
    govopsEnsureSheet_('財務收支', FINANCE_HEADERS);
    var budgets = govopsRows_('案件預算明細', BUDGET_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    var expenses = govopsRows_('財務收支', FINANCE_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId && r['類型']==='支出'; });
    var totalBudget = budgets.reduce(function(s,r){ return s+(parseFloat(r['預算金額'])||0); }, 0);
    var totalActual = expenses.reduce(function(s,r){ return s+(parseFloat(r['金額'])||0); }, 0);
    // Get case info
    var caseInfo = govopsRows_('01_專案主檔', CASE_HEADERS).filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    return { success: true, data: {
      caseInfo: { 案件名稱: caseInfo['專案計畫名稱']||'', 主辦單位: caseInfo['主辦單位']||'', 執行期間: (caseInfo['開始日期']||'')+' ~ '+(caseInfo['結束日期']||'') },
      budgetItems: budgets, expenses: expenses,
      totalBudget: totalBudget, totalActual: totalActual, balance: totalBudget - totalActual
    }, message: '核銷清單產生完成', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Calendar Route v0.1 — Google Calendar 串接（追蹤+查詢）
// 真正寫 Calendar 事件需 OAuth，此路由負責：記錄同步狀態、
// 產生事件摘要供前端顯示，實際建立事件由前端 gapi 處理。
// ════════════════════════════════════════════════════════
var CAL_SYNC_HEADERS = ['同步ID','案件ID','場次ID','任務ID','事件類型','CalendarEventID','CalendarLink','同步狀態','同步時間','錯誤訊息','備註'];
function govopsCalendarRoute_(params, action) {

  // getCalendarItems: 取得需要同步的案件/場次事件清單
  if (action === 'getCalendarItems') {
    var caseId = params.caseId || '';
    var cases = govopsRows_('01_專案主檔', CASE_HEADERS);
    var sessions = govopsRows_('02_場次活動', SESSION_HEADERS);
    if (caseId) {
      cases = cases.filter(function(r){ return r['專案ID'] === caseId; });
      sessions = sessions.filter(function(r){ return r['專案ID'] === caseId; });
    }
    var items = [];
    cases.forEach(function(c){
      if (c['開始日期']) items.push({ type:'案件開始', id:c['專案ID'], title:c['專案計畫名稱'], date:c['開始日期'], synced:c['Calendar連結']?'已同步':'未同步', link:c['Calendar連結']||'' });
      if (c['結案期限']) items.push({ type:'結案期限', id:c['專案ID'], title:'【結案】'+c['專案計畫名稱'], date:c['結案期限'], synced:c['Calendar連結']?'已同步':'未同步', link:'' });
    });
    sessions.forEach(function(s){
      if (s['活動日期']) items.push({ type:'場次', id:s['活動ID'], caseId:s['專案ID'], title:s['活動名稱'], date:s['活動日期'], time:s['開始時間']+' ~ '+s['結束時間'], location:s['活動地點']||'', synced:s['已同步日曆']||'否', link:s['CalendarLink']||'' });
    });
    return { success: true, data: items, message: '日曆事件清單完成，共 ' + items.length + ' 項', timestamp: govopsNow_() };
  }

  // updateCalendarSync: 回寫 Calendar 同步結果（前端 gapi 建完事件後呼叫）
  if (action === 'updateCalendarSync') {
    var itemId = params.itemId || '';
    var itemType = params.itemType || 'session';
    var eventId = params.CalendarEventID || params.calendarEventId || '';
    var eventLink = params.CalendarLink || params.calendarLink || '';
    if (!itemId || !eventId) return { success: false, error: 'MISSING_PARAM', message: 'itemId 和 CalendarEventID 為必填', timestamp: govopsNow_() };
    if (itemType === 'case' || itemType === '案件') {
      var allCases = govopsRows_('01_專案主檔', CASE_HEADERS);
      for (var i = 0; i < allCases.length; i++) {
        if (allCases[i]['專案ID'] === itemId) {
          govopsUpdate_('01_專案主檔', CASE_HEADERS, allCases[i]._row, { 'Calendar連結': eventLink, '更新時間': govopsNow_() });
          break;
        }
      }
    } else {
      var allSes = govopsRows_('02_場次活動', SESSION_HEADERS);
      for (var i = 0; i < allSes.length; i++) {
        if (allSes[i]['活動ID'] === itemId) {
          govopsUpdate_('02_場次活動', SESSION_HEADERS, allSes[i]._row, { 'CalendarEventID': eventId, 'CalendarLink': eventLink, '已同步日曆': '是', '日曆同步狀態': '已同步', '更新時間': govopsNow_() });
          break;
        }
      }
    }
    return { success: true, data: { itemId: itemId, eventId: eventId }, message: 'Calendar 同步狀態已更新', timestamp: govopsNow_() };
  }

  // getUpcomingSchedule: 取得近期行程（未來30天）供 dashboard 使用
  if (action === 'getUpcomingSchedule') {
    var days = parseInt(params.days || '30', 10);
    var now = new Date();
    var cutoff = new Date(now.getTime() + days * 86400000);
    var sessions = govopsRows_('02_場次活動', SESSION_HEADERS).filter(function(s){
      if (!s['活動日期'] || String(s['狀態']) === '封存' || String(s['狀態']) === '取消') return false;
      var d = new Date(String(s['活動日期']).replace(/\//g,'-'));
      return d >= now && d <= cutoff;
    });
    sessions.sort(function(a,b){ return String(a['活動日期']).localeCompare(String(b['活動日期'])); });
    var clean = sessions.slice(0,20).map(function(s){ return { 日期:s['活動日期'], 名稱:s['活動名稱'], 地點:s['活動地點']||'', 時間:s['開始時間']+' ~ '+s['結束時間'], 狀態:s['狀態'], 場次ID:s['活動ID'], 案件ID:s['專案ID'] }; });
    return { success: true, data: clean, message: '近期行程查詢完成，共 ' + clean.length + ' 筆', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Finance v1 Route — 擴充財務收支（v0.1 基礎）
// ════════════════════════════════════════════════════════
var FINANCE_HEADERS = ['收支ID','案件ID','場次ID','類型','科目','對象名稱','金額','付款方式','預計收付日','實際收付日','收付狀態','憑證連結','備註','建立時間','更新時間','tenantId','workspaceId'];
function govopsFinanceV1Route_(params, action) {
  if (action === 'getFinanceRecords') {
    var rows = govopsRowsCached_('財務收支', FINANCE_HEADERS);
    var _tid = String(params._tenantId || '');
    if (_tid) rows = rows.filter(function(r){ return String(r['tenantId']||'') === _tid; });
    var caseId = params.caseId || '';
    var type = params.type || '';
    var status = params.status || '';
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    if (type) rows = rows.filter(function(r){ return String(r['類型']) === type; });
    if (status) rows = rows.filter(function(r){ return String(r['收付狀態']) === status; });
    var clean = rows.map(function(r){ var o={}; Object.keys(r).forEach(function(k){if(k!=='_row')o[k]=r[k];}); return o; });
    var pg = govopsPaginate_(clean, params);
    return { success: true, data: pg.rows, total: pg.total, limit: pg.limit, offset: pg.offset, hasMore: pg.hasMore, message: '財務查詢完成，共 ' + pg.total + ' 筆（本頁 ' + pg.rows.length + ' 筆）', timestamp: govopsNow_() };
  }
  if (action === 'createFinanceRecord') {
    var amount = params['金額'] || params.amount;
    if (!amount) return { success: false, error: 'MISSING_REQUIRED', message: '金額為必填', timestamp: govopsNow_() };
    var obj = {
      '收支ID': govopsId_('FIN'),
      '案件ID': params.caseId || params['案件ID'] || '',
      '場次ID': params.sessionId || params['場次ID'] || '',
      '類型': params['類型'] || '支出',
      '科目': params['科目'] || '其他',
      '對象名稱': params['對象名稱'] || '',
      '金額': amount,
      '付款方式': params['付款方式'] || '匯款',
      '預計收付日': params['預計收付日'] || '',
      '實際收付日': params['實際收付日'] || '',
      '收付狀態': params['收付狀態'] || '未付款',
      '憑證連結': params['憑證連結'] || '',
      '備註': params['備註'] || '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_()
    };
    obj['tenantId']    = params._tenantId || '';
    obj['workspaceId'] = params._workspaceId || '';
    govopsAppend_('財務收支', FINANCE_HEADERS, obj);
    govopsCacheInvalidate_('財務收支');
    return { success: true, data: { finId: obj['收支ID'], row: obj }, message: '財務紀錄已新增', timestamp: govopsNow_() };
  }
  if (action === 'updateFinanceRecord') {
    var finId = params.finId || params['收支ID'];
    if (!finId) return { success: false, error: 'MISSING_ID', message: '缺少收支ID', timestamp: govopsNow_() };
    var rows = govopsRows_('財務收支', FINANCE_HEADERS);
    var found = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i]['收支ID'] === finId) { found = rows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到財務紀錄', timestamp: govopsNow_() };
    if (params._tenantId && String(found['tenantId']||'') && String(found['tenantId']||'') !== params._tenantId) return { success:false, error:'FORBIDDEN', message:'無權限修改此財務紀錄', timestamp:govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['類型','科目','對象名稱','金額','付款方式','預計收付日','實際收付日','收付狀態','憑證連結','備註'].forEach(function(f){ if (params[f] !== undefined && params[f] !== '') patch[f] = params[f]; });
    govopsUpdate_('財務收支', FINANCE_HEADERS, found._row, patch);
    govopsCacheInvalidate_('財務收支');
    return { success: true, data: { finId: finId, updated: patch }, message: '財務紀錄已更新', timestamp: govopsNow_() };
  }
  // ── 舊財務系統一鍵遷移 ─────────────────────────────────
  if (action === 'migrateOldFinanceData') {
    govopsEnsureSheet_('財務收支', FINANCE_HEADERS);
    var batchId = 'MIGRATE-' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHHmm');
    var now = govopsNow_();
    var created = 0;
    var skipped = 0;
    var existingNew = govopsRows_('財務收支', FINANCE_HEADERS);
    var existingBatchIds = existingNew.map(function(r){ return String(r['備註']); });

    // 1. 16_應收帳款 → 收入
    try {
      var arRows = govopsRows_('16_應收帳款', AR_HEADERS);
      arRows.forEach(function(r) {
        var marker = 'AR:' + String(r['應收ID'] || '');
        if (existingBatchIds.indexOf(marker) >= 0) { skipped++; return; }
        var obj = {
          '收支ID': govopsId_('FIN'), '案件ID': String(r['活動ID'] || ''),
          '場次ID': String(r['活動ID'] || ''), '類型': '收入',
          '科目': String(r['應收項目'] || '應收款'), '對象名稱': String(r['對象名稱'] || ''),
          '金額': parseFloat(String(r['應收金額']).replace(/,/g,'')) || 0,
          '付款方式': '匯款', '預計收付日': String(r['預計收款日'] || ''),
          '實際收付日': String(r['狀態'] === '已收款' ? r['預計收款日'] : ''),
          '收付狀態': String(r['狀態'] === '已收款' ? '已收款' : '未收款'),
          '憑證連結': '', '備註': marker, '建立時間': now, '更新時間': now
        };
        govopsAppend_('財務收支', FINANCE_HEADERS, obj);
        created++;
      });
    } catch(e) {}

    // 2. 18_支出明細 → 支出
    try {
      var expRows = govopsRows_('18_支出明細', EXP_HEADERS);
      expRows.forEach(function(r) {
        var marker = 'EXP:' + String(r['支出ID'] || '');
        if (existingBatchIds.indexOf(marker) >= 0) { skipped++; return; }
        var obj = {
          '收支ID': govopsId_('FIN'), '案件ID': String(r['活動ID'] || ''),
          '場次ID': String(r['活動ID'] || ''), '類型': '支出',
          '科目': String(r['支出類型'] || '其他支出'), '對象名稱': String(r['廠商'] || ''),
          '金額': parseFloat(String(r['支出金額']).replace(/,/g,'')) || 0,
          '付款方式': String(r['付款方式'] || '匯款'),
          '預計收付日': String(r['支出日期'] || ''), '實際收付日': String(r['支出日期'] || ''),
          '收付狀態': '已付款', '憑證連結': '',
          '備註': marker, '建立時間': now, '更新時間': now
        };
        govopsAppend_('財務收支', FINANCE_HEADERS, obj);
        created++;
      });
    } catch(e) {}

    govopsCacheInvalidate_('財務收支');
    return { success: true, data: { created: created, skipped: skipped, batchId: batchId }, message: '遷移完成，新增 ' + created + ' 筆（跳過重複 ' + skipped + ' 筆）', timestamp: govopsNow_() };
  }

  if (action === 'getFinanceSummary') {
    var caseId = params.caseId || '';
    // 新系統：財務收支
    var rows = govopsRows_('財務收支', FINANCE_HEADERS);
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    var income = 0, expense = 0, received = 0, paid = 0, pending = 0;
    rows.forEach(function(r){
      var amt = parseFloat(String(r['金額']).replace(/,/g,'')) || 0;
      var type = String(r['類型']);
      var status = String(r['收付狀態']);
      if (type === '收入') { income += amt; if (status === '已收款') received += amt; }
      if (type === '支出') { expense += amt; if (status === '已付款') paid += amt; }
      if (type === '收入' && status !== '已收款') pending += amt;
    });
    // 舊系統：合併 16_應收帳款 / 17_收款紀錄 / 18_支出明細（不按 caseId filter，舊系統無此欄）
    try {
      var arRows = govopsRows_('16_應收帳款', AR_HEADERS || []);
      var payRows = govopsRows_('17_收款紀錄', PAY_HEADERS || []);
      var expRows = govopsRows_('18_支出明細', EXP_HEADERS || []);
      arRows.forEach(function(r){ income += parseFloat(String(r['應收金額']).replace(/,/g,'')) || 0; });
      payRows.forEach(function(r){ received += parseFloat(String(r['收款金額']).replace(/,/g,'')) || 0; });
      expRows.forEach(function(r){ expense += parseFloat(String(r['支出金額']).replace(/,/g,'')) || 0; paid += parseFloat(String(r['支出金額']).replace(/,/g,'')) || 0; });
    } catch(e) {}
    pending = income - received;
    return { success: true, data: { totalIncome: income, totalExpense: expense, received: received, paid: paid, pendingReceivable: pending > 0 ? pending : 0, profit: received - paid, note: '含舊財務系統資料' }, message: '財務摘要完成', timestamp: govopsNow_() };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// Closing Route v0.1 — 結案檢核與成果報告
// ════════════════════════════════════════════════════════
var CLOSING_CHECK_HEADERS = ['檢核ID','案件ID','檢核項目','檢核類別','是否必要','完成狀態','完成日期','負責人','備註','建立時間','更新時間'];
var DEFAULT_CLOSING_ITEMS = [
  ['合約與公文','最終契約書','法務',true],
  ['合約與公文','計畫書（原版）','行政',true],
  ['執行紀錄','所有場次簽到表','行政',true],
  ['執行紀錄','所有場次照片','行政',true],
  ['執行紀錄','問卷回收','行政',false],
  ['財務核銷','所有講師領據','財務',true],
  ['財務核銷','工作人員簽收單','財務',true],
  ['財務核銷','核銷憑證清單','財務',true],
  ['財務核銷','請款文件','財務',true],
  ['成果報告','成果報告初稿','行政',true],
  ['成果報告','成果報告定稿','行政',true],
  ['其他','結案報告上傳系統','行政',false]
];

function govopsClosingRoute_(params, action) {
  if (action === 'initClosingChecklist') {
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    govopsEnsureSheet_('結案檢核', CLOSING_CHECK_HEADERS);
    var existing = govopsRows_('結案檢核', CLOSING_CHECK_HEADERS).filter(function(r){ return r['案件ID'] === caseId; });
    if (existing.length > 0) return { success: true, data: { count: existing.length }, message: '檢核清單已存在', timestamp: govopsNow_() };
    DEFAULT_CLOSING_ITEMS.forEach(function(item){
      var obj = { '檢核ID':govopsId_('CHK'), '案件ID':caseId, '檢核項目':item[1], '檢核類別':item[0], '是否必要':item[3]?'是':'否', '完成狀態':'待完成', '完成日期':'', '負責人':item[2], '備註':'', '建立時間':govopsNow_(), '更新時間':govopsNow_() };
      govopsAppend_('結案檢核', CLOSING_CHECK_HEADERS, obj);
    });
    return { success: true, data: { count: DEFAULT_CLOSING_ITEMS.length }, message: '結案檢核清單初始化完成', timestamp: govopsNow_() };
  }
  if (action === 'getClosingChecklist') {
    var caseId = params.caseId || '';
    govopsEnsureSheet_('結案檢核', CLOSING_CHECK_HEADERS);
    var rows = govopsRows_('結案檢核', CLOSING_CHECK_HEADERS);
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    var clean = rows.map(function(r){ var o={}; Object.keys(r).forEach(function(k){if(k!=='_row')o[k]=r[k];}); return o; });
    var done = clean.filter(function(r){ return r['完成狀態']==='已完成'; }).length;
    return { success: true, data: { list: clean, total: clean.length, done: done, remaining: clean.length - done }, message: '結案檢核清單查詢完成', timestamp: govopsNow_() };
  }
  if (action === 'updateClosingItem') {
    var itemId = params.itemId || params['檢核ID'];
    if (!itemId) return { success: false, error: 'MISSING_ID', message: '缺少檢核ID', timestamp: govopsNow_() };
    govopsEnsureSheet_('結案檢核', CLOSING_CHECK_HEADERS);
    var rows = govopsRows_('結案檢核', CLOSING_CHECK_HEADERS);
    var found = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i]['檢核ID'] === itemId) { found = rows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到檢核項目', timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    if (params['完成狀態']) patch['完成狀態'] = params['完成狀態'];
    if (params['完成日期']) patch['完成日期'] = params['完成日期'];
    if (params['備註']) patch['備註'] = params['備註'];
    if (params['負責人']) patch['負責人'] = params['負責人'];
    govopsUpdate_('結案檢核', CLOSING_CHECK_HEADERS, found._row, patch);
    return { success: true, data: { itemId: itemId }, message: '結案項目已更新', timestamp: govopsNow_() };
  }
  if (action === 'generateClosingSummary') {
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    // 彙整各模組資料
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS).filter(function(r){ return r['專案ID'] === caseId; });
    var caseData = caseRows[0] || {};
    var sessions = govopsRows_('02_場次活動', SESSION_HEADERS).filter(function(r){ return r['專案ID'] === caseId && r['狀態'] !== '封存'; });
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){ return r['案件ID'] === caseId; });
    var admitted = regs.filter(function(r){ return ['已錄取','備取'].indexOf(String(r['資格審查狀態'])) >= 0 || ['已錄取','備取'].indexOf(String(r['錄取狀態'])) >= 0; }).length;
    var finRows = [];
    try { finRows = govopsRows_('財務收支', FINANCE_HEADERS).filter(function(r){ return r['案件ID'] === caseId; }); } catch(e) {}
    var totalIncome = 0, totalExpense = 0;
    finRows.forEach(function(r){ var a = parseFloat(String(r['金額']).replace(/,/g,'')) || 0; if (r['類型']==='收入') totalIncome += a; else totalExpense += a; });
    var closing = [];
    try { closing = govopsRows_('結案檢核', CLOSING_CHECK_HEADERS).filter(function(r){ return r['案件ID'] === caseId; }); } catch(e) {}
    var closingDone = closing.filter(function(r){ return r['完成狀態']==='已完成'; }).length;
    return {
      success: true,
      data: {
        caseInfo: { 名稱: caseData['專案計畫名稱']||'', 類型: caseData['專案類型']||'', 客戶: caseData['主辦單位']||'', 期間: (caseData['開始日期']||'')+'~'+(caseData['結束日期']||'') },
        sessionCount: sessions.length,
        registrationCount: regs.length,
        admittedCount: admitted,
        finance: { income: totalIncome, expense: totalExpense, profit: totalIncome - totalExpense },
        closing: { total: closing.length, done: closingDone, remaining: closing.length - closingDone }
      },
      message: '結案摘要產生完成', timestamp: govopsNow_()
    };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// Task Route v0.1 — 任務管理
// ════════════════════════════════════════════════════════
var TASK_HEADERS = ['任務ID','案件ID','場次ID','任務名稱','任務類型','負責人','開始日期','截止日期','提醒日期','任務狀態','優先度','CalendarEventID','備註','建立時間','更新時間'];

// ════════════════════════════════════════════════════════
// Official Doc Route v0.1 — 收發公文管理
// ════════════════════════════════════════════════════════
var ODOC_HEADERS = ['公文ID','公文類型','案件ID','公文編號','主旨','發文單位','收文單位','承辦窗口','聯絡電話','來文日期','發文日期','辦理期限','是否需回覆','回覆期限','是否需補件','公文摘要','附件連結','處理狀態','負責人','備註','建立時間','更新時間','tenantId','workspaceId'];

function govopsOfficialDocRoute_(params, action) {
  if (action === 'getOfficialDocs') {
    govopsEnsureSheet_('收發公文', ODOC_HEADERS);
    var rows = govopsRowsCached_('收發公文', ODOC_HEADERS);
    var _tid = String(params._tenantId || '');
    if (_tid) rows = rows.filter(function(r){ return String(r['tenantId']||'') === _tid; });
    var caseId = String(params.caseId || '').trim();
    var type = String(params.type || params['公文類型'] || '').trim();
    var status = String(params.status || params['處理狀態'] || '').trim();
    var kw = String(params.keyword || '').trim();
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    if (type) rows = rows.filter(function(r){ return String(r['公文類型']) === type; });
    if (status) rows = rows.filter(function(r){ return String(r['處理狀態']) === status; });
    if (kw) rows = rows.filter(function(r){ return String(r['主旨']).indexOf(kw)>=0 || String(r['公文編號']).indexOf(kw)>=0 || String(r['發文單位']).indexOf(kw)>=0; });
    var clean = rows.map(function(r){ var o={}; Object.keys(r).forEach(function(k){ if(k!=='_row')o[k]=r[k]; }); return o; });
    var pg = govopsPaginate_(clean, params);
    return { success: true, data: pg.rows, total: pg.total, limit: pg.limit, offset: pg.offset, hasMore: pg.hasMore, message: '公文查詢完成，共 '+pg.total+' 筆（本頁 '+pg.rows.length+' 筆）', timestamp: govopsNow_() };
  }
  if (action === 'createOfficialDoc') {
    var subj = params['主旨'] || params.subject;
    if (!subj) return { success: false, error: 'MISSING_REQUIRED', message: '主旨為必填', timestamp: govopsNow_() };
    govopsEnsureSheet_('收發公文', ODOC_HEADERS);
    var obj = {
      '公文ID': govopsId_('DOC'),
      '公文類型': params['公文類型'] || '來文',
      '案件ID': params.caseId || params['案件ID'] || '',
      '公文編號': params['公文編號'] || '',
      '主旨': subj,
      '發文單位': params['發文單位'] || '',
      '收文單位': params['收文單位'] || '',
      '承辦窗口': params['承辦窗口'] || '',
      '聯絡電話': params['聯絡電話'] || '',
      '來文日期': params['來文日期'] || '',
      '發文日期': params['發文日期'] || '',
      '辦理期限': params['辦理期限'] || '',
      '是否需回覆': params['是否需回覆'] || '否',
      '回覆期限': params['回覆期限'] || '',
      '是否需補件': params['是否需補件'] || '否',
      '公文摘要': params['公文摘要'] || '',
      '附件連結': params['附件連結'] || '',
      '處理狀態': params['處理狀態'] || '未處理',
      '負責人': params['負責人'] || '',
      '備註': params['備註'] || '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_()
    };
    obj['tenantId']    = params._tenantId || '';
    obj['workspaceId'] = params._workspaceId || '';
    govopsAppend_('收發公文', ODOC_HEADERS, obj);
    govopsCacheInvalidate_('收發公文');
    return { success: true, data: { docId: obj['公文ID'], row: obj }, message: '公文已新增', timestamp: govopsNow_() };
  }
  if (action === 'updateOfficialDoc') {
    var docId = params.docId || params['公文ID'];
    if (!docId) return { success: false, error: 'MISSING_ID', message: '缺少公文ID', timestamp: govopsNow_() };
    govopsEnsureSheet_('收發公文', ODOC_HEADERS);
    var rows = govopsRows_('收發公文', ODOC_HEADERS);
    var found = null;
    for (var i=0;i<rows.length;i++){ if(rows[i]['公文ID']===docId){found=rows[i];break;} }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到公文：'+docId, timestamp: govopsNow_() };
    if (params._tenantId && String(found['tenantId']||'') && String(found['tenantId']||'') !== params._tenantId) return { success:false, error:'FORBIDDEN', message:'無權限修改此公文', timestamp:govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['公文類型','公文編號','主旨','發文單位','收文單位','承辦窗口','聯絡電話','來文日期','發文日期','辦理期限','是否需回覆','回覆期限','是否需補件','公文摘要','附件連結','處理狀態','負責人','備註'].forEach(function(f){ if(params[f]!==undefined&&params[f]!=='')patch[f]=params[f]; });
    govopsUpdate_('收發公文', ODOC_HEADERS, found._row, patch);
    govopsCacheInvalidate_('收發公文');
    return { success: true, data: { docId: docId, updated: patch }, message: '公文已更新', timestamp: govopsNow_() };
  }
  if (action === 'deleteOfficialDoc') {
    var docId = params.docId || params['公文ID'];
    if (!docId) return { success: false, error: 'MISSING_ID', message: '缺少公文ID', timestamp: govopsNow_() };
    govopsEnsureSheet_('收發公文', ODOC_HEADERS);
    var rows = govopsRows_('收發公文', ODOC_HEADERS);
    var found = null;
    for (var i=0;i<rows.length;i++){ if(rows[i]['公文ID']===docId){found=rows[i];break;} }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到公文：'+docId, timestamp: govopsNow_() };
    if (params._tenantId && String(found['tenantId']||'') && String(found['tenantId']||'') !== params._tenantId) return { success:false, error:'FORBIDDEN', message:'無權限刪除此公文', timestamp:govopsNow_() };
    govopsDeleteRow_('收發公文', found._row);
    govopsCacheInvalidate_('收發公文');
    return { success: true, data: { docId: docId }, message: '公文已刪除', timestamp: govopsNow_() };
  }
  if (action === 'getOfficialDocStats') {
    govopsEnsureSheet_('收發公文', ODOC_HEADERS);
    var rows = govopsRows_('收發公文', ODOC_HEADERS);
    var caseId = String(params.caseId || '').trim();
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    var byStatus = {'未處理':0,'處理中':0,'待回覆':0,'待補件':0,'已完成':0,'已歸檔':0};
    var overdueReply = 0;
    rows.forEach(function(r){
      var s = String(r['處理狀態']||'未處理');
      if (byStatus[s]!==undefined) byStatus[s]++;
      if (r['回覆期限'] && String(r['回覆期限'])<today && ['未處理','待回覆'].indexOf(s)>=0) overdueReply++;
    });
    var pending = (byStatus['未處理']||0)+(byStatus['待回覆']||0)+(byStatus['待補件']||0);
    return { success: true, data: { byStatus: byStatus, pending: pending, overdueReply: overdueReply, total: rows.length }, message: '公文統計完成', timestamp: govopsNow_() };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// Session SOP Tasks — 場次 SOP 任務自動產生
// ════════════════════════════════════════════════════════
function govopsTaskRoute_(params, action) {
  // getTasks: 查詢任務（支援多條件篩選）
  if (action === 'getTasks') {
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var rows = govopsRows_('案件任務清單', TASK_HEADERS);
    var caseId = String(params.caseId || '').trim();
    var sesId  = String(params.sessionId || '').trim();
    var status = String(params.status || '').trim();
    var kw     = String(params.keyword || '').trim();
    var overdue = String(params.overdue || '').toLowerCase() === 'true';
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    if (sesId)  rows = rows.filter(function(r){ return String(r['場次ID']) === sesId; });
    if (status) rows = rows.filter(function(r){ return String(r['任務狀態']) === status; });
    if (kw)     rows = rows.filter(function(r){ return String(r['任務名稱']).indexOf(kw) >= 0 || String(r['負責人']).indexOf(kw) >= 0; });
    if (overdue) {
      var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
      rows = rows.filter(function(r){ return r['截止日期'] && String(r['截止日期']) < today && ['待辦','進行中'].indexOf(String(r['任務狀態'])) >= 0; });
    }
    // 排除已取消/已完成（若無指定 status 篩選）
    var excludeStatuses = ['取消'];
    if (!status && !overdue) rows = rows.filter(function(r){ return excludeStatuses.indexOf(String(r['任務狀態'])) < 0; });
    var clean = rows.map(function(r){ var o={}; Object.keys(r).forEach(function(k){ if(k!=='_row') o[k]=r[k]; }); return o; });
    return { success: true, data: clean, message: '任務查詢完成，共 '+clean.length+' 筆', timestamp: govopsNow_() };
  }

  // createTask: 新增任務
  if (action === 'createTask') {
    var tname = params['任務名稱'] || params.name;
    if (!tname) return { success: false, error: 'MISSING_REQUIRED', message: '任務名稱為必填', timestamp: govopsNow_() };
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var obj = {
      '任務ID': govopsId_('TASK'),
      '案件ID': params.caseId || params['案件ID'] || '',
      '場次ID': params.sessionId || params['場次ID'] || '',
      '任務名稱': tname,
      '任務類型': params['任務類型'] || '一般',
      '負責人': params['負責人'] || '',
      '開始日期': params['開始日期'] || '',
      '截止日期': params['截止日期'] || '',
      '提醒日期': params['提醒日期'] || '',
      '任務狀態': params['任務狀態'] || '待辦',
      '優先度': params['優先度'] || '中',
      'CalendarEventID': '',
      '備註': params['備註'] || '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_()
    };
    govopsAppend_('案件任務清單', TASK_HEADERS, obj);
    return { success: true, data: { taskId: obj['任務ID'], row: obj }, message: '任務已建立', timestamp: govopsNow_() };
  }

  // updateTask: 更新任務（狀態、欄位）
  if (action === 'updateTask') {
    var taskId = params.taskId || params['任務ID'];
    if (!taskId) return { success: false, error: 'MISSING_ID', message: '缺少任務ID', timestamp: govopsNow_() };
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var rows = govopsRows_('案件任務清單', TASK_HEADERS);
    var found = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i]['任務ID'] === taskId) { found = rows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到任務：'+taskId, timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['任務名稱','任務類型','負責人','開始日期','截止日期','提醒日期','任務狀態','優先度','備註','CalendarEventID'].forEach(function(f){ if (params[f] !== undefined && params[f] !== '') patch[f] = params[f]; });
    govopsUpdate_('案件任務清單', TASK_HEADERS, found._row, patch);
    return { success: true, data: { taskId: taskId, updated: patch }, message: '任務已更新', timestamp: govopsNow_() };
  }

  // batchCompleteTask: 批次完成任務
  if (action === 'batchCompleteTask') {
    var taskIdsRaw = String(params.taskIds || '');
    if (!taskIdsRaw) return { success: false, error: 'MISSING_PARAM', message: '缺少 taskIds', timestamp: govopsNow_() };
    var taskIds = taskIdsRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean).slice(0, 100);
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var rows = govopsRows_('案件任務清單', TASK_HEADERS);
    var updated = 0;
    rows.forEach(function(r){
      if (taskIds.indexOf(r['任務ID']) >= 0) {
        govopsUpdate_('案件任務清單', TASK_HEADERS, r._row, { '任務狀態': params['status'] || '已完成', '更新時間': govopsNow_() });
        updated++;
      }
    });
    return { success: true, data: { updated: updated }, message: '批次更新完成：'+updated+' 筆', timestamp: govopsNow_() };
  }

  // getTaskStats: 任務統計（供 Dashboard 使用）
  if (action === 'getTaskStats') {
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var rows = govopsRows_('案件任務清單', TASK_HEADERS);
    var caseId = String(params.caseId || '').trim();
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    var tomorrow = Utilities.formatDate(new Date(new Date().getTime() + 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
    var byStatus = { '待辦': 0, '進行中': 0, '已完成': 0, '取消': 0 };
    var overdue = 0, dueToday = 0, dueSoon = 0;
    rows.forEach(function(r){
      var s = String(r['任務狀態'] || '待辦');
      if (byStatus[s] !== undefined) byStatus[s]++;
      var due = String(r['截止日期'] || '');
      if (due && ['待辦','進行中'].indexOf(s) >= 0) {
        if (due < today) overdue++;
        else if (due === today) dueToday++;
        else if (due <= new Date(new Date().getTime() + 7*86400000).toISOString().substring(0,10)) dueSoon++;
      }
    });
    var active = (byStatus['待辦'] || 0) + (byStatus['進行中'] || 0);
    return { success: true, data: { byStatus: byStatus, active: active, overdue: overdue, dueToday: dueToday, dueSoon: dueSoon, total: rows.length }, message: '任務統計完成', timestamp: govopsNow_() };
  }

  // generateSessionTasks: 根據場次自動產生 SOP 準備任務
  if (action === 'generateSessionTasks') {
    var sesId = params.sessionId || params['活動ID'];
    var caseId = params.caseId || params['案件ID'] || '';
    var sesDate = params.sessionDate || params['活動日期'] || '';
    var sesName = params.sessionName || params['場次名稱'] || params['活動名稱'] || '場次';
    if (!sesId) return { success: false, error: 'MISSING_PARAM', message: '缺少 sessionId', timestamp: govopsNow_() };
    // 若未傳入日期，從 Sheets 查詢場次資料
    if (!sesDate || !sesName || sesName === '場次') {
      var sesRows = govopsRows_('02_場次活動', SESSION_HEADERS);
      var sesRec = null;
      for (var si = 0; si < sesRows.length; si++) { if (sesRows[si]['活動ID'] === sesId) { sesRec = sesRows[si]; break; } }
      if (sesRec) {
        if (!sesDate) {
          var rawDate = sesRec['活動日期'];
          // Handle Sheets Date object (ISO string) or yyyy/MM/dd string
          if (rawDate instanceof Date) sesDate = Utilities.formatDate(rawDate, 'Asia/Taipei', 'yyyy-MM-dd');
          else sesDate = String(rawDate).replace(/\//g,'-').substring(0,10);
        }
        if (!sesName || sesName === '場次') sesName = sesRec['活動名稱'] || sesId;
        if (!caseId) caseId = sesRec['專案ID'] || '';
      }
    }
    // 計算各任務截止日（相對於場次日期）
    function addDays(baseDate, days) {
      if (!baseDate) return '';
      try {
        var d = new Date(String(baseDate).replace(/\//g,'-'));
        d.setDate(d.getDate() + days);
        return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
      } catch(e) { return ''; }
    }
    var SOPTemplates = [
      { name:'確認場地與設備', type:'場次準備', pri:'高', offset:-14, note:'確認投影機、麥克風、冷氣、桌椅等設備' },
      { name:'確認講師與教材', type:'場次準備', pri:'高', offset:-14, note:'確認講師出席、投影片、教材準備狀況' },
      { name:'寄發邀請/報名通知', type:'場次準備', pri:'高', offset:-10, note:'發送課程通知至報名學員或潛在學員' },
      { name:'完成報名審查', type:'場次準備', pri:'中', offset:-7, note:'審查所有報名資料，確認錄取名單' },
      { name:'發送錄取通知', type:'場次準備', pri:'高', offset:-7, note:'通知已錄取學員，附上課程資訊和地點' },
      { name:'準備簽到表與名冊', type:'場次準備', pri:'中', offset:-3, note:'列印簽到表、學員名冊、保險名冊' },
      { name:'訂便當/確認餐食', type:'場次準備', pri:'中', offset:-3, note:'確認葷素份數，聯絡餐飲廠商' },
      { name:'確認工作人員分工', type:'場次準備', pri:'中', offset:-2, note:'確認工作人員到位、分配任務職責' },
      { name:'課前再次提醒學員', type:'場次準備', pri:'中', offset:-1, note:'發送提醒訊息，附上地點/時間/注意事項' },
      { name:'課後回收問卷', type:'場次準備', pri:'中', offset:1, note:'收集學員滿意度問卷' },
      { name:'整理成果照片', type:'結案', pri:'低', offset:3, note:'整理活動照片，上傳至案件資料夾' },
      { name:'整理講師領據', type:'財務', pri:'高', offset:7, note:'取得講師簽名領據，準備請款' }
    ];
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var created = 0;
    SOPTemplates.forEach(function(t){
      var obj = {
        '任務ID': govopsId_('TASK'),
        '案件ID': caseId,
        '場次ID': sesId,
        '任務名稱': '['+sesName+'] '+t.name,
        '任務類型': t.type,
        '負責人': '',
        '開始日期': '',
        '截止日期': addDays(sesDate, t.offset),
        '提醒日期': '',
        '任務狀態': '待辦',
        '優先度': t.pri,
        'CalendarEventID': '',
        '備註': t.note,
        '建立時間': govopsNow_(),
        '更新時間': govopsNow_()
      };
      govopsAppend_('案件任務清單', TASK_HEADERS, obj);
      created++;
    });
    return { success: true, data: { created: created, sessionId: sesId }, message: '場次 SOP 任務已產生 '+created+' 筆', timestamp: govopsNow_() };
  }

  // deleteTask: 刪除任務
  if (action === 'deleteTask') {
    var taskId = params.taskId || params['任務ID'];
    if (!taskId) return { success: false, error: 'MISSING_ID', message: '缺少任務ID', timestamp: govopsNow_() };
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var rows = govopsRows_('案件任務清單', TASK_HEADERS);
    var found = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i]['任務ID'] === taskId) { found = rows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到任務：'+taskId, timestamp: govopsNow_() };
    govopsDeleteRow_('案件任務清單', found._row);
    return { success: true, data: { taskId: taskId }, message: '任務已刪除', timestamp: govopsNow_() };
  }

  return null;
}

// ── Manpower Route v2 — 支援人力管理 ─────────────────────
var MPOWER_NEED_HEADERS  = ['需求ID','案件ID','場次ID','需求名稱','人力類型','需求人數','工作說明','工作日期','開始時間','結束時間','工作地點','時薪','招募截止日','狀態','建立時間','更新時間','tenantId','workspaceId'];
var MPOWER_STAFF_HEADERS = ['人員ID','需求ID','案件ID','場次ID','姓名','電話','Email','身分別','銀行','帳號','戶名','身分證','應徵日期','審核狀態','備註','建立時間','更新時間','tenantId','workspaceId'];
var MPOWER_HOURS_HEADERS = ['工時ID','人員ID','需求ID','場次ID','案件ID','姓名','工作日期','開始時間','結束時間','工時','工作狀態','備註','建立時間','更新時間','tenantId'];
var MPOWER_PAY_HEADERS   = ['付款ID','人員ID','需求ID','場次ID','案件ID','姓名','付款類型','應付金額','實際付款金額','付款方式','付款狀態','付款日期','戶名','帳號','憑證連結','備註','建立時間','更新時間','tenantId'];

function govopsManpowerRoute_(params, action) {

  // ── 統計 KPI ──────────────────────────────────────────────
  if (action === 'getManpowerStats') {
    govopsEnsureSheet_('人力需求清單', MPOWER_NEED_HEADERS);
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    govopsEnsureSheet_('支援人員付款', MPOWER_PAY_HEADERS);
    var _tid = String(params._tenantId || '');
    var needs  = govopsRows_('人力需求清單', MPOWER_NEED_HEADERS);
    var staffs = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS);
    var pays   = govopsRows_('支援人員付款', MPOWER_PAY_HEADERS);
    if (_tid) { needs=needs.filter(function(r){return String(r['tenantId']||'')===_tid;}); staffs=staffs.filter(function(r){return String(r['tenantId']||'')===_tid;}); pays=pays.filter(function(r){return String(r['tenantId']||'')===_tid;}); }
    var totalNeeds = needs.reduce(function(s,r){ return s + (parseInt(r['需求人數'])||0); }, 0);
    var recruiting = needs.filter(function(r){ return r['狀態']==='招募中'; }).reduce(function(s,r){ return s+(parseInt(r['需求人數'])||0); },0);
    var applied  = staffs.length;
    var pending  = staffs.filter(function(r){ return r['審核狀態']==='待審'; }).length;
    var hired    = staffs.filter(function(r){ return r['審核狀態']==='已錄取'; }).length;
    var unpaid   = pays.filter(function(r){ return r['付款狀態']==='待付'; }).length;
    return { success: true, data: { totalNeeds: totalNeeds, recruiting: recruiting, applied: applied, pending: pending, hired: hired, unpaid: unpaid }, message: '人力統計完成', timestamp: govopsNow_() };
  }

  // ── 人力需求 ──────────────────────────────────────────────
  if (action === 'getManpowerNeeds') {
    govopsEnsureSheet_('人力需求清單', MPOWER_NEED_HEADERS);
    var rows = govopsRows_('人力需求清單', MPOWER_NEED_HEADERS);
    var _tid = String(params._tenantId || '');
    if (_tid) rows = rows.filter(function(r){ return String(r['tenantId']||'')===_tid; });
    if (params.caseId)   rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    if (params.sessionId) rows = rows.filter(function(r){ return String(r['場次ID'])===params.sessionId; });
    if (params.status)   rows = rows.filter(function(r){ return r['狀態']===params.status; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '人力需求查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createManpowerNeed') {
    if (!params.needName) return { success: false, error: 'MISSING_PARAM', message: '需求名稱必填', timestamp: govopsNow_() };
    govopsEnsureSheet_('人力需求清單', MPOWER_NEED_HEADERS);
    var now = govopsNow_();
    var obj = {
      '需求ID': govopsId_('MPN'),
      '案件ID': params.caseId || '', '場次ID': params.sessionId || '',
      '需求名稱': params.needName,
      '人力類型': params.staffType || '工作人員',
      '需求人數': parseInt(params.headcount) || 1,
      '工作說明': params.description || '',
      '工作日期': params.workDate || '',
      '開始時間': params.startTime || '', '結束時間': params.endTime || '',
      '工作地點': params.location || '',
      '時薪': parseFloat(params.hourlyRate) || 0,
      '招募截止日': params.deadline || '',
      '狀態': '招募中',
      '建立時間': now, '更新時間': now,
      'tenantId': params._tenantId||'', 'workspaceId': params._workspaceId||''
    };
    govopsAppend_('人力需求清單', MPOWER_NEED_HEADERS, obj);
    return { success: true, data: obj, message: '人力需求已建立', timestamp: now };
  }

  if (action === 'updateManpowerNeed') {
    var needId = params.needId;
    if (!needId) return { success: false, error: 'MISSING_PARAM', message: '缺少 needId', timestamp: govopsNow_() };
    govopsEnsureSheet_('人力需求清單', MPOWER_NEED_HEADERS);
    var rows = govopsRows_('人力需求清單', MPOWER_NEED_HEADERS);
    var found = null; for (var i=0;i<rows.length;i++){ if(rows[i]['需求ID']===needId){found=rows[i];break;} }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到需求', timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['需求名稱','人力類型','需求人數','工作說明','工作日期','開始時間','結束時間','工作地點','時薪','招募截止日','狀態'].forEach(function(k){ if (params[k]!==undefined) patch[k]=params[k]; });
    govopsUpdate_('人力需求清單', MPOWER_NEED_HEADERS, found._row, patch);
    return { success: true, data: patch, message: '人力需求已更新', timestamp: patch['更新時間'] };
  }

  // ── 支援人員名單 ──────────────────────────────────────────
  if (action === 'getStaffList') {
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    var rows = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS);
    var _tid = String(params._tenantId || '');
    if (_tid) rows = rows.filter(function(r){ return String(r['tenantId']||'')===_tid; });
    if (params.needId)   rows = rows.filter(function(r){ return String(r['需求ID'])===params.needId; });
    if (params.caseId)   rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    if (params.sessionId) rows = rows.filter(function(r){ return String(r['場次ID'])===params.sessionId; });
    if (params.status)   rows = rows.filter(function(r){ return r['審核狀態']===params.status; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '人員名單查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createStaff') {
    if (!params.name) return { success: false, error: 'MISSING_PARAM', message: '姓名必填', timestamp: govopsNow_() };
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    var now = govopsNow_();
    var obj = {
      '人員ID': govopsId_('STA'),
      '需求ID': params.needId || '', '案件ID': params.caseId || '', '場次ID': params.sessionId || '',
      '姓名': params.name, '電話': params.phone || '', 'Email': params.email || '',
      '身分別': params.staffType || '工作人員',
      '銀行': params.bank || '', '帳號': params.account || '', '戶名': params.accountName || '',
      '身分證': params.idNumber || '',
      '應徵日期': params.applyDate || now.substring(0,10),
      '審核狀態': '待審', '備註': params.remark || '',
      '建立時間': now, '更新時間': now,
      'tenantId': params._tenantId||'', 'workspaceId': params._workspaceId||''
    };
    govopsAppend_('支援人員名單', MPOWER_STAFF_HEADERS, obj);
    return { success: true, data: obj, message: '人員已新增', timestamp: now };
  }

  if (action === 'updateStaffStatus') {
    var staffId = params.staffId;
    if (!staffId) return { success: false, error: 'MISSING_PARAM', message: '缺少 staffId', timestamp: govopsNow_() };
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    var rows = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS);
    var found = null; for (var i=0;i<rows.length;i++){ if(rows[i]['人員ID']===staffId){found=rows[i];break;} }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到人員', timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['姓名','電話','Email','身分別','銀行','帳號','戶名','身分證','審核狀態','備註'].forEach(function(k){ if(params[k]!==undefined) patch[k]=params[k]; });
    govopsUpdate_('支援人員名單', MPOWER_STAFF_HEADERS, found._row, patch);
    return { success: true, data: patch, message: '人員資料已更新', timestamp: patch['更新時間'] };
  }

  if (action === 'batchApproveStaff') {
    var ids = String(params.staffIds||'').split(',').map(function(s){return s.trim();}).filter(Boolean).slice(0,50);
    var status = params.status || '已錄取';
    if (!ids.length) return { success: false, error: 'MISSING_PARAM', message: '缺少 staffIds', timestamp: govopsNow_() };
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    var rows = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS);
    var updated = 0;
    rows.forEach(function(r){ if(ids.indexOf(r['人員ID'])>=0){ govopsUpdate_('支援人員名單',MPOWER_STAFF_HEADERS,r._row,{'審核狀態':status,'更新時間':govopsNow_()}); updated++; } });
    return { success: true, data: { updated: updated }, message: '批次審核完成：'+updated+' 筆', timestamp: govopsNow_() };
  }

  // ── 排班工時 ──────────────────────────────────────────────
  if (action === 'getWorkHours') {
    govopsEnsureSheet_('支援人員工時', MPOWER_HOURS_HEADERS);
    var rows = govopsRows_('支援人員工時', MPOWER_HOURS_HEADERS);
    if (params.staffId)  rows = rows.filter(function(r){ return String(r['人員ID'])===params.staffId; });
    if (params.needId)   rows = rows.filter(function(r){ return String(r['需求ID'])===params.needId; });
    if (params.sessionId) rows = rows.filter(function(r){ return String(r['場次ID'])===params.sessionId; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '工時查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createWorkHour') {
    if (!params.staffId || !params.needId) return { success: false, error: 'MISSING_PARAM', message: '缺少 staffId 或 needId', timestamp: govopsNow_() };
    govopsEnsureSheet_('支援人員工時', MPOWER_HOURS_HEADERS);
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    var staffRow = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS).filter(function(r){ return r['人員ID']===params.staffId; })[0];
    var now = govopsNow_();
    var hours = parseFloat(params.hours) || 0;
    if (!hours && params.startTime && params.endTime) {
      var s = params.startTime.split(':'), e = params.endTime.split(':');
      hours = Math.round(((parseInt(e[0])*60+parseInt(e[1]))-(parseInt(s[0])*60+parseInt(s[1])))/60*10)/10;
    }
    var obj = {
      '工時ID': govopsId_('WRK'),
      '人員ID': params.staffId, '需求ID': params.needId,
      '場次ID': params.sessionId || (staffRow&&staffRow['場次ID']||''),
      '案件ID': params.caseId || (staffRow&&staffRow['案件ID']||''),
      '姓名': staffRow ? staffRow['姓名'] : (params.name||''),
      '工作日期': params.workDate || '',
      '開始時間': params.startTime || '', '結束時間': params.endTime || '',
      '工時': hours, '工作狀態': params.workStatus || '待確認',
      '備註': params.remark || '', '建立時間': now, '更新時間': now
    };
    govopsAppend_('支援人員工時', MPOWER_HOURS_HEADERS, obj);
    return { success: true, data: obj, message: '工時已記錄', timestamp: now };
  }

  if (action === 'updateWorkHour') {
    var hourId = params.hourId;
    if (!hourId) return { success: false, error: 'MISSING_PARAM', message: '缺少 hourId', timestamp: govopsNow_() };
    govopsEnsureSheet_('支援人員工時', MPOWER_HOURS_HEADERS);
    var rows = govopsRows_('支援人員工時', MPOWER_HOURS_HEADERS);
    var found = null; for(var i=0;i<rows.length;i++){if(rows[i]['工時ID']===hourId){found=rows[i];break;}}
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到工時紀錄', timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['工作日期','開始時間','結束時間','工時','工作狀態','備註'].forEach(function(k){ if(params[k]!==undefined) patch[k]=params[k]; });
    govopsUpdate_('支援人員工時', MPOWER_HOURS_HEADERS, found._row, patch);
    return { success: true, data: patch, message: '工時已更新', timestamp: patch['更新時間'] };
  }

  // ── 簽收付款 ──────────────────────────────────────────────
  if (action === 'getPayments') {
    govopsEnsureSheet_('支援人員付款', MPOWER_PAY_HEADERS);
    var rows = govopsRows_('支援人員付款', MPOWER_PAY_HEADERS);
    if (params.staffId)  rows = rows.filter(function(r){ return String(r['人員ID'])===params.staffId; });
    if (params.needId)   rows = rows.filter(function(r){ return String(r['需求ID'])===params.needId; });
    if (params.caseId)   rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    if (params.status)   rows = rows.filter(function(r){ return r['付款狀態']===params.status; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '付款查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createPayment') {
    if (!params.staffId) return { success: false, error: 'MISSING_PARAM', message: '缺少 staffId', timestamp: govopsNow_() };
    govopsEnsureSheet_('支援人員付款', MPOWER_PAY_HEADERS);
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    var staffRow = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS).filter(function(r){ return r['人員ID']===params.staffId; })[0];
    var now = govopsNow_();
    var obj = {
      '付款ID': govopsId_('PAY'),
      '人員ID': params.staffId, '需求ID': params.needId || '',
      '場次ID': params.sessionId || (staffRow&&staffRow['場次ID']||''),
      '案件ID': params.caseId || (staffRow&&staffRow['案件ID']||''),
      '姓名': staffRow ? staffRow['姓名'] : (params.name||''),
      '付款類型': params.payType || '工讀酬勞',
      '應付金額': parseFloat(params.amount) || 0,
      '實際付款金額': parseFloat(params.actualAmount) || parseFloat(params.amount) || 0,
      '付款方式': params.payMethod || '轉帳',
      '付款狀態': '待付', '付款日期': '',
      '戶名': staffRow ? staffRow['戶名'] : (params.accountName||''),
      '帳號': staffRow ? staffRow['帳號'] : (params.account||''),
      '憑證連結': '', '備註': params.remark || '',
      '建立時間': now, '更新時間': now
    };
    govopsAppend_('支援人員付款', MPOWER_PAY_HEADERS, obj);
    return { success: true, data: obj, message: '付款單已建立', timestamp: now };
  }

  if (action === 'updatePaymentStatus') {
    var payId = params.payId;
    if (!payId) return { success: false, error: 'MISSING_PARAM', message: '缺少 payId', timestamp: govopsNow_() };
    govopsEnsureSheet_('支援人員付款', MPOWER_PAY_HEADERS);
    var rows = govopsRows_('支援人員付款', MPOWER_PAY_HEADERS);
    var found = null; for(var i=0;i<rows.length;i++){if(rows[i]['付款ID']===payId){found=rows[i];break;}}
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到付款記錄', timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['付款狀態','付款日期','實際付款金額','付款方式','憑證連結','備註'].forEach(function(k){ if(params[k]!==undefined) patch[k]=params[k]; });
    govopsUpdate_('支援人員付款', MPOWER_PAY_HEADERS, found._row, patch);
    return { success: true, data: patch, message: '付款狀態已更新', timestamp: patch['更新時間'] };
  }

  if (action === 'batchGeneratePayments') {
    // 從已確認工時批次產生付款單（僅針對有時薪的需求）
    var needId = params.needId;
    if (!needId) return { success: false, error: 'MISSING_PARAM', message: '缺少 needId', timestamp: govopsNow_() };
    govopsEnsureSheet_('人力需求清單', MPOWER_NEED_HEADERS);
    govopsEnsureSheet_('支援人員工時', MPOWER_HOURS_HEADERS);
    govopsEnsureSheet_('支援人員付款', MPOWER_PAY_HEADERS);
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    var need = govopsRows_('人力需求清單', MPOWER_NEED_HEADERS).filter(function(r){ return r['需求ID']===needId; })[0];
    if (!need) return { success: false, error: 'NOT_FOUND', message: '找不到人力需求', timestamp: govopsNow_() };
    var hourlyRate = parseFloat(need['時薪']) || 0;
    var hours = govopsRows_('支援人員工時', MPOWER_HOURS_HEADERS).filter(function(r){ return r['需求ID']===needId && r['工作狀態']==='已確認'; });
    var staffRows = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS);
    var existPays = govopsRows_('支援人員付款', MPOWER_PAY_HEADERS).filter(function(r){ return r['需求ID']===needId; });
    var created = 0;
    hours.forEach(function(h){
      var alreadyPaid = existPays.some(function(p){ return p['人員ID']===h['人員ID'] && p['付款類型']==='工讀酬勞'; });
      if (alreadyPaid) return;
      var staffRow = staffRows.filter(function(s){ return s['人員ID']===h['人員ID']; })[0];
      var hrs = parseFloat(h['工時']) || 0;
      var amt = hourlyRate ? Math.round(hourlyRate * hrs) : 0;
      var now = govopsNow_();
      var obj = {
        '付款ID': govopsId_('PAY'), '人員ID': h['人員ID'], '需求ID': needId,
        '場次ID': h['場次ID']||'', '案件ID': h['案件ID']||'',
        '姓名': h['姓名']||'', '付款類型': '工讀酬勞',
        '應付金額': amt, '實際付款金額': amt, '付款方式': '轉帳',
        '付款狀態': '待付', '付款日期': '',
        '戶名': staffRow ? staffRow['戶名'] : '',
        '帳號': staffRow ? staffRow['帳號'] : '',
        '憑證連結': '', '備註': '工時 '+hrs+' 小時 × 時薪 '+hourlyRate,
        '建立時間': now, '更新時間': now
      };
      govopsAppend_('支援人員付款', MPOWER_PAY_HEADERS, obj);
      created++;
    });
    return { success: true, data: { created: created }, message: '已產生 '+created+' 筆付款單', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Case Requirements Route — 案件需求摘要 + 驗收條件
// ════════════════════════════════════════════════════════
var CASE_REQ_HEADERS = ['需求ID','案件ID','計畫緣起與背景','計畫目標','服務對象','預期場次數','預期參與人次','成果報告繳交份數','成果報告電子檔格式','特殊核銷要求','預期效益','對主辦單位效益','對參與者效益','後續延伸效益','建立時間','更新時間'];
var ACCEPTANCE_HEADERS = ['驗收ID','案件ID','項目編號','驗收項目名稱','驗收要求說明','繳交數量','繳交格式','繳交期限','完成狀態','完成日期','備註','建立時間','更新時間'];

function govopsCaseReqRoute_(params, action) {

  if (action === 'getCaseRequirements') {
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    govopsEnsureSheet_('03_案件需求摘要', CASE_REQ_HEADERS);
    var rows = govopsRows_('03_案件需求摘要', CASE_REQ_HEADERS);
    var found = rows.filter(function(r){ return String(r['案件ID'])===caseId; })[0] || null;
    // Also get acceptance items
    govopsEnsureSheet_('03b_驗收條件', ACCEPTANCE_HEADERS);
    var accepts = govopsRows_('03b_驗收條件', ACCEPTANCE_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    return { success: true, data: { requirements: found, acceptanceItems: accepts }, message: '案件需求查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'saveCaseRequirements') {
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    govopsEnsureSheet_('03_案件需求摘要', CASE_REQ_HEADERS);
    var rows = govopsRows_('03_案件需求摘要', CASE_REQ_HEADERS);
    var found = rows.filter(function(r){ return String(r['案件ID'])===caseId; })[0];
    var now = govopsNow_();
    var fields = ['計畫緣起與背景','計畫目標','服務對象','預期場次數','預期參與人次','成果報告繳交份數','成果報告電子檔格式','特殊核銷要求','預期效益','對主辦單位效益','對參與者效益','後續延伸效益'];
    if (found) {
      var patch = { '更新時間': now };
      fields.forEach(function(k){ if(params[k]!==undefined) patch[k]=params[k]; });
      govopsUpdate_('03_案件需求摘要', CASE_REQ_HEADERS, found._row, patch);
      return { success: true, data: patch, message: '案件需求已更新', timestamp: now };
    } else {
      var obj = { '需求ID': govopsId_('REQ'), '案件ID': caseId, '建立時間': now, '更新時間': now };
      fields.forEach(function(k){ obj[k] = params[k]||''; });
      govopsAppend_('03_案件需求摘要', CASE_REQ_HEADERS, obj);
      return { success: true, data: obj, message: '案件需求已建立', timestamp: now };
    }
  }

  if (action === 'saveAcceptanceItem') {
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    govopsEnsureSheet_('03b_驗收條件', ACCEPTANCE_HEADERS);
    var aId = params.acceptanceId;
    var now = govopsNow_();
    if (aId) {
      var rows = govopsRows_('03b_驗收條件', ACCEPTANCE_HEADERS);
      var found = rows.filter(function(r){ return r['驗收ID']===aId; })[0];
      if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到驗收項目', timestamp: now };
      var patch = { '更新時間': now };
      ['驗收項目名稱','驗收要求說明','繳交數量','繳交格式','繳交期限','完成狀態','完成日期','備註'].forEach(function(k){ if(params[k]!==undefined) patch[k]=params[k]; });
      govopsUpdate_('03b_驗收條件', ACCEPTANCE_HEADERS, found._row, patch);
      return { success: true, data: patch, message: '驗收條件已更新', timestamp: now };
    } else {
      var rows2 = govopsRows_('03b_驗收條件', ACCEPTANCE_HEADERS);
      var num = rows2.filter(function(r){ return String(r['案件ID'])===caseId; }).length + 1;
      var obj = { '驗收ID': govopsId_('ACC'), '案件ID': caseId, '項目編號': num,
        '驗收項目名稱': params['驗收項目名稱']||'', '驗收要求說明': params['驗收要求說明']||'',
        '繳交數量': params['繳交數量']||'', '繳交格式': params['繳交格式']||'',
        '繳交期限': params['繳交期限']||'', '完成狀態': '未完成', '完成日期': '',
        '備註': params['備註']||'', '建立時間': now, '更新時間': now };
      govopsAppend_('03b_驗收條件', ACCEPTANCE_HEADERS, obj);
      return { success: true, data: obj, message: '驗收條件已新增', timestamp: now };
    }
  }

  if (action === 'deleteAcceptanceItem') {
    var aId = params.acceptanceId;
    govopsEnsureSheet_('03b_驗收條件', ACCEPTANCE_HEADERS);
    var rows = govopsRows_('03b_驗收條件', ACCEPTANCE_HEADERS);
    var found = rows.filter(function(r){ return r['驗收ID']===aId; })[0];
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到', timestamp: govopsNow_() };
    govopsDeleteRow_('03b_驗收條件', found._row);
    return { success: true, data: { acceptanceId: aId }, message: '驗收條件已刪除', timestamp: govopsNow_() };
  }

  if (action === 'getReportData') {
    // Aggregate all data needed for 結案報告
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    var result = {};
    // Case info
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    result.caseInfo = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    // Requirements
    govopsEnsureSheet_('03_案件需求摘要', CASE_REQ_HEADERS);
    var reqRows = govopsRows_('03_案件需求摘要', CASE_REQ_HEADERS);
    result.requirements = reqRows.filter(function(r){ return String(r['案件ID'])===caseId; })[0] || {};
    // Acceptance items
    govopsEnsureSheet_('03b_驗收條件', ACCEPTANCE_HEADERS);
    result.acceptanceItems = govopsRows_('03b_驗收條件', ACCEPTANCE_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    // Sessions
    result.sessions = govopsRows_('02_場次活動', SESSION_HEADERS).filter(function(r){ return String(r['專案ID'])===caseId; });
    // Registration stats
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    result.regStats = { total: regs.length,
      admitted: regs.filter(function(r){ return ['已錄取','備取'].indexOf(String(r['資格審查狀態']))>=0||['已錄取','備取'].indexOf(String(r['錄取狀態']))>=0; }).length,
      rejected: regs.filter(function(r){ return ['不符合資格','未錄取'].indexOf(String(r['資格審查狀態']))>=0; }).length
    };
    // Tasks
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    result.tasks = govopsRows_('案件任務清單', TASK_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    // Finance
    govopsEnsureSheet_('財務收支', FINANCE_HEADERS);
    var finRows = govopsRows_('財務收支', FINANCE_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    var finIncome = finRows.filter(function(r){ return r['類型']==='收入'; }).reduce(function(s,r){ return s+(parseFloat(r['金額'])||0); }, 0);
    var finExpense = finRows.filter(function(r){ return r['類型']==='支出'; }).reduce(function(s,r){ return s+(parseFloat(r['金額'])||0); }, 0);
    result.finance = { income: finIncome, expense: finExpense, profit: finIncome-finExpense };
    // Budget
    govopsEnsureSheet_('案件預算明細', BUDGET_HEADERS);
    result.budget = govopsRows_('案件預算明細', BUDGET_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    // Closing checklist
    govopsEnsureSheet_('結案檢核', CLOSING_CHECK_HEADERS);
    result.closingChecks = govopsRows_('結案檢核', CLOSING_CHECK_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    return { success: true, data: result, message: '結案報告資料彙整完成', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Change Log Route — 場次變更管理
// ════════════════════════════════════════════════════════
var CHANGE_LOG_HEADERS = ['變更ID','案件ID','場次ID','變更類型','變更欄位','變更前內容','變更後內容','變更原因','是否影響通知','是否影響文件','是否影響財務','是否影響結案','是否已通知','是否已重產文件','變更人','變更時間','備註'];

function govopsChangeLogRoute_(params, action) {

  if (action === 'getChangeLogs') {
    govopsEnsureSheet_('05_場次變更紀錄', CHANGE_LOG_HEADERS);
    var rows = govopsRows_('05_場次變更紀錄', CHANGE_LOG_HEADERS);
    if (params.caseId) rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    if (params.sessionId) rows = rows.filter(function(r){ return String(r['場次ID'])===params.sessionId; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '變更紀錄查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createChangeLog') {
    govopsEnsureSheet_('05_場次變更紀錄', CHANGE_LOG_HEADERS);
    var now = govopsNow_();
    var profile = null; try { profile = Session.getActiveUser().getEmail(); } catch(e) {}
    var obj = {
      '變更ID': govopsId_('CHG'), '案件ID': params.caseId||'', '場次ID': params.sessionId||'',
      '變更類型': params.changeType||'', '變更欄位': params.changedField||'',
      '變更前內容': params.oldValue||'', '變更後內容': params.newValue||'',
      '變更原因': params.reason||'', '是否影響通知': params.affectNotify||'是',
      '是否影響文件': params.affectDoc||'是', '是否影響財務': params.affectFinance||'否',
      '是否影響結案': params.affectClosing||'否', '是否已通知': '否', '是否已重產文件': '否',
      '變更人': params.changedBy||profile||'', '變更時間': now, '備註': params.remark||''
    };
    govopsAppend_('05_場次變更紀錄', CHANGE_LOG_HEADERS, obj);
    // Mark session as changed
    if (params.sessionId) {
      var sesRows = govopsRows_('02_場次活動', SESSION_HEADERS);
      var ses = sesRows.filter(function(r){ return String(r['活動ID'])===params.sessionId; })[0];
      if (ses) govopsUpdate_('02_場次活動', SESSION_HEADERS, ses._row, { '變更狀態': '有變更', '更新時間': now });
    }
    return { success: true, data: obj, message: '變更紀錄已建立', timestamp: now };
  }

  if (action === 'markNotified') {
    var id = params.changeId;
    govopsEnsureSheet_('05_場次變更紀錄', CHANGE_LOG_HEADERS);
    var rows = govopsRows_('05_場次變更紀錄', CHANGE_LOG_HEADERS);
    var found = rows.filter(function(r){ return r['變更ID']===id; })[0];
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到變更紀錄', timestamp: govopsNow_() };
    govopsUpdate_('05_場次變更紀錄', CHANGE_LOG_HEADERS, found._row, { '是否已通知': '是', '更新時間': govopsNow_() });
    return { success: true, data: { changeId: id }, message: '已標記通知完成', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Import Route — 資料匯入與同步中心
// ════════════════════════════════════════════════════════
var IMPORT_BATCH_HEADERS = ['批次ID','案件ID','場次ID','匯入類型','匯入來源','資料筆數','成功筆數','失敗筆數','重複筆數','匯入狀態','錯誤訊息','匯入時間','操作人','備註'];

function govopsImportRoute_(params, action) {

  if (action === 'getImportBatches') {
    govopsEnsureSheet_('29_資料匯入批次紀錄', IMPORT_BATCH_HEADERS);
    var rows = govopsRows_('29_資料匯入批次紀錄', IMPORT_BATCH_HEADERS);
    if (params.caseId) rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '匯入批次查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createImportBatch') {
    govopsEnsureSheet_('29_資料匯入批次紀錄', IMPORT_BATCH_HEADERS);
    var now = govopsNow_();
    var obj = { '批次ID': govopsId_('IMP'), '案件ID': params.caseId||'', '場次ID': params.sessionId||'',
      '匯入類型': params.importType||'', '匯入來源': params.source||'',
      '資料筆數': parseInt(params.total)||0, '成功筆數': parseInt(params.success)||0,
      '失敗筆數': parseInt(params.failed)||0, '重複筆數': parseInt(params.duplicate)||0,
      '匯入狀態': params.status||'完成', '錯誤訊息': params.errorMsg||'',
      '匯入時間': now, '操作人': params.operator||'', '備註': params.remark||'' };
    govopsAppend_('29_資料匯入批次紀錄', IMPORT_BATCH_HEADERS, obj);
    return { success: true, data: obj, message: '匯入批次已記錄', timestamp: now };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// File Manager Route — 資料上傳與檔案管理
// ════════════════════════════════════════════════════════
var FILE_MGR_HEADERS = ['檔案ID','案件ID','場次ID','問卷ID','檔案名稱','檔案類型','檔案分類','Google Drive連結','檔案說明','是否用於結案','是否用於核銷','是否用於請款','是否用於成果報告','檔案狀態','上傳日期','上傳者','備註','建立時間','更新時間'];

function govopsFileManagerRoute_(params, action) {

  if (action === 'getFiles') {
    govopsEnsureSheet_('25_上傳檔案管理', FILE_MGR_HEADERS);
    var rows = govopsRows_('25_上傳檔案管理', FILE_MGR_HEADERS);
    if (params.caseId) rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    if (params.sessionId) rows = rows.filter(function(r){ return String(r['場次ID'])===params.sessionId; });
    if (params.fileType) rows = rows.filter(function(r){ return r['檔案類型']===params.fileType; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '檔案查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createFile') {
    if (!params.fileName) return { success: false, error: 'MISSING_PARAM', message: '缺少 fileName', timestamp: govopsNow_() };
    govopsEnsureSheet_('25_上傳檔案管理', FILE_MGR_HEADERS);
    var now = govopsNow_();
    var obj = { '檔案ID': govopsId_('FILE'), '案件ID': params.caseId||'', '場次ID': params.sessionId||'',
      '問卷ID': params.surveyId||'', '檔案名稱': params.fileName,
      '檔案類型': params.fileType||'', '檔案分類': params.fileCategory||'',
      'Google Drive連結': params.driveLink||'', '檔案說明': params.description||'',
      '是否用於結案': params.forClosing||'否', '是否用於核銷': params.forReimb||'否',
      '是否用於請款': params.forPayment||'否', '是否用於成果報告': params.forReport||'否',
      '檔案狀態': '正常', '上傳日期': now.substring(0,10), '上傳者': params.uploader||'',
      '備註': params.remark||'', '建立時間': now, '更新時間': now };
    govopsAppend_('25_上傳檔案管理', FILE_MGR_HEADERS, obj);
    return { success: true, data: obj, message: '檔案記錄已建立', timestamp: now };
  }

  if (action === 'updateFile') {
    var id = params.fileId;
    if (!id) return { success: false, error: 'MISSING_PARAM', message: '缺少 fileId', timestamp: govopsNow_() };
    govopsEnsureSheet_('25_上傳檔案管理', FILE_MGR_HEADERS);
    var rows = govopsRows_('25_上傳檔案管理', FILE_MGR_HEADERS);
    var found = rows.filter(function(r){ return r['檔案ID']===id; })[0];
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到檔案', timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['檔案名稱','檔案說明','Google Drive連結','檔案狀態','是否用於結案','是否用於核銷','是否用於請款','是否用於成果報告','備註'].forEach(function(k){ if(params[k]!==undefined) patch[k]=params[k]; });
    govopsUpdate_('25_上傳檔案管理', FILE_MGR_HEADERS, found._row, patch);
    return { success: true, data: patch, message: '檔案已更新', timestamp: patch['更新時間'] };
  }

  if (action === 'deleteFile') {
    var id = params.fileId;
    govopsEnsureSheet_('25_上傳檔案管理', FILE_MGR_HEADERS);
    var rows = govopsRows_('25_上傳檔案管理', FILE_MGR_HEADERS);
    var found = rows.filter(function(r){ return r['檔案ID']===id; })[0];
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到檔案', timestamp: govopsNow_() };
    govopsDeleteRow_('25_上傳檔案管理', found._row);
    return { success: true, data: { fileId: id }, message: '檔案記錄已刪除', timestamp: govopsNow_() };
  }

  if (action === 'getFileStats') {
    govopsEnsureSheet_('25_上傳檔案管理', FILE_MGR_HEADERS);
    var rows = govopsRows_('25_上傳檔案管理', FILE_MGR_HEADERS);
    if (params.caseId) rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    var stats = { total: rows.length, forClosing: 0, forReport: 0, byType: {} };
    rows.forEach(function(r){
      if (r['是否用於結案']==='是') stats.forClosing++;
      if (r['是否用於成果報告']==='是') stats.forReport++;
      var t = r['檔案類型']||'其他';
      stats.byType[t] = (stats.byType[t]||0)+1;
    });
    return { success: true, data: stats, message: '檔案統計完成', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Drive Route — 自動建立案件 Google Drive 資料夾結構
// ════════════════════════════════════════════════════════
var DRIVE_FOLDER_HEADERS = ['資料夾ID','案件ID','資料夾名稱','資料夾用途','Drive資料夾ID','Drive連結','建立時間'];

function govopsDriveRoute_(params, action) {

  function getOrCreateRootFolder() {
    var rootId = params.rootFolderId || '';
    if (!rootId) {
      // Auto-read from 28_系統設定 Sheet
      try {
        var settingsRows = govopsRows_('28_系統設定', ['設定鍵', '設定值', '說明', '更新時間']);
        var found = settingsRows.filter(function(r){ return String(r['設定鍵']) === 'driveFolderId'; })[0];
        if (found) rootId = String(found['設定值'] || '');
      } catch(e) {}
    }
    if (rootId) { try { return DriveApp.getFolderById(rootId); } catch(e) {} }
    return DriveApp.getRootFolder();
  }

  if (action === 'createCaseFolders') {
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var caseInfo = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0];
    if (!caseInfo) return { success: false, error: 'NOT_FOUND', message: '找不到案件', timestamp: govopsNow_() };
    var caseName = caseInfo['專案計畫名稱'] || caseId;
    var root = getOrCreateRootFolder();
    // Create main case folder
    var mainName = caseName + '_' + caseId.substring(0,8);
    var mainFolder;
    try {
      var existing = root.getFoldersByName(mainName);
      mainFolder = existing.hasNext() ? existing.next() : root.createFolder(mainName);
    } catch(e) { return { success: false, error: 'DRIVE_ERROR', message: 'Drive 建立失敗：'+e.message, timestamp: govopsNow_() }; }
    // Subfolders
    var subFolders = [
      '01_契約與公文','02_計畫與提案','03_場次資料','04_報名與錄取',
      '05_簽到表與名冊','06_成果照片','07_問卷與回饋',
      '08_講師與工作人員領據','09_請款與核銷','10_成果報告','11_結案資料','99_其他附件'
    ];
    var created = [];
    subFolders.forEach(function(name) {
      var sub;
      try {
        var ex = mainFolder.getFoldersByName(name);
        sub = ex.hasNext() ? ex.next() : mainFolder.createFolder(name);
        created.push({ name: name, id: sub.getId(), url: sub.getUrl() });
      } catch(e) {}
    });
    // Update case record with Drive link
    govopsUpdate_('01_專案主檔', CASE_HEADERS, caseInfo._row, { 'Drive連結': mainFolder.getUrl(), '更新時間': govopsNow_() });
    return { success: true, data: { mainFolder: mainFolder.getUrl(), mainFolderId: mainFolder.getId(), subFolders: created }, message: '案件資料夾已建立，共 '+created.length+' 個子資料夾', timestamp: govopsNow_() };
  }

  if (action === 'getCaseFolders') {
    var caseId = params.caseId;
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var caseInfo = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0];
    var driveLink = caseInfo ? caseInfo['Drive連結'] : '';
    return { success: true, data: { driveLink: driveLink, exists: !!driveLink }, message: 'Drive 資料夾狀態查詢完成', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// DocGen Route — 全自動產生 Google Doc / Sheet 文件
// 使用 DocumentApp + SpreadsheetApp + DriveApp
// ════════════════════════════════════════════════════════
function govopsDocGenRoute_(params, action) {

  // 取案件 Drive 資料夾（依名稱搜尋）
  function getCaseFolderByName(caseName, caseId, subFolder) {
    var rootFolderId = params.rootFolderId || '';
    var root;
    try { root = rootFolderId ? DriveApp.getFolderById(rootFolderId) : DriveApp.getRootFolder(); } catch(e) { root = DriveApp.getRootFolder(); }
    var mainName = caseName + '_' + caseId.substring(0,8);
    var folders = root.getFoldersByName(mainName);
    var mainFolder = folders.hasNext() ? folders.next() : null;
    if (!mainFolder) return null;
    if (!subFolder) return mainFolder;
    var subs = mainFolder.getFoldersByName(subFolder);
    return subs.hasNext() ? subs.next() : mainFolder;
  }

  // 格式化日期
  function fmtDate(v) {
    if (!v) return '___';
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy年MM月dd日');
    return String(v).replace(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2}).*/, '$1年$2月$3日');
  }
  function shortD(v) {
    if (!v) return '—';
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy/MM/dd');
    return String(v).replace(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2}).*/, '$1/$2/$3');
  }
  function fmtTime(v) {
    if (!v) return '';
    if (typeof v === 'string') { var m = v.match(/T(\d{2}):(\d{2})/); if(m) return m[1]+':'+m[2]; if(/^\d{1,2}:\d{2}/.test(v)) return v.substring(0,5); }
    return '';
  }
  function rocDate(v) {
    var d = v ? new Date(String(v).replace(/\//g,'-')) : new Date();
    return '中華民國 '+(d.getFullYear()-1911)+' 年 ___ 月 ___ 日';
  }

  // ── 簽到表（Google Sheet 全自動） ──────────────────────
  if (action === 'autoGenerateSignInSheet') {
    var sessionId = params.sessionId;
    if (!sessionId) return { success: false, error: 'MISSING_PARAM', message: '缺少 sessionId', timestamp: govopsNow_() };
    var sesRows = govopsRows_('02_場次活動', SESSION_HEADERS);
    var ses = sesRows.filter(function(r){ return String(r['活動ID'])===sessionId; })[0];
    if (!ses) return { success: false, error: 'NOT_FOUND', message: '找不到場次', timestamp: govopsNow_() };
    var caseId = ses['專案ID'] || '';
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var ci = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    var profile = null; try { profile = safeJSONGas_('govops_org_settings') || {}; } catch(e) {}
    // Get 錄取名單
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){
      return String(r['活動ID'])===sessionId && (['已錄取','備取','符合資格'].indexOf(String(r['資格審查狀態']))>=0 || ['已錄取','備取'].indexOf(String(r['錄取狀態']))>=0);
    });
    // Create Google Sheet
    var sheetTitle = '簽到表_'+(ses['活動名稱']||sessionId)+'_'+shortD(ses['活動日期']);
    var ss = SpreadsheetApp.create(sheetTitle);
    var sheet = ss.getActiveSheet();
    sheet.setName('簽到表');
    // Title row
    sheet.getRange(1,1,1,9).merge().setValue('簽    到    表').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
    // Meta rows
    sheet.getRange(2,1,1,3).merge().setValue('課程名稱：'+String(ses['活動名稱']||''));
    sheet.getRange(2,4,1,3).merge().setValue('日期：'+fmtDate(ses['活動日期']));
    sheet.getRange(2,7,1,3).merge().setValue('場次：第 ___ 場');
    sheet.getRange(3,1,1,4).merge().setValue('上課地點：'+String(ses['活動地點']||''));
    sheet.getRange(3,5,1,2).merge().setValue('時間：'+fmtTime(ses['開始時間'])+'～'+fmtTime(ses['結束時間']));
    sheet.getRange(3,7,1,3).merge().setValue('承辦單位：'+(ci['主辦單位']||''));
    // Headers row
    var headers = ['序號','姓名','服務單位','職稱','簽到','簽退','□葷 □素','□禮品','備註'];
    sheet.getRange(4,1,1,9).setValues([headers]).setFontWeight('bold').setBackground('#1a3a5c').setFontColor('#ffffff');
    // Student data
    if (regs.length > 0) {
      var data = regs.map(function(r, i){
        return [i+1, r['姓名']||'', r['服務單位']||'', r['職稱']||'', '', '', r['用餐習慣']||'', '', r['備註']||''];
      });
      sheet.getRange(5, 1, data.length, 9).setValues(data);
    }
    // Signature rows
    var nextRow = 5 + regs.length + 1;
    sheet.getRange(nextRow,1,1,4).merge().setValue('授課教師簽名：'+String(ses['講師']||''));
    sheet.getRange(nextRow,5,1,5).merge().setValue('工作人員簽名：'+String(ses['工作人員']||''));
    // Formatting
    sheet.setColumnWidth(1,40);sheet.setColumnWidth(2,80);sheet.setColumnWidth(3,140);
    sheet.setColumnWidth(4,80);sheet.setColumnWidth(5,70);sheet.setColumnWidth(6,70);
    sheet.setColumnWidth(7,90);sheet.setColumnWidth(8,70);sheet.setColumnWidth(9,80);
    var allRange = sheet.getRange(1,1,nextRow,9);
    allRange.setBorder(true,true,true,true,true,true);
    // Move to Drive folder
    var targetFolder = getCaseFolderByName(ci['專案計畫名稱']||caseId, caseId, '05_簽到表與名冊');
    var file = DriveApp.getFileById(ss.getId());
    if (targetFolder) { file.moveTo(targetFolder); }
    var url = ss.getUrl();
    // Log document
    govopsEnsureSheet_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態']);
    govopsAppend_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態'],
      {'產出ID':govopsId_('DOC'),'案件ID':caseId,'場次ID':sessionId,'文件類型':'簽到表','文件名稱':sheetTitle,'產出日期':govopsNow_(),'檔案連結':url,'狀態':'已產生'});
    return { success: true, data: { url: url, sheetId: ss.getId(), count: regs.length }, message: '簽到表已產生，共 '+regs.length+' 人', timestamp: govopsNow_() };
  }

  // ── 講師鐘點費領據（Google Doc 全自動） ───────────────
  if (action === 'autoGenerateLecturerReceipt') {
    var sessionId = params.sessionId;
    if (!sessionId) return { success: false, error: 'MISSING_PARAM', message: '缺少 sessionId', timestamp: govopsNow_() };
    var sesRows = govopsRows_('02_場次活動', SESSION_HEADERS);
    var ses = sesRows.filter(function(r){ return String(r['活動ID'])===sessionId; })[0];
    if (!ses) return { success: false, error: 'NOT_FOUND', message: '找不到場次', timestamp: govopsNow_() };
    var caseId = ses['專案ID'] || params.caseId || '';
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var ci = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    var lecName = ses['講師'] || params.lecturerName || '';
    var hours = parseFloat(params.hours) || 0;
    var hourlyRate = parseFloat(params.hourlyRate) || 1000;
    var amount = Math.round(hours * hourlyRate);
    // Lecturer info from master data
    var lecInfo = {};
    try {
      var lecRows = govopsRows_('18_講師資料', ['講師ID','姓名','電話','Email','身分證字號','出生日期','地址','銀行','帳號','戶名']);
      var found = lecRows.filter(function(r){ return String(r['姓名'])===lecName; })[0];
      if (found) lecInfo = found;
    } catch(e) {}
    var orgName = ci['主辦單位'] || params.orgName || '___限公司';
    var caseName = ci['專案計畫名稱'] || '';
    var docTitle = '講師領據_'+lecName+'_'+shortD(ses['活動日期']);
    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();
    body.setPageWidth(595.28);body.setPageHeight(841.89);// A4
    body.setMarginTop(50);body.setMarginBottom(50);body.setMarginLeft(60);body.setMarginRight(60);
    // Header
    var hp = body.appendParagraph(orgName);
    hp.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setFontFamily('標楷體').setFontSize(11);
    var tp = body.appendParagraph('領    據');
    tp.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setFontFamily('標楷體').setFontSize(18).setBold(true);
    body.appendParagraph('');
    // Data table
    var tableData = [
      ['領款人', lecName+'　　身份證字號：'+(lecInfo['身分證字號']||params.idNumber||'___________________')],
      ['出生年月日', (lecInfo['出生日期']||params.birthDate||'_____年_____月_____日')],
      ['戶籍地址', (lecInfo['地址']||params.address||'___________________________')],
      ['扣繳憑單寄送地址', (lecInfo['地址']||params.address||'___________________________')],
      ['費用項目', caseName+'-講師鐘點費　'+hours+' H × '+hourlyRate+'元（'+(fmtTime(ses['開始時間'])||'')+' ～ '+(fmtTime(ses['結束時間'])||'')+'）']
    ];
    var table = body.appendTable(tableData);
    table.setBorderColor('#000000');
    var amtPara = body.appendParagraph('金額：新台幣 '+amount.toLocaleString()+' 元整　NT$ '+amount.toLocaleString()+' 元');
    amtPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setFontFamily('標楷體').setFontSize(13).setBold(true);
    body.appendParagraph('');
    var signP = body.appendParagraph('上列款項已向 '+orgName+' 如數領訖');
    signP.setFontFamily('標楷體').setFontSize(10);
    body.appendParagraph('　　　　簽領處（請親簽）：___________________');
    body.appendParagraph('　　　　日期：'+rocDate(ses['活動日期']));
    body.appendParagraph('');
    // Notes & bank info
    var notes = [
      '1. 領款人戶籍地址、身份証編號及領款日期請詳細填寫。',
      '2. 領款人請於簽領處簽名，才算正式收據。',
      '3. 請附上身份證影本，以利所得之申報。'
    ];
    notes.forEach(function(n){ body.appendParagraph(n).setFontSize(9).setItalic(true); });
    body.appendParagraph('銀行名稱：'+(lecInfo['銀行']||params.bank||'___')+'　戶名：'+(lecInfo['戶名']||lecName)+'　銀行帳號：'+(lecInfo['帳號']||params.account||'___')).setFontSize(9);
    // Move to Drive
    var targetFolder = getCaseFolderByName(ci['專案計畫名稱']||caseId, caseId, '08_講師與工作人員領據');
    var file = DriveApp.getFileById(doc.getId());
    if (targetFolder) file.moveTo(targetFolder);
    var url = doc.getUrl();
    govopsEnsureSheet_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態']);
    govopsAppend_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態'],
      {'產出ID':govopsId_('DOC'),'案件ID':caseId,'場次ID':sessionId,'文件類型':'講師領據','文件名稱':docTitle,'產出日期':govopsNow_(),'檔案連結':url,'狀態':'已產生'});
    return { success: true, data: { url: url, docId: doc.getId(), lecturer: lecName, amount: amount }, message: '講師領據已產生：'+lecName+' NT$'+amount.toLocaleString(), timestamp: govopsNow_() };
  }

  // ── 工作人員費用領據（批次，每人一份 Google Doc） ──────
  if (action === 'autoGenerateStaffReceipts') {
    var sessionId = params.sessionId || '', needId = params.needId || '';
    var caseId = params.caseId || '';
    govopsEnsureSheet_('支援人員名單', MPOWER_STAFF_HEADERS);
    govopsEnsureSheet_('支援人員工時', MPOWER_HOURS_HEADERS);
    var staffRows = govopsRows_('支援人員名單', MPOWER_STAFF_HEADERS).filter(function(r){
      if (r['審核狀態']!=='已錄取') return false;
      if (sessionId && String(r['場次ID'])!==sessionId) return false;
      if (needId && String(r['需求ID'])!==needId) return false;
      if (caseId && String(r['案件ID'])!==caseId) return false;
      return true;
    });
    if (!staffRows.length) return { success: false, error: 'NO_DATA', message: '無已錄取工作人員', timestamp: govopsNow_() };
    var hoursRows = govopsRows_('支援人員工時', MPOWER_HOURS_HEADERS);
    if (!caseId) caseId = staffRows[0]['案件ID'] || '';
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var ci = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    var orgName = ci['主辦單位'] || '___限公司';
    var caseName = ci['專案計畫名稱'] || '';
    var hourlyRate = parseFloat(params.hourlyRate) || 190;
    var targetFolder = getCaseFolderByName(ci['專案計畫名稱']||caseId, caseId, '08_講師與工作人員領據');
    var results = [];
    staffRows.forEach(function(s) {
      var myHours = hoursRows.filter(function(h){ return h['人員ID']===s['人員ID'] && h['工作狀態']==='已確認'; });
      var totalHours = myHours.reduce(function(sum,h){ return sum+(parseFloat(h['工時'])||0); }, 0);
      var amount = Math.round(totalHours * hourlyRate);
      var docTitle = '工作人員領據_'+s['姓名']+'_'+shortD(new Date());
      try {
        var doc = DocumentApp.create(docTitle);
        var body = doc.getBody();
        body.setMarginTop(50);body.setMarginBottom(50);body.setMarginLeft(60);body.setMarginRight(60);
        body.appendParagraph(orgName).setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setFontFamily('標楷體').setFontSize(11);
        body.appendParagraph('領    據').setAlignment(DocumentApp.HorizontalAlignment.CENTER).setFontFamily('標楷體').setFontSize(18).setBold(true);
        body.appendParagraph('');
        var tableData = [
          ['領款人', (s['姓名']||'')+'　　身份證字號：'+(s['身分證']||'___________________')],
          ['出生年月日', '_____年_____月_____日'],
          ['戶籍地址', '___________________________'],
          ['費用項目', caseName+'-'+(s['身分別']||'工作人員')+'鐘點費　'+totalHours+' H × '+hourlyRate+'元']
        ];
        var table = doc.getBody().appendTable(tableData);table.setBorderColor('#000000');
        body.appendParagraph('金額：新台幣 '+amount.toLocaleString()+' 元整　NT$ '+amount.toLocaleString()+' 元').setAlignment(DocumentApp.HorizontalAlignment.CENTER).setFontFamily('標楷體').setFontSize(13).setBold(true);
        body.appendParagraph('').appendParagraph('　　　　簽領處（請親簽）：___________________');
        body.appendParagraph('　　　　日期：'+rocDate(new Date()));
        ['1. 領款人戶籍地址、身份証編號及領款日期請詳細填寫。','2. 請附上身份證影本，以利所得之申報。'].forEach(function(n){body.appendParagraph(n).setFontSize(9).setItalic(true);});
        body.appendParagraph('銀行名稱：'+(s['銀行']||'___')+'　戶名：'+(s['戶名']||s['姓名'])+'　銀行帳號：'+(s['帳號']||'___')).setFontSize(9);
        var file = DriveApp.getFileById(doc.getId());
        if (targetFolder) file.moveTo(targetFolder);
        var url = doc.getUrl();
        govopsEnsureSheet_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態']);
        govopsAppend_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態'],
          {'產出ID':govopsId_('DOC'),'案件ID':caseId,'場次ID':sessionId,'文件類型':'工作人員領據','文件名稱':docTitle,'產出日期':govopsNow_(),'檔案連結':url,'狀態':'已產生'});
        results.push({ name: s['姓名'], amount: amount, url: url, hours: totalHours });
      } catch(e) { results.push({ name: s['姓名'], error: e.message }); }
    });
    return { success: true, data: { results: results, count: results.length }, message: '已產生 '+results.length+' 份工作人員領據', timestamp: govopsNow_() };
  }

  // ── 核銷清單（Google Sheet 全自動） ───────────────────
  if (action === 'autoGenerateReimbursementSheet') {
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    govopsEnsureSheet_('案件預算明細', BUDGET_HEADERS);
    var budgets = govopsRows_('案件預算明細', BUDGET_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var ci = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    var caseName = ci['專案計畫名稱'] || caseId;
    var sheetTitle = '核銷清單_'+caseName;
    var ss = SpreadsheetApp.create(sheetTitle);
    var sheet = ss.getActiveSheet();sheet.setName('核銷清單');
    // Title
    sheet.getRange(1,1,1,8).merge().setValue(caseName+'　核銷清單').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(2,1,1,8).merge().setValue('主辦單位：'+(ci['主辦單位']||'')+'　執行期間：'+shortD(ci['開始日期'])+'～'+shortD(ci['結束日期'])).setFontSize(10).setHorizontalAlignment('center');
    var hdrs = ['編號','支出項目','單位','數量','單價(元)','場次數','預算金額(元)','核銷狀態'];
    sheet.getRange(3,1,1,8).setValues([hdrs]).setFontWeight('bold').setBackground('#1a3a5c').setFontColor('#ffffff');
    var totalBudget = 0;
    if (budgets.length) {
      var rows = budgets.map(function(b,i){
        totalBudget += parseFloat(b['預算金額'])||0;
        return [i+1, b['支出項目']||'', b['單位']||'式', b['數量']||1, b['單價']||0, b['場次數']||1, b['預算金額']||0, b['核銷狀態']||'未核銷'];
      });
      sheet.getRange(4,1,rows.length,8).setValues(rows);
      var lastRow = 4+rows.length;
      sheet.getRange(lastRow,1,1,6).merge().setValue('合計').setFontWeight('bold').setBackground('#f0ede8');
      sheet.getRange(lastRow,7).setValue(totalBudget).setFontWeight('bold').setBackground('#f0ede8');
    } else {
      sheet.getRange(4,1,1,8).merge().setValue('（尚未建立預算明細，請先在「案件需求摘要→核銷與財務」建立預算項目）').setFontColor('#b91c1c');
    }
    sheet.setColumnWidth(1,40);sheet.setColumnWidth(2,180);sheet.setColumnWidth(7,100);
    var allR = sheet.getRange(1,1,Math.max(5,4+budgets.length),8);
    allR.setBorder(true,true,true,true,true,true);
    var targetFolder = getCaseFolderByName(caseName, caseId, '09_請款與核銷');
    var file = DriveApp.getFileById(ss.getId());
    if (targetFolder) file.moveTo(targetFolder);
    var url = ss.getUrl();
    govopsEnsureSheet_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態']);
    govopsAppend_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態'],
      {'產出ID':govopsId_('DOC'),'案件ID':caseId,'場次ID':'','文件類型':'核銷清單','文件名稱':sheetTitle,'產出日期':govopsNow_(),'檔案連結':url,'狀態':'已產生'});
    return { success: true, data: { url: url, sheetId: ss.getId(), totalBudget: totalBudget, itemCount: budgets.length }, message: '核銷清單已產生', timestamp: govopsNow_() };
  }

  // ── 結案報告（Google Doc 全自動） ─────────────────────
  if (action === 'autoGenerateClosingReport') {
    var caseId = params.caseId;
    if (!caseId) return { success: false, error: 'MISSING_PARAM', message: '缺少 caseId', timestamp: govopsNow_() };
    // Gather all data
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var ci = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    var caseName = ci['專案計畫名稱'] || caseId;
    govopsEnsureSheet_('03_案件需求摘要', CASE_REQ_HEADERS);
    var reqRows = govopsRows_('03_案件需求摘要', CASE_REQ_HEADERS);
    var req = reqRows.filter(function(r){ return String(r['案件ID'])===caseId; })[0] || {};
    govopsEnsureSheet_('03b_驗收條件', ACCEPTANCE_HEADERS);
    var accepts = govopsRows_('03b_驗收條件', ACCEPTANCE_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    var sessions = govopsRows_('02_場次活動', SESSION_HEADERS).filter(function(r){ return String(r['專案ID'])===caseId; });
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    var admitted = regs.filter(function(r){ return ['已錄取','備取'].indexOf(String(r['資格審查狀態']))>=0||['已錄取','備取'].indexOf(String(r['錄取狀態']))>=0; });
    govopsEnsureSheet_('財務收支', FINANCE_HEADERS);
    var finRows = govopsRows_('財務收支', FINANCE_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    var finIncome = finRows.filter(function(r){ return r['類型']==='收入'; }).reduce(function(s,r){ return s+(parseFloat(r['金額'])||0); }, 0);
    var finExpense = finRows.filter(function(r){ return r['類型']==='支出'; }).reduce(function(s,r){ return s+(parseFloat(r['金額'])||0); }, 0);
    govopsEnsureSheet_('案件預算明細', BUDGET_HEADERS);
    var budgets = govopsRows_('案件預算明細', BUDGET_HEADERS).filter(function(r){ return String(r['案件ID'])===caseId; });
    var org = ci['主辦單位'] || '';
    var profile = {}; try { profile = JSON.parse(PropertiesService.getScriptProperties().getProperty('govops_org_settings')||'{}'); } catch(e) {}
    var myOrg = profile.orgName || '';
    var rocY = new Date().getFullYear() - 1911;
    var docTitle = '結案報告_'+caseName;
    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();
    body.setMarginTop(72);body.setMarginBottom(72);body.setMarginLeft(72);body.setMarginRight(72);
    var setStyle = function(p, size, bold, center) {
      p.setFontFamily('標楷體').setFontSize(size||11);
      if (bold) p.setBold(true);
      if (center) p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    };
    // === Cover ===
    body.appendParagraph('');body.appendParagraph('');body.appendParagraph('');
    setStyle(body.appendParagraph(caseName), 18, true, true);
    setStyle(body.appendParagraph('成果暨結案報告'), 16, true, true);
    body.appendParagraph('');body.appendParagraph('');
    var covData = [['主辦單位',org],['承辦單位',myOrg],['執行期間',shortD(ci['開始日期'])+' 至 '+shortD(ci['結束日期'])],['結案日期',shortD(new Date())]];
    body.appendTable(covData).setBorderColor('#000000');
    setStyle(body.appendParagraph('中華民國 '+rocY+' 年'), 11, false, true);
    body.appendPageBreak();
    // === 壹、前言 ===
    setStyle(body.appendParagraph('壹、前言'), 14, true, false).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(req['計畫緣起與背景'] || '（請補充計畫緣起與背景說明）');
    body.appendParagraph('');
    // === 貳、計畫摘要 ===
    setStyle(body.appendParagraph('貳、計畫摘要'), 14, true, false).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(req['計畫目標'] || '（請補充計畫目標說明）');
    var summaryItems = [['服務對象', req['服務對象']||'—'],['預期場次數', String(req['預期場次數']||'—')+'場'],['預期參與人次', String(req['預期參與人次']||'—')+'人次']];
    body.appendTable(summaryItems).setBorderColor('#000000');
    body.appendParagraph('');
    // === 參、實施內容 ===
    setStyle(body.appendParagraph('參、實施內容'), 14, true, false).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    setStyle(body.appendParagraph('一、辦理場次規劃'), 12, true, false);
    if (sessions.length) {
      var sesHeader = [['場次','日期','時間','地點','主題','講師','預計人數']];
      var sesData = sessions.map(function(s,i){
        return ['第'+(i+1)+'場', shortD(s['活動日期']), fmtTime(s['開始時間'])+'～'+fmtTime(s['結束時間']), s['活動地點']||'', s['活動名稱']||'', s['講師']||'', String(s['預計人數']||'')];
      });
      body.appendTable(sesHeader.concat(sesData)).setBorderColor('#000000');
    } else { body.appendParagraph('（尚無場次資料）'); }
    body.appendParagraph('');
    setStyle(body.appendParagraph('二、報名與出席統計'), 12, true, false);
    body.appendTable([['報名總數', regs.length+'人'],['審查通過／錄取', admitted.length+'人'],['實際出席', '（請填入）']]).setBorderColor('#000000');
    body.appendParagraph('');
    setStyle(body.appendParagraph('三、驗收條件達成'), 12, true, false);
    if (accepts.length) {
      var acHeader = [['#','驗收項目','驗收要求','繳交規格','完成狀態']];
      var acData = accepts.map(function(a,i){
        return [String(i+1), a['驗收項目名稱']||'', a['驗收要求說明']||'', (a['繳交數量']||'')+(a['繳交格式']?' ('+a['繳交格式']+')':''), a['完成狀態']||'未完成'];
      });
      body.appendTable(acHeader.concat(acData)).setBorderColor('#000000');
    } else { body.appendParagraph('（請先在案件需求摘要中建立驗收條件）'); }
    body.appendParagraph('');
    // === 肆、實施效益 ===
    setStyle(body.appendParagraph('肆、實施效益與分析'), 14, true, false).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(req['預期效益'] || '（請補充實施效益說明）');
    body.appendParagraph('');
    // === 財務 ===
    setStyle(body.appendParagraph('經費與核銷摘要'), 12, true, false);
    body.appendTable([['收入合計','NT$ '+finIncome.toLocaleString()],['支出合計','NT$ '+finExpense.toLocaleString()],['損益','NT$ '+(finIncome-finExpense).toLocaleString()]]).setBorderColor('#000000');
    if (budgets.length) {
      body.appendParagraph('');setStyle(body.appendParagraph('預算明細'), 11, true, false);
      var bdHeader = [['#','支出項目','單位','預算金額','核銷狀態']];
      var bdData = budgets.map(function(b,i){ return [String(i+1), b['支出項目']||'', b['單位']||'', 'NT$ '+(parseFloat(b['預算金額'])||0).toLocaleString(), b['核銷狀態']||'未核銷']; });
      body.appendTable(bdHeader.concat(bdData)).setBorderColor('#000000');
    }
    body.appendParagraph('');
    // === 伍、檢討建議 ===
    setStyle(body.appendParagraph('伍、執行檢討與後續建議'), 14, true, false).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    var reviewSections = [['一、執行過程觀察',''],['二、執行中遇到的問題',''],['三、行政作業檢討',''],['四、場次安排檢討',''],['五、招生／參與情形檢討',''],['六、未來改善建議','']];
    reviewSections.forEach(function(s){
      setStyle(body.appendParagraph(s[0]), 12, true, false);
      body.appendParagraph('（請填入本項檢討內容）');body.appendParagraph('');
    });
    // Move to Drive
    var targetFolder = getCaseFolderByName(caseName, caseId, '10_成果報告');
    var file = DriveApp.getFileById(doc.getId());
    if (targetFolder) file.moveTo(targetFolder);
    var url = doc.getUrl();
    govopsEnsureSheet_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態']);
    govopsAppend_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態'],
      {'產出ID':govopsId_('DOC'),'案件ID':caseId,'場次ID':'','文件類型':'結案報告','文件名稱':docTitle,'產出日期':govopsNow_(),'檔案連結':url,'狀態':'已產生（需補充伍章）'});
    return { success: true, data: { url: url, docId: doc.getId(), chapters: 5, note: '伍、執行檢討與後續建議章節需在 Google Doc 中手動補充' }, message: '結案報告已產生，請開啟連結補充伍章內容', timestamp: govopsNow_() };
  }

  // ── 將 Google Doc 匯出為 PDF 並存回 Drive ─────────────
  if (action === 'exportDocAsPDF') {
    var docId = params.docId;
    var caseId = params.caseId || '';
    var fileName = params.fileName || '文件';
    if (!docId) return { success: false, error: 'MISSING_PARAM', message: '缺少 docId', timestamp: govopsNow_() };
    try {
      var docFile = DriveApp.getFileById(docId);
      var pdfBlob = docFile.getAs('application/pdf');
      pdfBlob.setName(fileName + '.pdf');
      // 尋找案件資料夾，優先放到 10_成果報告，其次放根資料夾
      var targetFolder = null;
      if (caseId) {
        var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
        var ci = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
        var caseName = ci['專案計畫名稱'] || caseId;
        targetFolder = getCaseFolderByName(caseName, caseId, '10_成果報告');
      }
      if (!targetFolder) {
        var rootFolderId = params.rootFolderId || '';
        targetFolder = rootFolderId ? DriveApp.getFolderById(rootFolderId) : DriveApp.getRootFolder();
      }
      var pdfFile = targetFolder.createFile(pdfBlob);
      var pdfUrl = pdfFile.getUrl();
      // 記錄產出
      govopsEnsureSheet_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態']);
      govopsAppend_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態'],
        {'產出ID':govopsId_('PDF'),'案件ID':caseId,'場次ID':'','文件類型':'PDF','文件名稱':fileName+'.pdf','產出日期':govopsNow_(),'檔案連結':pdfUrl,'狀態':'已產生'});
      return { success: true, data: { pdfUrl: pdfUrl, pdfId: pdfFile.getId(), fileName: fileName+'.pdf' }, message: 'PDF 已產生並存至 Google Drive', timestamp: govopsNow_() };
    } catch(e) {
      return { success: false, error: 'PDF_EXPORT_FAILED', message: 'PDF 產生失敗：' + e.message, timestamp: govopsNow_() };
    }
  }

  // ── 取得文件產出紀錄 ──────────────────────────────────
  if (action === 'getDocumentRecords') {
    govopsEnsureSheet_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態']);
    var rows = govopsRows_('22_文件產出紀錄', ['產出ID','案件ID','場次ID','文件類型','文件名稱','產出日期','檔案連結','狀態']);
    if (params.caseId) rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    if (params.docType) rows = rows.filter(function(r){ return r['文件類型']===params.docType; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '文件紀錄查詢完成', timestamp: govopsNow_() };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Form Sync Route — Google 表單報名全自動同步
// ════════════════════════════════════════════════════════
var FORM_CONFIG_HEADERS = ['設定ID','案件ID','場次ID','表單名稱','試算表ID','工作表名稱','欄位對應JSON','上次同步時間','同步筆數','啟用狀態','備註'];

function govopsFormSyncRoute_(params, action) {

  if (action === 'saveFormConfig') {
    govopsEnsureSheet_('28_Google表單設定', FORM_CONFIG_HEADERS);
    var rows = govopsRows_('28_Google表單設定', FORM_CONFIG_HEADERS);
    var caseId = params.caseId || '';
    var sessionId = params.sessionId || '';
    var existing = rows.filter(function(r){ return String(r['案件ID'])===caseId && String(r['場次ID'])===sessionId && String(r['試算表ID'])===params.sheetId; })[0];
    var now = govopsNow_();
    if (existing) {
      govopsUpdate_('28_Google表單設定', FORM_CONFIG_HEADERS, existing._row, {'工作表名稱': params.tabName||'表單回覆 1','欄位對應JSON': params.fieldMapJson||'','啟用狀態': '啟用','更新時間': now});
      return { success: true, data: { configId: existing['設定ID'] }, message: '表單設定已更新', timestamp: now };
    } else {
      var obj = { '設定ID': govopsId_('FRM'), '案件ID': caseId, '場次ID': sessionId, '表單名稱': params.formName||'', '試算表ID': params.sheetId||'', '工作表名稱': params.tabName||'表單回覆 1', '欄位對應JSON': params.fieldMapJson||'', '上次同步時間': '', '同步筆數': 0, '啟用狀態': '啟用', '備註': params.remark||'' };
      govopsAppend_('28_Google表單設定', FORM_CONFIG_HEADERS, obj);
      return { success: true, data: obj, message: '表單設定已建立', timestamp: now };
    }
  }

  if (action === 'getFormConfigs') {
    govopsEnsureSheet_('28_Google表單設定', FORM_CONFIG_HEADERS);
    var rows = govopsRows_('28_Google表單設定', FORM_CONFIG_HEADERS);
    if (params.caseId) rows = rows.filter(function(r){ return String(r['案件ID'])===params.caseId; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '表單設定查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'syncFormRegistrations') {
    var configId = params.configId || '';
    var sheetId = params.sheetId || '';
    var tabName = params.tabName || '表單回覆 1';
    var caseId = params.caseId || '';
    var sessionId = params.sessionId || '';
    var fieldMapJson = params.fieldMapJson || '';
    // Get config if configId provided
    if (configId) {
      govopsEnsureSheet_('28_Google表單設定', FORM_CONFIG_HEADERS);
      var configs = govopsRows_('28_Google表單設定', FORM_CONFIG_HEADERS);
      var cfg = configs.filter(function(r){ return r['設定ID']===configId; })[0];
      if (cfg) { sheetId=cfg['試算表ID']; tabName=cfg['工作表名稱']; caseId=cfg['案件ID']; sessionId=cfg['場次ID']; fieldMapJson=cfg['欄位對應JSON']; }
    }
    if (!sheetId) return { success: false, error: 'MISSING_PARAM', message: '缺少試算表ID', timestamp: govopsNow_() };
    // Default field mapping
    var fieldMap = { '姓名':'姓名','電話':'聯絡電話','Email':'電子郵件','服務單位':'任職單位','身分別':'身分類別','用餐習慣':'用餐習慣','備註':'備註' };
    if (fieldMapJson) { try { var fm = JSON.parse(fieldMapJson); Object.keys(fm).forEach(function(k){ fieldMap[k]=fm[k]; }); } catch(e) {} }
    // Read Google Sheet
    var ss, sheet, data;
    try { ss = SpreadsheetApp.openById(sheetId); } catch(e) { return { success: false, error: 'SHEET_ERROR', message: '無法開啟試算表：'+e.message+'\n請確認試算表ID正確且已分享權限給此 Apps Script', timestamp: govopsNow_() }; }
    try {
      sheet = tabName ? ss.getSheetByName(tabName) : ss.getSheets()[0];
      if (!sheet) return { success: false, error: 'TAB_NOT_FOUND', message: '找不到工作表「'+tabName+'」', timestamp: govopsNow_() };
      data = sheet.getDataRange().getValues();
    } catch(e) { return { success: false, error: 'READ_ERROR', message: '讀取失敗：'+e.message, timestamp: govopsNow_() }; }
    if (data.length < 2) return { success: true, data: { imported: 0, duplicate: 0 }, message: '表單尚無回覆資料', timestamp: govopsNow_() };
    var headers = data[0].map(function(h){ return String(h).trim(); });
    var rows = data.slice(1);
    // Get existing registrations to deduplicate
    var existRegs = govopsRows_('報名資料庫', REG_EXT_HEADERS);
    var existEmails = {};
    var existPhones = {};
    existRegs.forEach(function(r){ if(r['Email'])existEmails[String(r['Email']).toLowerCase()]=true; if(r['電話'])existPhones[String(r['電話']).replace(/\D/g,'')]=true; });
    var imported = 0, duplicate = 0, failed = 0;
    var now = govopsNow_();
    rows.forEach(function(row) {
      var obj = {};
      headers.forEach(function(h, i){ obj[h] = row[i]!==undefined&&row[i]!==null ? String(row[i]) : ''; });
      // Map fields
      var reg = { '報名ID': govopsId_('REG'), '案件ID': caseId, '活動ID': sessionId, '報名來源': 'Google表單', '報名時間': now, '建立時間': now, '更新時間': now, '資格審查狀態': '待審查' };
      Object.keys(fieldMap).forEach(function(sysField){ var formField = fieldMap[sysField]; if(formField && obj[formField] !== undefined) reg[sysField] = obj[formField]; });
      if (!reg['姓名']) return;
      // Dedup check
      var email = (reg['Email']||'').toLowerCase();
      var phone = (reg['電話']||'').replace(/\D/g,'');
      if ((email && existEmails[email]) || (phone && existPhones[phone])) { duplicate++; return; }
      govopsAppend_('報名資料庫', REG_EXT_HEADERS, reg);
      if (email) existEmails[email] = true;
      if (phone) existPhones[phone] = true;
      imported++;
    });
    // Update sync status
    if (configId) {
      govopsEnsureSheet_('28_Google表單設定', FORM_CONFIG_HEADERS);
      var cfgs = govopsRows_('28_Google表單設定', FORM_CONFIG_HEADERS);
      var c = cfgs.filter(function(r){ return r['設定ID']===configId; })[0];
      if (c) govopsUpdate_('28_Google表單設定', FORM_CONFIG_HEADERS, c._row, {'上次同步時間': now, '同步筆數': (parseInt(c['同步筆數'])||0)+imported});
    }
    // Log batch
    govopsEnsureSheet_('29_資料匯入批次紀錄', IMPORT_BATCH_HEADERS);
    govopsAppend_('29_資料匯入批次紀錄', IMPORT_BATCH_HEADERS, {'批次ID':govopsId_('IMP'),'案件ID':caseId,'場次ID':sessionId,'匯入類型':'Google表單同步','匯入來源':sheetId,'資料筆數':rows.length,'成功筆數':imported,'失敗筆數':failed,'重複筆數':duplicate,'匯入狀態':'完成','錯誤訊息':'','匯入時間':now,'操作人':'','備註':''});
    return { success: true, data: { total: rows.length, imported: imported, duplicate: duplicate, failed: failed }, message: '同步完成：新增 '+imported+' 筆，重複 '+duplicate+' 筆', timestamp: now };
  }

  return null;
}

// ════════════════════════════════════════════════════════
// Notify Route — 全自動 Email 通知
// 使用 MailApp 直接發送通知信
// ════════════════════════════════════════════════════════
function govopsNotifyRoute_(params, action) {

  function sendMail(to, subject, body) {
    if (!to || !to.includes('@')) return false;
    try { MailApp.sendEmail({ to: to, subject: subject, htmlBody: body }); return true; } catch(e) { return false; }
  }

  function buildAdmissionHtml(name, caseName, sessionInfo, status) {
    var statusText = status === '已錄取' ? '恭喜您已通過資格審查，錄取本次課程！' : status === '備取' ? '您已被列為備取，如有名額釋出將優先通知。' : '很遺憾，您未能通過本次資格審查。';
    return '<div style="font-family:Microsoft JhengHei,Arial;max-width:600px;margin:0 auto;border:1px solid #e0dbd2;border-radius:8px;overflow:hidden">'
      +'<div style="background:#0d2340;color:#fff;padding:20px 24px"><h2 style="margin:0;font-size:18px">GovOps OS 通知</h2></div>'
      +'<div style="padding:24px"><p style="font-size:15px">親愛的 '+name+' 您好，</p>'
      +'<p>'+statusText+'</p>'
      +(sessionInfo?'<div style="background:#f7f4ef;border-radius:6px;padding:12px 16px;margin:16px 0"><b>課程名稱：</b>'+caseName+'<br><b>場次資訊：</b>'+sessionInfo+'</div>':'')
      +'<p style="color:#5a5248;font-size:13px">如有任何問題，請聯繫承辦單位。</p></div>'
      +'<div style="background:#f7f4ef;padding:12px 24px;font-size:12px;color:#8a8278">此為系統自動通知，請勿直接回覆。</div></div>';
  }

  if (action === 'sendAdmissionNotices') {
    // 批次發送錄取/備取/未錄取通知
    var caseId = params.caseId || '';
    var sessionId = params.sessionId || '';
    var statusToSend = params.statusFilter || '已錄取'; // '已錄取','備取','未錄取' or '' for all
    var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
    var ci = caseRows.filter(function(r){ return String(r['專案ID'])===caseId; })[0] || {};
    var caseName = ci['專案計畫名稱'] || '';
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){
      var sm = sessionId ? String(r['活動ID'])===sessionId : true;
      var cm = caseId ? (String(r['案件ID'])===caseId) : true;
      if (!sm || !cm) return false;
      var status = r['資格審查狀態'] || r['錄取狀態'] || '';
      if (statusToSend && status !== statusToSend) return false;
      if (r['通知日期']) return false; // Already notified
      return !!r['Email'];
    });
    var sent = 0, failed = 0;
    var today = govopsNow_().substring(0,10);
    regs.forEach(function(r) {
      var status = r['資格審查狀態'] || r['錄取狀態'] || '待審查';
      var sesInfo = sessionId ? '（請至報名頁面查詢詳細場次資訊）' : '';
      var ok = sendMail(r['Email'], '【'+caseName+'】報名結果通知', buildAdmissionHtml(r['姓名']||'您', caseName, sesInfo, status));
      if (ok) {
        sent++;
        govopsUpdate_('報名資料庫', REG_EXT_HEADERS, r._row, { '通知狀態': '已通知', '通知日期': today, '更新時間': govopsNow_() });
      } else { failed++; }
    });
    return { success: true, data: { sent: sent, failed: failed, total: regs.length }, message: '通知發送完成：成功 '+sent+' 封，失敗 '+failed+' 封', timestamp: govopsNow_() };
  }

  if (action === 'sendSupplementNotices') {
    // 發補件通知
    var caseId = params.caseId || '';
    var regs = govopsRows_('報名資料庫', REG_EXT_HEADERS).filter(function(r){
      return (caseId ? String(r['案件ID'])===caseId : true) && r['資格審查狀態']==='需補件' && !!r['Email'] && !r['通知日期'];
    });
    var ci = (govopsRows_('01_專案主檔', CASE_HEADERS).filter(function(r){ return String(r['專案ID'])===caseId; })[0])||{};
    var sent = 0;
    var today = govopsNow_().substring(0,10);
    regs.forEach(function(r) {
      var html = '<div style="font-family:Microsoft JhengHei,Arial;max-width:600px;margin:0 auto;border:1px solid #e0dbd2;border-radius:8px;overflow:hidden">'
        +'<div style="background:#0d2340;color:#fff;padding:20px 24px"><h2 style="margin:0">補件通知</h2></div>'
        +'<div style="padding:24px"><p>親愛的 '+(r['姓名']||'您')+' 您好，</p>'
        +'<p>您的報名資料需要補件，請於期限前提供下列文件：</p>'
        +'<div style="background:#fff7ed;border-left:4px solid #ea580c;padding:12px 16px;margin:16px 0">'
        +'<b>補件項目：</b>'+(r['補件項目']||'請聯繫承辦人')+'<br>'
        +'<b>補件期限：</b>'+(r['補件期限']||'請盡速處理')+'</div>'
        +'</div></div>';
      var ok = sendMail(r['Email'], '【'+(ci['專案計畫名稱']||'')+'】報名補件通知', html);
      if (ok) { sent++; govopsUpdate_('報名資料庫', REG_EXT_HEADERS, r._row, { '通知日期': today, '更新時間': govopsNow_() }); }
    });
    return { success: true, data: { sent: sent }, message: '補件通知發送完成：'+sent+' 封', timestamp: govopsNow_() };
  }

  if (action === 'sendTaskReminders') {
    // 發任務到期提醒（依 MailApp quota 每次最多50封）
    govopsEnsureSheet_('案件任務清單', TASK_HEADERS);
    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    var tomorrow = Utilities.formatDate(new Date(new Date().getTime()+86400000), 'Asia/Taipei', 'yyyy-MM-dd');
    var tasks = govopsRows_('案件任務清單', TASK_HEADERS).filter(function(r){
      return (r['截止日期']===today||r['截止日期']===tomorrow) && r['任務狀態']==='待辦' && !!r['負責人'];
    });
    var profile = {};
    try { profile = JSON.parse(PropertiesService.getScriptProperties().getProperty('govops_org_settings')||'{}'); } catch(e) {}
    var myEmail = profile.email || Session.getActiveUser().getEmail();
    var sent = 0;
    if (myEmail && tasks.length) {
      var taskList = tasks.map(function(t){ return '• ['+t['優先度']+'] '+t['任務名稱']+' — 截止：'+t['截止日期']; }).join('<br>');
      sendMail(myEmail, '【GovOps OS】今日/明日到期任務提醒（'+tasks.length+'筆）', '<div style="font-family:Microsoft JhengHei,Arial;padding:20px"><h3>任務到期提醒</h3>'+taskList+'</div>');
      sent = 1;
    }
    return { success: true, data: { sent: sent, tasks: tasks.length }, message: '任務提醒已發送', timestamp: govopsNow_() };
  }

  return null;
}

function safeJSONGas_(key) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(key)||'null'); } catch(e) { return null; }
}

function govopsSimpleFallbackRoute_(params, action) {
  if (action === '查詢核銷缺件') {
    var h = ['檢查ID','活動ID','文件類型','文件名稱','狀態','缺件說明','負責人','備註','建立時間','更新時間'];
    var rows = govopsFilter_(govopsRows_('核銷檢查中心', h), params);
    return { success: true, message: '核銷缺件查詢完成', data: { rows: rows, count: rows.length } };
  }
  if (action === '取得ERP儀表板' || action === 'ERP專案總覽' || action === 'ERP風險報告') {
    // v0.1：改回傳真實案件數據
    try {
      var caseRows = govopsRows_('01_專案主檔', CASE_HEADERS);
      var sesRows = govopsRows_('02_場次活動', SESSION_HEADERS);
      var urgentStatuses = ['待請款','待收款','待結案'];
      var activeStatuses = ['執行中','已簽約','洽談中','提案中'];
      var urgent = caseRows.filter(function(r){ return urgentStatuses.indexOf(String(r['狀態'])) >= 0; });
      var active = caseRows.filter(function(r){ return activeStatuses.indexOf(String(r['狀態'])) >= 0; });
      var rows = urgent.slice(0,10).map(function(c){ return { '案件名稱': c['專案計畫名稱'], '客戶': c['主辦單位']||'—', '狀態': c['狀態'], '預估收入': c['契約金額']||'—' }; });
      return { success: true, message: action + '完成', data: {
        '專案總數': caseRows.length, '活動總數': sesRows.length,
        '今日待辦': urgent.length, '未收款金額': 0, '已收收入': 0, '支出總額': 0, '損益': 0, '核銷缺件': 0,
        rows: rows, count: rows.length
      }};
    } catch(e) {
      return { success: true, message: action + '完成', data: { rows: [], count: 0 } };
    }
  }
  return null;
}


// ════════════════════════════════════════════════════════
// 成果文件 CRUD 路由
// ════════════════════════════════════════════════════════
var ARCHIVE_DOC_HEADERS = ['文件ID','活動ID','文件名稱','文件類型','狀態','缺件項目','driveUrl','備註','建立時間','更新時間'];

function govopsArchiveDocRoute_(params, action) {
  if (action === '初始化成果文件') {
    govopsEnsureSheet_('09_成果附件', ARCHIVE_DOC_HEADERS);
    return { success: true, message: '09_成果附件 初始化完成' };
  }
  if (action === '查詢成果文件') {
    var rows = govopsFilter_(govopsRows_('09_成果附件', ARCHIVE_DOC_HEADERS), params);
    return { success: true, message: '成果文件查詢完成', data: { rows: rows, count: rows.length } };
  }
  if (action === '新增成果文件') {
    var name = params['文件名稱'] || '';
    if (!name) return { success: false, message: '文件名稱必填' };
    var obj = {
      '文件ID': govopsId_('DOC'),
      '活動ID': params['活動ID'] || '',
      '文件名稱': name,
      '文件類型': params['文件類型'] || '其他',
      '狀態': params['狀態'] || '已上傳',
      '缺件項目': params['缺件項目'] || '',
      'driveUrl': params['driveUrl'] || '',
      '備註': params['備註'] || '',
      '建立時間': govopsNow_(),
      '更新時間': govopsNow_()
    };
    govopsAppend_('09_成果附件', ARCHIVE_DOC_HEADERS, obj);
    return { success: true, message: '成果文件新增完成', data: { 文件ID: obj['文件ID'] } };
  }
  if (action === '修改成果文件') {
    var id = params['文件ID'];
    if (!id) return { success: false, message: '文件ID 必填' };
    var rows2 = govopsRows_('09_成果附件', ARCHIVE_DOC_HEADERS);
    var found = rows2.find(function(r){ return r['文件ID'] === id; });
    if (!found) return { success: false, message: '找不到文件：' + id };
    var patch = { '更新時間': govopsNow_() };
    ['文件名稱','文件類型','狀態','缺件項目','driveUrl','備註'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
    govopsUpdate_('09_成果附件', ARCHIVE_DOC_HEADERS, found._row, patch);
    return { success: true, message: '成果文件已更新', data: { 文件ID: id } };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// 財務路由（應收、收款、支出）
// ════════════════════════════════════════════════════════
var AR_HEADERS  = ['應收ID','活動ID','對象名稱','應收項目','應收金額','預計收款日','狀態','備註','建立時間','更新時間'];
var PAY_HEADERS = ['收款ID','應收ID','活動ID','收款金額','收款日期','收款方式','付款人','備註','建立時間'];
var EXP_HEADERS = ['支出ID','活動ID','支出日期','支出金額','支出類型','廠商','付款方式','備註','建立時間'];

function govopsFinanceRoute_(params, action) {
  if (action === '初始化財務') {
    govopsEnsureSheet_('16_應收帳款', AR_HEADERS);
    govopsEnsureSheet_('17_收款紀錄', PAY_HEADERS);
    govopsEnsureSheet_('18_支出明細', EXP_HEADERS);
    return { success: true, message: '財務系統初始化完成（應收、收款、支出）' };
  }
  if (action === '建立應收帳款' || action === '新增應收') {
    var amt = parseFloat(params['應收金額'] || 0);
    if (!amt) return { success: false, message: '應收金額必填' };
    var obj = { '應收ID': govopsId_('AR'), '活動ID': params['活動ID'] || '', '對象名稱': params['對象名稱'] || params['arTarget'] || '', '應收項目': params['應收項目'] || params['arItem'] || '活動費用', '應收金額': amt, '預計收款日': params['預計收款日'] || params['arDueDate'] || '', '狀態': '待收款', '備註': params['備註'] || params['arNote'] || '', '建立時間': govopsNow_(), '更新時間': govopsNow_() };
    govopsAppend_('16_應收帳款', AR_HEADERS, obj);
    return { success: true, message: '應收帳款已建立', data: { 應收ID: obj['應收ID'] } };
  }
  if (action === '查詢應收帳款') {
    var rows = govopsFilter_(govopsRows_('16_應收帳款', AR_HEADERS), params);
    return { success: true, message: '應收帳款查詢完成', data: { rows: rows, count: rows.length } };
  }
  if (action === '登錄收款' || action === '收款沖帳') {
    var pamt = parseFloat(params['收款金額'] || 0);
    if (!pamt) return { success: false, message: '收款金額必填' };
    var pobj = { '收款ID': govopsId_('PAY'), '應收ID': params['應收ID'] || params['payArId'] || '', '活動ID': params['活動ID'] || params['payActivityId'] || '', '收款金額': pamt, '收款日期': params['收款日期'] || params['payDate'] || govopsNow_().split(' ')[0], '收款方式': params['收款方式'] || params['payMethod'] || '匯款', '付款人': params['付款人'] || params['payer'] || '', '備註': params['備註'] || params['payNote'] || '', '建立時間': govopsNow_() };
    govopsAppend_('17_收款紀錄', PAY_HEADERS, pobj);
    if (pobj['應收ID']) {
      var arRows = govopsRows_('16_應收帳款', AR_HEADERS);
      var ar = arRows.find(function(r){ return r['應收ID'] === pobj['應收ID']; });
      if (ar) govopsUpdate_('16_應收帳款', AR_HEADERS, ar._row, { '狀態': '已收款', '更新時間': govopsNow_() });
    }
    return { success: true, message: '收款已登錄', data: { 收款ID: pobj['收款ID'] } };
  }
  if (action === '查詢收款紀錄') {
    var prows = govopsFilter_(govopsRows_('17_收款紀錄', PAY_HEADERS), params);
    return { success: true, message: '收款紀錄查詢完成', data: { rows: prows, count: prows.length } };
  }
  if (action === '登錄支出' || action === '新增支出') {
    var eamt = parseFloat(params['支出金額'] || 0);
    if (!eamt) return { success: false, message: '支出金額必填' };
    var eobj = { '支出ID': govopsId_('EXP'), '活動ID': params['活動ID'] || params['expActivityId'] || '', '支出日期': params['支出日期'] || params['expDate'] || govopsNow_().split(' ')[0], '支出金額': eamt, '支出類型': params['支出類型'] || params['expType'] || '其他', '廠商': params['廠商'] || params['expVendor'] || '', '付款方式': params['付款方式'] || params['expMethod'] || '現金', '備註': params['備註'] || params['expNote'] || '', '建立時間': govopsNow_() };
    govopsAppend_('18_支出明細', EXP_HEADERS, eobj);
    return { success: true, message: '支出已登錄', data: { 支出ID: eobj['支出ID'] } };
  }
  if (action === '查詢支出明細') {
    var erows = govopsFilter_(govopsRows_('18_支出明細', EXP_HEADERS), params);
    return { success: true, message: '支出查詢完成', data: { rows: erows, count: erows.length } };
  }
  if (action === '查詢損益報表') {
    var arAll = govopsRows_('16_應收帳款', AR_HEADERS);
    var payAll = govopsRows_('17_收款紀錄', PAY_HEADERS);
    var expAll = govopsRows_('18_支出明細', EXP_HEADERS);
    var totalAR = arAll.reduce(function(s,r){return s+parseFloat(r['應收金額']||0);},0);
    var totalPaid = payAll.reduce(function(s,r){return s+parseFloat(r['收款金額']||0);},0);
    var totalExp = expAll.reduce(function(s,r){return s+parseFloat(r['支出金額']||0);},0);
    return { success: true, message: '損益報表查詢完成', data: { 應收總額: totalAR, 已收總額: totalPaid, 未收總額: totalAR - totalPaid, 支出總額: totalExp, 毛損益: totalPaid - totalExp } };
  }
  if (action === '系統健康檢查') {
    return { success: true, message: '財務系統運作正常', data: { status: 'ready', checkedAt: govopsNow_() } };
  }
  if (action === '初始化提醒中心') {
    govopsEnsureSheet_('20_提醒中心', ['提醒ID','類型','對象ID','提醒內容','提醒時間','狀態','建立時間']);
    return { success: true, message: '提醒中心初始化完成' };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// 講師主檔 & 工作人員主檔 路由
// ════════════════════════════════════════════════════════
var INSTRUCTOR_HEADERS = ['講師ID','姓名','電話','Email','服務單位','專業領域','費率','銀行','帳號','戶名','身分證字號','地址','備註','建立時間','更新時間','tenantId','workspaceId','createdBy'];
var STAFF_HEADERS     = ['人員ID','姓名','電話','Email','身分別','身分證字號','銀行','帳號','戶名','備註','建立時間','更新時間','tenantId','workspaceId','createdBy'];

function govopsResourceRoute_(params, action) {
  if (action === '初始化講師主檔') {
    govopsEnsureSheet_('24_講師主檔', INSTRUCTOR_HEADERS);
    return { success: true, message: '24_講師主檔 初始化完成' };
  }
  if (action === '新增講師' || action === '儲存講師') {
    var name = params['姓名'] || '';
    if (!name) return { success: false, message: '講師姓名必填' };
    var lecId = params['講師ID'] || '';
    // 若有 講師ID 且存在 → 更新
    if (lecId) {
      var rows2 = govopsRows_('24_講師主檔', INSTRUCTOR_HEADERS);
      var found2 = rows2.find(function(r){ return r['講師ID'] === lecId; });
      if (found2) {
        if (params._tenantId && String(found2['tenantId']||'') && String(found2['tenantId']||'') !== params._tenantId) return { success:false, message:'無權限修改此講師', error:'FORBIDDEN' };
        var patch2 = { '更新時間': govopsNow_() };
        ['姓名','電話','Email','服務單位','專業領域','費率','銀行','帳號','戶名','身分證字號','地址','備註'].forEach(function(k){ if (params[k]!==undefined && params[k]!=='') patch2[k]=params[k]; });
        govopsUpdate_('24_講師主檔', INSTRUCTOR_HEADERS, found2._row, patch2);
        return { success: true, message: '講師資料已更新', data: { 講師ID: lecId } };
      }
    }
    var obj = {
      '講師ID': lecId || govopsId_('LEC'),
      '姓名': name, '電話': params['電話']||'', 'Email': params['Email']||'',
      '服務單位': params['服務單位']||'', '專業領域': params['專業領域']||'',
      '費率': params['費率']||params['時薪']||'',
      '銀行': params['銀行']||'', '帳號': params['帳號']||'', '戶名': params['戶名']||'',
      '身分證字號': params['身分證字號']||params['統編/身分證']||'',
      '地址': params['地址']||'', '備註': params['備註']||'',
      '建立時間': govopsNow_(), '更新時間': govopsNow_(),
      'tenantId': params._tenantId||'', 'workspaceId': params._workspaceId||'', 'createdBy': params._userId||''
    };
    govopsAppend_('24_講師主檔', INSTRUCTOR_HEADERS, obj);
    return { success: true, message: '講師新增完成', data: { 講師ID: obj['講師ID'], 姓名: obj['姓名'] } };
  }
  if (action === '查詢講師') {
    var rows = govopsFilter_(govopsRows_('24_講師主檔', INSTRUCTOR_HEADERS), params);
    return { success: true, message: '講師查詢完成', data: { rows: rows, count: rows.length } };
  }
  if (action === '初始化工作人員主檔') {
    govopsEnsureSheet_('25_工作人員主檔', STAFF_HEADERS);
    return { success: true, message: '25_工作人員主檔 初始化完成' };
  }
  if (action === '新增工作人員' || action === '儲存工作人員') {
    var sname = params['姓名'] || '';
    if (!sname) return { success: false, message: '姓名必填' };
    var sId = params['人員ID'] || '';
    if (sId) {
      var srows2 = govopsRows_('25_工作人員主檔', STAFF_HEADERS);
      var sfound2 = srows2.find(function(r){ return r['人員ID']===sId; });
      if (sfound2) {
        if (params._tenantId && String(sfound2['tenantId']||'') && String(sfound2['tenantId']||'')!==params._tenantId) return { success:false, message:'無權限修改此工作人員', error:'FORBIDDEN' };
        var spatch2 = { '更新時間': govopsNow_() };
        ['姓名','電話','Email','身分別','身分證字號','銀行','帳號','戶名','備註'].forEach(function(k){ if(params[k]!==undefined && params[k]!=='') spatch2[k]=params[k]; });
        govopsUpdate_('25_工作人員主檔', STAFF_HEADERS, sfound2._row, spatch2);
        return { success: true, message: '工作人員資料已更新', data: { 人員ID: sId } };
      }
    }
    var sobj = {
      '人員ID': sId || govopsId_('STF'),
      '姓名': sname, '電話': params['電話']||'', 'Email': params['Email']||'',
      '身分別': params['身分別']||'', '身分證字號': params['身分證字號']||params['統編/身分證']||'',
      '銀行': params['銀行']||'', '帳號': params['帳號']||'', '戶名': params['戶名']||'',
      '備註': params['備註']||'', '建立時間': govopsNow_(), '更新時間': govopsNow_(),
      'tenantId': params._tenantId||'', 'workspaceId': params._workspaceId||'', 'createdBy': params._userId||''
    };
    govopsAppend_('25_工作人員主檔', STAFF_HEADERS, sobj);
    return { success: true, message: '工作人員新增完成', data: { 人員ID: sobj['人員ID'], 姓名: sobj['姓名'] } };
  }
  if (action === '查詢工作人員') {
    var srows = govopsFilter_(govopsRows_('25_工作人員主檔', STAFF_HEADERS), params);
    return { success: true, message: '工作人員查詢完成', data: { rows: srows, count: srows.length } };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// 修改路由（專案、活動、廠商、學員CRM）
// ════════════════════════════════════════════════════════
function govopsModifyRoute_(params, action) {
  if (action === '修改活動') {
    var id = params['活動ID'];
    if (!id) return { success: false, message: '活動ID 必填' };
    var rows = govopsRows_('02_場次活動', ACTIVITY_HEADERS);
    var found = rows.find(function(r){ return r['活動ID'] === id; });
    if (!found) return { success: false, message: '找不到活動：' + id };
    var patch = { '更新時間': govopsNow_() };
    ['專案計畫名稱','活動名稱','活動類型','活動日期','活動地點','開始時間','結束時間','講師','聯絡電話','聯絡人','工作人員','狀態','備註'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
    govopsUpdate_('02_場次活動', ACTIVITY_HEADERS, found._row, patch);
    return { success: true, message: '活動資料已更新', data: { 活動ID: id } };
  }
  if (action === '修改專案') {
    var id = params['專案ID'];
    if (!id) return { success: false, message: '專案ID 必填' };
    var rows = govopsRows_('01_專案主檔', PROJECT_HEADERS);
    var found = rows.find(function(r){ return r['專案ID'] === id; });
    if (!found) return { success: false, message: '找不到專案：' + id };
    var patch = { '更新時間': govopsNow_() };
    ['專案計畫名稱','專案類型','主辦單位','契約金額','開始日期','結束日期','狀態','專案說明','變更原因'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
    govopsUpdate_('01_專案主檔', PROJECT_HEADERS, found._row, patch);
    return { success: true, message: '專案資料已更新', data: { 專案ID: id } };
  }
  if (action === '修改合作廠商') {
    var id = params['廠商編號'];
    if (!id) return { success: false, message: '廠商編號 必填' };
    var VH = ['廠商編號','名稱','類型','聯絡人','電話','地址','Email','支付方式','銀行','帳號','戶名','統編/身分證','是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註','建立時間','更新時間'];
    var rows = govopsRows_('23_合作廠商主檔', VH);
    var found = rows.find(function(r){ return r['廠商編號'] === id; });
    if (!found) return { success: false, message: '找不到廠商：' + id };
    var patch = { '更新時間': govopsNow_() };
    ['名稱','類型','聯絡人','電話','地址','Email','支付方式','銀行','帳號','戶名','統編/身分證','是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
    govopsUpdate_('23_合作廠商主檔', VH, found._row, patch);
    return { success: true, message: '廠商資料已更新', data: { 廠商編號: id } };
  }
  if (action === '修改學員CRM' || action === '修改學員') {
    var id = params['CRM_ID'] || params['crmPersonId'];
    if (!id) return { success: false, message: 'CRM_ID 必填' };
    var rows = govopsRows_('學員CRM', CRM_HEADERS); // 修正：使用正確的 sheet 名稱和 headers
    var found = rows.find(function(r){ return r['CRM_ID'] === id; });
    if (!found) return { success: false, message: '找不到學員：' + id };
    var patch = { '更新時間': govopsNow_() };
    ['姓名','電話','Email','身分別','服務單位','標籤','備註','行銷同意'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
    govopsUpdate_('學員CRM', CRM_HEADERS, found._row, patch);
    return { success: true, message: '學員CRM 已更新', data: { CRM_ID: id } };
  }
  return null;
}

// ════════════════════════════════════════════════════════
// 報名審查 & 通知路由
// ════════════════════════════════════════════════════════
var NOTIF_HEADERS = ['通知ID','招生活動ID','報名ID','姓名','電話','LINE_ID','通知類型','通知內容','發送狀態','發送時間','建立時間'];
var REVIEW_HEADERS = ['審查ID','報名ID','招生活動ID','審查結果','審查原因','審查人','審查時間','建立時間'];

function govopsReviewNotifRoute_(params, action) {
  if (action === '初始化審查系統') {
    govopsEnsureSheet_('28_報名審查紀錄', REVIEW_HEADERS);
    govopsEnsureSheet_('29_通知紀錄', NOTIF_HEADERS);
    return { success: true, message: '審查與通知系統初始化完成' };
  }
  if (action === '修復報名資料庫架構') {
    var ss = govopsSS_();
    var sh = ss.getSheetByName('報名資料庫');
    if (!sh) return { success: false, message: '找不到報名資料庫工作表' };
    var lastCol = sh.getLastColumn();
    var lastRow = sh.getLastRow();
    if (lastRow < 1) return { success: false, message: '工作表無資料' };

    // 讀取現有 headers
    var hdrs = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v){ return String(v).trim(); });

    // 欄位對應表：舊名 → 新名
    var renameMap = {
      '活動ID': '招生活動ID',
      '學員ID': 'CRM_ID',
      '所在地區': '備註_地區',
      'LINE UID': 'LINE_ID'
    };
    var renamedCount = 0;
    hdrs.forEach(function(h, i) {
      if (renameMap[h]) {
        sh.getRange(1, i + 1).setValue(renameMap[h]);
        renamedCount++;
      }
    });

    // 重新讀取 headers（改名後）
    hdrs = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v){ return String(v).trim(); });

    // 補缺少的欄位
    var missing = REG_HEADERS.filter(function(h){ return hdrs.indexOf(h) === -1; });
    if (missing.length) {
      sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
      lastCol += missing.length;
    }

    // 重新讀取全部 headers
    hdrs = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v){ return String(v).trim(); });

    // 修正電話欄：設為文字格式並補 0
    var phoneColIdx = hdrs.indexOf('電話') + 1;
    if (phoneColIdx > 0 && lastRow > 1) {
      var phoneRange = sh.getRange(2, phoneColIdx, lastRow - 1, 1);
      phoneRange.setNumberFormat('@'); // 強制文字格式
      var phoneVals = phoneRange.getValues();
      var fixedPhone = 0;
      phoneVals.forEach(function(row, i) {
        var p = String(row[0] || '').trim();
        if (/^\d{9}$/.test(p)) { phoneVals[i][0] = '0' + p; fixedPhone++; }
      });
      if (fixedPhone > 0) phoneRange.setValues(phoneVals);
    }

    return { success: true, message: '修復完成！欄位改名 '+renamedCount+' 個，補充欄位 '+missing.length+' 個。請重新同步資料以填入 Email 等欄位。', data: { renamed: renamedCount, added: missing.length } };
  }
  if (action === '修正電話格式') {
    var rows = govopsRows_('報名資料庫', REG_HEADERS);
    var fixed = 0;
    rows.forEach(function(r){
      var phone = String(r['電話'] || '').trim();
      if (/^\d{9}$/.test(phone)) {
        govopsUpdate_('報名資料庫', REG_HEADERS, r._row, { '電話': '0' + phone, '更新時間': govopsNow_() });
        fixed++;
      }
    });
    // 同步修正 CRM
    var crmRows = govopsRows_('學員CRM', CRM_HEADERS);
    var crmFixed = 0;
    crmRows.forEach(function(r){
      var phone = String(r['電話'] || '').trim();
      if (/^\d{9}$/.test(phone)) {
        govopsUpdate_('學員CRM', CRM_HEADERS, r._row, { '電話': '0' + phone, '更新時間': govopsNow_() });
        crmFixed++;
      }
    });
    return { success: true, message: '電話格式修正完成，報名 '+fixed+' 筆、CRM '+crmFixed+' 筆', data: { fixed: fixed, crmFixed: crmFixed } };
  }
  if (action === '修正核准狀態') {
    var rows = govopsRows_('報名資料庫', REG_HEADERS);
    var fixed = 0;
    rows.forEach(function(r){
      if (String(r['審核狀態']) === '核准' || String(r['報名狀態']) === '核准') {
        govopsUpdate_('報名資料庫', REG_HEADERS, r._row, { '審核狀態': '已入選', '報名狀態': '已入選', '更新時間': govopsNow_() });
        fixed++;
      }
    });
    return { success: true, message: '已將 ' + fixed + ' 筆「核准」修正為「已入選」', data: { fixed: fixed } };
  }
  if (action === '清除重複報名') {
    var sh = govopsEnsureSheet_('報名資料庫', REG_HEADERS);
    var allRows = govopsRows_('報名資料庫', REG_HEADERS);
    // 以 招生活動ID + 電話 為唯一鍵，保留資料最完整的（有 Email 者優先，否則保留最後一筆）
    var groups = {};
    allRows.forEach(function(r){
      var camKey = String(r['招生活動ID'] || r['活動ID'] || '').trim();
      var phoneKey = String(r['電話'] || '').trim();
      if(!camKey && !phoneKey) return;
      var key = camKey + '|' + phoneKey;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    var toDelete = [];
    Object.keys(groups).forEach(function(key){
      var grp = groups[key];
      if (grp.length <= 1) return;
      // 優先保留有 Email 的，有多個則保留最後一筆（row number 最大）
      grp.sort(function(a, b){
        var aHasEmail = a['Email'] ? 1 : 0;
        var bHasEmail = b['Email'] ? 1 : 0;
        if (bHasEmail !== aHasEmail) return bHasEmail - aHasEmail;
        return b._row - a._row; // 最後一筆優先
      });
      for (var i = 1; i < grp.length; i++) toDelete.push(grp[i]._row);
    });
    toDelete.sort(function(a,b){ return b - a; });
    toDelete.forEach(function(rowNum){ sh.deleteRow(rowNum); });
    return { success: true, message: '清除完成，保留有 Email 的最新筆，共刪除 ' + toDelete.length + ' 筆重複報名', data: { deleted: toDelete.length } };
  }
  if (action === '查詢待審查') {
    var rows = govopsRows_('報名資料庫', REG_HEADERS).filter(function(r){ return String(r['審核狀態'] || r['報名狀態'] || '') === '待審查'; });
    var kw = String(params.keyword || '').trim();
    if (kw) rows = rows.filter(function(r){ return JSON.stringify(r).indexOf(kw) >= 0; });
    return { success: true, message: '待審查名單查詢完成', data: { rows: rows, count: rows.length } };
  }
  if (action === '審查報名') {
    var regId = params['報名ID'];
    var result = params['審查結果'] || '';
    if (!regId || !result) return { success: false, message: '報名ID 和審查結果必填' };
    var rows = govopsRows_('報名資料庫', REG_HEADERS);
    var found = rows.find(function(r){ return r['報名ID'] === regId; });
    if (!found) return { success: false, message: '找不到報名：' + regId };
    govopsUpdate_('報名資料庫', REG_HEADERS, found._row, { '審核狀態': result, '報名狀態': result, '更新時間': govopsNow_() });
    var revObj = { '審查ID': govopsId_('REV'), '報名ID': regId, '招生活動ID': found['招生活動ID'] || '', '審查結果': result, '審查原因': params['審查原因'] || '', '審查人': params['審查人'] || '', '審查時間': govopsNow_(), '建立時間': govopsNow_() };
    govopsAppend_('28_報名審查紀錄', REVIEW_HEADERS, revObj);
    return { success: true, message: '審查完成：' + result, data: { 報名ID: regId, 審查結果: result } };
  }
  if (action === '批次核准報名') {
    var camId = params['招生活動ID'] || '';
    if (!camId) return { success: false, message: '招生活動ID必填' };
    var rows = govopsRows_('報名資料庫', REG_HEADERS);
    var count = 0;
    rows.forEach(function(r){
      if (r['招生活動ID'] === camId && (String(r['審核狀態']) === '待審查' || String(r['報名狀態']) === '待審查')) {
        govopsUpdate_('報名資料庫', REG_HEADERS, r._row, { '審核狀態': '已入選', '報名狀態': '已入選', '更新時間': govopsNow_() });
        count++;
      }
    });
    return { success: true, message: '批次核准完成，共 ' + count + ' 筆', data: { count: count } };
  }
  if (action === '匯入線上報名') {
    var sheetId = params['sheetId'] || '';
    var sheetName = params['sheetName'] || '';
    var camId = params['招生活動ID'] || '';
    if (!sheetId || !camId) return { success: false, message: 'sheetId 和招生活動ID必填' };
    try {
      var srcSS = SpreadsheetApp.openById(sheetId);
      var srcSh = sheetName ? (srcSS.getSheetByName(sheetName) || srcSS.getSheets()[0]) : srcSS.getSheets()[0];
      if (!srcSh) return { success: false, message: '找不到工作表' };
      var srcData = srcSh.getDataRange().getValues();
      if (srcData.length < 2) return { success: false, message: '來源表無資料' };
      var hdrs = srcData[0].map(function(v){ return String(v).trim(); });
      function findCol(keywords) {
        for (var ki = 0; ki < keywords.length; ki++) {
          var kw = keywords[ki].toLowerCase();
          for (var hi = 0; hi < hdrs.length; hi++) {
            if (hdrs[hi].toLowerCase().indexOf(kw) >= 0) return hi;
          }
        }
        return -1;
      }
      var nameIdx  = findCol(['姓名']);
      var phoneIdx = findCol(['電話','手機','mobile','phone']);
      if (nameIdx < 0) return { success: false, message: '找不到姓名欄位（欄位標題需含「姓名」）' };
      if (phoneIdx < 0) return { success: false, message: '找不到電話欄位（欄位標題需含「電話」或「手機」）' };
      var emailIdx = findCol(['email','電郵','信箱','mail','郵件']);
      var unitIdx  = findCol(['公司','行號','單位','機構','學校','組織','服務']);
      var idIdx    = findCol(['身份','身分','類型','type']);
      var mealIdx  = findCol(['用餐','餐飲','葷素','飲食','餐點']);
      var noteIdx  = findCol(['備註','note','其他']);
      // 預先確保 CRM 與報名工作表存在
      govopsEnsureSheet_('學員CRM', CRM_HEADERS);
      govopsEnsureSheet_('報名資料庫', REG_HEADERS);
      var crmCache = govopsRows_('學員CRM', CRM_HEADERS);
      // 載入本招生活動既有報名，用於去重（key = 電話）
      var existingRegs = govopsRows_('報名資料庫', REG_HEADERS).filter(function(r){ return r['招生活動ID'] === camId; });
      var existingPhones = {};
      existingRegs.forEach(function(r){ existingPhones[String(r['電話'] || '').trim()] = true; });
      var imported = 0; var skipped = 0; var duplicate = 0; var crmCreated = 0; var crmUpdated = 0;
      var startTime = new Date().getTime();
      var timeLimit = 270000; // 4.5分鐘安全上限，避免 Apps Script 6分鐘 hard limit
      for (var i = 1; i < srcData.length; i++) {
        // 超時保護：若執行超過 4.5 分鐘，停止並回傳已完成部分
        if (new Date().getTime() - startTime > timeLimit) {
          return { success: true, message: '⚠ 資料量過大，本次已匯入 '+imported+' 筆（共 '+(srcData.length-1)+' 筆），請再執行一次以繼續。重複：'+duplicate+'，略過：'+skipped, data: { imported: imported, duplicate: duplicate, skipped: skipped, crmCreated: crmCreated, crmUpdated: crmUpdated, partial: true } };
        }
        var r = srcData[i];
        var rName = String(r[nameIdx] || '').trim();
        // 先讀取所有可選欄位（修正：變數宣告移到電話去重前）
        var rPhoneRaw = String(r[phoneIdx] || '').trim();
        var rPhone = rPhoneRaw.replace(/[\s\-]/g, '');
        if (/^\d{9}$/.test(rPhone)) rPhone = '0' + rPhone;
        var rEmail = emailIdx >= 0 ? String(r[emailIdx] || '').trim() : '';
        var rUnit  = unitIdx  >= 0 ? String(r[unitIdx]  || '').trim() : '';
        var rIdent = idIdx    >= 0 ? String(r[idIdx]    || '').trim() : '';
        var rMeal  = mealIdx  >= 0 ? String(r[mealIdx]  || '').trim() : '';
        var rNote  = noteIdx  >= 0 ? String(r[noteIdx]  || '').trim() : '';
        if (!rName || !rPhone) { skipped++; continue; }
        // Upsert：同一活動已有此電話，更新 Email/服務單位/用餐習慣（不覆蓋審核狀態）
        if (existingPhones[rPhone]) {
          var existReg = existingRegs.find(function(er){ return String(er['電話']||'').trim()===rPhone || String(er['電話']||'').trim()==='0'+rPhone; });
          if (existReg) {
            var upd = { '更新時間': govopsNow_() };
            if (rEmail && !existReg['Email']) upd['Email'] = rEmail;
            if (rUnit  && !existReg['服務單位']) upd['服務單位'] = rUnit;
            if (rMeal  && !existReg['用餐習慣']) upd['用餐習慣'] = rMeal;
            if (rIdent && !existReg['身分別']) upd['身分別'] = rIdent;
            govopsUpdate_('報名資料庫', REG_HEADERS, existReg._row, upd);
          }
          duplicate++;
          continue;
        }
        // CRM 查找（使用已預載的 crmCache，不重複讀 sheet）
        var existCrm = crmCache.find(function(c){
          var cp = String(c['電話'] || '').trim();
          return cp === rPhone || cp === rPhoneRaw || (cp.length === 9 && '0'+cp === rPhone);
        });
        var crmId;
        try {
          if (existCrm) {
            crmId = existCrm['CRM_ID'];
            var newCnt = parseInt(existCrm['累積報名次數'] || 0) + 1;
            govopsUpdate_('學員CRM', CRM_HEADERS, existCrm._row, { '更新時間': govopsNow_(), '最近參與活動': camId, '累積報名次數': newCnt });
            existCrm['累積報名次數'] = newCnt; // 更新 in-memory cache
            crmUpdated++;
          } else {
            crmId = govopsId_('CRM');
            var crmObj = { 'CRM_ID': crmId, '姓名': rName, '電話': rPhone, 'Email': rEmail, '服務單位': rUnit, '身分別': rIdent, '標籤': '', '最近參與活動': camId, '累積報名次數': 1, '累積出席次數': 0, '累積完訓次數': 0, '是否回流學員': '否', '行銷同意': '', '備註': '', '建立時間': govopsNow_(), '更新時間': govopsNow_() };
            govopsAppend_('學員CRM', CRM_HEADERS, crmObj);
            // 修正：移除 govopsRows_ 重複讀取（原本在迴圈內讀整張 sheet，造成 O(n²) 效能問題）
            crmCache.push(crmObj); // 只更新 in-memory cache
            crmCreated++;
          }
        } catch(crmErr) { crmId = ''; }
        var regNote = rNote ? ('表單：' + rNote) : '';
        var regObj = { '報名ID': govopsId_('REG'), '招生活動ID': camId, '活動ID': '', '姓名': rName, '電話': rPhone, 'Email': rEmail, '身分別': rIdent, '服務單位': rUnit, '用餐習慣': rMeal, '報名狀態': '待審查', '審核狀態': '待審查', '出席狀態': '', '完訓狀態': '', '報名來源': '線上報名匯入', '報名時間': govopsNow_(), '通知狀態': '', '備註': regNote, 'CRM_ID': crmId, '建立時間': govopsNow_(), '更新時間': govopsNow_() };
        govopsAppend_('報名資料庫', REG_HEADERS, regObj);
        existingPhones[rPhone] = true;
        imported++;
      }
      return { success: true, message: '同步完成！新增 '+imported+' 筆，略過重複 '+duplicate+' 筆，略過空白 '+skipped+' 筆。CRM 新增 '+crmCreated+' 人、更新 '+crmUpdated+' 人。工作表：'+srcSh.getName(), data: { imported: imported, duplicate: duplicate, skipped: skipped, crmCreated: crmCreated, crmUpdated: crmUpdated } };
    } catch(e) { return { success: false, message: '匯入失敗：' + e.message }; }
  }
  if (action === '發送通知') {
    var type = params['通知類型'] || '審查通知';
    var content = params['通知內容'] || '';
    var regId = params['報名ID'] || '';
    var camId = params['招生活動ID'] || '';
    var allRegs = govopsRows_('報名資料庫', REG_HEADERS);
    var toNotify;
    if (regId) { toNotify = allRegs.filter(function(r){ return r['報名ID'] === regId; }); }
    else if (camId) { toNotify = allRegs.filter(function(r){ return r['招生活動ID'] === camId; }); }
    else { toNotify = govopsFilter_(allRegs, params); }
    if (!toNotify.length) return { success: false, message: '找不到符合的報名紀錄' };
    var sent = 0; var pending = 0; var failed = 0;
    toNotify.forEach(function(reg){
      var lineId = reg['LINE_ID'] || '';
      var notifContent = content || govopsDefaultNotifContent_(type, reg);
      var sendStatus = '待發送';
      var sendTime = '';
      if (lineId && typeof govopsLinePush_ === 'function') {
        try { govopsLinePush_(lineId, [{ type: 'text', text: notifContent }]); sendStatus = '已發送'; sendTime = govopsNow_(); sent++; }
        catch(e) { sendStatus = '發送失敗'; failed++; }
      } else { pending++; }
      var notifObj = { '通知ID': govopsId_('NTF'), '招生活動ID': reg['招生活動ID'] || '', '報名ID': reg['報名ID'] || '', '姓名': reg['姓名'] || '', '電話': reg['電話'] || '', 'LINE_ID': lineId, '通知類型': type, '通知內容': notifContent, '發送狀態': sendStatus, '發送時間': sendTime, '建立時間': govopsNow_() };
      govopsAppend_('29_通知紀錄', NOTIF_HEADERS, notifObj);
      govopsUpdate_('報名資料庫', REG_HEADERS, reg._row, { '通知狀態': sendStatus, '更新時間': govopsNow_() });
    });
    return { success: true, message: '通知處理完成，已發送：' + sent + '，待發送：' + pending + '，失敗：' + failed, data: { sent: sent, pending: pending, failed: failed } };
  }
  if (action === 'LINE廣播') {
    var msg = params['訊息'] || params['content'] || '';
    if (!msg) return { success: false, message: '訊息內容必填' };
    var token = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN') || '';
    if (!token) return { success: false, message: 'LINE Token 未設定' };
    try {
      var resp = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', { method: 'post', contentType: 'application/json', headers: { 'Authorization': 'Bearer ' + token }, payload: JSON.stringify({ messages: [{ type: 'text', text: msg }] }) });
      return { success: true, message: 'LINE廣播已發送', data: { status: resp.getResponseCode() } };
    } catch(e) { return { success: false, message: 'LINE廣播失敗：' + e.message }; }
  }
  if (action === '查詢通知紀錄') {
    var rows = govopsFilter_(govopsRows_('29_通知紀錄', NOTIF_HEADERS), params);
    return { success: true, message: '通知紀錄查詢完成', data: { rows: rows, count: rows.length } };
  }
  return null;
}

// ─────────────────────────────────────────────────────
// govopsSettingsRoute_ — 系統設定 (saveSetting / getSetting)
// ─────────────────────────────────────────────────────
function govopsSettingsRoute_(params, action) {
  var SETTINGS_HEADERS = ['設定鍵', '設定值', '說明', '更新時間'];
  if (action === 'saveSetting') {
    var key = String(params.key || '').trim();
    var val = String(params.value || '').trim();
    if (!key) return { success: false, message: '缺少 key', timestamp: govopsNow_() };
    govopsEnsureSheet_('28_系統設定', SETTINGS_HEADERS);
    var rows = govopsRows_('28_系統設定', SETTINGS_HEADERS);
    var existing = rows.filter(function(r){ return String(r['設定鍵']) === key; })[0];
    if (existing && existing._row) {
      govopsUpdate_('28_系統設定', SETTINGS_HEADERS, existing._row, { '設定值': val, '更新時間': govopsNow_() });
    } else {
      govopsAppend_('28_系統設定', SETTINGS_HEADERS, { '設定鍵': key, '設定值': val, '說明': params.description || '', '更新時間': govopsNow_() });
    }
    return { success: true, message: '設定已儲存', timestamp: govopsNow_() };
  }
  if (action === 'getSetting') {
    var key = String(params.key || '').trim();
    if (!key) return { success: false, message: '缺少 key', timestamp: govopsNow_() };
    var rows = govopsRows_('28_系統設定', SETTINGS_HEADERS);
    var found = rows.filter(function(r){ return String(r['設定鍵']) === key; })[0];
    return { success: true, data: { key: key, value: found ? String(found['設定值'] || '') : null }, timestamp: govopsNow_() };
  }
  return null;
}

// ─────────────────────────────────────────────────────
// govopsAuthRoute_ — 初始化 / 登入 / 使用者管理
// ─────────────────────────────────────────────────────
function govopsAuthRoute_(params, action) {
  var SETTINGS_HEADERS = ['設定鍵', '設定值', '說明', '更新時間'];
  var WORKSPACE_HEADERS = ['工作室ID', '工作室名稱', '負責人姓名', 'Email', '預設主辦單位', '系統初始化狀態', '建立時間', '更新時間'];
  var USER_HEADERS = ['使用者ID', '工作室ID', '姓名', 'Email', '角色', '帳號狀態', '最後登入時間', '建立時間', '更新時間'];

  function isInitialized() {
    try {
      var rows = govopsRows_('28_系統設定', SETTINGS_HEADERS);
      return rows.some(function(r){ return String(r['設定鍵']) === 'isInitialized' && String(r['設定值']) === 'true'; });
    } catch(e) { return false; }
  }

  function getWorkspaceName(wsId) {
    try {
      var ws = govopsRows_('30_工作室設定', WORKSPACE_HEADERS);
      var found = ws.filter(function(r){ return String(r['工作室ID']) === wsId; })[0];
      return found ? (String(found['工作室名稱'] || '')) : '';
    } catch(e) { return ''; }
  }

  function roleLabel(role) {
    return { owner:'負責人', admin:'管理者', finance:'財務', staff:'行政', viewer:'檢視者' }[role] || role || '使用者';
  }

  if (action === 'checkInitStatus') {
    var inited = isInitialized();
    var wsName = '';
    var defaultOrg = '';
    if (inited) {
      try {
        var ws = govopsRows_('30_工作室設定', WORKSPACE_HEADERS);
        if (ws.length) { wsName = String(ws[0]['工作室名稱'] || ''); defaultOrg = String(ws[0]['預設主辦單位'] || ''); }
      } catch(e) {}
    }
    return { success: true, data: { initialized: inited, workspaceName: wsName, defaultOrg: defaultOrg }, timestamp: govopsNow_() };
  }

  if (action === 'initWorkspace') {
    if (isInitialized()) {
      return { success: false, alreadyInitialized: true, message: '系統已初始化，請直接登入', timestamp: govopsNow_() };
    }
    var wsName = String(params.workspaceName || params['工作室名稱'] || '').trim();
    var ownerName = String(params.ownerName || params['負責人姓名'] || '').trim();
    var email = String(params.email || '').trim().toLowerCase();
    var defaultOrg = String(params.defaultOrg || params['預設主辦單位'] || '').trim();
    if (!wsName || !email) return { success: false, message: '工作室名稱和 Email 為必填', timestamp: govopsNow_() };
    govopsEnsureSheet_('31_使用者管理', USER_HEADERS);
    var users = govopsRows_('31_使用者管理', USER_HEADERS);
    var existing = users.filter(function(r){ return String(r['Email'] || '').toLowerCase() === email; })[0];
    if (existing) {
      // Mark initialized if needed, then return existing user
      if (!isInitialized()) {
        govopsEnsureSheet_('28_系統設定', SETTINGS_HEADERS);
        govopsAppend_('28_系統設定', SETTINGS_HEADERS, { '設定鍵': 'isInitialized', '設定值': 'true', '說明': '系統已初始化', '更新時間': govopsNow_() });
      }
      return { success: false, emailExists: true, message: '此 Email 已建立帳號，請直接登入', timestamp: govopsNow_() };
    }
    var wsId = 'WS_' + Date.now();
    var uid = 'U_' + Utilities.getUuid().replace(/-/g,'').substring(0, 12);
    govopsEnsureSheet_('30_工作室設定', WORKSPACE_HEADERS);
    govopsAppend_('30_工作室設定', WORKSPACE_HEADERS, { '工作室ID': wsId, '工作室名稱': wsName, '負責人姓名': ownerName||wsName, 'Email': email, '預設主辦單位': defaultOrg, '系統初始化狀態': 'true', '建立時間': govopsNow_(), '更新時間': govopsNow_() });
    govopsAppend_('31_使用者管理', USER_HEADERS, { '使用者ID': uid, '工作室ID': wsId, '姓名': ownerName||wsName, 'Email': email, '角色': 'owner', '帳號狀態': '啟用', '最後登入時間': govopsNow_(), '建立時間': govopsNow_(), '更新時間': govopsNow_() });
    govopsEnsureSheet_('28_系統設定', SETTINGS_HEADERS);
    govopsAppend_('28_系統設定', SETTINGS_HEADERS, { '設定鍵': 'isInitialized', '設定值': 'true', '說明': '系統已初始化', '更新時間': govopsNow_() });
    return { success: true, data: { userId: uid, tenantId: wsId, userName: ownerName||wsName, email: email, role: 'owner', roleLabel: '負責人', orgName: wsName, defaultHost: defaultOrg, plan: 'enterprise', status: 'active' }, message: '初始化成功', timestamp: govopsNow_() };
  }

  if (action === 'login') {
    var email = String(params.email || '').trim().toLowerCase();
    if (!email) return { success: false, message: '請輸入 Email', timestamp: govopsNow_() };
    if (!isInitialized()) return { success: false, message: '系統尚未初始化，請先完成設定', timestamp: govopsNow_() };
    var users = govopsRows_('31_使用者管理', USER_HEADERS);
    var user = users.filter(function(r){ return String(r['Email'] || '').toLowerCase() === email && r['帳號狀態'] === '啟用'; })[0];
    if (!user) return { success: false, message: '此 Email 尚未建立帳號，或帳號已停用', timestamp: govopsNow_() };
    try { if (user._row) govopsUpdate_('31_使用者管理', USER_HEADERS, user._row, { '最後登入時間': govopsNow_() }); } catch(e) {}
    var ws = govopsRows_('30_工作室設定', WORKSPACE_HEADERS);
    var wsInfo = ws.filter(function(r){ return String(r['工作室ID']) === String(user['工作室ID']); })[0] || {};
    return { success: true, data: {
      userId: user['使用者ID'], tenantId: user['工作室ID'],
      userName: user['姓名'], email: user['Email'],
      role: user['角色'], roleLabel: roleLabel(user['角色']),
      orgName: wsInfo['工作室名稱'] || '', defaultHost: wsInfo['預設主辦單位'] || '',
      plan: 'enterprise', status: 'active'
    }, timestamp: govopsNow_() };
  }

  if (action === 'getCurrentUser') {
    var uid = String(params.userId || '').trim();
    if (!uid) return { success: false, message: '缺少 userId', timestamp: govopsNow_() };
    var users = govopsRows_('31_使用者管理', USER_HEADERS);
    var user = users.filter(function(r){ return String(r['使用者ID']) === uid && r['帳號狀態'] === '啟用'; })[0];
    if (!user) return { success: false, message: '找不到使用者或帳號已停用', timestamp: govopsNow_() };
    return { success: true, data: user, timestamp: govopsNow_() };
  }

  return null;
}

function govopsDefaultNotifContent_(type, reg) {
  var name = reg['姓名'] || '學員';
  if (type === '資格審查通知' || type === '審查通知') return name + ' 您好，您的報名申請已送出，我們將盡快進行資格審查，請耐心等候通知。';
  if (type === '核准通知') return name + ' 您好，恭喜您的報名已通過資格審查！開課前將再次通知您相關訊息，請留意。';
  if (type === '拒絕通知') return name + ' 您好，很遺憾您的報名未通過資格審查，如有疑問請與我們聯繫，謝謝。';
  if (type === '開課通知') return name + ' 您好，課程即將開始！請準時出席，期待在課堂上見到您。';
  if (type === '簽到提醒') return name + ' 您好，提醒您今日有課程活動，請記得簽到，謝謝。';
  return name + ' 您好，' + type + '相關通知，如有疑問請聯繫主辦單位。';
}

// ════════════════════════════════════════════════════════
// SaaS Core @40 — 多租戶、帳號、資料隔離
// ════════════════════════════════════════════════════════

var TENANT_HEADERS     = ['tenantId','tenantName','orgType','primaryEmail','primaryContact','planId','status','driveRootFolder','planStartDate','planEndDate','reminderSent','createdAt','updatedAt'];
var WORKSPACE_HEADERS  = ['workspaceId','tenantId','workspaceName','defaultOrgName','status','createdAt','updatedAt'];
var SAAS_USER_HEADERS  = ['userId','tenantId','workspaceId','userName','email','passwordHash','salt','role','status','lastLoginAt','loginCount','createdAt','updatedAt'];
var SESS_LOG_HEADERS   = ['sessionId','sessionToken','userId','tenantId','workspaceId','role','loginAt','expireAt','status'];
var PLAN_HEADERS_SAAS  = ['planId','planName','maxCases','maxUsers','maxDocGen','maxImports','features','monthlyPrice','createdAt'];
var MODULE_HDR         = ['moduleId','tenantId','moduleName','isEnabled','updatedAt'];
var USAGE_HDR          = ['usageId','tenantId','workspaceId','metric','value','period','recordedAt'];
var OP_LOG_HDR         = ['opId','tenantId','userId','action','targetType','targetId','summary','timestamp'];

var GOVOPS_PLANS = [
  {planId:'free',     planName:'Free 試用',  maxCases:5,    maxUsers:2,  maxDocGen:10,  maxImports:5,   features:'基本功能',        monthlyPrice:0},
  {planId:'basic',    planName:'Basic',      maxCases:20,   maxUsers:5,  maxDocGen:50,  maxImports:20,  features:'基本+文件產出',     monthlyPrice:990},
  {planId:'pro',      planName:'Pro',        maxCases:50,   maxUsers:10, maxDocGen:200, maxImports:100, features:'全功能',           monthlyPrice:2490},
  {planId:'team',     planName:'Team',       maxCases:200,  maxUsers:30, maxDocGen:500, maxImports:500, features:'全功能+多工作空間', monthlyPrice:5990},
  {planId:'enterprise',planName:'Enterprise',maxCases:9999, maxUsers:9999,maxDocGen:9999,maxImports:9999,features:'無限制',          monthlyPrice:0}
];

// ── 密碼雜湊 ──────────────────────────────────────────
function saasHash_(pwd, salt) {
  var s = pwd + '|' + salt + '|GOVOPS_SAAS_2026';
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return b.map(function(x){ return ('0'+(x&0xff).toString(16)).slice(-2); }).join('');
}
function saasGenSalt_()  { return Utilities.getUuid().replace(/-/g,''); }
function saasGenToken_() { return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,''); }

// ── Session 驗證（含 5 分鐘快取） ─────────────────────
function govopsParseDate_(v) {
  // Google Sheets 會把日期字串自動轉成 Date 物件，直接處理
  if (v instanceof Date) return isNaN(v.getTime()) ? NaN : v.getTime();
  if (!v) return NaN;
  var s = String(v);
  // 嘗試解析 'yyyy/MM/dd HH:mm:ss' 或 'yyyy-MM-dd HH:mm:ss'
  var m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[\sT](\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6])).getTime();
  // fallback: 讓 JS 自行解析
  var d = new Date(s);
  return isNaN(d.getTime()) ? NaN : d.getTime();
}

function govopsValidateSession_(params) {
  var token = String(params.sessionToken || params.token || '').trim();
  if (!token || token.length < 8) return null;
  var cacheKey = 'sess_' + token.substring(0,32);
  var cached = null;
  try { cached = govopsCache_().get(cacheKey); } catch(e) {}
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }
  govopsEnsureSheet_('S08_登入紀錄', SESS_LOG_HEADERS);
  var rows = govopsRows_('S08_登入紀錄', SESS_LOG_HEADERS);
  var s = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i]['sessionToken'] === token && rows[i]['status'] === 'active') { s = rows[i]; break; }
  }
  if (!s) return null;
  // 使用穩健日期解析，避免 V8 date string 格式問題
  var loginAtMs = govopsParseDate_(s['loginAt']);
  if (!loginAtMs || (Date.now() - loginAtMs) > 86400000) {
    try { govopsUpdate_('S08_登入紀錄', SESS_LOG_HEADERS, s._row, { 'status':'expired' }); } catch(e) {}
    return null;
  }
  var sess = { sessionToken:token, userId:String(s['userId']||''), tenantId:String(s['tenantId']||''), workspaceId:String(s['workspaceId']||''), role:String(s['role']||'viewer') };
  try { govopsCache_().put(cacheKey, JSON.stringify(sess), 300); } catch(e) {}
  return sess;
}

// ── 用量記錄（fire-and-forget） ────────────────────────
function saasLogUsage_(tid, wid, metric) {
  try {
    govopsEnsureSheet_('S07_使用量紀錄', USAGE_HDR);
    govopsAppend_('S07_使用量紀錄', USAGE_HDR, { 'usageId':govopsId_('USG'), 'tenantId':tid, 'workspaceId':wid, 'metric':metric, 'value':1, 'period':Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM'), 'recordedAt':govopsNow_() });
  } catch(e) {}
}

// ── SaaS 主路由 ───────────────────────────────────────
function govopsSaasRoute_(params, action) {

  // 取得方案清單（公開）
  if (action === 'getPlans') {
    return { success:true, data:GOVOPS_PLANS, message:'方案清單', timestamp:govopsNow_() };
  }

  // ── 租戶註冊 ──────────────────────────────────────
  if (action === 'registerTenant') {
    var tenantName = String(params.tenantName||params.orgName||'').trim();
    var userName   = String(params.userName||'').trim();
    var email      = String(params.email||'').trim().toLowerCase();
    var password   = String(params.password||'').trim();
    if (!tenantName) return {success:false,error:'MISSING_FIELD',message:'請填寫公司／工作室名稱',timestamp:govopsNow_()};
    if (!userName)   return {success:false,error:'MISSING_FIELD',message:'請填寫使用者姓名',timestamp:govopsNow_()};
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return {success:false,error:'INVALID_EMAIL',message:'請填寫有效 Email',timestamp:govopsNow_()};
    if (password.length < 6) return {success:false,error:'WEAK_PASSWORD',message:'密碼至少 6 個字元',timestamp:govopsNow_()};
    govopsEnsureSheet_('S03_使用者', SAAS_USER_HEADERS);
    var existing = govopsRows_('S03_使用者', SAAS_USER_HEADERS);
    if (existing.some(function(u){ return String(u['email']).toLowerCase()===email; })) {
      return {success:false,error:'EMAIL_EXISTS',message:'此 Email 已被使用，請直接登入',timestamp:govopsNow_()};
    }
    var now=govopsNow_(), tenantId='T-'+Utilities.getUuid().replace(/-/g,'').substring(0,16);
    var workspaceId='W-'+Utilities.getUuid().replace(/-/g,'').substring(0,16);
    var userId='U-'+Utilities.getUuid().replace(/-/g,'').substring(0,16);
    var salt=saasGenSalt_(), passwordHash=saasHash_(password,salt);
    var planId=params.planId||'free';
    govopsEnsureSheet_('S01_租戶', TENANT_HEADERS);
    govopsAppend_('S01_租戶', TENANT_HEADERS, { 'tenantId':tenantId,'tenantName':tenantName,'orgType':params.orgType||'顧問工作室','primaryEmail':email,'primaryContact':userName,'planId':planId,'status':'active','driveRootFolder':'','createdAt':now,'updatedAt':now });
    govopsEnsureSheet_('S02_工作空間', WORKSPACE_HEADERS);
    govopsAppend_('S02_工作空間', WORKSPACE_HEADERS, { 'workspaceId':workspaceId,'tenantId':tenantId,'workspaceName':tenantName,'defaultOrgName':tenantName,'status':'active','createdAt':now,'updatedAt':now });
    govopsAppend_('S03_使用者', SAAS_USER_HEADERS, { 'userId':userId,'tenantId':tenantId,'workspaceId':workspaceId,'userName':userName,'email':email,'passwordHash':passwordHash,'salt':salt,'role':'tenant_owner','status':'active','lastLoginAt':now,'loginCount':1,'createdAt':now,'updatedAt':now });
    govopsEnsureSheet_('S08_登入紀錄', SESS_LOG_HEADERS);
    var tok=saasGenToken_(), expire=Utilities.formatDate(new Date(Date.now()+86400000),'Asia/Taipei','yyyy/MM/dd HH:mm:ss');
    govopsAppend_('S08_登入紀錄', SESS_LOG_HEADERS, { 'sessionId':govopsId_('SES'),'sessionToken':tok,'userId':userId,'tenantId':tenantId,'workspaceId':workspaceId,'role':'tenant_owner','loginAt':now,'expireAt':expire,'status':'active' });
    saasLogUsage_(tenantId,workspaceId,'register');
    return { success:true, data:{ sessionToken:tok,userId:userId,tenantId:tenantId,workspaceId:workspaceId,workspaceName:tenantName,userName:userName,email:email,role:'tenant_owner',planId:planId,planName:'Free 試用',isLoggedIn:true,loginTime:now,expireTime:expire }, message:'帳號建立成功，歡迎使用 GovOps OS SaaS 商業版！', timestamp:govopsNow_() };
  }

  // ── 登入 ──────────────────────────────────────────
  if (action === 'loginUser') {
    var email=String(params.email||'').trim().toLowerCase();
    var password=String(params.password||'').trim();
    if (!email||!password) return {success:false,error:'MISSING_FIELD',message:'Email 和密碼為必填',timestamp:govopsNow_()};
    govopsEnsureSheet_('S03_使用者', SAAS_USER_HEADERS);
    var users=govopsRows_('S03_使用者', SAAS_USER_HEADERS);
    var user=null;
    for (var i=0;i<users.length;i++) { if (String(users[i]['email']).toLowerCase()===email&&users[i]['status']==='active') { user=users[i]; break; } }
    if (!user) return {success:false,error:'NOT_FOUND',message:'Email 不存在或帳號已停用',timestamp:govopsNow_()};
    if (saasHash_(password,String(user['salt']||''))!==String(user['passwordHash']||'')) return {success:false,error:'WRONG_PASSWORD',message:'密碼錯誤，請確認後再試',timestamp:govopsNow_()};
    govopsEnsureSheet_('S01_租戶', TENANT_HEADERS);
    govopsEnsureSheet_('S02_工作空間', WORKSPACE_HEADERS);
    var tenant=(govopsRows_('S01_租戶',TENANT_HEADERS).filter(function(t){return t['tenantId']===user['tenantId'];})[0])||{};
    var ws=(govopsRows_('S02_工作空間',WORKSPACE_HEADERS).filter(function(w){return w['workspaceId']===user['workspaceId'];})[0])||{};
    var planId=tenant['planId']||'free';
    var plan=(GOVOPS_PLANS.filter(function(p){return p.planId===planId;})[0])||GOVOPS_PLANS[0];
    var now=govopsNow_(), tok=saasGenToken_(), expire=Utilities.formatDate(new Date(Date.now()+86400000),'Asia/Taipei','yyyy/MM/dd HH:mm:ss');
    govopsEnsureSheet_('S08_登入紀錄', SESS_LOG_HEADERS);
    govopsAppend_('S08_登入紀錄', SESS_LOG_HEADERS, { 'sessionId':govopsId_('LOG'),'sessionToken':tok,'userId':user['userId'],'tenantId':user['tenantId'],'workspaceId':user['workspaceId'],'role':user['role'],'loginAt':now,'expireAt':expire,'status':'active' });
    govopsUpdate_('S03_使用者', SAAS_USER_HEADERS, user._row, { 'lastLoginAt':now,'loginCount':(parseInt(user['loginCount'])||0)+1,'updatedAt':now });
    saasLogUsage_(user['tenantId'],user['workspaceId'],'login');
    return { success:true, data:{ sessionToken:tok,userId:user['userId'],tenantId:user['tenantId'],workspaceId:user['workspaceId'],workspaceName:ws['workspaceName']||tenant['tenantName']||'',userName:user['userName'],email:email,role:user['role'],planId:planId,planName:plan.planName,isLoggedIn:true,loginTime:now,expireTime:expire }, message:'登入成功', timestamp:govopsNow_() };
  }

  // ── 登出 ──────────────────────────────────────────
  if (action === 'logoutUser') {
    var tok=String(params.sessionToken||'').trim();
    if (tok) {
      govopsEnsureSheet_('S08_登入紀錄', SESS_LOG_HEADERS);
      var sessions=govopsRows_('S08_登入紀錄', SESS_LOG_HEADERS);
      sessions.forEach(function(s){ if (s['sessionToken']===tok&&s['status']==='active') govopsUpdate_('S08_登入紀錄', SESS_LOG_HEADERS, s._row, {'status':'logged_out'}); });
      try { govopsCache_().remove('sess_'+tok.substring(0,32)); } catch(e) {}
    }
    return {success:true, message:'已安全登出', timestamp:govopsNow_()};
  }

  // ── 取得目前 session 資訊 ─────────────────────────
  if (action === 'getMe') {
    var sess=govopsValidateSession_(params);
    if (!sess) return {success:false,error:'UNAUTHORIZED',message:'未登入或 session 已過期，請重新登入',timestamp:govopsNow_()};
    var tenant=(govopsRows_('S01_租戶',TENANT_HEADERS).filter(function(t){return t['tenantId']===sess.tenantId;})[0])||{};
    var planId=tenant['planId']||'free', plan=(GOVOPS_PLANS.filter(function(p){return p.planId===planId;})[0])||GOVOPS_PLANS[0];
    return {success:true,data:Object.assign({},sess,{tenantName:tenant['tenantName']||'',planId:planId,planName:plan.planName,maxCases:plan.maxCases,maxUsers:plan.maxUsers}),message:'session 有效',timestamp:govopsNow_()};
  }

  // ── 初始化 SaaS 資料表（sys_admin 用）────────────
  if (action === 'initSaasSheets') {
    ['S01_租戶','S02_工作空間','S03_使用者','S04_方案','S06_模組開關','S07_使用量紀錄','S08_登入紀錄','S09_操作日誌'].forEach(function(n){
      govopsEnsureSheet_(n, n==='S01_租戶'?TENANT_HEADERS:n==='S02_工作空間'?WORKSPACE_HEADERS:n==='S03_使用者'?SAAS_USER_HEADERS:n==='S08_登入紀錄'?SESS_LOG_HEADERS:n==='S06_模組開關'?MODULE_HDR:n==='S07_使用量紀錄'?USAGE_HDR:n==='S09_操作日誌'?OP_LOG_HDR:PLAN_HEADERS_SAAS);
    });
    var existingPlans=govopsRows_('S04_方案',PLAN_HEADERS_SAAS);
    if (!existingPlans.length) GOVOPS_PLANS.forEach(function(p){ govopsAppend_('S04_方案',PLAN_HEADERS_SAAS,Object.assign({'createdAt':govopsNow_()},p)); });
    return {success:true,message:'SaaS 資料表初始化完成（S01~S09）',timestamp:govopsNow_()};
  }

  // ── 租戶成員管理 ──────────────────────────────────
  if (action === 'getTenantUsers') {
    var sess=govopsValidateSession_(params);
    if (!sess) return {success:false,error:'UNAUTHORIZED',message:'未登入',timestamp:govopsNow_()};
    govopsEnsureSheet_('S03_使用者', SAAS_USER_HEADERS);
    var users=govopsRows_('S03_使用者', SAAS_USER_HEADERS).filter(function(u){ return u['tenantId']===sess.tenantId; });
    var safe=users.map(function(u){ return { userId:u['userId'],userName:u['userName'],email:u['email'],role:u['role'],status:u['status'],lastLoginAt:u['lastLoginAt'],createdAt:u['createdAt'] }; });
    return {success:true,data:{users:safe,count:safe.length},message:'成員清單載入完成',timestamp:govopsNow_()};
  }

  if (action === 'inviteUser') {
    var sess=govopsValidateSession_(params);
    if (!sess) return {success:false,error:'UNAUTHORIZED',message:'未登入',timestamp:govopsNow_()};
    if (!['tenant_owner','admin'].includes(sess.role)) return {success:false,error:'FORBIDDEN',message:'僅管理者以上可邀請成員',timestamp:govopsNow_()};
    var email=String(params.email||'').trim().toLowerCase();
    var userName=String(params.userName||'').trim();
    var role=String(params.role||'viewer');
    var password=String(params.password||'temp1234');
    if (!email||!userName) return {success:false,error:'MISSING_FIELD',message:'Email 和姓名為必填',timestamp:govopsNow_()};
    govopsEnsureSheet_('S03_使用者', SAAS_USER_HEADERS);
    var existing=govopsRows_('S03_使用者', SAAS_USER_HEADERS);
    if (existing.some(function(u){ return String(u['email']).toLowerCase()===email; })) return {success:false,error:'EMAIL_EXISTS',message:'此 Email 已有帳號',timestamp:govopsNow_()};
    // 方案用量：檢查 maxUsers
    var tenantUsers=existing.filter(function(u){ return u['tenantId']===sess.tenantId&&u['status']==='active'; });
    var tenantRow=(govopsRows_('S01_租戶',TENANT_HEADERS).filter(function(t){ return t['tenantId']===sess.tenantId; })[0])||{};
    var plan=(GOVOPS_PLANS.filter(function(p){ return p.planId===(tenantRow['planId']||'free'); })[0])||GOVOPS_PLANS[0];
    if (tenantUsers.length >= plan.maxUsers) return {success:false,error:'QUOTA_EXCEEDED',message:'已達方案成員數上限（'+plan.maxUsers+' 人）',timestamp:govopsNow_()};
    var now=govopsNow_(), userId='U-'+Utilities.getUuid().replace(/-/g,'').substring(0,16);
    var salt=saasGenSalt_();
    govopsAppend_('S03_使用者', SAAS_USER_HEADERS, { 'userId':userId,'tenantId':sess.tenantId,'workspaceId':sess.workspaceId,'userName':userName,'email':email,'passwordHash':saasHash_(password,salt),'salt':salt,'role':role,'status':'active','lastLoginAt':'','loginCount':0,'createdAt':now,'updatedAt':now });
    saasLogUsage_(sess.tenantId,sess.workspaceId,'invite_user');
    return {success:true,data:{userId:userId,email:email,userName:userName,role:role,tempPassword:password},message:'成員已邀請（臨時密碼：'+password+'，請提醒其登入後修改）',timestamp:govopsNow_()};
  }

  if (action === 'updateUserRole') {
    var sess=govopsValidateSession_(params);
    if (!sess) return {success:false,error:'UNAUTHORIZED',message:'未登入',timestamp:govopsNow_()};
    if (!['tenant_owner','admin'].includes(sess.role)) return {success:false,error:'FORBIDDEN',message:'僅管理者以上可修改角色',timestamp:govopsNow_()};
    var targetId=String(params.targetUserId||params.userId||'');
    var newRole=String(params.role||'viewer');
    if (!targetId) return {success:false,error:'MISSING_ID',message:'缺少目標使用者ID',timestamp:govopsNow_()};
    govopsEnsureSheet_('S03_使用者', SAAS_USER_HEADERS);
    var users=govopsRows_('S03_使用者', SAAS_USER_HEADERS);
    var target=null;
    for (var i=0;i<users.length;i++) { if (users[i]['userId']===targetId&&users[i]['tenantId']===sess.tenantId) { target=users[i]; break; } }
    if (!target) return {success:false,error:'NOT_FOUND',message:'找不到此成員',timestamp:govopsNow_()};
    govopsUpdate_('S03_使用者', SAAS_USER_HEADERS, target._row, {'role':newRole,'updatedAt':govopsNow_()});
    return {success:true,data:{userId:targetId,role:newRole},message:'角色已更新',timestamp:govopsNow_()};
  }

  if (action === 'disableUser') {
    var sess=govopsValidateSession_(params);
    if (!sess||sess.role!=='tenant_owner') return {success:false,error:'FORBIDDEN',message:'僅租戶擁有者可停用成員',timestamp:govopsNow_()};
    var targetId=String(params.targetUserId||params.userId||'');
    if (!targetId||targetId===sess.userId) return {success:false,error:'INVALID',message:'不能停用自己的帳號',timestamp:govopsNow_()};
    govopsEnsureSheet_('S03_使用者', SAAS_USER_HEADERS);
    var users=govopsRows_('S03_使用者', SAAS_USER_HEADERS);
    var target=null;
    for (var i=0;i<users.length;i++) { if (users[i]['userId']===targetId&&users[i]['tenantId']===sess.tenantId) { target=users[i]; break; } }
    if (!target) return {success:false,error:'NOT_FOUND',message:'找不到此成員',timestamp:govopsNow_()};
    govopsUpdate_('S03_使用者', SAAS_USER_HEADERS, target._row, {'status':'disabled','updatedAt':govopsNow_()});
    return {success:true,data:{userId:targetId,status:'disabled'},message:'成員已停用',timestamp:govopsNow_()};
  }

  if (action === 'changePassword') {
    var sess=govopsValidateSession_(params);
    if (!sess) return {success:false,error:'UNAUTHORIZED',message:'未登入',timestamp:govopsNow_()};
    var oldPwd=String(params.oldPassword||'');
    var newPwd=String(params.newPassword||'');
    if (!oldPwd||!newPwd||newPwd.length<6) return {success:false,error:'INVALID',message:'請填寫舊密碼及新密碼（至少6字元）',timestamp:govopsNow_()};
    govopsEnsureSheet_('S03_使用者', SAAS_USER_HEADERS);
    var users=govopsRows_('S03_使用者', SAAS_USER_HEADERS);
    var user=null;
    for (var i=0;i<users.length;i++) { if (users[i]['userId']===sess.userId) { user=users[i]; break; } }
    if (!user) return {success:false,error:'NOT_FOUND',message:'帳號不存在',timestamp:govopsNow_()};
    if (saasHash_(oldPwd,String(user['salt']||''))!==String(user['passwordHash']||'')) return {success:false,error:'WRONG_PASSWORD',message:'舊密碼錯誤',timestamp:govopsNow_()};
    var newSalt=saasGenSalt_();
    govopsUpdate_('S03_使用者', SAAS_USER_HEADERS, user._row, {'passwordHash':saasHash_(newPwd,newSalt),'salt':newSalt,'updatedAt':govopsNow_()});
    return {success:true,message:'密碼已更新',timestamp:govopsNow_()};
  }

  // ── 取得租戶設定 ──────────────────────────────────
  if (action === 'getTenantSettings') {
    var sess=govopsValidateSession_(params);
    if (!sess) return {success:false,error:'UNAUTHORIZED',message:'未登入',timestamp:govopsNow_()};
    var tenant=(govopsRows_('S01_租戶',TENANT_HEADERS).filter(function(t){return t['tenantId']===sess.tenantId;})[0])||{};
    var planId=tenant['planId']||'free', plan=(GOVOPS_PLANS.filter(function(p){return p.planId===planId;})[0])||GOVOPS_PLANS[0];
    govopsEnsureSheet_('S06_模組開關',MODULE_HDR);
    var modules=govopsRows_('S06_模組開關',MODULE_HDR).filter(function(m){return m['tenantId']===sess.tenantId;});
    return {success:true,data:{tenant:tenant,plan:plan,modules:modules},message:'租戶設定載入完成',timestamp:govopsNow_()};
  }

  // ── 平台管理（用 masterKey 驗證，不需租戶 session）──

  // 取得 masterKey（存在 Script Properties 或用預設）
  function getMasterKey_() {
    try { return PropertiesService.getScriptProperties().getProperty('GOVOPS_MASTER_KEY') || 'GOVOPS_ADMIN_2026'; } catch(e) { return 'GOVOPS_ADMIN_2026'; }
  }
  function checkMasterKey_(params) {
    return String(params.masterKey||'') === getMasterKey_();
  }

  if (action === 'adminListTenants') {
    if (!checkMasterKey_(params)) return {success:false,error:'FORBIDDEN',message:'需要 masterKey',timestamp:govopsNow_()};
    govopsEnsureSheet_('S01_租戶', TENANT_HEADERS);
    govopsEnsureSheet_('S03_使用者', SAAS_USER_HEADERS);
    var tenants = govopsRows_('S01_租戶', TENANT_HEADERS);
    var users   = govopsRows_('S03_使用者', SAAS_USER_HEADERS);
    var result  = tenants.map(function(t){
      var owner = users.filter(function(u){ return u['tenantId']===t['tenantId']&&u['role']==='tenant_owner'; })[0] || {};
      var memberCount = users.filter(function(u){ return u['tenantId']===t['tenantId']&&u['status']==='active'; }).length;
      return { tenantId:t['tenantId'], tenantName:t['tenantName'], planId:t['planId'], status:t['status'], primaryEmail:t['primaryEmail'], createdAt:t['createdAt'], ownerName:owner['userName']||'', memberCount:memberCount };
    });
    return {success:true,data:{tenants:result,count:result.length},message:'租戶清單載入完成',timestamp:govopsNow_()};
  }

  if (action === 'adminUpgradePlan') {
    if (!checkMasterKey_(params)) return {success:false,error:'FORBIDDEN',message:'需要 masterKey',timestamp:govopsNow_()};
    var tid = String(params.tenantId||'').trim();
    var newPlan = String(params.planId||'').trim();
    if (!tid||!newPlan) return {success:false,error:'MISSING_FIELD',message:'tenantId 和 planId 為必填',timestamp:govopsNow_()};
    if (!GOVOPS_PLANS.some(function(p){return p.planId===newPlan;})) return {success:false,error:'INVALID_PLAN',message:'無效的方案 ID：'+newPlan,timestamp:govopsNow_()};
    govopsEnsureSheet_('S01_租戶', TENANT_HEADERS);
    var tenants = govopsRows_('S01_租戶', TENANT_HEADERS);
    var found = null;
    for (var i=0;i<tenants.length;i++){if(tenants[i]['tenantId']===tid){found=tenants[i];break;}}
    if (!found) return {success:false,error:'NOT_FOUND',message:'找不到租戶：'+tid,timestamp:govopsNow_()};
    var plan = GOVOPS_PLANS.filter(function(p){return p.planId===newPlan;})[0];
    govopsUpdate_('S01_租戶', TENANT_HEADERS, found._row, {'planId':newPlan,'maxCases':plan.maxCases,'maxUsers':plan.maxUsers,'updatedAt':govopsNow_()});
    govopsCacheInvalidate_('S01_租戶');
    return {success:true,data:{tenantId:tid,tenantName:found['tenantName'],newPlan:newPlan,planName:plan.planName,maxCases:plan.maxCases,maxUsers:plan.maxUsers},message:'方案已升級：'+found['tenantName']+' → '+plan.planName,timestamp:govopsNow_()};
  }

  if (action === 'adminDisableTenant') {
    if (!checkMasterKey_(params)) return {success:false,error:'FORBIDDEN',message:'需要 masterKey',timestamp:govopsNow_()};
    var tid = String(params.tenantId||'').trim();
    if (!tid) return {success:false,error:'MISSING_FIELD',message:'tenantId 為必填',timestamp:govopsNow_()};
    govopsEnsureSheet_('S01_租戶', TENANT_HEADERS);
    var tenants = govopsRows_('S01_租戶', TENANT_HEADERS);
    var found = null;
    for (var i=0;i<tenants.length;i++){if(tenants[i]['tenantId']===tid){found=tenants[i];break;}}
    if (!found) return {success:false,error:'NOT_FOUND',message:'找不到租戶：'+tid,timestamp:govopsNow_()};
    govopsUpdate_('S01_租戶', TENANT_HEADERS, found._row, {'status':'disabled','updatedAt':govopsNow_()});
    return {success:true,data:{tenantId:tid,status:'disabled'},message:'租戶已停用：'+found['tenantName'],timestamp:govopsNow_()};
  }

  // ── 列出所有工作表（管理用）──
  if (action === 'listSheets') {
    var ss = govopsSS_();
    var sheets = ss.getSheets().map(function(s){ return s.getName(); });
    return {success:true, data:{sheets:sheets, count:sheets.length}, message:'共 '+sheets.length+' 個工作表', timestamp:govopsNow_()};
  }

  // ── 清除舊版/未使用工作表（管理用）──
  if (action === 'cleanupSheets') {
    var key = String(params.confirmKey || '');
    if (key !== 'CLEANUP_2026') return {success:false,error:'FORBIDDEN',message:'需要正確的 confirmKey',timestamp:govopsNow_()};
    var KEEP = [
      'S01_租戶','S02_工作空間','S03_使用者','S04_方案','S05_訂單','S06_模組開關','S07_使用量紀錄','S08_登入紀錄','S09_操作日誌',
      '01_專案主檔','02_場次活動','03_案件需求摘要','03b_驗收條件','05_場次變更紀錄','09_成果附件',
      '16_應收帳款','17_收款紀錄','18_支出明細','20_提醒中心','22_文件產出紀錄',
      '23_合作廠商主檔','24_講師主檔','25_工作人員主檔','25_上傳檔案管理',
      '28_Google表單設定','28_報名審查紀錄','28_系統設定','29_資料匯入批次紀錄','29_通知紀錄',
      '30_工作室設定','30_開課前SOP','31_使用者管理','31_標案池',
      '人力需求清單','報名資料庫','學員CRM','招生活動管理','支援人員付款','支援人員名單','支援人員工時',
      '收發公文','核銷檢查中心','案件任務清單','案件預算明細','簽到表','簽到表紀錄','結案檢核','財務收支'
    ];
    var ss = govopsSS_();
    var allSheets = ss.getSheets();
    if (allSheets.length <= 1) return {success:false,message:'只剩一個工作表，無法刪除',timestamp:govopsNow_()};
    var deleted = [], kept = [];
    allSheets.forEach(function(s){
      var n = s.getName();
      if (KEEP.indexOf(n) === -1) { deleted.push(n); }
      else { kept.push(n); }
    });
    // 確保刪除後至少剩1張
    if (kept.length === 0) return {success:false,message:'保留清單為空，取消刪除',timestamp:govopsNow_()};
    var actualDeleted = [];
    deleted.forEach(function(name){
      try {
        var s = ss.getSheetByName(name);
        if (s && ss.getSheets().length > 1) { ss.deleteSheet(s); actualDeleted.push(name); }
      } catch(e) { /* skip */ }
    });
    return {success:true, data:{deleted:actualDeleted, kept:kept.length}, message:'已刪除 '+actualDeleted.length+' 個舊工作表，保留 '+kept.length+' 個', timestamp:govopsNow_()};
  }

  // ── 開發用：清除所有 SaaS 帳號資料（重置測試環境）──
  if (action === 'devClearSaasData') {
    var key = String(params.confirmKey || '');
    if (key !== 'RESET_SAAS_2026') return {success:false,error:'FORBIDDEN',message:'需要正確的 confirmKey',timestamp:govopsNow_()};
    var cleared = [];
    ['S01_租戶','S02_工作空間','S03_使用者','S08_登入紀錄','S07_使用量紀錄'].forEach(function(sheet){
      var n = govopsClearSheet_(sheet);
      cleared.push(sheet + '(' + n + '筆)');
    });
    // 清除 session 快取
    try { CacheService.getScriptCache().removeAll([]); } catch(e) {}
    return {success:true,message:'SaaS 帳號資料已清除：' + cleared.join('、'),timestamp:govopsNow_()};
  }

  return null;
}

// ════════════════════════════════════════════════════════
// 訂閱 / 付款 / 到期提醒系統
// ════════════════════════════════════════════════════════

var ORDER_HEADERS = ['orderId','tenantId','tenantName','email','planId','planName','amount','payMethod','status','paidAt','activatedAt','expireAt','note','createdAt','updatedAt'];

// ── 取得 Script Properties 設定 ──────────────────────
function saasGetProp_(key, def) {
  try { return PropertiesService.getScriptProperties().getProperty(key) || def; } catch(e) { return def; }
}

// LINE Pay 商家 API 簽章（申請到 Channel ID/Secret 後啟用）
function linePaySign_(channelSecret, uri, body, nonce) {
  var msg = channelSecret + uri + body + nonce;
  var sig = Utilities.computeHmacSha256Signature(msg, channelSecret, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(sig);
}

function govopsPaymentRoute_(params, action) {

  // ── 取得方案資訊（公開）────────────────────────────
  if (action === 'getPlanDetail') {
    var planId = String(params.planId || '').trim();
    var plan = GOVOPS_PLANS.filter(function(p){ return p.planId === planId; })[0];
    if (!plan) return {success:false,error:'NOT_FOUND',message:'找不到方案',timestamp:govopsNow_()};
    return {success:true,data:plan,message:'方案資訊',timestamp:govopsNow_()};
  }

  // ── 客戶申請升級方案（掃 QR 付款後填表通知）─────────
  if (action === 'requestPlanUpgrade') {
    var sess = govopsValidateSession_(params);
    if (!sess) return {success:false,error:'UNAUTHORIZED',message:'請先登入',timestamp:govopsNow_()};
    var planId  = String(params.planId || '').trim();
    var payNote = String(params.payNote || '').trim();  // 付款備註或末5碼
    var plan = GOVOPS_PLANS.filter(function(p){ return p.planId===planId; })[0];
    if (!plan) return {success:false,error:'INVALID_PLAN',message:'無效方案',timestamp:govopsNow_()};
    if (planId === 'free') return {success:false,error:'INVALID',message:'Free 方案不需要付款',timestamp:govopsNow_()};
    govopsEnsureSheet_('S01_租戶',TENANT_HEADERS);
    var tenant = (govopsRows_('S01_租戶',TENANT_HEADERS).filter(function(t){return t['tenantId']===sess.tenantId;})[0])||{};
    govopsEnsureSheet_('S03_使用者',SAAS_USER_HEADERS);
    var owner  = (govopsRows_('S03_使用者',SAAS_USER_HEADERS).filter(function(u){return u['userId']===sess.userId;})[0])||{};
    var email  = owner['email'] || tenant['primaryEmail'] || '';
    var now    = govopsNow_();
    var orderId = govopsId_('ORD');
    // 寫入訂單
    govopsEnsureSheet_('S05_訂單', ORDER_HEADERS);
    govopsAppend_('S05_訂單', ORDER_HEADERS, {
      'orderId':orderId, 'tenantId':sess.tenantId, 'tenantName':tenant['tenantName']||'',
      'email':email, 'planId':planId, 'planName':plan.planName,
      'amount':plan.monthlyPrice, 'payMethod':'LINE Pay QR',
      'status':'pending', 'paidAt':'', 'activatedAt':'', 'expireAt':'',
      'note':payNote, 'createdAt':now, 'updatedAt':now
    });
    // 發 Email 通知你（平台管理員）
    var adminEmail = saasGetProp_('ADMIN_EMAIL', 'ccazhu@gmail.com');
    var subject    = '【GovOps OS】新訂閱申請：' + (tenant['tenantName']||'') + ' → ' + plan.planName;
    var body_      = '新訂閱申請\n\n'
      + '租戶名稱：' + (tenant['tenantName']||'') + '\n'
      + 'tenantId：' + sess.tenantId + '\n'
      + 'Email：' + email + '\n'
      + '申請方案：' + plan.planName + '（NT$' + plan.monthlyPrice + '/月）\n'
      + '付款備註：' + (payNote || '無') + '\n'
      + '訂單編號：' + orderId + '\n'
      + '申請時間：' + now + '\n\n'
      + '請至管理後台確認付款並升級方案：\n'
      + 'file:///C:/Users/lll/.local/bin/政府標案管理系統/GovOps_管理後台.html';
    try { GmailApp.sendEmail(adminEmail, subject, body_); } catch(e) {}
    return {success:true, data:{orderId:orderId, planName:plan.planName, amount:plan.monthlyPrice}, message:'申請已送出！我們確認付款後（通常1小時內）將為您升級，並寄送確認 Email。', timestamp:govopsNow_()};
  }

  // ── 管理員確認付款並升級（admin 用，同時通知客戶）──────
  if (action === 'adminConfirmAndUpgrade') {
    if (!checkMasterKey_(params)) return {success:false,error:'FORBIDDEN',message:'需要 masterKey',timestamp:govopsNow_()};
    var orderId = String(params.orderId || '').trim();
    var tid     = String(params.tenantId || '').trim();
    var planId  = String(params.planId || '').trim();
    if (!tid || !planId) return {success:false,error:'MISSING_FIELD',message:'tenantId 和 planId 為必填',timestamp:govopsNow_()};
    var plan = GOVOPS_PLANS.filter(function(p){return p.planId===planId;})[0];
    if (!plan) return {success:false,error:'INVALID_PLAN',message:'無效方案',timestamp:govopsNow_()};
    // 升級方案
    govopsEnsureSheet_('S01_租戶',TENANT_HEADERS);
    var tenants = govopsRows_('S01_租戶',TENANT_HEADERS);
    var found = null;
    for (var i=0;i<tenants.length;i++){if(tenants[i]['tenantId']===tid){found=tenants[i];break;}}
    if (!found) return {success:false,error:'NOT_FOUND',message:'找不到租戶：'+tid,timestamp:govopsNow_()};
    var now=govopsNow_();
    var startDate = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd');
    var expireMs  = new Date().getTime() + 31*24*60*60*1000;
    var expireDate = Utilities.formatDate(new Date(expireMs), 'Asia/Taipei', 'yyyy/MM/dd');
    govopsUpdate_('S01_租戶',TENANT_HEADERS, found._row, {
      'planId':planId,'maxCases':plan.maxCases,'maxUsers':plan.maxUsers,
      'planStartDate':startDate,'planEndDate':expireDate,'reminderSent':'','updatedAt':now
    });
    govopsCacheInvalidate_('S01_租戶');
    // 更新訂單狀態
    if (orderId) {
      govopsEnsureSheet_('S05_訂單',ORDER_HEADERS);
      var orders = govopsRows_('S05_訂單',ORDER_HEADERS);
      orders.forEach(function(o){ if(o['orderId']===orderId) govopsUpdate_('S05_訂單',ORDER_HEADERS,o._row,{'status':'activated','activatedAt':now,'expireAt':expireDate,'updatedAt':now}); });
    }
    // 發 Email 通知客戶
    var custEmail = found['primaryEmail'] || '';
    if (custEmail) {
      try {
        GmailApp.sendEmail(custEmail,
          '【GovOps OS】您的方案已升級：'+plan.planName,
          '親愛的 '+found['tenantName']+' 用戶，\n\n'
          +'您的 GovOps OS 方案已成功升級！\n\n'
          +'方案名稱：'+plan.planName+'\n'
          +'案件上限：'+plan.maxCases+' 件\n'
          +'成員上限：'+plan.maxUsers+' 位\n'
          +'有效期限：'+expireDate+'\n\n'
          +'感謝您的支持！如有任何問題請直接回覆此信。\n\nGovOps OS 團隊'
        );
      } catch(e) {}
    }
    return {success:true,data:{tenantId:tid,planName:plan.planName,expireDate:expireDate},message:'方案已升級並通知客戶：'+found['tenantName']+' → '+plan.planName+' 有效至 '+expireDate,timestamp:govopsNow_()};
  }

  // ── 查詢待處理訂單（管理員）─────────────────────────
  if (action === 'adminGetPendingOrders') {
    if (!checkMasterKey_(params)) return {success:false,error:'FORBIDDEN',message:'需要 masterKey',timestamp:govopsNow_()};
    govopsEnsureSheet_('S05_訂單',ORDER_HEADERS);
    var orders = govopsRows_('S05_訂單',ORDER_HEADERS);
    var pending = orders.filter(function(o){ return o['status']==='pending'; });
    var clean = pending.map(function(o){ var r={}; Object.keys(o).forEach(function(k){if(k!=='_row')r[k]=o[k];}); return r; });
    return {success:true,data:{orders:clean,count:clean.length},message:'待處理訂單：'+clean.length+' 筆',timestamp:govopsNow_()};
  }

  // ── LINE Pay 商家 API（申請到 Channel ID/Secret 後啟用）──
  if (action === 'createLinePayOrder') {
    var sess = govopsValidateSession_(params);
    if (!sess) return {success:false,error:'UNAUTHORIZED',message:'請先登入',timestamp:govopsNow_()};
    var channelId     = saasGetProp_('LINEPAY_CHANNEL_ID', '');
    var channelSecret = saasGetProp_('LINEPAY_CHANNEL_SECRET', '');
    if (!channelId || !channelSecret) {
      return {success:false,error:'NOT_CONFIGURED',message:'LINE Pay 商家 API 尚未設定。請至 Script Properties 設定 LINEPAY_CHANNEL_ID 和 LINEPAY_CHANNEL_SECRET。目前請使用 QR Code 手動付款流程。',timestamp:govopsNow_()};
    }
    var planId = String(params.planId||'').trim();
    var plan = GOVOPS_PLANS.filter(function(p){return p.planId===planId;})[0];
    if (!plan||!plan.monthlyPrice) return {success:false,error:'INVALID_PLAN',message:'此方案不需付款',timestamp:govopsNow_()};
    var orderId  = govopsId_('ORD');
    var nonce    = Utilities.getUuid().replace(/-/g,'');
    var isSandbox = saasGetProp_('LINEPAY_SANDBOX','true') === 'true';
    var baseUrl   = isSandbox ? 'https://sandbox-api-pay.line.me' : 'https://api-pay.line.me';
    var uri       = '/v3/payments/request';
    var confirmUrl= 'https://ccazhu-coder.github.io/job-exam-game/govbid-os/app/payment-result.html?orderId='+orderId+'&tenantId='+sess.tenantId;
    var cancelUrl = 'https://ccazhu-coder.github.io/job-exam-game/govbid-os/app/pricing.html?canceled=1';
    var reqBody = JSON.stringify({
      amount: plan.monthlyPrice, currency: 'TWD', orderId: orderId,
      packages: [{id:'pkg1',amount:plan.monthlyPrice,products:[{name:'GovOps OS '+plan.planName+'（1個月）',quantity:1,price:plan.monthlyPrice}]}],
      redirectUrls: {confirmUrl:confirmUrl,cancelUrl:cancelUrl}
    });
    var sig = linePaySign_(channelSecret, uri, reqBody, nonce);
    var resp = UrlFetchApp.fetch(baseUrl+uri, {
      method:'post',contentType:'application/json',payload:reqBody,
      headers:{'X-LINE-ChannelId':channelId,'X-LINE-Authorization-Nonce':nonce,'X-LINE-Authorization':sig,'Content-Type':'application/json'}
    });
    var result = JSON.parse(resp.getContentText());
    if (result.returnCode !== '0000') return {success:false,error:'LINEPAY_ERROR',message:result.returnMessage,timestamp:govopsNow_()};
    govopsEnsureSheet_('S05_訂單',ORDER_HEADERS);
    var tenant=(govopsRows_('S01_租戶',TENANT_HEADERS).filter(function(t){return t['tenantId']===sess.tenantId;})[0])||{};
    govopsAppend_('S05_訂單',ORDER_HEADERS,{
      'orderId':orderId,'tenantId':sess.tenantId,'tenantName':tenant['tenantName']||'','email':tenant['primaryEmail']||'',
      'planId':planId,'planName':plan.planName,'amount':plan.monthlyPrice,'payMethod':'LINE Pay API',
      'status':'awaiting_payment','paidAt':'','activatedAt':'','expireAt':'',
      'note':result.info.transactionId||'','createdAt':govopsNow_(),'updatedAt':govopsNow_()
    });
    return {success:true,data:{paymentUrl:result.info.paymentUrl.web,transactionId:result.info.transactionId,orderId:orderId},message:'LINE Pay 付款連結已建立',timestamp:govopsNow_()};
  }

  if (action === 'confirmLinePayOrder') {
    var transactionId = String(params.transactionId||'').trim();
    var orderId       = String(params.orderId||'').trim();
    if (!transactionId||!orderId) return {success:false,error:'MISSING_FIELD',message:'缺少 transactionId 或 orderId',timestamp:govopsNow_()};
    var channelId     = saasGetProp_('LINEPAY_CHANNEL_ID','');
    var channelSecret = saasGetProp_('LINEPAY_CHANNEL_SECRET','');
    if (!channelId||!channelSecret) return {success:false,error:'NOT_CONFIGURED',message:'LINE Pay 未設定',timestamp:govopsNow_()};
    govopsEnsureSheet_('S05_訂單',ORDER_HEADERS);
    var orders = govopsRows_('S05_訂單',ORDER_HEADERS);
    var order  = orders.filter(function(o){return o['orderId']===orderId;})[0];
    if (!order) return {success:false,error:'NOT_FOUND',message:'找不到訂單',timestamp:govopsNow_()};
    var planId  = order['planId'];
    var plan    = GOVOPS_PLANS.filter(function(p){return p.planId===planId;})[0];
    var isSandbox=saasGetProp_('LINEPAY_SANDBOX','true')==='true';
    var baseUrl=isSandbox?'https://sandbox-api-pay.line.me':'https://api-pay.line.me';
    var uri='/v3/payments/'+transactionId+'/confirm';
    var nonce=Utilities.getUuid().replace(/-/g,'');
    var reqBody=JSON.stringify({amount:plan.monthlyPrice,currency:'TWD'});
    var sig=linePaySign_(channelSecret,uri,reqBody,nonce);
    var resp=UrlFetchApp.fetch(baseUrl+uri,{method:'post',contentType:'application/json',payload:reqBody,headers:{'X-LINE-ChannelId':channelId,'X-LINE-Authorization-Nonce':nonce,'X-LINE-Authorization':sig,'Content-Type':'application/json'}});
    var result=JSON.parse(resp.getContentText());
    if (result.returnCode!=='0000') return {success:false,error:'CONFIRM_FAILED',message:result.returnMessage,timestamp:govopsNow_()};
    // 升級方案
    var now=govopsNow_(),startDate=Utilities.formatDate(new Date(),'Asia/Taipei','yyyy/MM/dd');
    var expireDate=Utilities.formatDate(new Date(new Date().getTime()+31*24*60*60*1000),'Asia/Taipei','yyyy/MM/dd');
    var tenants=govopsRows_('S01_租戶',TENANT_HEADERS);
    var tenant=tenants.filter(function(t){return t['tenantId']===order['tenantId'];})[0];
    if (tenant) govopsUpdate_('S01_租戶',TENANT_HEADERS,tenant._row,{'planId':planId,'maxCases':plan.maxCases,'maxUsers':plan.maxUsers,'planStartDate':startDate,'planEndDate':expireDate,'updatedAt':now});
    govopsUpdate_('S05_訂單',ORDER_HEADERS,order._row,{'status':'activated','paidAt':now,'activatedAt':now,'expireAt':expireDate,'updatedAt':now});
    govopsCacheInvalidate_('S01_租戶');
    return {success:true,data:{planName:plan.planName,expireDate:expireDate},message:'付款確認成功，方案已升級至 '+plan.planName,timestamp:govopsNow_()};
  }

  // ── 到期提醒（每月由 Time-driven Trigger 自動執行）──
  if (action === 'checkRenewalReminders') {
    if (!checkMasterKey_(params)) return {success:false,error:'FORBIDDEN',message:'需要 masterKey',timestamp:govopsNow_()};
    govopsEnsureSheet_('S01_租戶',TENANT_HEADERS);
    var tenants=govopsRows_('S01_租戶',TENANT_HEADERS);
    var today=new Date(), todayStr=Utilities.formatDate(today,'Asia/Taipei','yyyy/MM/dd');
    var day7=new Date(today.getTime()+7*24*60*60*1000);
    var day7Str=Utilities.formatDate(day7,'Asia/Taipei','yyyy/MM/dd');
    var notified=0, alreadySent=0;
    tenants.forEach(function(t){
      if (t['planId']==='free'||t['planId']==='enterprise') return;
      if (!t['planEndDate']||t['status']!=='active') return;
      if (t['reminderSent']==='true') { alreadySent++; return; }
      if (t['planEndDate']<=day7Str && t['planEndDate']>=todayStr) {
        var email=t['primaryEmail']||'';
        if (email) {
          try {
            GmailApp.sendEmail(email,
              '【GovOps OS】您的方案即將到期',
              '親愛的 '+t['tenantName']+' 用戶，\n\n'
              +'您的 '+(GOVOPS_PLANS.filter(function(p){return p.planId===t['planId'];})[0]||{}).planName+' 方案將於 '+t['planEndDate']+' 到期。\n\n'
              +'請盡快至方案頁面續約，以免功能受限：\n'
              +'https://ccazhu-coder.github.io/job-exam-game/govbid-os/app/pricing.html\n\n'
              +'如有任何問題，歡迎直接回覆此信。\n\nGovOps OS 團隊'
            );
            govopsUpdate_('S01_租戶',TENANT_HEADERS,t._row,{'reminderSent':'true','updatedAt':govopsNow_()});
            notified++;
          } catch(e) {}
        }
      }
    });
    return {success:true,data:{notified:notified,alreadySent:alreadySent},message:'到期提醒檢查完成，發送 '+notified+' 封提醒',timestamp:govopsNow_()};
  }

  // ── 安裝每月到期提醒排程（只需執行一次）──────────────
  if (action === 'installRenewalTrigger') {
    if (!checkMasterKey_(params)) return {success:false,error:'FORBIDDEN',message:'需要 masterKey',timestamp:govopsNow_()};
    try {
      ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='govopsRenewalTriggerRun') ScriptApp.deleteTrigger(t); });
      ScriptApp.newTrigger('govopsRenewalTriggerRun').timeBased().onMonthDay(25).atHour(9).create();
      return {success:true,message:'✅ 每月 25 日 09:00 自動發送到期提醒已設定',timestamp:govopsNow_()};
    } catch(e) { return {success:false,message:'排程設定失敗：'+e.message,timestamp:govopsNow_()}; }
  }

  return null;
}

// ── 每月到期提醒 Trigger 執行函式 ────────────────────
function govopsRenewalTriggerRun() {
  var masterKey = saasGetProp_('GOVOPS_MASTER_KEY','GOVOPS_ADMIN_2026');
  govopsPaymentRoute_({masterKey:masterKey}, 'checkRenewalReminders');
}
