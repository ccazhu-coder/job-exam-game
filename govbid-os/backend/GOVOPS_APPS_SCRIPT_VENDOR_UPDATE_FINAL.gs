/**
 * GovOps OS｜Apps Script 後端正式更新包：23_合作廠商主檔
 * 更新目的：讓後端正式支援新增、修改、查詢合作廠商，並包含付款／扣繳／匯款欄位。
 * 使用方式：整份貼到 Apps Script 新檔案，例如：23_vendor_master_official.gs
 */

var GOVOPS_VENDOR_SHEET_NAME = '23_合作廠商主檔';

var GOVOPS_VENDOR_HEADERS = [
  '廠商編號',
  '名稱',
  '類型',
  '聯絡人',
  '電話',
  'Email',
  '支付方式',
  '銀行',
  '帳號',
  '戶名',
  '統編/身分證',
  '是否開發票',
  '是否扣繳',
  '扣繳類型',
  '預設單價',
  '評價',
  '常用',
  '備註',
  '建立時間',
  '更新時間'
];

function govopsVendorNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function govopsVendorId_() {
  return 'VEN-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
}

function govopsVendorJsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function govopsVendorSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(GOVOPS_VENDOR_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(GOVOPS_VENDOR_SHEET_NAME);

  var colCount = Math.max(sh.getLastColumn(), GOVOPS_VENDOR_HEADERS.length);
  var firstRow = sh.getRange(1, 1, 1, colCount).getValues()[0].map(function(v){ return String(v || '').trim(); });
  var empty = firstRow.every(function(v){ return !v; });

  if (empty) {
    sh.getRange(1, 1, 1, GOVOPS_VENDOR_HEADERS.length).setValues([GOVOPS_VENDOR_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }

  var missing = GOVOPS_VENDOR_HEADERS.filter(function(h){ return firstRow.indexOf(h) === -1; });
  if (missing.length) {
    var currentLength = firstRow.filter(function(v){ return !!v; }).length;
    sh.getRange(1, currentLength + 1, 1, missing.length).setValues([missing]);
  }
  return sh;
}

function govopsVendorHeaders_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(v){ return String(v || '').trim(); });
}

function govopsVendorRows_() {
  var sh = govopsVendorSheet_();
  var headers = govopsVendorHeaders_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  return values.map(function(row, index){
    var obj = { _row: index + 2 };
    headers.forEach(function(h, i){ obj[h] = row[i]; });
    return obj;
  });
}

function govopsVendorUpdateRow_(rowNumber, patch) {
  var sh = govopsVendorSheet_();
  var headers = govopsVendorHeaders_(sh);
  headers.forEach(function(h, i){
    if (patch[h] !== undefined) sh.getRange(rowNumber, i + 1).setValue(patch[h]);
  });
}

function govopsInitVendorMaster(params) {
  govopsVendorSheet_();
  return {
    success: true,
    message: '23_合作廠商主檔初始化完成',
    data: {
      sheetName: GOVOPS_VENDOR_SHEET_NAME,
      headers: GOVOPS_VENDOR_HEADERS
    }
  };
}

function govopsCreateVendor(params) {
  params = params || {};
  govopsVendorSheet_();

  var name = params['名稱'] || params['廠商名稱'] || params.name || params.vendorName;
  if (!name) return { success: false, message: '請填寫廠商名稱' };

  var type = params['類型'] || params['廠商類型'] || params.type || params.vendorType || '其他廠商';
  var rows = govopsVendorRows_();
  var exists = rows.find(function(r){ return String(r['名稱']) === String(name) && String(r['類型']) === String(type); });

  if (exists) {
    return {
      success: true,
      message: '廠商資料已存在，已回傳既有資料',
      data: {
        廠商編號: exists['廠商編號'],
        row: exists
      }
    };
  }

  var rowObj = {
    '廠商編號': params['廠商編號'] || govopsVendorId_(),
    '名稱': name,
    '類型': type,
    '聯絡人': params['聯絡人'] || params.contactName || '',
    '電話': params['電話'] || params['聯絡電話'] || params.phone || params.contactPhone || '',
    'Email': params['Email'] || params.email || '',
    '支付方式': params['支付方式'] || params['付款方式'] || params.paymentMethod || '匯款',
    '銀行': params['銀行'] || params['銀行名稱'] || params.bankName || '',
    '帳號': params['帳號'] || params.bankAccount || '',
    '戶名': params['戶名'] || params.accountName || name,
    '統編/身分證': params['統編/身分證'] || params['統一編號'] || params['身分證字號'] || params.taxId || '',
    '是否開發票': params['是否開發票'] || params.invoiceRequired || '',
    '是否扣繳': params['是否扣繳'] || params.withholdingRequired || '',
    '扣繳類型': params['扣繳類型'] || params.withholdingType || '',
    '預設單價': params['預設單價'] || params.defaultPrice || '',
    '評價': params['評價'] || params.rating || '',
    '常用': params['常用'] || params.favorite || '',
    '備註': params['備註'] || params.note || '',
    '建立時間': govopsVendorNow_(),
    '更新時間': govopsVendorNow_()
  };

  var sh = govopsVendorSheet_();
  var headers = govopsVendorHeaders_(sh);
  sh.appendRow(headers.map(function(h){ return rowObj[h] !== undefined ? rowObj[h] : ''; }));

  return {
    success: true,
    message: '合作廠商已新增',
    data: {
      廠商編號: rowObj['廠商編號'],
      row: rowObj
    }
  };
}

