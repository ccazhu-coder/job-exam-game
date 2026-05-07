/**
 * GovOps OS｜政府專案作業系統｜可上線操作版
 * 版本：1.0.0
 * 用途：Google Apps Script Web App + Google Sheets + LINE Bot
 * 使用方式：整份貼到 Apps Script 的「程式碼.gs」，部署成網頁應用程式。
 */

const GOVOPS = {
  試算表ID: '1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY',
  系統名稱: 'GovOps OS｜政府專案作業系統',
  版本: '1.0.0',
  預設時區: 'Asia/Taipei'
};

function doGet(e) {
  return 處理請求(e, 'GET');
}

function doPost(e) {
  const body = 取得PostBody(e);
  if (body && body.events && Array.isArray(body.events)) {
    return 處理LINEWebhook(body);
  }
  return 處理請求(e, 'POST');
}

function 處理請求(e, method) {
  try {
    const 參數 = 解析請求(e);
    const 動作 = 參數.action || 參數.動作 || '';
    let 結果;

    switch (動作) {
      case '系統健康檢查':
      case 'health':
        結果 = 系統健康檢查();
        break;
      case '取得儀表板':
      case 'getDashboard':
        結果 = 取得儀表板();
        break;
      case '新增活動':
      case 'createActivity':
        結果 = 建立活動(參數);
        break;
      case '執行事件佇列':
      case 'runEvents':
        結果 = 執行事件佇列(Number(參數.limit || 10));
        break;
      case '生成活動作業包':
      case 'generateActivityPack':
        結果 = 生成活動作業包(參數.活動ID || 參數.activityId || 參數.id);
        break;
      case '查詢':
      case 'query':
        結果 = 查詢中心(參數.query || 參數.查詢內容 || '');
        break;
      case '更新任務狀態':
      case 'updateTaskStatus':
        結果 = 更新任務狀態(參數);
        break;
      case '更新物品狀態':
      case 'updateItemStatus':
        結果 = 更新物品狀態(參數);
        break;
      case '更新核銷狀態':
      case 'updateCheckStatus':
        結果 = 更新核銷狀態(參數);
        break;
      case 'LINE測試':
      case 'lineTest':
        結果 = 執行LINE文字指令(參數.text || 參數.文字 || '查詢今日任務', 參數.uid || '測試');
        break;
      default:
        結果 = 回應(false, '找不到可執行的動作：' + 動作, {
          支援動作: ['系統健康檢查', '取得儀表板', '新增活動', '執行事件佇列', '查詢', '更新任務狀態', '更新物品狀態', '更新核銷狀態', 'LINE測試']
        });
    }
    return 輸出JSON(結果);
  } catch (err) {
    記錄錯誤('主控制器', '請求處理失敗', err, '', '');
    return 輸出JSON(回應(false, err.message, {}));
  }
}

function 取得PostBody(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  try { return JSON.parse(e.postData.contents); } catch (err) { return null; }
}

function 解析請求(e) {
  if (!e) return {};
  const body = 取得PostBody(e);
  if (body && !body.events) return body;
  return e.parameter || {};
}

function 輸出JSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function 回應(success, message, data) {
  return { success: success, message: message, data: data || {}, time: new Date().toISOString() };
}

function 取得試算表() {
  return SpreadsheetApp.openById(GOVOPS.試算表ID);
}

function 取得工作表(sheetName) {
  const sh = 取得試算表().getSheetByName(sheetName);
  if (!sh) throw new Error('找不到工作表：' + sheetName);
  return sh;
}

function 讀取表頭(sheetName) {
  const sh = 取得工作表(sheetName);
  const lastCol = sh.getLastColumn();
  return lastCol < 1 ? [] : sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

function 讀取資料列(sheetName) {
  const sh = 取得工作表(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, idx) => obj[h] = row[idx]);
    return obj;
  });
}

function 更新列資料(sheetName, rowNumber, updates) {
  const sh = 取得工作表(sheetName);
  const headers = 讀取表頭(sheetName);
  Object.keys(updates).forEach(key => {
    const idx = headers.indexOf(key);
    if (idx >= 0) sh.getRange(rowNumber, idx + 1).setValue(updates[key]);
  });
}

