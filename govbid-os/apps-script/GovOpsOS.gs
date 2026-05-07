/**
 * GovOps OS｜政府專案作業系統
 * 後端主控制器：Google Apps Script
 * 用途：串接前端、LINE、Google Sheets、Drive、Calendar
 */

const GOVOPS = {
  試算表ID: '1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY',
  系統名稱: 'GovOps OS｜政府專案作業系統',
  版本: '0.1.0',
  預設時區: 'Asia/Taipei'
};

function doGet(e) {
  return 處理請求(e, 'GET');
}

function doPost(e) {
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
      case '新增標案':
      case 'createBid':
        結果 = 新增資料('標案池', 參數);
        break;
      case '新增任務':
      case 'createTask':
        結果 = 新增資料('任務場次', 參數);
        break;
      case '新增財務':
      case 'createFinance':
        結果 = 新增資料('財務收支', 參數);
        break;
      case '查詢':
      case 'query':
        結果 = 查詢中心(參數.query || 參數.查詢內容 || '');
        break;
      default:
        結果 = 回應(false, '找不到可執行的動作：' + 動作, { 支援動作: ['系統健康檢查','取得儀表板','新增活動','新增標案','新增任務','新增財務','查詢'] });
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

function 輸出JSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function 回應(success, message, data) {
  return { success: success, message: message, data: data || {}, time: new Date().toISOString() };
}

function 取得試算表() {
  return SpreadsheetApp.openById(GOVOPS.試算表ID);
}

function 取得工作表(sheetName) {
  const ss = 取得試算表();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('找不到工作表：' + sheetName);
  return sh;
}

function 讀取表頭(sheetName) {
  const sh = 取得工作表(sheetName);
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

function 新增資料(sheetName, data) {
  const sh = 取得工作表(sheetName);
  const headers = 讀取表頭(sheetName);
  const row = headers.map(h => data[h] || data[轉欄位鍵(h)] || '');
  sh.appendRow(row);
  寫入操作紀錄('新增資料', sheetName, '', JSON.stringify(data), '成功');
  return 回應(true, '已新增到：' + sheetName, { sheetName: sheetName, row: row });
}

function 轉欄位鍵(text) {
  return String(text || '').replace(/[\s　／\/]/g, '');
}

function 系統健康檢查() {
  const ss = 取得試算表();
  return 回應(true, '系統正常', {
    系統名稱: GOVOPS.系統名稱,
    版本: GOVOPS.版本,
    試算表名稱: ss.getName(),
    試算表連結: ss.getUrl()
  });
}

function 取得儀表板() {
  const tables = ['標案池','投標專案','招生活動管理','報名資料庫','學員CRM','開課任務清單','當日工作任務表','核銷檢查中心','系統錯誤紀錄'];
  const data = {};
  tables.forEach(name => {
    try {
      const sh = 取得工作表(name);
      data[name] = Math.max(sh.getLastRow() - 1, 0);
    } catch (err) {
      data[name] = '未建立';
    }
  });
  return 回應(true, '儀表板資料已取得', data);
}

function 建立活動(data) {
  const 活動ID = data['活動ID'] || 產生ID('活動');
  data['活動ID'] = 活動ID;
  data['建立時間'] = new Date();
  新增資料('招生活動管理', data);
  建立事件('活動建立', '招生活動管理', 活動ID, '建立活動後自動產生任務、資料夾、通知與檢查項目');
  寫入關聯索引('活動', 活動ID, data['活動名稱'] || data['課程名稱'] || '', '招生活動管理', 活動ID, data['活動名稱'] || '');
  return 回應(true, '活動已建立，並已加入事件佇列', { 活動ID: 活動ID });
}

function 產生ID(type) {
  const map = {
    '標案': 'BID',
    '活動': 'ACT',
    '報名': 'REG',
    '學員': 'PER',
    '講師': 'TEA',
    '工作人員': 'STAFF',
    '文件': 'DOC',
    '領據': 'REC',
    '任務': 'TASK',
    '通知': 'MSG',
    '照片': 'IMG',
    '異動': 'CHG',
    '核銷': 'CLAIM',
    '事件': 'EVT',
    '流程': 'FLOW',
    '錯誤': 'ERR'
  };
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
  const sh = 取得工作表('事件佇列中心');
  sh.appendRow([eventId, type, sourceSheet, sourceId, type, content, '待系統執行', '普通', '待執行', new Date(), '', '', 0, '', '事件觸發引擎', '']);
  return eventId;
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
  try {
    const sh = 取得工作表('系統錯誤紀錄');
    sh.appendRow([產生ID('錯誤'), module, type, String(err && err.message ? err.message : err), sourceSheet, sourceId, '系統', new Date(), '高', '未修復', '', '']);
  } catch (e) {}
}

function 查詢中心(keyword) {
  const k = String(keyword || '').trim();
  if (!k) return 回應(false, '請輸入查詢內容', {});
  if (k.indexOf('今日') >= 0) return 查詢今日任務();
  if (k.indexOf('未完成') >= 0) return 查詢未完成任務();
  if (k.indexOf('缺件') >= 0 || k.indexOf('核銷') >= 0) return 查詢核銷缺件();
  return 回應(true, '目前已收到查詢，後續會接全域搜尋中心', { 查詢內容: k });
}

function 查詢今日任務() {
  return 回應(true, '今日任務查詢完成', { 提醒: '下一版會依日期讀取開課任務清單與當日工作任務表' });
}

function 查詢未完成任務() {
  return 回應(true, '未完成任務查詢完成', { 提醒: '下一版會篩選任務狀態不是已完成的資料' });
}

function 查詢核銷缺件() {
  return 回應(true, '核銷缺件查詢完成', { 提醒: '下一版會讀取核銷檢查中心，列出缺件與高風險項目' });
}
