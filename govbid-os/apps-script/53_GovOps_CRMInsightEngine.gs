/*
GovOps OS｜53_GovOps_CRMInsightEngine.gs
目的：建立中文 CRM 學員洞察引擎。
安全策略：
1. 不修改 37_core.gs / router。
2. 不覆蓋學員CRM原資料。
3. 不建立行銷推播名單，只建立服務追蹤與學員關懷洞察。
4. 不輸出大量個資，只保留必要識別欄位供內部服務追蹤。
*/

var GOVOPS_CRM_INSIGHT_VERSION = '1.0.0';
var GOVOPS_CRM_INSIGHT_SHEET = 'CRM學員洞察';
var GOVOPS_CRM_CARE_SHEET = 'CRM關懷追蹤';
var GOVOPS_CRM_SUMMARY_SHEET = 'CRM服務摘要';

var GOVOPS_CRM_INSIGHT_HEADERS = ['洞察ID','tenantId','學員ID','姓名','分群類型','互動等級','出席風險','課程偏好','洞察說明','建議服務行動','建立時間','更新時間'];
var GOVOPS_CRM_CARE_HEADERS = ['追蹤ID','tenantId','學員ID','姓名','追蹤類型','追蹤原因','建議關懷方式','追蹤狀態','建立時間','更新時間','備註'];
var GOVOPS_CRM_SUMMARY_HEADERS = ['摘要ID','tenantId','產生時間','CRM總人數','高互動人數','需關懷人數','出席風險人數','一般培育人數','服務建議摘要','建立時間'];

function 初始化CRM學員洞察引擎() {
  try {
    ensureCrmInsightSheets_();
    return 建立中文成功回傳('CRM學員洞察引擎初始化完成。', {
      版本: GOVOPS_CRM_INSIGHT_VERSION,
      洞察表: GOVOPS_CRM_INSIGHT_SHEET,
      關懷追蹤表: GOVOPS_CRM_CARE_SHEET,
      服務摘要表: GOVOPS_CRM_SUMMARY_SHEET
    });
  } catch (err) {
    if (typeof logError === 'function') logError('初始化CRM學員洞察引擎', err);
    return 建立中文失敗回傳('系統錯誤', 'CRM學員洞察引擎初始化失敗。', {});
  }
}

function 執行CRM學員洞察分析(data) {
  try {
    初始化CRM學員洞察引擎();
    data = data || {};
    var tenantId = String(data.tenantId || 'default').trim() || 'default';
    var rows = 讀取CRM來源資料_(tenantId);
    var insights = rows.map(function(row){ return 建立學員洞察_(row, tenantId); });
    var careRows = insights.filter(function(item){ return item.分群類型 === '需關懷學員' || item.出席風險 === '高'; }).map(function(item){ return 建立關懷追蹤_(item); });
    覆寫CRM衍生表_(GOVOPS_CRM_INSIGHT_SHEET, insights);
    覆寫CRM衍生表_(GOVOPS_CRM_CARE_SHEET, careRows);
    var summary = 寫入CRM服務摘要_(rows, insights, tenantId);
    return 建立中文成功回傳('CRM學員洞察分析完成。', {
      tenantId: tenantId,
      CRM總人數: rows.length,
      洞察筆數: insights.length,
      關懷追蹤筆數: careRows.length,
      摘要: summary
    });
  } catch (err) {
    if (typeof logError === 'function') logError('執行CRM學員洞察分析', err);
    return 建立中文失敗回傳('系統錯誤', 'CRM學員洞察分析失敗。', {});
  }
}

function 取得CRM學員洞察(data) {
  try {
    初始化CRM學員洞察引擎();
    data = data || {};
    var tenantId = String(data.tenantId || '').trim();
    var type = String(data.分群類型 || '').trim();
    var rows = 讀取CRM洞察列_(GOVOPS_CRM_INSIGHT_SHEET);
    if (tenantId) rows = rows.filter(function(r){ return String(r.tenantId || 'default') === tenantId; });
    if (type) rows = rows.filter(function(r){ return String(r.分群類型) === type; });
    return 建立中文成功回傳('CRM學員洞察已取得。', { 筆數: rows.length, 結果: rows.slice(0, Number(data.limit || 200)) });
  } catch (err) {
    return 建立中文失敗回傳('系統錯誤', 'CRM學員洞察讀取失敗。', {});
  }
}

function 取得CRM服務摘要(data) {
  try {
    初始化CRM學員洞察引擎();
    data = data || {};
    var tenantId = String(data.tenantId || '').trim();
    var rows = 讀取CRM洞察列_(GOVOPS_CRM_SUMMARY_SHEET).reverse();
    if (tenantId) rows = rows.filter(function(r){ return String(r.tenantId || 'default') === tenantId; });
    return 建立中文成功回傳('CRM服務摘要已取得。', { 最新摘要: rows[0] || {}, 最近摘要: rows.slice(0, 10) });
  } catch (err) {
    return 建立中文失敗回傳('系統錯誤', 'CRM服務摘要讀取失敗。', {});
  }
}

function 讀取CRM來源資料_(tenantId) {
  var rows = [];
  try {
    if (typeof readRows === 'function') rows = readRows('學員CRM');
    else rows = 讀取CRM洞察列_('學員CRM');
  } catch (err) {
    rows = [];
  }
  return rows.filter(function(r){
    var rowTenant = String(r.tenantId || 'default');
    return !tenantId || tenantId === 'default' || rowTenant === tenantId;
  });
}