function 轉欄位鍵(text) {
  return String(text || '').replace(/[\s　／\/]/g, '');
}

function 新增資料(sheetName, data) {
  const sh = 取得工作表(sheetName);
  const headers = 讀取表頭(sheetName);
  const row = headers.map(h => data[h] || data[轉欄位鍵(h)] || '');
  sh.appendRow(row);
  寫入操作紀錄('新增資料', sheetName, '', JSON.stringify(data), '成功');
  return 回應(true, '已新增到：' + sheetName, { sheetName: sheetName });
}

function 系統健康檢查() {
  const ss = 取得試算表();
  return 回應(true, '系統正常，可以開始操作', {
    系統名稱: GOVOPS.系統名稱,
    版本: GOVOPS.版本,
    試算表名稱: ss.getName(),
    試算表連結: ss.getUrl()
  });
}

function 取得儀表板() {
  const data = {};
  const tables = ['標案池','投標專案','招生活動管理','報名資料庫','學員CRM','開課任務清單','當日工作任務表','物品清單','現場照片紀錄','核銷檢查中心','事件佇列中心','系統錯誤紀錄'];
  tables.forEach(name => {
    try { data[name] = Math.max(取得工作表(name).getLastRow() - 1, 0); }
    catch (err) { data[name] = '未建立'; }
  });
  data['待完成任務'] = 統計狀態('當日工作任務表', '任務狀態', ['待執行','進行中','異常']);
  data['核銷缺件'] = 統計狀態('核銷檢查中心', '目前狀態', ['未完成','缺件']);
  data['事件待執行'] = 統計狀態('事件佇列中心', '狀態', ['待執行','重試']);
  return 回應(true, '儀表板資料已取得', data);
}

function 統計狀態(sheetName, statusHeader, targetStatuses) {
  try {
    return 讀取資料列(sheetName).filter(r => targetStatuses.indexOf(String(r[statusHeader] || '')) >= 0).length;
  } catch (err) { return 0; }
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
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === type && String(values[i][3]) === String(year)) {
      rowIndex = i + 1;
      break;
    }
  }
  let serial = 1;
  if (rowIndex > 0) {
    serial = Number(sh.getRange(rowIndex, 5).getValue() || 0) + 1;
    sh.getRange(rowIndex, 5).setValue(serial);
    sh.getRange(rowIndex, 11).setValue(new Date());
  } else {
    sh.appendRow([type, type + '編號', prefix, year, serial, prefix + '-' + year + '-流水號', prefix + '-' + year + '-001', '', '是', new Date(), new Date(), '', '自動產生唯一編號']);
  }
  return prefix + '-' + year + '-' + String(serial).padStart(3, '0');
}

function 建立事件(type, sourceSheet, sourceId, content) {
  const eventId = 產生ID('事件');
  取得工作表('事件佇列中心').appendRow([eventId, type, sourceSheet, sourceId, type, content, '待系統執行', '普通', '待執行', new Date(), '', '', 0, '', '事件觸發引擎', '']);
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
      const result = 事件類型 === '活動建立' ? 生成活動作業包(來源ID) : 回應(true, '事件暫無對應工人', { 事件類型: 事件類型 });
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
  return 讀取資料列(sheetName).find(r => Object.keys(r).some(k => (k.indexOf('ID') >= 0 || k.indexOf('編號') >= 0) && String(r[k]) === String(id))) || null;
}

function 找列(sheetName, conditionFn) {
  return 讀取資料列(sheetName).find(conditionFn) || null;
}

function 更新任務狀態(data) {
  const 活動ID = data.活動ID || data.activityId || '';
  const 任務關鍵字 = data.任務名稱 || data.taskName || data.keyword || '';
  const 狀態 = data.任務狀態 || data.status || '已完成';
  const row = 找列('當日工作任務表', r => (!活動ID || String(r['活動ID']) === String(活動ID)) && (!任務關鍵字 || String(r['工作任務'] || '').indexOf(任務關鍵字) >= 0));
  if (!row) return 回應(false, '找不到符合的當日任務', { 活動ID, 任務關鍵字 });
  更新列資料('當日工作任務表', row._row, { '任務狀態': 狀態, '完成時間': new Date() });
  寫入操作紀錄('更新任務狀態', '當日工作任務表', row['任務ID'] || '', JSON.stringify(data), '成功');
  return 回應(true, '任務狀態已更新', { 任務: row['工作任務'], 狀態 });
}

