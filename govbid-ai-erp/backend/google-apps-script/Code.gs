/**
 * GovBid AI ERP｜AI Company Backend V2
 * 目的：Landing Lead → CRM → Task → Followup → Deal → Dashboard
 * 部署方式：Google Apps Script → Web App
 */

const APP_VERSION = '2.0.0';

const SHEET_NAMES = {
  leads: 'leads',
  tasks: 'tasks',
  followups: 'followups',
  deals: 'deals',
  settings: 'settings',
  dashboard: 'dashboard',
  logs: 'logs',
};

const HEADERS = {
  leads: [
    'lead_id', 'created_at', 'source', 'name', 'line', 'email', 'plan', 'status', 'message',
    'stage', 'score', 'priority', 'owner', 'last_contact_at', 'next_followup_date', 'note', 'updated_at'
  ],
  tasks: [
    'task_id', 'created_at', 'lead_id', 'title', 'status', 'priority', 'deadline', 'owner', 'note', 'updated_at'
  ],
  followups: [
    'followup_id', 'created_at', 'lead_id', 'type', 'content', 'status', 'next_followup_date', 'updated_at'
  ],
  deals: [
    'deal_id', 'created_at', 'lead_id', 'plan', 'amount', 'status', 'closed_at', 'note', 'updated_at'
  ],
  settings: [
    'key', 'value', 'note', 'updated_at'
  ],
  dashboard: [
    'metric', 'value', 'note', 'updated_at'
  ],
  logs: [
    'created_at', 'level', 'action', 'message', 'payload'
  ],
};

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';

  try {
    if (action === 'dashboard') return jsonOutput({ ok: true, data: getDashboardData() });
    if (action === 'leads') return jsonOutput({ ok: true, data: getRowsAsObjects(SHEET_NAMES.leads) });

    return jsonOutput({
      ok: true,
      service: 'GovBid AI ERP AI Company API',
      version: APP_VERSION,
      actions: ['health', 'dashboard', 'leads'],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    writeLog('error', 'do_get_error', error.message, { stack: error.stack });
    return jsonOutput({ ok: false, message: error.message });
  }
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const action = payload.action || 'createLead';

    if (action === 'createLead') return handleCreateLead(payload);
    if (action === 'updateLeadStage') return handleUpdateLeadStage(payload);
    if (action === 'createTask') return handleCreateTask(payload);
    if (action === 'createFollowup') return handleCreateFollowup(payload);
    if (action === 'createDeal') return handleCreateDeal(payload);
    if (action === 'refreshDashboard') return jsonOutput({ ok: true, data: refreshDashboard() });

    return jsonOutput({ ok: false, message: '未知的 action：' + action });
  } catch (error) {
    writeLog('error', 'server_error', error.message, { stack: error.stack });
    return jsonOutput({ ok: false, message: '系統暫時無法處理，請稍後再試。', error: error.message });
  }
}

function handleCreateLead(payload) {
  const validation = validateLead(payload);
  if (!validation.ok) {
    writeLog('warn', 'validation_failed', validation.message, payload);
    return jsonOutput({ ok: false, message: validation.message });
  }

  setup();

  const now = new Date();
  const leadId = createId('L');
  const score = calculateLeadScore(payload);
  const priority = score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low';
  const nextFollowupDate = addDays(now, priority === 'high' ? 1 : 3);

  appendObject(SHEET_NAMES.leads, {
    lead_id: leadId,
    created_at: payload.createdAt || now.toISOString(),
    source: payload.source || 'GovBid AI ERP Landing Page',
    name: cleanText(payload.name),
    line: cleanText(payload.line),
    email: cleanText(payload.email),
    plan: cleanText(payload.plan),
    status: cleanText(payload.status),
    message: cleanText(payload.message),
    stage: 'new',
    score,
    priority,
    owner: '',
    last_contact_at: '',
    next_followup_date: toDateString(nextFollowupDate),
    note: buildLeadNote(payload, score, priority),
    updated_at: now.toISOString(),
  });

  const taskId = createDefaultTask(leadId, payload, priority, nextFollowupDate);
  const followupId = createDefaultFollowup(leadId, payload, nextFollowupDate);
  const dealId = createDefaultDeal(leadId, payload);

  refreshDashboard();
  writeLog('info', 'lead_created', `Lead created: ${leadId}`, { leadId, taskId, followupId, dealId, score, priority });

  return jsonOutput({
    ok: true,
    message: '已收到你的預約資料，我們會盡快與你聯繫。',
    lead_id: leadId,
    task_id: taskId,
    followup_id: followupId,
    deal_id: dealId,
    score,
    priority,
  });
}

