/*
GovOps OS｜Product Core Integration v1
目的：整合既有 37_core.gs，不重寫既有功能；以外掛 handler 補上正式產品核心能力。
重點：正式 DB Schema、Date Engine、State Guard、Lock、Form Sync FastPatch。
*/

var GOVOPS_PRODUCT_DB_ID = '1ffBZCA0XriHaMzFXTB-4_Rzh5vSq4_NQB9uPrW_eZEQ';
var GOVOPS_TZ = 'Asia/Taipei';

var GOVOPS_PRODUCT_SHEETS = {
  系統設定: '01_系統設定',
  系統ID中心: '02_系統ID中心',
  同步紀錄: '03_同步紀錄',
  標案池: '04_標案池',
  投標評估: '05_投標評估',
  活動: '06_招生活動管理',
  報名: '07_報名資料庫',
  CRM: '08_學員CRM',
  候補: '09_候補名單',
  任務: '10_當日工作任務表',
  物品: '11_物品清單',
  餐點: '12_餐點管理',
  簽到: '13_簽到表紀錄',
  核銷: '14_核銷檢查中心',
  文件: '15_文件歸檔紀錄',
  應收: '16_應收帳款',
  收款: '17_收款紀錄',
  支出: '18_支出明細',
  損益: '19_專案損益',
  提醒: '20_提醒中心',
  摘要: '21_秘書摘要',
  狀態規則: '22_狀態規則中心',
  操作: '23_操作紀錄',
  錯誤: '24_錯誤紀錄',
  使用者: '25_組織與使用者',
  Session: '26_Session紀錄'
};

var GOVOPS_PRODUCT_HEADERS = {
  '03_同步紀錄': ['同步ID','同步類型','來源ID','來源試算表ID','來源分頁名稱','最後同步列數','最後同步時間','新增筆數','略過筆數','同步狀態','錯誤訊息','tenantId','userId'],
  '04_標案池': ['tenantId','標案ID','標案名稱','機關名稱','案號','採購類型','招標方式','預算金額','公告日期','截止投標日','開標日期','履約地點','履約期限','押標金','資格條件','評選方式','標案網址','標案狀態','是否追蹤','AI判讀摘要','投標建議','建立時間','更新時間','更新人','備註'],
  '06_招生活動管理': ['tenantId','活動ID','標案ID','計畫名稱','活動名稱','活動日期','開始時間','結束時間','活動地點','主辦單位','協辦單位','聯絡人','聯絡電話','講師','名額','活動類型','活動狀態','報名表單連結','表單回覆試算表ID','表單回覆分頁名稱','Drive資料夾ID','Drive資料夾連結','CalendarID','建立時間','更新時間','userId','userRole','plan','備註'],
  '07_報名資料庫': ['tenantId','報名ID','活動ID','學員ID','姓名','電話','Email','LINE UID','身分別','服務單位','所在地區','來源渠道','報名方式','報名狀態','審核結果','確認參加','出席狀態','報名時間','建立時間','更新時間','userId','備註'],
  '08_學員CRM': ['tenantId','學員ID','姓名','電話','Email','LINE UID','LINE名稱','性別','年齡區間','身分別','職業','服務單位','所在地區','興趣標籤','課程偏好','曾報名課程','曾出席課程','報名次數','出席次數','未出席次數','最後報名日期','最後出席日期','最後互動日期','來源渠道','行銷同意','LINE好友狀態','Email訂閱狀態','可再次行銷','學員價值等級','互動分數','最近一次活動ID','最近一次報名ID','建立時間','更新時間','userId','備註'],
  '22_狀態規則中心': ['模組','狀態類型','狀態值','排序','是否啟用','說明'],
  '23_操作紀錄': ['時間','tenantId','userId','操作類型','資料表','關聯ID','操作內容','操作結果','requestId'],
  '24_錯誤紀錄': ['時間','tenantId','userId','功能模組','錯誤摘要','錯誤內容','處理狀態','requestId']
};

