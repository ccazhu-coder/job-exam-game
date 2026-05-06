const SHEET_NAME = '客戶名單';
const NOTIFY_EMAIL = '';

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateLeadSheet_(ss);
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const lead = normalizeLead_(data);

    sheet.appendRow([
      new Date(),
      lead.name,
      lead.line,
      lead.email,
      lead.plan,
      lead.status,
      lead.message,
      lead.source,
      lead.createdAt,
      lead.level,
      lead.leadStatus,
      lead.contactStatus,
      lead.dealAmount,
      lead.nextFollowUpDate,
      lead.quoteText,
      ''
    ]);

    notifyNewLead_(lead);

    return json_({ ok: true, message: 'saved', leadLevel: lead.level, quote: lead.quoteText });
  } catch (err) {
    return json_({ ok: false, message: err.message });
  }
}

function doGet() {
  return json_({ ok: true, service: 'GovBid AI ERP Lead Webhook', version: '2.0' });
}

function normalizeLead_(data) {
  const plan = data.plan || '';
  const status = data.status || '';
  const message = data.message || '';
  const dealAmount = getDealAmount_(plan);
  const level = getLeadLevel_(plan, status, message);
  const quoteText = getQuoteText_(plan, dealAmount);
  const nextFollowUpDate = getNextFollowUpDate_(level);

  return {
    name: data.name || '',
    line: data.line || '',
    email: data.email || '',
    plan,
    status,
    message,
    source: data.source || 'GovBid AI ERP Landing Page',
    createdAt: data.createdAt || '',
    level,
    leadStatus: '新名單',
    contactStatus: '未聯繫',
    dealAmount,
    nextFollowUpDate,
    quoteText
  };
}

function getDealAmount_(plan) {
  if (plan.indexOf('9,800') !== -1 || plan.indexOf('內測') !== -1) return 9800;
  if (plan.indexOf('19,800') !== -1 || plan.indexOf('商用') !== -1) return 19800;
  if (plan.indexOf('39,800') !== -1 || plan.indexOf('顧問') !== -1) return 39800;
  return 0;
}

function getLeadLevel_(plan, status, message) {
  const text = plan + ' ' + status + ' ' + message;
  if (text.indexOf('已經有接') !== -1 || text.indexOf('顧問導入') !== -1 || text.indexOf('公司') !== -1 || text.indexOf('協會') !== -1) return 'A級｜熱客戶';
  if (text.indexOf('想開始') !== -1 || text.indexOf('完整商用') !== -1 || text.indexOf('內測') !== -1) return 'B級｜溫客戶';
  return 'C級｜培養名單';
}

function getNextFollowUpDate_(level) {
  const today = new Date();
  const days = level.indexOf('A級') !== -1 ? 1 : level.indexOf('B級') !== -1 ? 3 : 7;
  today.setDate(today.getDate() + days);
  return today;
}

function getQuoteText_(plan, amount) {
  if (!amount) return '先了解需求，再推薦方案。';
  return '建議方案：' + plan + '，預估金額 NT$' + amount.toLocaleString('zh-TW') + '。';
}

function notifyNewLead_(lead) {
  if (!NOTIFY_EMAIL) return;
  const subject = 'GovBid AI ERP 新名單｜' + lead.level;
  const body = [
    '有新的 GovBid AI ERP 諮詢名單：',
    '',
    '姓名/單位：' + lead.name,
    'LINE：' + lead.line,
    'Email：' + lead.email,
    '方案：' + lead.plan,
    '目前狀況：' + lead.status,
    '分級：' + lead.level,
    '建議報價：' + lead.quoteText,
    '需求：' + lead.message,
    '',
    '請依照客戶分級進行後續追蹤。'
  ].join('\n');
  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}

function getOrCreateLeadSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

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
      '客戶分級',
      '名單狀態',
      '聯繫狀態',
      '預估成交金額',
      '下次追蹤日',
      '自動報價文字',
      '備註'
    ]);
  }

  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
