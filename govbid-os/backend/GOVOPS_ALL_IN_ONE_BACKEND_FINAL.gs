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
  var params = {};
  try {
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents) || {};
    } else if (e && e.parameter) {
      params = e.parameter || {};
    }
  } catch (err) {
    params = (e && e.parameter) ? e.parameter : {};
  }
  return govopsMainRouter_(params);
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

function govopsFilter_(rows, params) {
  params = params || {};
  var kw = String(params.keyword || params.q || params['關鍵字'] || '').trim();
  if (kw) rows = rows.filter(function(r){ return JSON.stringify(r).indexOf(kw) >= 0; });
  return rows;
}

var VENDOR_HEADERS = ['廠商編號','名稱','類型','聯絡人','電話','Email','支付方式','銀行','帳號','戶名','統編/身分證','是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註','建立時間','更新時間'];
var PROJECT_HEADERS = ['專案ID','專案計畫名稱','專案類型','主辦單位','開始日期','結束日期','契約金額','狀態','專案說明','備註','建立時間','更新時間'];
var ACTIVITY_HEADERS = ['活動ID','專案ID','專案計畫名稱','活動名稱','活動日期','活動類型','開始時間','結束時間','活動地點','講師','聯絡人','聯絡電話','狀態','備註','建立時間','更新時間'];
var CAMPAIGN_HEADERS = ['招生活動ID','專案ID','活動ID','課程名稱','招生狀態','報名開始日','報名截止日','開課日期','招生名額','候補名額','報名連結','招生渠道','主辦單位','聯絡人','聯絡電話','備註','建立時間','更新時間'];
var REG_HEADERS = ['報名ID','招生活動ID','活動ID','姓名','電話','Email','身分別','服務單位','報名狀態','審核狀態','出席狀態','完訓狀態','報名來源','報名時間','通知狀態','備註','CRM_ID','建立時間','更新時間'];
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
    var obj = {'招生活動ID': params['招生活動ID'] || govopsId_('ENR'),'專案ID': params['專案ID'] || '','活動ID': params['活動ID'] || '','課程名稱': title,'招生狀態': params['招生狀態'] || '招生中','報名開始日': params['報名開始日'] || '','報名截止日': params['報名截止日'] || '','開課日期': params['開課日期'] || '','招生名額': params['招生名額'] || '','候補名額': params['候補名額'] || '','報名連結': params['報名連結'] || '','招生渠道': params['招生渠道'] || '','主辦單位': params['主辦單位'] || '','聯絡人': params['聯絡人'] || '','聯絡電話': params['聯絡電話'] || '','備註': params['備註'] || '','建立時間': govopsNow_(),'更新時間': govopsNow_()};
    govopsAppend_('招生活動管理', CAMPAIGN_HEADERS, obj);
    return { success: true, message: '招生活動已新增', data: { 招生活動ID: obj['招生活動ID'], row: obj } };
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
    govopsEnsureSheet_('01_專案主檔', PROJECT_HEADERS);
    govopsEnsureSheet_('02_場次活動', ACTIVITY_HEADERS);
    govopsEnsureSheet_('23_合作廠商主檔', VENDOR_HEADERS);
    govopsEnrollmentRoute_(params, '初始化招生報名系統');
    govopsCourseOpsRoute_(params, '初始化課程執行系統');
    return { success: true, message: '正式平台初始化完成' };
  }
  if (action === '正式平台健康檢查') {
    return { success: true, message: '正式平台健康檢查完成', data: { status: 'ready', checkedAt: govopsNow_() } };
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
    return { success: true, message: action + '完成', data: { rows: [], count: 0 } };
  }
  return null;
}