var GOVOPS_ALLOWED_STATES = {
  activity: ['規劃中','招生中','已額滿','已截止','已完成','已取消'],
  registration: ['待審核','已入選','候補','已取消','已確認參加'],
  attendance: ['未簽到','已簽到','未出席'],
  task: ['待執行','進行中','已完成','異常','已取消'],
  finance: ['未收款','部分收款','已收款','逾期'],
  claim: ['待檢查','缺件','已完成'],
  reminder: ['待提醒','已提醒','已完成'],
  tender: ['新標案','評估中','決定投標','不投標','已投標','未得標','已得標','履約中','已結案']
};

function handleGovOpsProductCoreAction(action, data) {
  data = data || {};
  try {
    if (action === 'product.schema.init') return GovOpsProduct_initSchema(data);
    if (action === 'product.schema.health') return GovOpsProduct_schemaHealth(data);
    if (action === 'registration.sync.fast' || action === '從報名表單同步報名資料_正式版') return GovOpsProduct_syncRegistrationFast(data);
    if (action === 'tender.create' || action === '新增標案') return GovOpsProduct_createTender(data);
    if (action === 'tender.query' || action === '查詢標案池') return GovOpsProduct_queryTender(data);
    if (action === 'tender.updateStatus' || action === '更新標案狀態') return GovOpsProduct_updateTenderStatus(data);
    return null;
  } catch (err) {
    GovOpsProduct_logError('handleGovOpsProductCoreAction', err, data);
    return GovOpsProduct_fail('系統暫時無法完成操作，請稍後再試。', { code: 'PRODUCT_CORE_ERROR' });
  }
}

function handleAPIGatewayAction(action, data) {
  return handleGovOpsProductCoreAction(action, data);
}

