/**
 * GovOps OS｜政府專案作業系統
 * 後端主控制器：Google Apps Script
 * 用途：串接前端、LINE、Google Sheets、Drive、Calendar
 */

const GOVOPS = {
  試算表ID: '1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY',
  系統名稱: 'GovOps OS｜政府專案作業系統',
  版本: '0.2.0',
  預設時區: 'Asia/Taipei'
};

function doGet(e) { return 處理請求(e, 'GET'); }
function doPost(e) { return 處理請求(e, 'POST'); }

function 處理請求(e, method) {
  try {
    const 參數 = 解析請求(e);
    const 動作 = 參數.action || 參數.動作 || '';
    let 結果;

    switch (動作) {
      case '系統健康檢查':
      case 'health':
        結果 = 系統健康檢查(); break;
      case '取得儀表板':
      case 'getDashboard':
        結果 = 取得儀表板(); break;
      case '新增活動':
      case 'createActivity':
        結果 = 建立活動(參數); break;
      case '新增標案':
      case 'createBid':
        結果 = 新增資料('標案池', 參數); break;
      case '新增任務':
      case 'createTask':
        結果 = 新增資料('任務場次', 參數); break;
      case '新增財務':
      case 'createFinance':
        結果 = 新增資料('財務收支', 參數); break;
      case '查詢':
      case 'query':
        結果 = 查詢中心(參數.query || 參數.查詢內容 || ''); break;
      case '執行事件佇列':
      case 'runEvents':
        結果 = 執行事件佇列(Number(參數.limit || 10)); break;
      case '生成活動作業包':
      case 'generateActivityPack':
        結果 = 生成活動作業包(參數.活動ID || 參數.activityId || 參數.id); break;
      default:
        結果 = 回應(false, '找不到可執行的動作：' + 動作, { 支援動作: ['系統健康檢查','取得儀表板','新增活動','新增標案','新增任務','新增財務','查詢','執行事件佇列','生成活動作業包'] });
    }
    return 輸出JSON(結果);
  } catch (err) {
    記錄錯誤('主控制器', '請求處理失敗', err, '', '');
    return 輸出JSON(回應(false, err.message, {}));
  }
}

function 解析請求(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) {}
  }
  return e.parameter || {};
}
function 輸出JSON(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function 回應(success, message, data) { return { success: success, message: message, data: data || {}, time: new Date().toISOString() }; }
function 取得試算表() { return SpreadsheetApp.openById(GOVOPS.試算表ID); }
function 取得工作表(sheetName) { const sh = 取得試算表().getSheetByName(sheetName); if (!sh) throw new Error('找不到工作表：' + sheetName); return sh; }
function 讀取表頭(sheetName) { const sh = 取得工作表(sheetName); const lastCol = sh.getLastColumn(); return lastCol < 1 ? [] : sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String); }
function 轉欄位鍵(text) { return String(text || '').replace(/[\s　／\/]/g, ''); }

function 新增資料(sheetName, data) {
  const sh = 取得工作表(sheetName);
  const headers = 讀取表頭(sheetName);
  const row = headers.map(h => data[h] || data[轉欄位鍵(h)] || '');
  sh.appendRow(row);
  寫入操作紀錄('新增資料', sheetName, '', JSON.stringify(data), '成功');
  return 回應(true, '已新增到：' + sheetName, { sheetName: sheetName, row: row });
}

function 系統健康檢查() {
  const ss = 取得試算表();
  return 回應(true, '系統正常', { 系統名稱: GOVOPS.系統名稱, 版本: GOVOPS.版本, 試算表名稱: ss.getName(), 試算表連結: ss.getUrl() });
}

function 取得儀表板() {
  const tables = ['標案池','投標專案','招生活動管理','報名資料庫','學員CRM','開課任務清單','當日工作任務表','核銷檢查中心','事件佇列中心','系統錯誤紀錄'];
  const data = {};
  tables.forEach(name => { try { data[name] = Math.max(取得工作表(name).getLastRow() - 1, 0); } catch (err) { data[name] = '未建立'; } });
  return 回應(true, '儀表板資料已取得', data);
}

