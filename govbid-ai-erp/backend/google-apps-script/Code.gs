/**
 * GovBid AI ERP｜Landing Lead Backend
 * 部署方式：Google Apps Script → 部署為 Web App
 * 權限：Anyone with the link 可存取
 */

const SHEET_NAMES = {
  leads: 'leads',
  logs: 'logs',
};

const LEAD_HEADERS = [
  'lead_id',
  'created_at',
  'source',
  'name',
  'line',
  'email',
  'plan',
  'status',
  'message',
  'stage',
  'owner',
  'note',
  'updated_at',
];

const LOG_HEADERS = [
  'created_at',
  'level',
  'action',
  'message',
  'payload',
];

function doGet() {
  return jsonOutput({
    ok: true,
    service: 'GovBid AI ERP Lead API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const validation = validateLead(payload);

    if (!validation.ok) {
      writeLog('warn', 'validation_failed', validation.message, payload);
      return jsonOutput({ ok: false, message: validation.message });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const leadsSheet = ensureSheet(ss, SHEET_NAMES.leads, LEAD_HEADERS);
    ensureSheet(ss, SHEET_NAMES.logs, LOG_HEADERS);

    const now = new Date();
    const leadId = createLeadId();

    const row = [
      leadId,
      payload.createdAt || now.toISOString(),
      payload.source || 'GovBid AI ERP Landing Page',
      cleanText(payload.name),
      cleanText(payload.line),
      cleanText(payload.email),
      cleanText(payload.plan),
      cleanText(payload.status),
      cleanText(payload.message),
      'new',
      '',
      '',
      now.toISOString(),
    ];

    leadsSheet.appendRow(row);
    writeLog('info', 'lead_created', `Lead created: ${leadId}`, payload);

    return jsonOutput({
      ok: true,
      message: '已收到你的預約資料，我們會盡快與你聯繫。',
      lead_id: leadId,
    });
  } catch (error) {
    writeLog('error', 'server_error', error.message, { stack: error.stack });
    return jsonOutput({
      ok: false,
      message: '系統暫時無法送出，請稍後再試。',
      error: error.message,
    });
  }
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) return {};

  const raw = e.postData.contents;
  try {
    return JSON.parse(raw);
  } catch (error) {
    const params = e.parameter || {};
    return params;
  }
}

function validateLead(payload) {
  if (!payload) return { ok: false, message: '缺少表單資料。' };
  if (!payload.name) return { ok: false, message: '請填寫姓名或單位名稱。' };
  if (!payload.line) return { ok: false, message: '請填寫 LINE ID 或官方帳號。' };
  if (!payload.plan) return { ok: false, message: '請選擇想了解的方案。' };
  if (!payload.status) return { ok: false, message: '請選擇目前狀況。' };
  return { ok: true, message: 'ok' };
}

function ensureSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = currentHeaders.some(Boolean);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  return sheet;
}

function writeLog(level, action, message, payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ensureSheet(ss, SHEET_NAMES.logs, LOG_HEADERS);
    logSheet.appendRow([
      new Date().toISOString(),
      level,
      action,
      message,
      JSON.stringify(payload || {}),
    ]);
  } catch (error) {
    console.error(error);
  }
}

function createLeadId() {
  return 'L' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function cleanText(value) {
  return String(value || '').trim();
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, SHEET_NAMES.leads, LEAD_HEADERS);
  ensureSheet(ss, SHEET_NAMES.logs, LOG_HEADERS);
  writeLog('info', 'setup', 'GovBid AI ERP backend setup completed.', {});
}