function GovOpsProduct_ss() { return SpreadsheetApp.openById(GOVOPS_PRODUCT_DB_ID); }
function GovOpsProduct_now() { return Utilities.formatDate(new Date(), GOVOPS_TZ, 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsProduct_today() { return Utilities.formatDate(new Date(), GOVOPS_TZ, 'yyyy/MM/dd'); }
function GovOpsProduct_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsProduct_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }

function GovOpsProduct_sheet(name) {
  var ss = GovOpsProduct_ss();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function GovOpsProduct_headers(sheetName) {
  var sheet = GovOpsProduct_sheet(sheetName);
  if (sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
}

function GovOpsProduct_ensureSheet(sheetName, headers) {
  var sheet = GovOpsProduct_sheet(sheetName);
  headers = headers || GOVOPS_PRODUCT_HEADERS[sheetName] || [];
  if (!headers.length) return sheet;
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  var current = GovOpsProduct_headers(sheetName);
  var missing = headers.filter(function(h){ return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  sheet.setFrozenRows(1);
  return sheet;
}

function GovOpsProduct_rowToObj(headers, row, rowNumber) {
  var obj = { _row: rowNumber };
  headers.forEach(function(h, i){ obj[h] = row[i]; });
  return obj;
}

function GovOpsProduct_readRows(sheetName) {
  var sheet = GovOpsProduct_sheet(sheetName);
  var headers = GovOpsProduct_headers(sheetName);
  if (sheet.getLastRow() < 2 || headers.length === 0) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().map(function(row, idx){
    return GovOpsProduct_rowToObj(headers, row, idx + 2);
  });
}

function GovOpsProduct_append(sheetName, obj) {
  var headers = GOVOPS_PRODUCT_HEADERS[sheetName] || GovOpsProduct_headers(sheetName);
  GovOpsProduct_ensureSheet(sheetName, headers);
  var row = headers.map(function(h){ return obj[h] !== undefined ? obj[h] : ''; });
  GovOpsProduct_sheet(sheetName).appendRow(row);
  return obj;
}

function GovOpsProduct_update(sheetName, rowNumber, patch) {
  var sheet = GovOpsProduct_sheet(sheetName);
  var headers = GovOpsProduct_headers(sheetName);
  Object.keys(patch).forEach(function(key){
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowNumber, col).setValue(patch[key]);
  });
}

function GovOpsProduct_initSchema(data) {
  Object.keys(GOVOPS_PRODUCT_HEADERS).forEach(function(sheetName){ GovOpsProduct_ensureSheet(sheetName, GOVOPS_PRODUCT_HEADERS[sheetName]); });
  GovOpsProduct_seedStateRules();
  return GovOpsProduct_success('正式產品資料結構初始化完成。', { spreadsheetId: GOVOPS_PRODUCT_DB_ID });
}

function GovOpsProduct_schemaHealth(data) {
  var result = [];
  Object.keys(GOVOPS_PRODUCT_HEADERS).forEach(function(sheetName){
    var actual = GovOpsProduct_headers(sheetName);
    var required = GOVOPS_PRODUCT_HEADERS[sheetName];
    var missing = required.filter(function(h){ return actual.indexOf(h) < 0; });
    result.push({ sheetName: sheetName, ok: missing.length === 0, missing: missing });
  });
  return GovOpsProduct_success('正式產品資料結構檢查完成。', { checks: result });
}

function GovOpsProduct_seedStateRules() {
  var sheetName = GOVOPS_PRODUCT_SHEETS.狀態規則;
  GovOpsProduct_ensureSheet(sheetName, GOVOPS_PRODUCT_HEADERS[sheetName]);
  var rows = GovOpsProduct_readRows(sheetName);
  if (rows.length > 0) return;
  Object.keys(GOVOPS_ALLOWED_STATES).forEach(function(type){
    GOVOPS_ALLOWED_STATES[type].forEach(function(state, idx){
      GovOpsProduct_append(sheetName, { 模組: type, 狀態類型: type, 狀態值: state, 排序: idx + 1, 是否啟用: 'TRUE', 說明: '' });
    });
  });
}

function GovOpsProduct_assertState(type, state) {
  if (!state) return true;
  var allowed = GOVOPS_ALLOWED_STATES[type] || [];
  if (allowed.indexOf(state) < 0) throw new Error('狀態不符合產品規則：' + type + ' / ' + state);
  return true;
}

function GovOpsProduct_parseDate(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;
  if (typeof value === 'number') return new Date(Math.round((value - 25569) * 86400 * 1000));
  var s = String(value).trim();
  if (!s) return null;
  s = s.replace(/-/g, '/').replace(/年/g, '/').replace(/月/g, '/').replace(/日/g, '');
  var d = new Date(s);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  return d;
}

function GovOpsProduct_formatDate(value) {
  var d = GovOpsProduct_parseDate(value);
  return d ? Utilities.formatDate(d, GOVOPS_TZ, 'yyyy/MM/dd') : '';
}

function GovOpsProduct_formatDateTime(value) {
  var d = GovOpsProduct_parseDate(value);
  return d ? Utilities.formatDate(d, GOVOPS_TZ, 'yyyy/MM/dd HH:mm') : '';
}

function GovOpsProduct_addDays(value, days) {
  var d = GovOpsProduct_parseDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + Number(days || 0), d.getHours(), d.getMinutes(), d.getSeconds());
}

function GovOpsProduct_extractSpreadsheetId(value) {
  var s = String(value || '').trim();
  if (!s) return '';
  var m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m && m[1]) return m[1];
  if (/^[a-zA-Z0-9-_]{25,}$/.test(s)) return s;
  return '';
}

function GovOpsProduct_findResponseSheet(spreadsheetId, preferredName) {
  var source = SpreadsheetApp.openById(spreadsheetId);
  var sheets = source.getSheets();
  if (preferredName) {
    var exact = source.getSheetByName(preferredName);
    if (exact) return exact;
  }
  var candidates = ['Form_Responses','表單回應 1','表單回應1','Form Responses 1','報名回覆','工作表1'];
  for (var i = 0; i < candidates.length; i++) {
    var sh = source.getSheetByName(candidates[i]);
    if (sh) return sh;
  }
  return sheets[0];
}

function GovOpsProduct_getLastSyncRecord(activityId, tenantId) {
  var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.同步紀錄);
  var found = rows.filter(function(r){ return String(r.來源ID) === String(activityId) && String(r.tenantId || '') === String(tenantId || ''); });
  if (!found.length) return null;
  return found[found.length - 1];
}

function GovOpsProduct_setLastSyncRecord(data) {
  GovOpsProduct_ensureSheet(GOVOPS_PRODUCT_SHEETS.同步紀錄, GOVOPS_PRODUCT_HEADERS[GOVOPS_PRODUCT_SHEETS.同步紀錄]);
  var record = GovOpsProduct_getLastSyncRecord(data.來源ID, data.tenantId);
  var patch = {
    同步類型: data.同步類型 || 'registration',
    來源ID: data.來源ID,
    來源試算表ID: data.來源試算表ID,
    來源分頁名稱: data.來源分頁名稱,
    最後同步列數: data.最後同步列數,
    最後同步時間: GovOpsProduct_now(),
    新增筆數: data.新增筆數 || 0,
    略過筆數: data.略過筆數 || 0,
    同步狀態: data.同步狀態 || '完成',
    錯誤訊息: data.錯誤訊息 || '',
    tenantId: data.tenantId || '',
    userId: data.userId || ''
  };
  if (record) GovOpsProduct_update(GOVOPS_PRODUCT_SHEETS.同步紀錄, record._row, patch);
  else GovOpsProduct_append(GOVOPS_PRODUCT_SHEETS.同步紀錄, Object.assign({ 同步ID: 'SYNC-' + new Date().getTime() }, patch));
}

function GovOpsProduct_normPhone(v) { return String(v || '').replace(/[^0-9]/g, ''); }
function GovOpsProduct_normEmail(v) { return String(v || '').trim().toLowerCase(); }

function GovOpsProduct_pick(row, headers, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = headers.indexOf(names[i]);
    if (idx >= 0 && row[idx] !== '') return row[idx];
  }
  return '';
}