function 建立活動(data) {
  const 活動ID = data['活動ID'] || data.activityId || 產生ID('活動');
  data['活動ID'] = 活動ID;
  data['建立時間'] = new Date();
  新增資料('招生活動管理', data);
  const eventId = 建立事件('活動建立', '招生活動管理', 活動ID, '建立活動後自動產生任務、資料夾、通知與檢查項目');
  寫入關聯索引('活動', 活動ID, data['活動名稱'] || data['課程名稱'] || '', '招生活動管理', 活動ID, data['活動名稱'] || data['課程名稱'] || '');
  return 回應(true, '活動已建立，並已加入事件佇列', { 活動ID: 活動ID, 事件ID: eventId });
}

function 產生ID(type) {
  const map = {'標案':'BID','活動':'ACT','報名':'REG','學員':'PER','講師':'TEA','工作人員':'STAFF','文件':'DOC','領據':'REC','任務':'TASK','通知':'MSG','照片':'IMG','異動':'CHG','核銷':'CLAIM','事件':'EVT','流程':'FLOW','錯誤':'ERR'};
  const prefix = map[type] || 'ID';
  const year = new Date().getFullYear() - 1911;
  const sh = 取得工作表('系統ID中心');
  const values = sh.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) if (String(values[i][0]) === type && String(values[i][3]) === String(year)) { rowIndex = i + 1; break; }
  let serial = 1;
  if (rowIndex > 0) { serial = Number(sh.getRange(rowIndex, 5).getValue() || 0) + 1; sh.getRange(rowIndex, 5).setValue(serial); sh.getRange(rowIndex, 11).setValue(new Date()); }
  else sh.appendRow([type, type + '編號', prefix, year, serial, prefix + '-' + year + '-流水號', prefix + '-' + year + '-001', '', '是', new Date(), new Date(), '', '自動產生唯一編號']);
  return prefix + '-' + year + '-' + String(serial).padStart(3, '0');
}

function 建立事件(type, sourceSheet, sourceId, content) {
  const eventId = 產生ID('事件');
  const sh = 取得工作表('事件佇列中心');
  sh.appendRow([eventId, type, sourceSheet, sourceId, type, content, '待系統執行', '普通', '待執行', new Date(), '', '', 0, '', '事件觸發引擎', '']);
  return eventId;
}

function 執行事件佇列(limit) {
  const sh = 取得工作表('事件佇列中心');
  const values = sh.getDataRange().getValues();
  let count = 0;
  const results = [];
  for (let i = 1; i < values.length && count < limit; i++) {
    const row = values[i];
    const 狀態 = String(row[8] || '');
    if (狀態 !== '待執行' && 狀態 !== '重試') continue;
    const 事件ID = row[0];
    const 事件類型 = row[1];
    const 來源ID = row[3];
    try {
      sh.getRange(i + 1, 9).setValue('執行中');
      sh.getRange(i + 1, 11).setValue(new Date());
      let result;
      if (事件類型 === '活動建立') result = 生成活動作業包(來源ID);
      else result = 回應(true, '事件暫無對應工人', { 事件類型: 事件類型 });
      sh.getRange(i + 1, 9).setValue('已完成');
      sh.getRange(i + 1, 12).setValue(new Date());
      results.push({ 事件ID: 事件ID, 結果: result.message });
      count++;
    } catch (err) {
      const retry = Number(row[12] || 0) + 1;
      sh.getRange(i + 1, 9).setValue(retry >= 3 ? '失敗' : '重試');
      sh.getRange(i + 1, 13).setValue(retry);
      sh.getRange(i + 1, 14).setValue(err.message);
      記錄錯誤('事件執行工人', '事件執行失敗', err, '事件佇列中心', 事件ID);
    }
  }
  return 回應(true, '事件佇列已執行', { 執行筆數: count, 明細: results });
}

