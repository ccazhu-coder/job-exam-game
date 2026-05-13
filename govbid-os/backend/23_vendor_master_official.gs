/**
 * GovOps OS｜23_合作廠商主檔 正式後端程式
 * 請直接貼到 Apps Script 專案中。
 * 功能：初始化、新增、修改、查詢合作廠商。
 */

const VENDOR_MASTER_SHEET_NAME = '23_合作廠商主檔';

const VENDOR_MASTER_HEADERS = [
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

function vendorNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function vendorId_() {
  return 'VEN-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 1000);
}

function vendorJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function vendorSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(VENDOR_MASTER_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(VENDOR_MASTER_SHEET_NAME);

  const lastCol = Math.max(sh.getLastColumn(), VENDOR_MASTER_HEADERS.length);
  const firstRow = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || '').trim());
  const isEmpty = firstRow.every(v => !v);

  if (isEmpty) {
    sh.getRange(1, 1, 1, VENDOR_MASTER_HEADERS.length).setValues([VENDOR_MASTER_HEADERS]);
    sh.setFrozenRows(1);
  } else {
    const missing = VENDOR_MASTER_HEADERS.filter(h => firstRow.indexOf(h) === -1);
    if (missing.length) {
      sh.getRange(1, firstRow.filter(Boolean).length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sh;
}

function vendorHeaders_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(v => String(v || '').trim());
}

function vendorRows_() {
  const sh = vendorSheet_();
  const headers = vendorHeaders_(sh);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  return values.map((row, index) => {
    const obj = { _row: index + 2 };
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function vendorUpdateRow_(rowNumber, patch) {
  const sh = vendorSheet_();
  const headers = vendorHeaders_(sh);
  headers.forEach((h, i) => {
    if (patch[h] !== undefined) sh.getRange(rowNumber, i + 1).setValue(patch[h]);
  });
}

function initVendorMaster() {
  vendorSheet_();
  return { success: true, message: '23_合作廠商主檔初始化完成', data: { sheetName: VENDOR_MASTER_SHEET_NAME, headers: VENDOR_MASTER_HEADERS } };
}

function createVendorMaster(params) {
  vendorSheet_();
  params = params || {};

  const name = params['名稱'] || params['廠商名稱'] || params.name || params.vendorName;
  if (!name) return { success: false, message: '請填寫廠商名稱' };

  const type = params['類型'] || params['廠商類型'] || params.type || params.vendorType || '其他廠商';
  const exists = vendorRows_().find(r => String(r['名稱']) === String(name) && String(r['類型']) === String(type));
  if (exists) {
    return { success: true, message: '廠商資料已存在，已回傳既有資料', data: { 廠商編號: exists['廠商編號'], row: exists } };
  }

  const obj = {
    '廠商編號': params['廠商編號'] || vendorId_(),
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
    '建立時間': vendorNow_(),
    '更新時間': vendorNow_()
  };

  const sh = vendorSheet_();
  const headers = vendorHeaders_(sh);
  sh.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));

  return { success: true, message: '合作廠商已新增', data: { 廠商編號: obj['廠商編號'], row: obj } };
}

function updateVendorMaster(params) {
  vendorSheet_();
  params = params || {};

  const vendorNo = params['廠商編號'] || params['廠商ID'] || params.vendorNo || params.vendorId;
  if (!vendorNo) return { success: false, message: '請提供廠商編號' };

  const row = vendorRows_().find(r => String(r['廠商編號']) === String(vendorNo));
  if (!row) return { success: false, message: '找不到廠商資料' };

  const fields = ['名稱','類型','聯絡人','電話','Email','支付方式','銀行','帳號','戶名','統編/身分證','是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註'];
  const patch = {};
  fields.forEach(k => {
    if (params[k] !== undefined && params[k] !== '') patch[k] = params[k];
  });

  if (params['廠商名稱']) patch['名稱'] = params['廠商名稱'];
  if (params['廠商類型']) patch['類型'] = params['廠商類型'];
  if (params['聯絡電話']) patch['電話'] = params['聯絡電話'];
  if (params['付款方式']) patch['支付方式'] = params['付款方式'];
  if (params['統一編號']) patch['統編/身分證'] = params['統一編號'];

  patch['更新時間'] = vendorNow_();
  vendorUpdateRow_(row._row, patch);

  return { success: true, message: '合作廠商已修改', data: { 廠商編號: vendorNo, updated: patch } };
}

function queryVendorMaster(params) {
  vendorSheet_();
  params = params || {};

  const keyword = String(params.keyword || params.q || params['關鍵字'] || '').trim();
  const type = String(params['類型'] || params['廠商類型'] || params.vendorType || '').trim();
  const favorite = String(params['常用'] || '').trim();

  let rows = vendorRows_();
  if (type) rows = rows.filter(r => String(r['類型']).indexOf(type) >= 0);
  if (favorite) rows = rows.filter(r => String(r['常用']) === favorite);
  if (keyword) rows = rows.filter(r => JSON.stringify(r).indexOf(keyword) >= 0);

  return { success: true, message: '合作廠商查詢完成', data: { rows: rows, 廠商: rows, count: rows.length } };
}

function vendorMasterRoute(params) {
  const action = String((params && params.action) || '');
  if (action === '初始化合作廠商主檔') return initVendorMaster(params);
  if (action === '新增合作廠商' || action === '儲存合作廠商') return createVendorMaster(params);
  if (action === '修改合作廠商' || action === '更新合作廠商') return updateVendorMaster(params);
  if (action === '查詢合作廠商') return queryVendorMaster(params);
  return null;
}

/**
 * 主 router 接法：
 * const vendorResult = vendorMasterRoute(params);
 * if (vendorResult) return jsonOutput(vendorResult);
 */
