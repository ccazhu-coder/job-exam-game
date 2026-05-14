/**
 * GovOps OS｜ALL-IN-ONE Apps Script 正式後端
 * 目的：一次解決前端找不到 action 的問題。
 * 使用方式：
 * 1. Apps Script 新增一個檔案：GOVOPS_ALL_IN_ONE_BACKEND_FINAL.gs
 * 2. 將本檔完整貼上。
 * 3. 其他重複定義 doGet/doPost/jsonOutput 的檔案請先停用或刪除，避免衝突。
 * 4. 部署 → 管理部署作業 → 編輯 → 新增版本 → 部署。
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

function govopsMainRouter_(params) {
  params = params || {};
  var action = String(params.action || '');
  var result = null;

  result = govopsVendorRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsEnrollmentRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsCourseOpsRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsProjectActivityRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsProductionRoute_(params, action);
  if (result) return jsonOutput(result);

  if (typeof govopsLineRoute_ === 'function') { result = govopsLineRoute_(params, action); if (result) return jsonOutput(result); }

  result = govopsSopRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsTenderRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsModifyRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsResourceRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsArchiveDocRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsFinanceRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsReviewNotifRoute_(params, action);
  if (result) return jsonOutput(result);

  result = govopsDocumentRoute_(params, action);
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

  result = govopsSimpleFallbackRoute_(params, action);
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
    if (missing.length) sh.getRange(1, first.filter(Boolean).length + 1, 1, missing.length).setValues([missing]);
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
  hs.forEach(function(h, i){ if (patch[h] !== undefined) sh.getRange(rowNumber, i + 1).setValue(patch[h]); });
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
  var kw = String(params.keyword || params.q || params['關鍵字'] || '').trim();
  if (kw) rows = rows.filter(function(r){ return JSON.stringify(r).indexOf(kw) >= 0; });
  return rows;
}

var VENDOR_HEADERS = ['廠商編號','名稱','類型','聯絡人','電話','地址','Email','支付方式','銀行','帳號','戶名','統編/身分證','是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註','建立時間','更新時間'];
var PROJECT_HEADERS = ['專案ID','專案計畫名稱','專案類型','主辦單位','開始日期','結束日期','契約金額','狀態','專案說明','備註','建立時間','更新時間'];
// CASE_HEADERS = PROJECT_HEADERS 原有12欄 + 擴充9欄（第13~21欄），govopsEnsureSheet_會自動補欄
var CASE_HEADERS = ['專案ID','專案計畫名稱','專案類型','主辦單位','開始日期','結束日期','契約金額','狀態','專案說明','備註','建立時間','更新時間','承辦窗口','聯絡電話','Email','結案期限','預估成本','付款狀態','結案狀態','Drive連結','Calendar連結'];
var ACTIVITY_HEADERS = ['活動ID','專案ID','專案計畫名稱','活動名稱','活動日期','活動類型','開始時間','結束時間','活動地點','講師','聯絡電話','聯絡人','工作人員','狀態','備註','建立時間','更新時間'];
// SESSION_HEADERS = ACTIVITY_HEADERS 原有17欄 + v0.1擴充14欄，govopsEnsureSheet_自動補欄
var SESSION_HEADERS = ['活動ID','專案ID','專案計畫名稱','活動名稱','活動日期','活動類型','開始時間','結束時間','活動地點','講師','聯絡電話','聯絡人','工作人員','狀態','備註','建立時間','更新時間','報名截止日','預計人數','實際人數','是否需簽到表','是否需簽退表','是否需便當','是否需保險','是否需問卷','是否需成果照片','是否需講師領據','是否需工作人員','CalendarEventID','CalendarLink','已同步日曆','日曆同步狀態','變更狀態'];
var CAMPAIGN_HEADERS = ['招生活動ID','專案ID','活動ID','課程名稱','招生狀態','報名開始日','報名截止日','開課日期','招生名額','候補名額','報名連結','招生渠道','主辦單位','聯絡人','聯絡電話','備註','建立時間','更新時間'];
var REG_HEADERS = ['報名ID','招生活動ID','活動ID','姓名','電話','Email','身分別','服務單位','用餐習慣','報名狀態','審核狀態','出席狀態','完訓狀態','報名來源','報名時間','通知狀態','備註','CRM_ID','建立時間','更新時間'];
// REG_EXT_HEADERS = REG_HEADERS 原有20欄 + v0.1擴充13欄
var REG_EXT_HEADERS = ['報名ID','招生活動ID','活動ID','姓名','電話','Email','身分別','服務單位','用餐習慣','報名狀態','審核狀態','出席狀態','完訓狀態','報名來源','報名時間','通知狀態','備註','CRM_ID','建立時間','更新時間','案件ID','性別','出生日期','身分證字號','地址','職稱','資格審查狀態','審查結果','補件項目','補件期限','通知日期','錄取狀態','匯入批次ID'];
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
    var rows = govopsRows_('01_專案主檔', CASE_HEADERS);
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
    return { success: true, data: clean, message: '案件查詢完成，共 ' + clean.length + ' 筆', timestamp: govopsNow_() };
  }

  // createCase: 新增案件（寫入擴充欄位）
  if (action === 'createCase') {
    var cname = params['案件名稱'] || params['專案計畫名稱'] || params.name;
    if (!cname) return { success: false, error: 'MISSING_REQUIRED', message: '案件名稱為必填', timestamp: govopsNow_() };
    var ctype = params['案件類型'] || params['專案類型'] || '';
    if (!ctype) return { success: false, error: 'MISSING_REQUIRED', message: '案件類型為必填', timestamp: govopsNow_() };
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
      'Calendar連結': params['Calendar連結'] || ''
    };
    govopsAppend_('01_專案主檔', CASE_HEADERS, cobj);
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
    govopsUpdate_('01_專案主檔', CASE_HEADERS, found._row, { '狀態': '封存', '更新時間': govopsNow_() });
    return { success: true, data: { caseId: caseId, status: '封存' }, message: '案件已封存', timestamp: govopsNow_() };
  }

  // getCaseStats: 案件統計（供 Dashboard 使用）
  if (action === 'getCaseStats') {
    var allRows = govopsRows_('01_專案主檔', CASE_HEADERS);
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
    var rows = govopsRows_('02_場次活動', SESSION_HEADERS);
    // caseId 篩選（最常用）
    var caseIdF = String(params.caseId || params['專案ID'] || '').trim();
    if (caseIdF) rows = rows.filter(function(r){ return String(r['專案ID']) === caseIdF; });
    // keyword
    var kw = String(params.keyword || params.q || '').trim();
    if (kw) rows = rows.filter(function(r){ return String(r['活動名稱']).indexOf(kw) >= 0 || String(r['活動地點']).indexOf(kw) >= 0 || String(r['講師']).indexOf(kw) >= 0; });
    // status
    var statusF = String(params.status || params['狀態'] || '').trim();
    if (statusF) rows = rows.filter(function(r){ return String(r['狀態']) === statusF; });
    // dateFrom / dateTo（活動日期）
    var dateFrom = String(params.dateFrom || '').trim();
    var dateTo = String(params.dateTo || '').trim();
    if (dateFrom) rows = rows.filter(function(r){ return String(r['活動日期']) >= dateFrom; });
    if (dateTo) rows = rows.filter(function(r){ return String(r['活動日期']) <= dateTo; });
    // 排除封存
    var incArch = String(params.includeArchived || '').toLowerCase() === 'true';
    if (!incArch) rows = rows.filter(function(r){ return String(r['狀態'] || '') !== '封存'; });
    var clean = rows.map(function(r){ var o = {}; Object.keys(r).forEach(function(k){ if (k !== '_row') o[k] = r[k]; }); return o; });
    return { success: true, data: clean, message: '場次查詢完成，共 ' + clean.length + ' 筆', timestamp: govopsNow_() };
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
    govopsAppend_('02_場次活動', SESSION_HEADERS, sobj);
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
    govopsUpdate_('02_場次活動', SESSION_HEADERS, foundSes._row, { '狀態': '封存', '更新時間': govopsNow_() });
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
    var rows = govopsRows_('報名資料庫', REG_EXT_HEADERS);
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
    return { success: true, data: clean, message: '報名查詢完成，共 ' + clean.length + ' 筆', timestamp: govopsNow_() };
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
    govopsAppend_('報名資料庫', REG_EXT_HEADERS, robj);
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
    var regPatch = { '更新時間': govopsNow_() };
    var regUpdatable = ['審核狀態','報名狀態','資格審查狀態','審查結果','補件項目','補件期限','錄取狀態','出席狀態','完訓狀態','通知狀態','通知日期','備註','用餐習慣','身分別','服務單位','職稱'];
    regUpdatable.forEach(function(f){ if (params[f] !== undefined && params[f] !== '') regPatch[f] = params[f]; });
    govopsUpdate_('報名資料庫', REG_EXT_HEADERS, foundReg._row, regPatch);
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
    return { success: true, data: { total: total, admitted: admitted, withAddress: withAddr, needMeal: needMeal }, message: '文件資料彙整完成', timestamp: govopsNow_() };
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
var FINANCE_HEADERS = ['收支ID','案件ID','場次ID','類型','科目','對象名稱','金額','付款方式','預計收付日','實際收付日','收付狀態','憑證連結','備註','建立時間','更新時間'];
function govopsFinanceV1Route_(params, action) {
  if (action === 'getFinanceRecords') {
    var rows = govopsRows_('財務收支', FINANCE_HEADERS);
    var caseId = params.caseId || '';
    var type = params.type || '';
    var status = params.status || '';
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    if (type) rows = rows.filter(function(r){ return String(r['類型']) === type; });
    if (status) rows = rows.filter(function(r){ return String(r['收付狀態']) === status; });
    var clean = rows.map(function(r){ var o={}; Object.keys(r).forEach(function(k){if(k!=='_row')o[k]=r[k];}); return o; });
    return { success: true, data: clean, message: '財務查詢完成，共 ' + clean.length + ' 筆', timestamp: govopsNow_() };
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
    govopsAppend_('財務收支', FINANCE_HEADERS, obj);
    return { success: true, data: { finId: obj['收支ID'], row: obj }, message: '財務紀錄已新增', timestamp: govopsNow_() };
  }
  if (action === 'updateFinanceRecord') {
    var finId = params.finId || params['收支ID'];
    if (!finId) return { success: false, error: 'MISSING_ID', message: '缺少收支ID', timestamp: govopsNow_() };
    var rows = govopsRows_('財務收支', FINANCE_HEADERS);
    var found = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i]['收支ID'] === finId) { found = rows[i]; break; } }
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到財務紀錄', timestamp: govopsNow_() };
    var patch = { '更新時間': govopsNow_() };
    ['類型','科目','對象名稱','金額','付款方式','預計收付日','實際收付日','收付狀態','憑證連結','備註'].forEach(function(f){ if (params[f] !== undefined && params[f] !== '') patch[f] = params[f]; });
    govopsUpdate_('財務收支', FINANCE_HEADERS, found._row, patch);
    return { success: true, data: { finId: finId, updated: patch }, message: '財務紀錄已更新', timestamp: govopsNow_() };
  }
  if (action === 'getFinanceSummary') {
    var caseId = params.caseId || '';
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
    return { success: true, data: { totalIncome: income, totalExpense: expense, received: received, paid: paid, pendingReceivable: pending, profit: received - paid }, message: '財務摘要完成', timestamp: govopsNow_() };
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
var ODOC_HEADERS = ['公文ID','公文類型','案件ID','公文編號','主旨','發文單位','收文單位','承辦窗口','聯絡電話','來文日期','發文日期','辦理期限','是否需回覆','回覆期限','是否需補件','公文摘要','附件連結','處理狀態','負責人','備註','建立時間','更新時間'];

function govopsOfficialDocRoute_(params, action) {
  if (action === 'getOfficialDocs') {
    govopsEnsureSheet_('收發公文', ODOC_HEADERS);
    var rows = govopsRows_('收發公文', ODOC_HEADERS);
    var caseId = String(params.caseId || '').trim();
    var type = String(params.type || params['公文類型'] || '').trim();
    var status = String(params.status || params['處理狀態'] || '').trim();
    var kw = String(params.keyword || '').trim();
    if (caseId) rows = rows.filter(function(r){ return String(r['案件ID']) === caseId; });
    if (type) rows = rows.filter(function(r){ return String(r['公文類型']) === type; });
    if (status) rows = rows.filter(function(r){ return String(r['處理狀態']) === status; });
    if (kw) rows = rows.filter(function(r){ return String(r['主旨']).indexOf(kw)>=0 || String(r['公文編號']).indexOf(kw)>=0 || String(r['發文單位']).indexOf(kw)>=0; });
    var clean = rows.map(function(r){ var o={}; Object.keys(r).forEach(function(k){ if(k!=='_row')o[k]=r[k]; }); return o; });
    return { success: true, data: clean, message: '公文查詢完成，共 '+clean.length+' 筆', timestamp: govopsNow_() };
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
    govopsAppend_('收發公文', ODOC_HEADERS, obj);
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
    var patch = { '更新時間': govopsNow_() };
    ['公文類型','公文編號','主旨','發文單位','收文單位','承辦窗口','聯絡電話','來文日期','發文日期','辦理期限','是否需回覆','回覆期限','是否需補件','公文摘要','附件連結','處理狀態','負責人','備註'].forEach(function(f){ if(params[f]!==undefined&&params[f]!=='')patch[f]=params[f]; });
    govopsUpdate_('收發公文', ODOC_HEADERS, found._row, patch);
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
    govopsDeleteRow_('收發公文', found._row);
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
    var taskIds = taskIdsRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
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

// ── Manpower Route ────────────────────────────────────────
var VACANCY_HEADERS = ['職缺ID','案件ID','職缺名稱','職務類型','需求人數','薪資範圍','工作地點','開始日期','結束日期','職缺說明','任職資格','狀態','建立時間','更新時間'];
var APPLICANT_HEADERS = ['應徵者ID','職缺ID','案件ID','姓名','電話','Email','履歷連結','應徵日期','審查狀態','面試日期','面試地點','面試備註','薪資期望','備註','建立時間','更新時間'];

function govopsManpowerRoute_(params, action) {

  // ── 職缺 ─────────────────────────────────────────────────
  if (action === 'getVacancies') {
    govopsEnsureSheet_('人力職缺', VACANCY_HEADERS);
    var rows = govopsRows_('人力職缺', VACANCY_HEADERS);
    if (params.caseId) rows = rows.filter(function(r){ return r['案件ID'] === params.caseId; });
    if (params.status) rows = rows.filter(function(r){ return r['狀態'] === params.status; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '職缺查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createVacancy') {
    govopsEnsureSheet_('人力職缺', VACANCY_HEADERS);
    var now = govopsNow_();
    var obj = {
      '職缺ID': 'VAC-' + now.replace(/[^0-9]/g,'').substring(0,14) + '-' + Math.floor(Math.random()*9000+1000),
      '案件ID': params.caseId || '',
      '職缺名稱': params.vacancyName || '',
      '職務類型': params.jobType || '正職',
      '需求人數': params.headcount || 1,
      '薪資範圍': params.salaryRange || '',
      '工作地點': params.location || '',
      '開始日期': params.startDate || '',
      '結束日期': params.endDate || '',
      '職缺說明': params.description || '',
      '任職資格': params.requirements || '',
      '狀態': '招募中',
      '建立時間': now,
      '更新時間': now
    };
    govopsAppend_('人力職缺', VACANCY_HEADERS, obj);
    return { success: true, data: obj, message: '職缺已建立', timestamp: now };
  }

  if (action === 'updateVacancy') {
    govopsEnsureSheet_('人力職缺', VACANCY_HEADERS);
    var rows = govopsRows_('人力職缺', VACANCY_HEADERS);
    var found = rows.filter(function(r){ return r['職缺ID'] === params.vacancyId; })[0];
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到職缺', timestamp: govopsNow_() };
    var patch = {};
    ['職缺名稱','職務類型','需求人數','薪資範圍','工作地點','開始日期','結束日期','職缺說明','任職資格','狀態'].forEach(function(k){
      if (params[k] !== undefined) patch[k] = params[k];
    });
    patch['更新時間'] = govopsNow_();
    govopsUpdate_('人力職缺', VACANCY_HEADERS, found._row, patch);
    return { success: true, data: patch, message: '職缺已更新', timestamp: patch['更新時間'] };
  }

  if (action === 'getVacancyStats') {
    govopsEnsureSheet_('人力職缺', VACANCY_HEADERS);
    var rows = govopsRows_('人力職缺', VACANCY_HEADERS);
    var stats = { total: rows.length, recruiting: 0, paused: 0, closed: 0 };
    rows.forEach(function(r){
      if (r['狀態'] === '招募中') stats.recruiting++;
      else if (r['狀態'] === '暫停') stats.paused++;
      else if (r['狀態'] === '已關閉') stats.closed++;
    });
    return { success: true, data: stats, message: '職缺統計完成', timestamp: govopsNow_() };
  }

  // ── 應徵者 ───────────────────────────────────────────────
  if (action === 'getApplicants') {
    govopsEnsureSheet_('應徵者資料', APPLICANT_HEADERS);
    var rows = govopsRows_('應徵者資料', APPLICANT_HEADERS);
    if (params.vacancyId) rows = rows.filter(function(r){ return r['職缺ID'] === params.vacancyId; });
    if (params.caseId) rows = rows.filter(function(r){ return r['案件ID'] === params.caseId; });
    if (params.status) rows = rows.filter(function(r){ return r['審查狀態'] === params.status; });
    return { success: true, data: { rows: rows, count: rows.length }, message: '應徵者查詢完成', timestamp: govopsNow_() };
  }

  if (action === 'createApplicant') {
    govopsEnsureSheet_('應徵者資料', APPLICANT_HEADERS);
    var now = govopsNow_();
    var obj = {
      '應徵者ID': 'APP-' + now.replace(/[^0-9]/g,'').substring(0,14) + '-' + Math.floor(Math.random()*9000+1000),
      '職缺ID': params.vacancyId || '',
      '案件ID': params.caseId || '',
      '姓名': params.name || '',
      '電話': params.phone || '',
      'Email': params.email || '',
      '履歷連結': params.resumeLink || '',
      '應徵日期': params.applyDate || now.substring(0,10),
      '審查狀態': '待審',
      '面試日期': '',
      '面試地點': '',
      '面試備註': '',
      '薪資期望': params.salaryExpect || '',
      '備註': params.remark || '',
      '建立時間': now,
      '更新時間': now
    };
    govopsAppend_('應徵者資料', APPLICANT_HEADERS, obj);
    return { success: true, data: obj, message: '應徵者已建立', timestamp: now };
  }

  if (action === 'updateApplicant') {
    govopsEnsureSheet_('應徵者資料', APPLICANT_HEADERS);
    var rows = govopsRows_('應徵者資料', APPLICANT_HEADERS);
    var found = rows.filter(function(r){ return r['應徵者ID'] === params.applicantId; })[0];
    if (!found) return { success: false, error: 'NOT_FOUND', message: '找不到應徵者', timestamp: govopsNow_() };
    var patch = {};
    ['姓名','電話','Email','履歷連結','應徵日期','審查狀態','面試日期','面試地點','面試備註','薪資期望','備註'].forEach(function(k){
      if (params[k] !== undefined) patch[k] = params[k];
    });
    patch['更新時間'] = govopsNow_();
    govopsUpdate_('應徵者資料', APPLICANT_HEADERS, found._row, patch);
    return { success: true, data: patch, message: '應徵者資料已更新', timestamp: patch['更新時間'] };
  }

  if (action === 'getApplicantStats') {
    govopsEnsureSheet_('應徵者資料', APPLICANT_HEADERS);
    var rows = govopsRows_('應徵者資料', APPLICANT_HEADERS);
    var stats = { total: rows.length, pending: 0, interview: 0, hired: 0, rejected: 0 };
    rows.forEach(function(r){
      var s = r['審查狀態'];
      if (s === '待審') stats.pending++;
      else if (s === '通知面試' || s === '面試完成') stats.interview++;
      else if (s === '錄取') stats.hired++;
      else if (s === '未錄取') stats.rejected++;
    });
    return { success: true, data: stats, message: '應徵者統計完成', timestamp: govopsNow_() };
  }

  return null;
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
var INSTRUCTOR_HEADERS = ['講師ID','姓名','電話','地址','Email','專業領域','時薪','銀行','帳號','戶名','統編/身分證','是否扣繳','扣繳類型','評價','備註','建立時間','更新時間'];
var STAFF_HEADERS     = ['人員ID','姓名','電話','地址','Email','職務類型','時薪','銀行','帳號','戶名','統編/身分證','是否扣繳','評價','備註','建立時間','更新時間'];

function govopsResourceRoute_(params, action) {
  if (action === '初始化講師主檔') {
    govopsEnsureSheet_('24_講師主檔', INSTRUCTOR_HEADERS);
    return { success: true, message: '24_講師主檔 初始化完成' };
  }
  if (action === '新增講師') {
    var name = params['姓名'] || '';
    if (!name) return { success: false, message: '講師姓名必填' };
    var obj = { '講師ID': govopsId_('LEC'), '姓名': name, '電話': params['電話'] || '', 'Email': params['Email'] || '', '專業領域': params['專業領域'] || '', '時薪': params['時薪'] || '', '銀行': params['銀行'] || '', '帳號': params['帳號'] || '', '戶名': params['戶名'] || '', '統編/身分證': params['統編/身分證'] || '', '是否扣繳': params['是否扣繳'] || '', '扣繳類型': params['扣繳類型'] || '執行業務所得', '評價': params['評價'] || '', '備註': params['備註'] || '', '建立時間': govopsNow_(), '更新時間': govopsNow_() };
    govopsAppend_('24_講師主檔', INSTRUCTOR_HEADERS, obj);
    return { success: true, message: '講師新增完成', data: { 講師ID: obj['講師ID'], 姓名: obj['姓名'] } };
  }
  if (action === '查詢講師') {
    var rows = govopsFilter_(govopsRows_('24_講師主檔', INSTRUCTOR_HEADERS), params);
    return { success: true, message: '講師查詢完成', data: { rows: rows, count: rows.length } };
  }
  if (action === '修改講師') {
    var id = params['講師ID'];
    if (!id) return { success: false, message: '講師ID 必填' };
    var rows2 = govopsRows_('24_講師主檔', INSTRUCTOR_HEADERS);
    var found = rows2.find(function(r){ return r['講師ID'] === id; });
    if (!found) return { success: false, message: '找不到講師：' + id };
    var patch = { '更新時間': govopsNow_() };
    ['姓名','電話','Email','專業領域','時薪','銀行','帳號','戶名','統編/身分證','是否扣繳','扣繳類型','評價','備註'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
    govopsUpdate_('24_講師主檔', INSTRUCTOR_HEADERS, found._row, patch);
    return { success: true, message: '講師資料已更新', data: { 講師ID: id } };
  }
  if (action === '初始化工作人員主檔') {
    govopsEnsureSheet_('25_工作人員主檔', STAFF_HEADERS);
    return { success: true, message: '25_工作人員主檔 初始化完成' };
  }
  if (action === '新增工作人員') {
    var sname = params['姓名'] || '';
    if (!sname) return { success: false, message: '姓名必填' };
    var sobj = { '人員ID': govopsId_('STF'), '姓名': sname, '電話': params['電話'] || '', 'Email': params['Email'] || '', '職務類型': params['職務類型'] || '', '時薪': params['時薪'] || '', '銀行': params['銀行'] || '', '帳號': params['帳號'] || '', '戶名': params['戶名'] || '', '統編/身分證': params['統編/身分證'] || '', '是否扣繳': params['是否扣繳'] || '', '評價': params['評價'] || '', '備註': params['備註'] || '', '建立時間': govopsNow_(), '更新時間': govopsNow_() };
    govopsAppend_('25_工作人員主檔', STAFF_HEADERS, sobj);
    return { success: true, message: '工作人員新增完成', data: { 人員ID: sobj['人員ID'], 姓名: sobj['姓名'] } };
  }
  if (action === '查詢工作人員') {
    var srows = govopsFilter_(govopsRows_('25_工作人員主檔', STAFF_HEADERS), params);
    return { success: true, message: '工作人員查詢完成', data: { rows: srows, count: srows.length } };
  }
  if (action === '修改工作人員') {
    var sid = params['人員ID'];
    if (!sid) return { success: false, message: '人員ID 必填' };
    var srows2 = govopsRows_('25_工作人員主檔', STAFF_HEADERS);
    var sfound = srows2.find(function(r){ return r['人員ID'] === sid; });
    if (!sfound) return { success: false, message: '找不到工作人員：' + sid };
    var spatch = { '更新時間': govopsNow_() };
    ['姓名','電話','Email','職務類型','時薪','銀行','帳號','戶名','統編/身分證','是否扣繳','評價','備註'].forEach(function(k){ if (params[k] !== undefined && params[k] !== '') spatch[k] = params[k]; });
    govopsUpdate_('25_工作人員主檔', STAFF_HEADERS, sfound._row, spatch);
    return { success: true, message: '工作人員資料已更新', data: { 人員ID: sid } };
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

function govopsDefaultNotifContent_(type, reg) {
  var name = reg['姓名'] || '學員';
  if (type === '資格審查通知' || type === '審查通知') return name + ' 您好，您的報名申請已送出，我們將盡快進行資格審查，請耐心等候通知。';
  if (type === '核准通知') return name + ' 您好，恭喜您的報名已通過資格審查！開課前將再次通知您相關訊息，請留意。';
  if (type === '拒絕通知') return name + ' 您好，很遺憾您的報名未通過資格審查，如有疑問請與我們聯繫，謝謝。';
  if (type === '開課通知') return name + ' 您好，課程即將開始！請準時出席，期待在課堂上見到您。';
  if (type === '簽到提醒') return name + ' 您好，提醒您今日有課程活動，請記得簽到，謝謝。';
  return name + ' 您好，' + type + '相關通知，如有疑問請聯繫主辦單位。';
}