function 生成活動作業包(活動ID) {
  if (!活動ID) throw new Error('缺少活動ID');
  const activity = 依ID查資料('招生活動管理', 活動ID) || { 活動ID: 活動ID };
  const 活動名稱 = activity['活動名稱'] || activity['課程名稱'] || '未命名活動';
  const 活動日期 = activity['活動日期'] || activity['日期'] || '';
  const 地點 = activity['活動地點'] || activity['地點'] || '';
  const 計畫名稱 = activity['計畫名稱'] || activity['標案名稱'] || '';

  建立流程紀錄('活動建立流程', 活動ID, '開始生成作業包', '產生任務與檢查資料', '執行中', '系統');
  生成開課任務(活動ID, 活動名稱, 活動日期, 計畫名稱);
  生成當日任務(活動ID, 活動名稱, 活動日期, 地點);
  生成物品清單(活動ID, 活動名稱);
  生成照片清單(活動ID, 活動名稱);
  生成核銷檢查(活動ID, 活動名稱);
  建立流程紀錄('活動建立流程', 活動ID, '作業包完成', '等待人工確認', '已完成', '系統');
  return 回應(true, '活動作業包已生成', { 活動ID: 活動ID, 活動名稱: 活動名稱 });
}

function 依ID查資料(sheetName, id) {
  const sh = 取得工作表(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = values[0].map(String);
  const idIndex = headers.findIndex(h => h.indexOf('ID') >= 0 || h.indexOf('編號') >= 0);
  if (idIndex < 0) return null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(id)) {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = values[i][idx]);
      return obj;
    }
  }
  return null;
}

function 生成開課任務(活動ID, 活動名稱, 活動日期, 計畫名稱) {
  const tasks = [
    ['15天前','確認講義與課程資料'], ['7天前','確認場地與設備'], ['5天前','發送學員行前通知'], ['2天前','產生簽到表與名牌'], ['1天前','確認講師、餐點、工作人員'], ['當天','現場執行與資料回收'], ['課後3天','整理照片與滿意度'], ['課後7天','完成成果與核銷資料']
  ];
  const sh = 取得工作表('開課任務清單');
  tasks.forEach(t => sh.appendRow([產生ID('任務'), 活動ID, 活動名稱, t[0], t[1], '系統待指派', '', '待執行', 'LINE', '未提醒', '', '', '活動作業包', 活動ID, 計畫名稱, new Date(), new Date()]));
}

function 生成當日任務(活動ID, 活動名稱, 活動日期, 地點) {
  const tasks = [
    ['07:30–07:45','場地佈置','張貼海報、布條，確認報到桌與動線'], ['07:45–08:00','報到處作業','簽到表、講義、禮品、領據準備'], ['08:00–08:15','開場說明','活動流程、計畫說明與注意事項'], ['08:15–10:30','研習課程','拍攝講師授課與學員互動'], ['10:00','餐點確認','確認葷素、數量、送達時間、收據'], ['10:30–10:40','休息轉場','更換海報、確認下一段講師'], ['10:40–11:30','研習課程','持續拍攝與支援講師'], ['12:00','發放便當／賦歸','協助學員領取餐點與離場'], ['撤場','資料回收','簽到表、領據、滿意度、發票、物品取回']
  ];
  const sh = 取得工作表('當日工作任務表');
  tasks.forEach(t => sh.appendRow([產生ID('任務'), 活動ID, 活動名稱, 活動日期, 地點, t[0], t[1], t[2], '系統待指派', '', '待執行', '', new Date(), '活動作業包', '']));
}

function 生成物品清單(活動ID, 活動名稱) {
  const items = ['出席禮品','有獎徵答禮品','講師海報','講師領據','工作人員領據','簽到表','布條','文具箱','滿意度調查表','報到處立牌','講義','餐盒發票／收據'];
  const sh = 取得工作表('物品清單');
  items.forEach(name => sh.appendRow([產生ID('任務'), 活動ID, 活動名稱, '攜帶與取回', name, 1, '系統待指派', '否', '否', '', '待確認', new Date(), '活動作業包']));
}