function 建立學員洞察_(row, tenantId) {
  var signups = Number(row.報名次數 || 0);
  var attends = Number(row.出席次數 || 0);
  var absent = Number(row.未出席次數 || 0);
  var type = '一般培育學員';
  var interaction = '一般';
  var risk = '低';
  var reason = [];
  var action = '持續提供合適的課程與服務資訊。';

  if (signups >= 3 || attends >= 2) {
    type = '高互動學員';
    interaction = '高';
    reason.push('報名或出席次數較高');
    action = '可優先邀請參與進階活動、回饋訪談或擔任案例分享。';
  }
  if (absent >= 2) {
    type = '需關懷學員';
    risk = '高';
    reason.push('未出席次數偏高');
    action = '建議以關懷方式了解未出席原因，協助排除時間、交通或需求落差。';
  }
  if (signups === 0 && attends === 0) {
    type = '待培育學員';
    interaction = '低';
    reason.push('尚未累積報名或出席紀錄');
    action = '可提供入門型活動資訊，協助建立初次參與經驗。';
  }

  return {
    洞察ID: 產生CRM洞察ID_('INS'),
    tenantId: row.tenantId || tenantId || 'default',
    學員ID: row.學員ID || '',
    姓名: row.姓名 || '',
    分群類型: type,
    互動等級: interaction,
    出席風險: risk,
    課程偏好: row.課程偏好 || row.興趣標籤 || '',
    洞察說明: reason.join('；') || '一般互動狀態',
    建議服務行動: action,
    建立時間: 現在CRM洞察時間_(),
    更新時間: 現在CRM洞察時間_()
  };
}

function 建立關懷追蹤_(item) {
  return {
    追蹤ID: 產生CRM洞察ID_('CARE'),
    tenantId: item.tenantId || 'default',
    學員ID: item.學員ID || '',
    姓名: item.姓名 || '',
    追蹤類型: item.分群類型,
    追蹤原因: item.洞察說明,
    建議關懷方式: item.建議服務行動,
    追蹤狀態: '待追蹤',
    建立時間: 現在CRM洞察時間_(),
    更新時間: 現在CRM洞察時間_(),
    備註: ''
  };
}

function 寫入CRM服務摘要_(crmRows, insights, tenantId) {
  var high = insights.filter(function(i){ return i.分群類型 === '高互動學員'; }).length;
  var care = insights.filter(function(i){ return i.分群類型 === '需關懷學員'; }).length;
  var risk = insights.filter(function(i){ return i.出席風險 === '高'; }).length;
  var normal = insights.filter(function(i){ return i.分群類型 === '一般培育學員'; }).length;
  var summaryText = '目前CRM共 ' + crmRows.length + ' 人；高互動學員 ' + high + ' 人；需關懷學員 ' + care + ' 人；出席風險 ' + risk + ' 人；一般培育 ' + normal + ' 人。建議優先追蹤高風險未出席學員，並建立高互動學員的進階服務路徑。';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_CRM_SUMMARY_SHEET);
  var headers = 取得CRM洞察表頭_(sheet);
  var record = {
    摘要ID: 產生CRM洞察ID_('CRMSUM'),
    tenantId: tenantId || 'default',
    產生時間: 現在CRM洞察時間_(),
    CRM總人數: crmRows.length,
    高互動人數: high,
    需關懷人數: care,
    出席風險人數: risk,
    一般培育人數: normal,
    服務建議摘要: summaryText,
    建立時間: 現在CRM洞察時間_()
  };
  sheet.appendRow(headers.map(function(h){ return record[h] !== undefined ? record[h] : ''; }));
  return record;
}

function ensureCrmInsightSheets_() {
  ensureCrmInsightSheet_(GOVOPS_CRM_INSIGHT_SHEET, GOVOPS_CRM_INSIGHT_HEADERS);
  ensureCrmInsightSheet_(GOVOPS_CRM_CARE_SHEET, GOVOPS_CRM_CARE_HEADERS);
  ensureCrmInsightSheet_(GOVOPS_CRM_SUMMARY_SHEET, GOVOPS_CRM_SUMMARY_HEADERS);
}

function ensureCrmInsightSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var current = 取得CRM洞察表頭_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  var missing = headers.filter(function(h){ return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function 覆寫CRM衍生表_(sheetName, rows) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var headers = 取得CRM洞察表頭_(sheet);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  if (!rows.length) return;
  var values = rows.map(function(row){ return headers.map(function(h){ return row[h] !== undefined ? row[h] : ''; }); });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function 讀取CRM洞察列_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = 取得CRM洞察表頭_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx){
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    return obj;
  });
}

function 取得CRM洞察表頭_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
}

function 產生CRM洞察ID_(prefix) {
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  return prefix + '-' + roc + '-' + String(new Date().getTime()).slice(-8) + '-' + Math.floor(Math.random() * 1000);
}

function 現在CRM洞察時間_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_CRM學員洞察_初始化() {
  return 初始化CRM學員洞察引擎();
}

function 測試_CRM學員洞察_分析() {
  return 執行CRM學員洞察分析({ tenantId: 'default' });
}

function 測試_CRM學員洞察_取得摘要() {
  return 取得CRM服務摘要({ tenantId: 'default' });
}