function 更新物品狀態(data) {
  const 活動ID = data.活動ID || data.activityId || '';
  const 物品名稱 = data.物品名稱 || data.itemName || data.keyword || '';
  const 欄位 = data.欄位 || data.field || (String(data.actionText || '').indexOf('取回') >= 0 ? '是否已取回' : '是否已帶出');
  const 狀態 = data.狀態 || data.status || '是';
  const row = 找列('物品清單', r => (!活動ID || String(r['活動ID']) === String(活動ID)) && (!物品名稱 || String(r['物品名稱'] || '').indexOf(物品名稱) >= 0));
  if (!row) return 回應(false, '找不到符合的物品', { 活動ID, 物品名稱 });
  更新列資料('物品清單', row._row, { [欄位]: 狀態, '備註': data.備註 || '' });
  return 回應(true, '物品狀態已更新', { 物品: row['物品名稱'], 欄位, 狀態 });
}

function 更新核銷狀態(data) {
  const 活動ID = data.活動ID || data.activityId || '';
  const 檢查項目 = data.檢查項目 || data.checkName || data.keyword || '';
  const 狀態 = data.目前狀態 || data.status || '已完成';
  const row = 找列('核銷檢查中心', r => (!活動ID || String(r['活動ID']) === String(活動ID)) && (!檢查項目 || String(r['檢查項目'] || '').indexOf(檢查項目) >= 0));
  if (!row) return 回應(false, '找不到符合的核銷檢查項目', { 活動ID, 檢查項目 });
  更新列資料('核銷檢查中心', row._row, { '目前狀態': 狀態, '完成日': new Date(), '更新時間': new Date() });
  return 回應(true, '核銷狀態已更新', { 檢查項目: row['檢查項目'], 狀態 });
}

function 查詢中心(keyword) {
  const k = String(keyword || '').trim();
  if (!k) return 回應(false, '請輸入查詢內容', {});
  const dateKey = 擷取日期字串(k);
  if (k.indexOf('未完成') >= 0) return 查詢未完成任務(dateKey);
  if (k.indexOf('物品') >= 0 || k.indexOf('攜帶') >= 0) return 查詢物品清單(dateKey);
  if (k.indexOf('缺件') >= 0 || k.indexOf('核銷') >= 0) return 查詢核銷缺件(dateKey);
  if (k.indexOf('今日') >= 0) return 查詢今日任務();
  return 回應(true, '目前已收到查詢，後續會接全域搜尋中心', { 查詢內容: k });
}