function govopsUpdateVendor(params) {
  params = params || {};
  govopsVendorSheet_();

  var vendorNo = params['廠商編號'] || params['廠商ID'] || params.vendorNo || params.vendorId;
  if (!vendorNo) return { success: false, message: '請提供廠商編號' };

  var row = govopsVendorRows_().find(function(r){ return String(r['廠商編號']) === String(vendorNo); });
  if (!row) return { success: false, message: '找不到廠商資料' };

  var fields = [
    '名稱','類型','聯絡人','電話','Email','支付方式','銀行','帳號','戶名','統編/身分證',
    '是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註'
  ];
  var patch = {};
  fields.forEach(function(k){
    if (params[k] !== undefined && params[k] !== '') patch[k] = params[k];
  });

  if (params['廠商名稱']) patch['名稱'] = params['廠商名稱'];
  if (params['廠商類型']) patch['類型'] = params['廠商類型'];
  if (params['聯絡電話']) patch['電話'] = params['聯絡電話'];
  if (params['付款方式']) patch['支付方式'] = params['付款方式'];
  if (params['統一編號']) patch['統編/身分證'] = params['統一編號'];
  patch['更新時間'] = govopsVendorNow_();

  govopsVendorUpdateRow_(row._row, patch);

  return {
    success: true,
    message: '合作廠商已修改',
    data: {
      廠商編號: vendorNo,
      updated: patch
    }
  };
}

function govopsQueryVendors(params) {
  params = params || {};
  govopsVendorSheet_();

  var keyword = String(params.keyword || params.q || params['關鍵字'] || '').trim();
  var type = String(params['類型'] || params['廠商類型'] || params.vendorType || '').trim();
  var favorite = String(params['常用'] || params.favorite || '').trim();
  var invoice = String(params['是否開發票'] || '').trim();
  var withholding = String(params['是否扣繳'] || '').trim();

  var rows = govopsVendorRows_();

  if (type) rows = rows.filter(function(r){ return String(r['類型']).indexOf(type) >= 0; });
  if (favorite) rows = rows.filter(function(r){ return String(r['常用']) === favorite; });
  if (invoice) rows = rows.filter(function(r){ return String(r['是否開發票']) === invoice; });
  if (withholding) rows = rows.filter(function(r){ return String(r['是否扣繳']) === withholding; });
  if (keyword) rows = rows.filter(function(r){ return JSON.stringify(r).indexOf(keyword) >= 0; });

  return {
    success: true,
    message: '合作廠商查詢完成',
    data: {
      rows: rows,
      廠商: rows,
      count: rows.length
    }
  };
}

function govopsVendorOfficialRoute(params) {
  var action = String((params && params.action) || '');
  if (action === '初始化合作廠商主檔') return govopsInitVendorMaster(params);
  if (action === '新增合作廠商' || action === '儲存合作廠商') return govopsCreateVendor(params);
  if (action === '修改合作廠商' || action === '更新合作廠商') return govopsUpdateVendor(params);
  if (action === '查詢合作廠商') return govopsQueryVendors(params);
  return null;
}

/**
 * 主 router 接法：請放在 doGet / doPost 的 action switch 前面。
 *
 * var vendorResult = govopsVendorOfficialRoute(params);
 * if (vendorResult) return jsonOutput(vendorResult);
 */
