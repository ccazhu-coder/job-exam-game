/*
GovOps OS｜第37檔：Apps Script 正式後端 core.gs
版本：MVP v1.0.0 內部試營運版
用途：提供正式前端 govbid-os/app/index.html 可呼叫的 Apps Script API 基礎核心。
*/

const GOVOPS_VERSION = '1.0.0';

var GOVOPS_CORE_SHEETS = {
  設定: '系統設定',
  活動: '招生活動管理',
  報名: '報名資料庫',
  CRM: '學員CRM',
  候補: '候補名單',
  任務: '當日工作任務表',
  物品: '物品清單',
  餐點: '餐點管理',
  簽到: '簽到表紀錄',
  核銷: '核銷檢查中心',
  文件: '文件歸檔紀錄',
  操作: '操作紀錄',
  錯誤: '錯誤紀錄',
  常用選項: '使用者常用選項'
};

var GOVOPS_CORE_HEADERS = {
  系統設定: ['設定鍵','設定值','說明','更新時間'],
  招生活動管理: ['活動ID','計畫名稱','活動名稱','活動日期','開始時間','結束時間','活動地點','主辦單位','協辦單位','聯絡人','聯絡電話','講師','活動類型','活動狀態','報名表單連結','表單回覆試算表ID','表單回覆分頁名稱','Drive資料夾連結','建立時間','更新時間'],
  報名資料庫: ['報名ID','活動ID','學員ID','姓名','電話','Email','身分別','服務單位','所在地區','來源渠道','報名方式','報名狀態','出席狀態','備註','建立時間','更新時間'],
  學員CRM: ['學員ID','姓名','電話','Email','LINE UID','LINE名稱','性別','年齡區間','身分別','職業','服務單位','所在地區','興趣標籤','課程偏好','曾報名課程','曾出席課程','報名次數','出席次數','未出席次數','最後報名日期','最後出席日期','來源渠道','行銷同意','LINE好友狀態','Email訂閱狀態','備註','建立時間','更新時間'],
  候補名單: ['候補ID','活動ID','報名ID','學員ID','姓名','電話','候補順位','候補狀態','建立時間','更新時間'],
  當日工作任務表: ['任務ID','活動ID','時段','工作任務','動作說明','負責人','備註道具','任務狀態','完成時間','建立時間','更新時間'],
  物品清單: ['物品ID','活動ID','物品類型','物品名稱','數量','負責人','是否已帶出','是否已取回','備註','建立時間','更新時間'],
  餐點管理: ['餐點ID','活動ID','便當店名稱','便當店電話','單價','葷食數量','素食數量','總數量','預計送達時間','付款方式','收據狀態','建立時間','更新時間'],
  簽到表紀錄: ['簽到ID','活動ID','報名ID','學員ID','姓名','電話','簽到狀態','簽名欄','建立時間','更新時間'],
  核銷檢查中心: ['核銷ID','活動ID','核銷項目','核銷狀態','負責人','建議處理方式','完成時間','建立時間','更新時間'],
  文件歸檔紀錄: ['文件ID','活動ID','文件類型','文件名稱','Drive連結','歸檔狀態','建立時間','更新時間'],
  操作紀錄: ['時間','操作類型','資料表','關聯ID','操作內容','操作結果'],
  錯誤紀錄: ['時間','功能模組','錯誤摘要','錯誤內容','處理狀態'],
  使用者常用選項: ['選項ID','選項類型','選項名稱','使用次數','最後使用時間','是否預設','狀態','建立時間','更新時間']
};

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    const data = parseRequest(e);
    const action = data.action || data.Action || '';
    if (!action) return jsonOutput(fail('請提供操作指令。'));
    const result = router(action, data);
    return jsonOutput(result);
  } catch (err) {
    logError('handleRequest', err);
    return jsonOutput(fail('系統暫時無法完成操作，請稍後再試。'));
  }
}

function parseRequest(e) {
  const data = {};
  if (e && e.parameter) Object.assign(data, e.parameter);
  if (e && e.postData && e.postData.contents) {
    try { Object.assign(data, JSON.parse(e.postData.contents)); } catch (err) {}
  }
  return data;
}

