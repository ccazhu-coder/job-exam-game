const SHEET_NAME = '客戶名單';

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateLeadSheet_(ss);
    const data = JSON.parse(e.postData.contents || '{}');

    sheet.appendRow([
      new Date(),
      data.name || '',
      data.line || '',
      data.email || '',
      data.plan || '',
      data.status || '',
      data.message || '',
      data.source || 'GovBid AI ERP Landing Page',
      data.createdAt || '',
      '新名單',
      '未聯繫',
      ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, message: 'saved' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'GovBid AI ERP Lead Webhook' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateLeadSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      '建立時間',
      '姓名/單位',
      'LINE',
      'Email',
      '方案',
      '目前狀況',
      '需求內容',
      '來源',
      '前端建立時間',
      '名單狀態',
      '聯繫狀態',
      '備註'
    ]);
  }

  return sheet;
}