function GovOpsProduct_findOrCreateCRM(person, tenantId, userId) {
  var sheetName = GOVOPS_PRODUCT_SHEETS.CRM;
  GovOpsProduct_ensureSheet(sheetName, GOVOPS_PRODUCT_HEADERS[sheetName]);
  var rows = GovOpsProduct_readRows(sheetName);
  var phone = GovOpsProduct_normPhone(person.電話);
  var email = GovOpsProduct_normEmail(person.Email);
  var line = String(person['LINE UID'] || '').trim();
  var found = rows.find(function(r){
    return String(r.tenantId || '') === String(tenantId || '') && (
      (phone && GovOpsProduct_normPhone(r.電話) === phone) ||
      (email && GovOpsProduct_normEmail(r.Email) === email) ||
      (line && String(r['LINE UID'] || '').trim() === line)
    );
  });
  if (found) {
    var count = Number(found.報名次數 || 0) + 1;
    GovOpsProduct_update(sheetName, found._row, { 報名次數: count, 最後報名日期: GovOpsProduct_today(), 最近一次活動ID: person.活動ID, 更新時間: GovOpsProduct_now(), userId: userId || found.userId || '' });
    return found.學員ID;
  }
  var id = GovOpsProduct_nextId('STU', tenantId);
  GovOpsProduct_append(sheetName, {
    tenantId: tenantId || '', 學員ID: id, 姓名: person.姓名 || '', 電話: person.電話 || '', Email: person.Email || '', 'LINE UID': person['LINE UID'] || '',
    身分別: person.身分別 || '', 服務單位: person.服務單位 || '', 所在地區: person.所在地區 || '', 來源渠道: person.來源渠道 || '',
    報名次數: 1, 出席次數: 0, 未出席次數: 0, 最後報名日期: GovOpsProduct_today(), 最近一次活動ID: person.活動ID || '',
    建立時間: GovOpsProduct_now(), 更新時間: GovOpsProduct_now(), userId: userId || ''
  });
  return id;
}

function GovOpsProduct_nextId(prefix, tenantId) {
  var year = String(new Date().getFullYear() - 1911);
  var key = prefix + '-' + year + '-';
  var max = 0;
  Object.keys(GOVOPS_PRODUCT_SHEETS).forEach(function(k){
    var sheetName = GOVOPS_PRODUCT_SHEETS[k];
    try {
      GovOpsProduct_readRows(sheetName).forEach(function(r){
        Object.keys(r).forEach(function(col){
          var v = String(r[col] || '');
          if (v.indexOf(key) === 0) {
            var n = Number(v.replace(key, ''));
            if (!isNaN(n) && n > max) max = n;
          }
        });
      });
    } catch (err) {}
  });
  return key + String(max + 1).padStart(4, '0');
}

