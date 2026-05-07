/**
 * GovBid AI ERP｜5/23 講課可用 MVP 後端
 * 功能：官網表單 → Google Sheet CRM → 自動建立任務/追蹤/商機/儀表板
 * 使用方式：Google Sheet → 擴充功能 → Apps Script → 貼上本檔案 → 執行 setup() → 部署 Web App
 */

const APP_VERSION = '0523-MVP-1.0';

const CRM = {
  leads: {
    name: 'leads',
    headers: ['lead_id', 'created_at', 'source', 'name', 'line', 'email', 'plan', 'status', 'message', 'stage', 'score', 'priority', 'next_followup_date', 'note', 'updated_at'],
  },
  tasks: {
    name: 'tasks',
    headers: ['task_id', 'created_at', 'lead_id', 'title', 'status', 'priority', 'deadline', 'note', 'updated_at'],
  },
  followups: {
    name: 'followups',
    headers: ['followup_id', 'created_at', 'lead_id', 'type', 'content', 'status', 'next_followup_date', 'updated_at'],
  },
  deals: {
    name: 'deals',
    headers: ['deal_id', 'created_at', 'lead_id', 'plan', 'amount', 'status', 'note', 'updated_at'],
  },
  dashboard: {
    name: 'dashboard',
    headers: ['metric', 'value', 'note', 'updated_at'],
  },
  logs: {
    name: 'logs',
    headers: ['created_at', 'level', 'action', 'message', 'payload'],
  },
  settings: {
    name: 'settings',
    headers: ['key', 'value', 'note', 'updated_at'],
  },
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(CRM).forEach((key) => ensureSheet(ss, CRM[key].name, CRM[key].headers));
  seedSettings();
  refreshDashboard();
  writeLog('info', 'setup', 'GovBid AI ERP 5/23 MVP setup completed.', {});
  return 'GovBid AI ERP 5/23 MVP setup completed.';
}