function router(action, data) {
  if (typeof handleComposedGovOpsAction === 'function') {
    var composed = handleComposedGovOpsAction(action, data, function(runtimeData) {
      if (typeof handleTenantCoreAction === 'function') {
        return handleTenantCoreAction(action, runtimeData);
      }
      return null;
    });

    if (composed) {
      return composed;
    }
  }

  switch (action) {
    case '初始化系統': return 初始化系統();
    case '系統健康檢查': return success('系統連線正常。', { version: GOVOPS_VERSION });
    case '取得儀表板': return 取得儀表板(data);
    case '新增活動': return 新增活動(data);
    case '生成活動作業包': return 生成活動作業包(data);
    case '更新活動狀態': return 更新活動狀態(data);
    case '更新活動報名表單連結': return 更新活動報名表單連結(data);
    case '從報名表單同步報名資料': return 從報名表單同步報名資料(data);
    case '新增報名': return 新增報名(data);
    case '審核報名': return 審核報名(data);
    case '查詢': return 查詢(data);
    case '查詢學員': return 查詢學員(data);
    case '查詢可行銷名單': return 查詢可行銷名單(data);
    case '查詢今日任務': return 查詢今日任務(data);
    case '更新任務狀態': return 更新任務狀態(data);
    case '查詢物品': return 查詢物品(data);
    case '更新物品狀態': return 更新物品狀態(data);
    case '更新餐點狀態': return 更新餐點狀態(data);
    case '生成簽到表': return 生成簽到表(data);
    case '查詢簽到名單': return 查詢簽到名單(data);
    case 'AI缺件檢查': return AI缺件檢查(data);
    case '更新核銷狀態': return 更新核銷狀態(data);
    case '建立Drive資料夾': return 建立Drive資料夾(data);
    case '查詢文件歸檔': return 查詢文件歸檔(data);
    case 'LINE測試': return typeof AI秘書查詢 === 'function' ? AI秘書查詢(data) : LINE測試(data);
    case 'LINE測試V2': return AI秘書查詢(data);
    case '初始化財務資料表': 初始化財務資料表(); return success('財務資料表初始化完成。');
    case '建立應收帳款': return 建立應收帳款(data);
    case '登錄收款': return 登錄收款(data);
    case '登錄支出': return 登錄支出(data);
    case '查詢未收款': return 查詢未收款(data);
    case '查詢專案損益': return 查詢專案損益(data);
    case '初始化提醒中心': 初始化提醒中心(); return success('提醒中心初始化完成。');
    case '建立活動提醒': return 建立活動提醒(data);
    case '查詢今日提醒': return 查詢今日提醒(data);
    case '執行提醒檢查': return 執行提醒檢查(data);
    case 'AI秘書查詢': return AI秘書查詢(data);
    case '產生秘書摘要': return 產生秘書摘要(data);
    case '測試_RuntimeComposer_新增活動': return typeof 測試_RuntimeComposer_新增活動 === 'function' ? 測試_RuntimeComposer_新增活動() : fail('Runtime Composer 測試函式尚未載入。');
    case '測試_RuntimeComposer_財務權限': return typeof 測試_RuntimeComposer_財務權限 === 'function' ? 測試_RuntimeComposer_財務權限() : fail('Runtime Composer 測試函式尚未載入。');
    case '測試_RuntimeComposer_AI限制': return typeof 測試_RuntimeComposer_AI限制 === 'function' ? 測試_RuntimeComposer_AI限制() : fail('Runtime Composer 測試函式尚未載入。');
    default: return fail('找不到對應功能：' + action);
  }
}

function jsonOutput(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function now() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function today() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd'); }
function getSheet(name) { const spreadsheet = ss(); let sheet = spreadsheet.getSheetByName(name); if (!sheet) sheet = spreadsheet.insertSheet(name); return sheet; }
function ensureSheet(name, headers) { const sheet = getSheet(name); if (sheet.getLastRow() === 0) { sheet.appendRow(headers); return sheet; } const current = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String); const missing = headers.filter(h => current.indexOf(h) < 0); if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]); return sheet; }
function 初始化系統() { Object.keys(GOVOPS_CORE_HEADERS).forEach(name => ensureSheet(name, GOVOPS_CORE_HEADERS[name])); writeLog('初始化系統', '系統', '', '建立或補齊MVP資料表', '完成'); return success('系統初始化完成。', { 分頁數: Object.keys(GOVOPS_CORE_HEADERS).length }); }
function headersOf(sheetName) { const sheet = getSheet(sheetName); if (sheet.getLastRow() === 0) return []; return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String); }
function readRows(sheetName) { const sheet = getSheet(sheetName); if (sheet.getLastRow() < 2) return []; const headers = headersOf(sheetName); const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues(); return values.map((row, idx) => { const obj = { _row: idx + 2 }; headers.forEach((h, i) => obj[h] = row[i]); return obj; }); }
function appendObject(sheetName, obj) { const headers = GOVOPS_CORE_HEADERS[sheetName] || headersOf(sheetName); ensureSheet(sheetName, headers); const row = headers.map(h => obj[h] !== undefined ? obj[h] : ''); getSheet(sheetName).appendRow(row); return obj; }
function updateRow(sheetName, rowNumber, patch) { const sheet = getSheet(sheetName); const headers = headersOf(sheetName); Object.keys(patch).forEach(key => { const col = headers.indexOf(key) + 1; if (col > 0) sheet.getRange(rowNumber, col).setValue(patch[key]); }); }
function findById(sheetName, id) { if (!id) return null; const rows = readRows(sheetName); return rows.find(row => Object.keys(row).some(k => /ID$/.test(k) && String(row[k]) === String(id))) || null; }
function generateId(type) { const y = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy'); const roc = String(Number(y) - 1911); const prefixMap = { 活動:'ACT', 報名:'REG', 學員:'STU', 任務:'TSK', 物品:'ITM', 餐點:'MEAL', 簽到:'ATT', 核銷:'CHK', 文件:'DOC', 候補:'WAIT', 選項:'OPT' }; const prefix = prefixMap[type] || 'ID'; const key = prefix + '-' + roc + '-'; let max = 0; Object.keys(GOVOPS_CORE_SHEETS).forEach(k => { readRows(GOVOPS_CORE_SHEETS[k]).forEach(row => { Object.keys(row).forEach(col => { const v = String(row[col] || ''); if (v.indexOf(key) === 0) { const n = Number(v.replace(key, '')); if (!isNaN(n) && n > max) max = n; } }); }); }); return key + String(max + 1).padStart(4, '0'); }
function writeLog(type, sheetName, id, content, result) { try { appendObject(GOVOPS_CORE_SHEETS.操作, { 時間: now(), 操作類型: type, 資料表: sheetName, 關聯ID: id, 操作內容: content, 操作結果: result || '完成' }); } catch (err) {} }
function logError(module, err) { try { appendObject(GOVOPS_CORE_SHEETS.錯誤, { 時間: now(), 功能模組: module, 錯誤摘要: err && err.message ? err.message : String(err), 錯誤內容: err && err.stack ? err.stack : String(err), 處理狀態: '未處理' }); } catch (e) {} }
function requireField(data, key, label) { if (!data[key]) throw new Error('請先填寫必要欄位：' + (label || key)); }