function GovOpsProduct_syncRegistrationFast(data) {
  data = data || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return GovOpsProduct_fail('系統正在同步資料，請稍後再試。');
  try {
    var tenantId = data.tenantId || data.租戶ID || 'TENANT-DEMO';
    var userId = data.userId || data.使用者ID || '';
    var activityId = data.活動ID || data.activityId || data.來源ID;
    if (!activityId) return GovOpsProduct_fail('請提供活動ID。');
    var sheetId = GovOpsProduct_extractSpreadsheetId(data.表單回覆試算表ID || data.responseSheetId || data.試算表網址 || data.formUrl || data.報名表單連結);
    if (!sheetId) return GovOpsProduct_fail('請貼上 Google 試算表網址或有效試算表ID。');
    var sourceSheet = GovOpsProduct_findResponseSheet(sheetId, data.表單回覆分頁名稱 || data.responseSheetName);
    var lastCol = sourceSheet.getLastColumn();
    var lastRow = sourceSheet.getLastRow();
    if (lastRow < 2) return GovOpsProduct_success('目前沒有可同步的報名資料。', { 新增筆數: 0, 略過筆數: 0, 使用分頁: sourceSheet.getName(), 最後同步列數: lastRow });
    var headers = sourceSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    var lastRecord = GovOpsProduct_getLastSyncRecord(activityId, tenantId);
    var startRow = Math.max(2, Number(lastRecord && lastRecord.最後同步列數 ? lastRecord.最後同步列數 : 1) + 1);
    if (startRow > lastRow) return GovOpsProduct_success('沒有新增報名資料需要同步。', { 新增筆數: 0, 略過筆數: 0, 使用分頁: sourceSheet.getName(), 最後同步列數: lastRow });
    var values = sourceSheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();
    var regSheet = GOVOPS_PRODUCT_SHEETS.報名;
    GovOpsProduct_ensureSheet(regSheet, GOVOPS_PRODUCT_HEADERS[regSheet]);
    var existed = GovOpsProduct_readRows(regSheet);
    var added = 0;
    var skipped = 0;
    values.forEach(function(row){
      var name = GovOpsProduct_pick(row, headers, ['姓名','您的姓名','學員姓名','名字','名稱']);
      var phone = GovOpsProduct_pick(row, headers, ['電話','手機','聯絡電話','手機號碼','行動電話']);
      var email = GovOpsProduct_pick(row, headers, ['Email','電子郵件','信箱','電子信箱']);
      if (!name && !phone && !email) { skipped++; return; }
      var phoneNorm = GovOpsProduct_normPhone(phone);
      var emailNorm = GovOpsProduct_normEmail(email);
      var duplicated = existed.some(function(r){
        return String(r.tenantId || '') === String(tenantId) && String(r.活動ID || '') === String(activityId) && (
          (phoneNorm && GovOpsProduct_normPhone(r.電話) === phoneNorm) ||
          (emailNorm && GovOpsProduct_normEmail(r.Email) === emailNorm)
        );
      });
      if (duplicated) { skipped++; return; }
      var person = {
        活動ID: activityId,
        姓名: name,
        電話: phone,
        Email: email,
        'LINE UID': GovOpsProduct_pick(row, headers, ['LINE UID','LINE User ID','LINE ID']),
        身分別: GovOpsProduct_pick(row, headers, ['身分別','身份別','身分']),
        服務單位: GovOpsProduct_pick(row, headers, ['服務單位','公司','單位','任職單位']),
        所在地區: GovOpsProduct_pick(row, headers, ['所在地區','居住地','縣市','地區']),
        來源渠道: 'Google表單'
      };
      var studentId = GovOpsProduct_findOrCreateCRM(person, tenantId, userId);
      GovOpsProduct_append(regSheet, {
        tenantId: tenantId,
        報名ID: GovOpsProduct_nextId('REG', tenantId),
        活動ID: activityId,
        學員ID: studentId,
        姓名: name,
        電話: phone,
        Email: email,
        'LINE UID': person['LINE UID'],
        身分別: person.身分別,
        服務單位: person.服務單位,
        所在地區: person.所在地區,
        來源渠道: 'Google表單',
        報名方式: '表單同步',
        報名狀態: '待審核',
        出席狀態: '未簽到',
        報名時間: GovOpsProduct_formatDateTime(GovOpsProduct_pick(row, headers, ['時間戳記','Timestamp','提交時間'])) || GovOpsProduct_now(),
        建立時間: GovOpsProduct_now(),
        更新時間: GovOpsProduct_now(),
        userId: userId
      });
      added++;
    });
    GovOpsProduct_setLastSyncRecord({ 來源ID: activityId, 來源試算表ID: sheetId, 來源分頁名稱: sourceSheet.getName(), 最後同步列數: lastRow, 新增筆數: added, 略過筆數: skipped, tenantId: tenantId, userId: userId });
    return GovOpsProduct_success('報名資料同步完成。', { 新增筆數: added, 略過筆數: skipped, 使用分頁: sourceSheet.getName(), 最後同步列數: lastRow });
  } catch (err) {
    GovOpsProduct_logError('GovOpsProduct_syncRegistrationFast', err, data);
    return GovOpsProduct_fail('報名同步失敗，請確認試算表網址與權限。');
  } finally {
    lock.releaseLock();
  }
}