function doGet(e) {
  try {
    setup();
    const action = (e && e.parameter && e.parameter.action) || 'health';

    if (action === 'dashboard') return jsonOutput({ ok: true, data: getDashboard() });
    if (action === 'today') return jsonOutput({ ok: true, data: getTodayBriefing() });
    if (action === 'leads') return jsonOutput({ ok: true, data: getRows(CRM.leads.name).slice(-50) });

    return jsonOutput({
      ok: true,
      service: 'GovBid AI ERP MVP API',
      version: APP_VERSION,
      actions: ['health', 'dashboard', 'today', 'leads'],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    writeLog('error', 'doGet', error.message, { stack: error.stack });
    return jsonOutput({ ok: false, message: error.message });
  }
}

function doPost(e) {
  try {
    setup();
    const payload = parsePayload(e);
    const action = payload.action || 'createLead';

    if (action === 'createLead') return createLead(payload);
    if (action === 'refreshDashboard') return jsonOutput({ ok: true, data: refreshDashboard() });

    return jsonOutput({ ok: false, message: '未知 action：' + action });
  } catch (error) {
    writeLog('error', 'doPost', error.message, { stack: error.stack });
    return jsonOutput({ ok: false, message: '系統錯誤，請稍後再試。', error: error.message });
  }
}

function createLead(payload) {
  const valid = validateLead(payload);
  if (!valid.ok) {
    writeLog('warn', 'validation_failed', valid.message, payload);
    return jsonOutput(valid);
  }

  const now = new Date();
  const leadId = createId('L');
  const score = scoreLead(payload);
  const priority = score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low';
  const nextDate = addDays(now, priority === 'high' ? 1 : 3);
  const nextFollowupDate = formatDate(nextDate);
  const planAmount = inferAmount(payload.plan);

  appendObject(CRM.leads.name, CRM.leads.headers, {
    lead_id: leadId,
    created_at: payload.createdAt || now.toISOString(),
    source: payload.source || 'GovBid AI ERP Landing Page',
    name: text(payload.name),
    line: text(payload.line),
    email: text(payload.email),
    plan: text(payload.plan),
    status: text(payload.status),
    message: text(payload.message),
    stage: 'new',
    score,
    priority,
    next_followup_date: nextFollowupDate,
    note: `AI初判分數：${score}；優先級：${priority}；需求：${text(payload.message) || '未填寫'}`,
    updated_at: now.toISOString(),
  });

  const taskId = createTaskForLead(leadId, payload, priority, nextFollowupDate);
  const followupId = createFollowupForLead(leadId, payload, nextFollowupDate);
  const dealId = createDealForLead(leadId, payload, planAmount);

  refreshDashboard();
  writeLog('info', 'lead_created', `Lead created: ${leadId}`, { leadId, taskId, followupId, dealId, score, priority });

  return jsonOutput({
    ok: true,
    message: '已成功寫入 CRM。',
    lead_id: leadId,
    task_id: taskId,
    followup_id: followupId,
    deal_id: dealId,
    score,
    priority,
  });
}

function createTaskForLead(leadId, payload, priority, deadline) {
  const taskId = createId('T');
  appendObject(CRM.tasks.name, CRM.tasks.headers, {
    task_id: taskId,
    created_at: new Date().toISOString(),
    lead_id: leadId,
    title: `聯絡新名單：${text(payload.name)}｜${text(payload.plan)}`,
    status: 'todo',
    priority,
    deadline,
    note: '系統自動建立：確認需求、判斷方案、安排諮詢或 Demo。',
    updated_at: new Date().toISOString(),
  });
  return taskId;
}

function createFollowupForLead(leadId, payload, nextDate) {
  const followupId = createId('F');
  appendObject(CRM.followups.name, CRM.followups.headers, {
    followup_id: followupId,
    created_at: new Date().toISOString(),
    lead_id: leadId,
    type: 'first_contact',
    content: `您好，我是 GovBid AI ERP，看到您想了解「${text(payload.plan)}」，想先確認您目前標案流程最卡的是哪一段？`,
    status: 'pending',
    next_followup_date: nextDate,
    updated_at: new Date().toISOString(),
  });
  return followupId;
}

function createDealForLead(leadId, payload, amount) {
  const dealId = createId('D');
  appendObject(CRM.deals.name, CRM.deals.headers, {
    deal_id: dealId,
    created_at: new Date().toISOString(),
    lead_id: leadId,
    plan: text(payload.plan),
    amount,
    status: 'open',
    note: '系統自動建立初始商機。',
    updated_at: new Date().toISOString(),
  });
  return dealId;
}

function refreshDashboard() {
  const today = formatDate(new Date());
  const leads = getRows(CRM.leads.name);
  const tasks = getRows(CRM.tasks.name);
  const followups = getRows(CRM.followups.name);
  const deals = getRows(CRM.deals.name);

  const metrics = [
    ['total_leads', leads.length, '總名單數'],
    ['new_leads', leads.filter((x) => x.stage === 'new').length, '尚未聯絡名單'],
    ['high_priority_leads', leads.filter((x) => x.priority === 'high').length, '高優先名單'],
    ['todo_tasks', tasks.filter((x) => x.status === 'todo').length, '待辦任務'],
    ['due_tasks', tasks.filter((x) => x.status === 'todo' && String(x.deadline || '') <= today).length, '今日/逾期待辦'],
    ['pending_followups', followups.filter((x) => x.status === 'pending').length, '待追蹤紀錄'],
    ['due_followups', followups.filter((x) => x.status === 'pending' && String(x.next_followup_date || '') <= today).length, '今日/逾期追蹤'],
    ['open_deals', deals.filter((x) => x.status === 'open').length, '開放商機'],
    ['open_deal_amount', deals.filter((x) => x.status === 'open').reduce((sum, x) => sum + Number(x.amount || 0), 0), '開放商機金額'],
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureSheet(ss, CRM.dashboard.name, CRM.dashboard.headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, CRM.dashboard.headers.length).setValues([CRM.dashboard.headers]);
  if (metrics.length > 0) {
    const now = new Date().toISOString();
    sheet.getRange(2, 1, metrics.length, 4).setValues(metrics.map((m) => [m[0], m[1], m[2], now]));
  }
  return getDashboard();
}

function getDashboard() {
  const rows = getRows(CRM.dashboard.name);
  const data = {};
  rows.forEach((row) => {
    data[row.metric] = { value: row.value, note: row.note, updated_at: row.updated_at };
  });
  return data;
}

function getTodayBriefing() {
  refreshDashboard();
  const today = formatDate(new Date());
  const dashboard = getDashboard();
  const tasks = getRows(CRM.tasks.name).filter((x) => x.status === 'todo' && String(x.deadline || '') <= today);
  const followups = getRows(CRM.followups.name).filter((x) => x.status === 'pending' && String(x.next_followup_date || '') <= today);
  const highLeads = getRows(CRM.leads.name).filter((x) => x.priority === 'high' && x.stage === 'new');

  const suggestions = [];
  if (tasks.length) suggestions.push(`今天有 ${tasks.length} 個待辦要處理。`);
  if (followups.length) suggestions.push(`今天有 ${followups.length} 筆客戶追蹤到期。`);
  if (highLeads.length) suggestions.push(`目前有 ${highLeads.length} 位高優先新名單，建議優先聯絡。`);
  if (!suggestions.length) suggestions.push('目前沒有逾期任務，可以安排社群導流或開發新名單。');

  return {
    date: today,
    dashboard,
    due_tasks: tasks.slice(0, 10),
    due_followups: followups.slice(0, 10),
    high_priority_leads: highLeads.slice(0, 10),
    suggestions,
  };
}

function validateLead(payload) {
  if (!payload) return { ok: false, message: '缺少表單資料。' };
  if (!payload.name) return { ok: false, message: '請填寫姓名或單位名稱。' };
  if (!payload.line) return { ok: false, message: '請填寫 LINE ID 或官方帳號。' };
  if (!payload.plan) return { ok: false, message: '請選擇想了解的方案。' };
  if (!payload.status) return { ok: false, message: '請選擇目前狀況。' };
  return { ok: true, message: 'ok' };
}

function scoreLead(payload) {
  let score = 30;
  const plan = String(payload.plan || '');
  const status = String(payload.status || '');
  const message = String(payload.message || '');

  if (plan.includes('顧問導入')) score += 35;
  else if (plan.includes('完整商用')) score += 25;
  else if (plan.includes('內測')) score += 15;
  if (status.includes('已經有接')) score += 25;
  if (status.includes('公司') || status.includes('協會')) score += 20;
  if (message.length >= 20) score += 10;
  if (message.includes('不會寫') || message.includes('混亂') || message.includes('財務') || message.includes('履約')) score += 10;

  return Math.min(score, 100);
}

function inferAmount(plan) {
  const value = String(plan || '');
  if (value.includes('39,800') || value.includes('顧問導入')) return 39800;
  if (value.includes('19,800') || value.includes('完整商用')) return 19800;
  if (value.includes('9,800') || value.includes('內測')) return 9800;
  return 0;
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const raw = e.postData.contents;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return e.parameter || {};
  }
}

function seedSettings() {
  const rows = getRows(CRM.settings.name);
  if (rows.length > 0) return;
  appendObject(CRM.settings.name, CRM.settings.headers, {
    key: 'app_name',
    value: 'GovBid AI ERP',
    note: '系統名稱',
    updated_at: new Date().toISOString(),
  });
  appendObject(CRM.settings.name, CRM.settings.headers, {
    key: 'default_owner',
    value: '珍珠老師',
    note: '預設負責人',
    updated_at: new Date().toISOString(),
  });
}

function ensureSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some(Boolean);
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function appendObject(sheetName, headers, object) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureSheet(ss, sheetName, headers);
  const row = headers.map((key) => object[key] !== undefined ? object[key] : '');
  sheet.appendRow(row);
}

function getRows(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).filter((row) => row.some(Boolean)).map((row) => {
    const obj = {};
    headers.forEach((header, index) => obj[header] = normalizeValue(row[index]));
    return obj;
  });
}

function writeLog(level, action, message, payload) {
  try {
    appendObject(CRM.logs.name, CRM.logs.headers, {
      created_at: new Date().toISOString(),
      level,
      action,
      message,
      payload: JSON.stringify(payload || {}),
    });
  } catch (error) {
    console.error(error);
  }
}

function createId(prefix) {
  return prefix + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function normalizeValue(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return formatDate(value);
  return value;
}

function text(value) {
  return String(value || '').trim();
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