function 擷取日期字串(text) {
  const m = String(text).match(/(\d{1,2})\/(\d{1,2})/);
  return m ? (m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0')) : '';
}

function 查詢今日任務() {
  const today = Utilities.formatDate(new Date(), GOVOPS.預設時區, 'yyyy/MM/dd');
  const rows = 讀取資料列('當日工作任務表').filter(r => 格式化日期(r['活動日期']) === today);
  return 回應(true, '今日任務查詢完成', { 日期: today, 筆數: rows.length, 任務: rows });
}

function 查詢未完成任務(dateKey) {
  const rows = 讀取資料列('當日工作任務表').filter(r => (!dateKey || 格式化日期(r['活動日期']).indexOf(dateKey) >= 0) && String(r['任務狀態']) !== '已完成');
  return 回應(true, '未完成任務查詢完成', { 筆數: rows.length, 任務: rows });
}

function 查詢物品清單(dateKey) {
  const rows = 讀取資料列('物品清單').filter(r => !dateKey || String(r['活動名稱'] || '').indexOf(dateKey) >= 0 || String(r['活動ID'] || '').indexOf(dateKey) >= 0);
  return 回應(true, '物品清單查詢完成', { 筆數: rows.length, 物品: rows });
}

function 查詢核銷缺件(dateKey) {
  const rows = 讀取資料列('核銷檢查中心').filter(r => String(r['目前狀態']) !== '已完成');
  return 回應(true, '核銷缺件查詢完成', { 筆數: rows.length, 缺件: rows });
}

function 格式化日期(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return Utilities.formatDate(value, GOVOPS.預設時區, 'yyyy/MM/dd');
  return String(value);
}

function 處理LINEWebhook(body) {
  try {
    body.events.forEach(ev => {
      if (!ev.replyToken || !ev.message || ev.message.type !== 'text') return;
      const uid = ev.source && ev.source.userId ? ev.source.userId : '';
      const text = ev.message.text || '';
      const result = 執行LINE文字指令(text, uid);
      回覆LINE訊息(ev.replyToken, 格式化LINE回覆(result));
    });
    return 輸出JSON({ success: true });
  } catch (err) {
    記錄錯誤('LINEWebhook', 'LINE處理失敗', err, '', '');
    return 輸出JSON({ success: false, message: err.message });
  }
}

function 執行LINE文字指令(text, uid) {
  const cmd = 解析LINE文字指令(text);
  let result;
  if (cmd.類型 === '查詢') result = 查詢中心(text);
  else if (cmd.類型 === '任務完成') result = 更新任務狀態({ keyword: cmd.關鍵字, status: '已完成' });
  else if (cmd.類型 === '物品更新') result = 更新物品狀態({ keyword: cmd.關鍵字, actionText: text });
  else if (cmd.類型 === '核銷更新') result = 更新核銷狀態({ keyword: cmd.關鍵字, status: '已完成' });
  else result = 回應(false, '目前無法判斷指令，請改用：查詢今日任務、查詢未完成事項、完成場地佈置、講師領據已簽回。', { 原文: text });
  寫入操作紀錄('LINE指令', 'LINE', uid, text, result.success ? '成功' : '失敗');
  return result;
}

function 解析LINE文字指令(text) {
  const t = String(text || '').trim();
  if (t.indexOf('查詢') >= 0 || t.indexOf('今日') >= 0 || t.indexOf('未完成') >= 0 || t.indexOf('缺件') >= 0) return { 類型: '查詢', 關鍵字: t };
  if (t.indexOf('已帶出') >= 0 || t.indexOf('已取回') >= 0) return { 類型: '物品更新', 關鍵字: 移除日期與動詞(t, ['已帶出','已取回']) };
  if (t.indexOf('領據') >= 0 || t.indexOf('滿意度') >= 0 || t.indexOf('照片') >= 0 || t.indexOf('收據') >= 0 || t.indexOf('發票') >= 0) return { 類型: '核銷更新', 關鍵字: 移除日期與動詞(t, ['已簽回','已回收','已上傳','已取得','已完成']) };
  if (t.indexOf('完成') >= 0 || t.indexOf('已確認') >= 0) return { 類型: '任務完成', 關鍵字: 移除日期與動詞(t, ['完成','已確認']) };
  return { 類型: '未知', 關鍵字: t };
}

function 移除日期與動詞(text, words) {
  let t = String(text || '').replace(/\d{1,2}\/\d{1,2}/g, '').trim();
  words.forEach(w => t = t.replace(w, ''));
  return t.trim();
}

function 格式化LINE回覆(result) {
  if (!result || !result.success) return '⚠️ 操作失敗\n' + (result ? result.message : '系統沒有回應');
  const data = result.data || {};
  if (data.任務 && Array.isArray(data.任務)) {
    if (data.任務.length === 0) return '目前沒有符合的任務。';
    return '📌 任務查詢結果：' + data.任務.length + ' 筆\n\n' + data.任務.slice(0, 8).map(r => '・' + (r['時段'] || '') + ' ' + (r['工作任務'] || '') + '｜' + (r['任務狀態'] || '')).join('\n');
  }
  if (data.缺件 && Array.isArray(data.缺件)) {
    if (data.缺件.length === 0) return '✅ 目前沒有核銷缺件。';
    return '⚠️ 核銷缺件：' + data.缺件.length + ' 筆\n\n' + data.缺件.slice(0, 8).map(r => '・' + (r['檢查項目'] || '') + '｜' + (r['目前狀態'] || '')).join('\n');
  }
  if (data.物品 && Array.isArray(data.物品)) {
    if (data.物品.length === 0) return '目前沒有符合的物品。';
    return '📦 物品清單：' + data.物品.length + ' 筆\n\n' + data.物品.slice(0, 8).map(r => '・' + (r['物品名稱'] || '') + '｜帶出：' + (r['是否已帶出'] || '') + '｜取回：' + (r['是否已取回'] || '')).join('\n');
  }
  return '✅ ' + result.message;
}

function 取得LINE權杖() {
  try {
    const rows = 讀取資料列('系統設定中心');
    const row = rows.find(r => String(r['設定名稱']) === 'LINE Token' || String(r['設定名稱']) === 'LINE權杖');
    return row ? String(row['設定值'] || '') : '';
  } catch (err) { return ''; }
}

function 回覆LINE訊息(replyToken, text) {
  const token = 取得LINE權杖();
  if (!token) {
    記錄錯誤('LINE', '缺少LINE權杖', new Error('請在系統設定中心填入 LINE Token'), '', '');
    return;
  }
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
}

function 生成開課任務(活動ID, 活動名稱, 活動日期, 計畫名稱) {
  const tasks = [['15天前','確認講義與課程資料'], ['7天前','確認場地與設備'], ['5天前','發送學員行前通知'], ['2天前','產生簽到表與名牌'], ['1天前','確認講師、餐點、工作人員'], ['當天','現場執行與資料回收'], ['課後3天','整理照片與滿意度'], ['課後7天','完成成果與核銷資料']];
  const sh = 取得工作表('開課任務清單');
  tasks.forEach(t => sh.appendRow([產生ID('任務'), 活動ID, 活動名稱, t[0], t[1], '系統待指派', '', '待執行', 'LINE', '未提醒', '', '', '活動作業包', 活動ID, 計畫名稱, new Date(), new Date()]));
}

function 生成當日任務(活動ID, 活動名稱, 活動日期, 地點) {
  const tasks = [['07:30–07:45','場地佈置','張貼海報、布條，確認報到桌與動線'], ['07:45–08:00','報到處作業','簽到表、講義、禮品、領據準備'], ['08:00–08:15','開場說明','活動流程、計畫說明與注意事項'], ['08:15–10:30','研習課程','拍攝講師授課與學員互動'], ['10:00','餐點確認','確認葷素、數量、送達時間、收據'], ['10:30–10:40','休息轉場','更換海報、確認下一段講師'], ['10:40–11:30','研習課程','持續拍攝與支援講師'], ['12:00','發放便當／賦歸','協助學員領取餐點與離場'], ['撤場','資料回收','簽到表、領據、滿意度、發票、物品取回']];
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
  取得工作表('流程執行紀錄').appendRow([產生ID('流程'), 流程名稱, 關聯ID, 流程階段, '', 流程階段, 下一步, 狀態, 負責人, new Date(), 狀態 === '已完成' ? new Date() : '', '否', '低', '', '']);
}

function 寫入關聯索引(mainType, mainId, mainName, relatedSheet, relatedId, relatedName) {
  const id = 'REL-' + new Date().getTime();
  取得工作表('資料關聯索引').appendRow([id, mainType, mainId, mainName, relatedSheet, relatedId, relatedName, relatedSheet, '有效', '系統自動建立', new Date(), new Date(), '', '正常']);
  return id;
}

function 寫入操作紀錄(action, targetType, targetId, content, result) {
  try { 取得工作表('操作紀錄').appendRow(['LOG-' + new Date().getTime(), new Date(), '系統', '系統', action, targetType, targetId, '', content, result, '', 'Apps Script']); } catch (err) {}
}

function 記錄錯誤(module, type, err, sourceSheet, sourceId) {
  try { 取得工作表('系統錯誤紀錄').appendRow([產生ID('錯誤'), module, type, String(err && err.message ? err.message : err), sourceSheet, sourceId, '系統', new Date(), '高', '未修復', '', '']); } catch (e) {}
}