function 生成照片清單(活動ID, 活動名稱) {
  const photos = ['場地佈置','海報','布條','報到處','學員簽到','長官致詞','講師授課','學員互動','有獎徵答','便當發放','滿意度回收','撤場後場地恢復'];
  const sh = 取得工作表('現場照片紀錄');
  photos.forEach(name => sh.appendRow([產生ID('照片'), 活動ID, 活動名稱, name, '必拍', '未上傳', '', '', '系統待指派', '', new Date(), '活動作業包']));
}

function 生成核銷檢查(活動ID, 活動名稱) {
  const checks = ['簽到表已回收','講師領據已簽回','工作人員領據已簽回','滿意度調查表已回收','便當收據／發票已取得','場地費收據已取得','照片已上傳','物品已取回','場地已恢復'];
  const sh = 取得工作表('核銷檢查中心');
  checks.forEach(name => sh.appendRow([產生ID('核銷'), '', 活動ID, name, '活動核銷', '是', '未完成', '尚未確認：' + name, '系統待指派', '', '', '', '核銷檢查中心', '中', '請於活動結束後完成確認', new Date()]));
}

function 建立流程紀錄(流程名稱, 關聯ID, 流程階段, 下一步, 狀態, 負責人) {
  const sh = 取得工作表('流程執行紀錄');
  sh.appendRow([產生ID('流程'), 流程名稱, 關聯ID, 流程階段, '', 流程階段, 下一步, 狀態, 負責人, new Date(), 狀態 === '已完成' ? new Date() : '', '否', '低', '', '']);
}

function 寫入關聯索引(mainType, mainId, mainName, relatedSheet, relatedId, relatedName) {
  const sh = 取得工作表('資料關聯索引');
  const id = 'REL-' + new Date().getTime();
  sh.appendRow([id, mainType, mainId, mainName, relatedSheet, relatedId, relatedName, relatedSheet, '有效', '系統自動建立', new Date(), new Date(), '', '正常']);
  return id;
}

function 寫入操作紀錄(action, targetType, targetId, content, result) {
  let sh;
  try { sh = 取得工作表('操作紀錄'); } catch (err) { return; }
  sh.appendRow(['LOG-' + new Date().getTime(), new Date(), '系統', '系統', action, targetType, targetId, '', content, result, '', 'Apps Script']);
}
function 記錄錯誤(module, type, err, sourceSheet, sourceId) {
  try { 取得工作表('系統錯誤紀錄').appendRow([產生ID('錯誤'), module, type, String(err && err.message ? err.message : err), sourceSheet, sourceId, '系統', new Date(), '高', '未修復', '', '']); } catch (e) {}
}

function 查詢中心(keyword) {
  const k = String(keyword || '').trim();
  if (!k) return 回應(false, '請輸入查詢內容', {});
  if (k.indexOf('今日') >= 0) return 查詢今日任務();
  if (k.indexOf('未完成') >= 0) return 查詢未完成任務();
  if (k.indexOf('缺件') >= 0 || k.indexOf('核銷') >= 0) return 查詢核銷缺件();
  return 回應(true, '目前已收到查詢，後續會接全域搜尋中心', { 查詢內容: k });
}
function 查詢今日任務() { return 回應(true, '今日任務查詢完成', { 提醒: '已可透過當日工作任務表讀取今日資料，下一版加入日期篩選' }); }
function 查詢未完成任務() { return 回應(true, '未完成任務查詢完成', { 提醒: '下一版會篩選任務狀態不是已完成的資料' }); }
function 查詢核銷缺件() { return 回應(true, '核銷缺件查詢完成', { 提醒: '下一版會讀取核銷檢查中心，列出缺件與高風險項目' }); }