function handleUpdateLeadStage(payload) {
  const leadId = cleanText(payload.lead_id);
  const stage = cleanText(payload.stage);
  if (!leadId || !stage) return jsonOutput({ ok: false, message: '缺少 lead_id 或 stage。' });

  const updated = updateRowById(SHEET_NAMES.leads, 'lead_id', leadId, {
    stage,
    last_contact_at: payload.last_contact_at || '',
    next_followup_date: payload.next_followup_date || '',
    note: payload.note || '',
    updated_at: new Date().toISOString(),
  });

  refreshDashboard();
  writeLog('info', 'lead_stage_updated', `Lead stage updated: ${leadId} → ${stage}`, payload);
  return jsonOutput({ ok: updated, message: updated ? 'Lead 狀態已更新。' : '找不到 Lead。' });
}

function handleCreateTask(payload) {
  setup();
  const taskId = createId('T');
  appendObject(SHEET_NAMES.tasks, {
    task_id: taskId,
    created_at: new Date().toISOString(),
    lead_id: cleanText(payload.lead_id),
    title: cleanText(payload.title),
    status: payload.status || 'todo',
    priority: payload.priority || 'medium',
    deadline: payload.deadline || '',
    owner: payload.owner || '',
    note: payload.note || '',
    updated_at: new Date().toISOString(),
  });
  refreshDashboard();
  return jsonOutput({ ok: true, task_id: taskId, message: '任務已建立。' });
}

function handleCreateFollowup(payload) {
  setup();
  const followupId = createId('F');
  appendObject(SHEET_NAMES.followups, {
    followup_id: followupId,
    created_at: new Date().toISOString(),
    lead_id: cleanText(payload.lead_id),
    type: payload.type || 'manual',
    content: cleanText(payload.content),
    status: payload.status || 'pending',
    next_followup_date: payload.next_followup_date || '',
    updated_at: new Date().toISOString(),
  });
  refreshDashboard();
  return jsonOutput({ ok: true, followup_id: followupId, message: '追蹤紀錄已建立。' });
}

function handleCreateDeal(payload) {
  setup();
  const dealId = createId('D');
  appendObject(SHEET_NAMES.deals, {
    deal_id: dealId,
    created_at: new Date().toISOString(),
    lead_id: cleanText(payload.lead_id),
    plan: cleanText(payload.plan),
    amount: Number(payload.amount || 0),
    status: payload.status || 'open',
    closed_at: payload.closed_at || '',
    note: payload.note || '',
    updated_at: new Date().toISOString(),
  });
  refreshDashboard();
  return jsonOutput({ ok: true, deal_id: dealId, message: '成交資料已建立。' });
}

function createDefaultTask(leadId, payload, priority, nextFollowupDate) {
  const taskId = createId('T');
  appendObject(SHEET_NAMES.tasks, {
    task_id: taskId,
    created_at: new Date().toISOString(),
    lead_id: leadId,
    title: `聯絡新名單：${cleanText(payload.name)}｜${cleanText(payload.plan)}`,
    status: 'todo',
    priority,
    deadline: toDateString(nextFollowupDate),
    owner: '',
    note: '系統自動建立：請確認需求、預約導入諮詢、判斷方案適配。',
    updated_at: new Date().toISOString(),
  });
  return taskId;
}

function createDefaultFollowup(leadId, payload, nextFollowupDate) {
  const followupId = createId('F');
  appendObject(SHEET_NAMES.followups, {
    followup_id: followupId,
    created_at: new Date().toISOString(),
    lead_id: leadId,
    type: 'first_contact',
    content: `建議話術：您好，我是 GovBid AI ERP，看到您想了解「${cleanText(payload.plan)}」，想先確認您目前標案流程最卡的是哪一段？`,
    status: 'pending',
    next_followup_date: toDateString(nextFollowupDate),
    updated_at: new Date().toISOString(),
  });
  return followupId;
}

function createDefaultDeal(leadId, payload) {
  const dealId = createId('D');
  const amount = inferPlanAmount(payload.plan);
  appendObject(SHEET_NAMES.deals, {
    deal_id: dealId,
    created_at: new Date().toISOString(),
    lead_id: leadId,
    plan: cleanText(payload.plan),
    amount,
    status: 'open',
    closed_at: '',
    note: '系統自動建立初始商機。',
    updated_at: new Date().toISOString(),
  });
  return dealId;
}