function GovOpsProduct_createTender(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  GovOpsProduct_assertState('tender', data.標案狀態 || '新標案');
  if (!data.標案名稱) return GovOpsProduct_fail('請填寫標案名稱。');
  var obj = {
    tenantId: tenantId,
    標案ID: data.標案ID || GovOpsProduct_nextId('BID', tenantId),
    標案名稱: data.標案名稱 || '',
    機關名稱: data.機關名稱 || '',
    案號: data.案號 || '',
    採購類型: data.採購類型 || '',
    招標方式: data.招標方式 || '',
    預算金額: data.預算金額 || '',
    公告日期: GovOpsProduct_formatDate(data.公告日期) || data.公告日期 || '',
    截止投標日: GovOpsProduct_formatDate(data.截止投標日) || data.截止投標日 || '',
    開標日期: GovOpsProduct_formatDate(data.開標日期) || data.開標日期 || '',
    履約地點: data.履約地點 || '',
    履約期限: data.履約期限 || '',
    押標金: data.押標金 || '',
    資格條件: data.資格條件 || '',
    評選方式: data.評選方式 || '',
    標案網址: data.標案網址 || '',
    標案狀態: data.標案狀態 || '新標案',
    是否追蹤: data.是否追蹤 || '否',
    AI判讀摘要: data.AI判讀摘要 || '',
    投標建議: data.投標建議 || '',
    建立時間: GovOpsProduct_now(),
    更新時間: GovOpsProduct_now(),
    更新人: data.userId || '',
    備註: data.備註 || ''
  };
  GovOpsProduct_append(GOVOPS_PRODUCT_SHEETS.標案池, obj);
  return GovOpsProduct_success('標案已新增。', obj);
}

function GovOpsProduct_queryTender(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || '').trim();
  var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池).filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
  return GovOpsProduct_success('標案池查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsProduct_updateTenderStatus(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.標案ID || data.tenderId;
  var status = data.標案狀態 || data.status;
  if (!id) return GovOpsProduct_fail('請提供標案ID。');
  GovOpsProduct_assertState('tender', status);
  var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池);
  var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID) === String(id); });
  if (!found) return GovOpsProduct_fail('找不到標案。');
  GovOpsProduct_update(GOVOPS_PRODUCT_SHEETS.標案池, found._row, { 標案狀態: status, 更新時間: GovOpsProduct_now(), 更新人: data.userId || '' });
  return GovOpsProduct_success('標案狀態已更新。', { 標案ID: id, 標案狀態: status });
}

function GovOpsProduct_logError(module, err, data) {
  try {
    GovOpsProduct_append(GOVOPS_PRODUCT_SHEETS.錯誤, {
      時間: GovOpsProduct_now(), tenantId: data && data.tenantId || '', userId: data && data.userId || '',
      功能模組: module, 錯誤摘要: err && err.message ? err.message : String(err), 錯誤內容: err && err.stack ? err.stack : String(err), 處理狀態: '未處理', requestId: data && data.requestId || ''
    });
  } catch (e) {}
}

function 測試_ProductCore_SchemaHealth() { return GovOpsProduct_schemaHealth({ tenantId: 'TENANT-DEMO' }); }
function 測試_ProductCore_InitSchema() { return GovOpsProduct_initSchema({ tenantId: 'TENANT-DEMO' }); }
function 測試_ProductCore_新增標案() { return GovOpsProduct_createTender({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案', 機關名稱: '測試機關', 標案狀態: '新標案' }); }