function refreshDashboard() {
  setup();
  const leads = getRowsAsObjects(SHEET_NAMES.leads);
  const tasks = getRowsAsObjects(SHEET_NAMES.tasks);
  const followups = getRowsAsObjects(SHEET_NAMES.followups);
  const deals = getRowsAsObjects(SHEET_NAMES.deals);

  const metrics = [
    ['total_leads', leads.length, '總名單數'],
    ['new_leads', leads.filter(x => x.stage === 'new').length, '尚未聯絡名單'],
    ['high_priority_leads', leads.filter(x => x.priority === 'high').length, '高優先名單'],
    ['todo_tasks', tasks.filter(x => x.status === 'todo').length, '待辦任務'],
    ['pending_followups', followups.filter(x => x.status === 'pending').length, '待追蹤紀錄'],
    ['open_deals', deals.filter(x => x.status === 'open').length, '開放商機'],
    ['won_deals', deals.filter(x => x.status === 'won').length, '已成交商機'],
    ['open_deal_amount', deals.filter(x => x.status === 'open').reduce((sum, x) => sum + Number(x.amount || 0), 0), '開放商機金額'],
    ['won_deal_amount', deals.filter(x => x.status === 'won').reduce((sum, x) => sum + Number(x.amount || 0), 0), '已成交金額'],
  ];

  const sheet = ensureSheet(SpreadsheetApp.getActiveSpreadsheet(), SHEET_NAMES.dashboard, HEADERS.dashboard);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.dashboard.length).setValues([HEADERS.dashboard]);
  const now = new Date().toISOString();
  if (metrics.length) sheet.getRange(2, 1, metrics.length, 4).setValues(metrics.map(m => [m[0], m[1], m[2], now]));
  return getDashboardData();
}

function getDashboardData() {
  const rows = getRowsAsObjects(SHEET_NAMES.dashboard);
  const obj = {};
  rows.forEach(row => obj[row.metric] = { value: row.value, note: row.note, updated_at: row.updated_at });
  return obj;
}

function calculateLeadScore(payload) {
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

function inferPlanAmount(plan) {
  const text = String(plan || '');
  if (text.includes('39,800') || text.includes('顧問導入')) return 39800;
  if (text.includes('19,800') || text.includes('完整商用')) return 19800;
  if (text.includes('9,800') || text.includes('內測')) return 9800;
  return 0;
}

function buildLeadNote(payload, score, priority) {
  return `AI初判分數：${score}；優先級：${priority}；需求摘要：${cleanText(payload.message) || '尚未填寫'}`;
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const raw = e.postData.contents;
  try { return JSON.parse(raw); } catch (error) { return e.parameter || {}; }
}

function validateLead(payload) {
  if (!payload) return { ok: false, message: '缺少表單資料。' };
  if (!payload.name) return { ok: false, message: '請填寫姓名或單位名稱。' };
  if (!payload.line) return { ok: false, message: '請填寫 LINE ID 或官方帳號。' };
  if (!payload.plan) return { ok: false, message: '請選擇想了解的方案。' };
  if (!payload.status) return { ok: false, message: '請選擇目前狀況。' };
  return { ok: true, message: 'ok' };
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_NAMES).forEach(key => ensureSheet(ss, SHEET_NAMES[key], HEADERS[key]));
  seedSettings();
}

function seedSettings() {
  const rows = getRowsAsObjects(SHEET_NAMES.settings);
  if (rows.length > 0) return;
  appendObject(SHEET_NAMES.settings, { key: 'app_name', value: 'GovBid AI ERP', note: '系統名稱', updated_at: new Date().toISOString() });
  appendObject(SHEET_NAMES.settings, { key: 'default_owner', value: '', note: '預設負責人', updated_at: new Date().toISOString() });
  appendObject(SHEET_NAMES.settings, { key: 'line_notify_enabled', value: 'false', note: '下一階段串接 LINE 通知', updated_at: new Date().toISOString() });
}

function ensureSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (!headers) return sheet;
  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = currentHeaders.some(Boolean);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function appendObject(sheetName, object) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headers = HEADERS[getSheetKey(sheetName)];
  const sheet = ensureSheet(ss, sheetName, headers);
  const row = headers.map(h => object[h] !== undefined ? object[h] : '');
  sheet.appendRow(row);
}

function updateRowById(sheetName, idColumn, idValue, patch) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return false;
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf(idColumn);
  if (idIndex === -1) return false;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(idValue)) {
      Object.keys(patch).forEach(key => {
        const col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(patch[key]);
      });
      return true;
    }
  }
  return false;
}

function getRowsAsObjects(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row.some(Boolean)).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function writeLog(level, action, message, payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ensureSheet(ss, SHEET_NAMES.logs, HEADERS.logs);
    logSheet.appendRow([new Date().toISOString(), level, action, message, JSON.stringify(payload || {})]);
  } catch (error) {
    console.error(error);
  }
}

function getSheetKey(sheetName) {
  return Object.keys(SHEET_NAMES).find(key => SHEET_NAMES[key] === sheetName);
}

function createId(prefix) {
  return prefix + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateString(date) {
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function cleanText(value) {
  return String(value || '').trim();
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
