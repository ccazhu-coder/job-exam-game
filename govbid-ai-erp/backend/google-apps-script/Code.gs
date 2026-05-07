/**
 * GovBid AI ERP｜AI Company Backend V3
 * 目的：Landing Lead → CRM → Task → Followup → Deal → Dashboard → AI Secretary Report
 * 部署方式：Google Apps Script → Web App
 */

const APP_VERSION = '3.0.0';

const SHEET_NAMES = {
  leads: 'leads',
  tasks: 'tasks',
  followups: 'followups',
  deals: 'deals',
  reports: 'reports',
  notifications: 'notifications',
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
  reports: [
    'report_id', 'created_at', 'type', 'title', 'content', 'status', 'sent_at', 'updated_at'
  ],
  notifications: [
    'notification_id', 'created_at', 'type', 'target', 'title', 'content', 'status', 'sent_at', 'error', 'updated_at'
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
    setup();
    if (action === 'dashboard') return jsonOutput({ ok: true, data: getDashboardData() });
    if (action === 'leads') return jsonOutput({ ok: true, data: getRowsAsObjects(SHEET_NAMES.leads) });
    if (action === 'today') return jsonOutput({ ok: true, data: getTodayBriefing() });
    if (action === 'report') return jsonOutput({ ok: true, data: createDailyReport() });

    return jsonOutput({
      ok: true,
      service: 'GovBid AI ERP AI Company API',
      version: APP_VERSION,
      actions: ['health', 'dashboard', 'leads', 'today', 'report'],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    writeLog('error', 'do_get_error', error.message, { stack: error.stack });
    return jsonOutput({ ok: false, message: error.message });
  }
}

function doPost(e) {
  try {
    setup();
    const payload = parsePayload(e);
    const action = payload.action || 'createLead';

    if (action === 'createLead') return handleCreateLead(payload);
    if (action === 'updateLeadStage') return handleUpdateLeadStage(payload);
    if (action === 'createTask') return handleCreateTask(payload);
    if (action === 'completeTask') return handleCompleteTask(payload);
    if (action === 'createFollowup') return handleCreateFollowup(payload);
    if (action === 'completeFollowup') return handleCompleteFollowup(payload);
    if (action === 'createDeal') return handleCreateDeal(payload);
    if (action === 'updateDealStatus') return handleUpdateDealStatus(payload);
    if (action === 'refreshDashboard') return jsonOutput({ ok: true, data: refreshDashboard() });
    if (action === 'createDailyReport') return jsonOutput({ ok: true, data: createDailyReport() });
    if (action === 'createNotification') return handleCreateNotification(payload);
    if (action === 'sendPendingNotifications') return jsonOutput({ ok: true, data: sendPendingNotifications() });
    if (action === 'createTriggers') return jsonOutput({ ok: true, data: createSecretaryTriggers() });

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
    owner: getSetting('default_owner') || '',
    last_contact_at: '',
    next_followup_date: toDateString(nextFollowupDate),
    note: buildLeadNote(payload, score, priority),
    updated_at: now.toISOString(),
  });

  const taskId = createDefaultTask(leadId, payload, priority, nextFollowupDate);
  const followupId = createDefaultFollowup(leadId, payload, nextFollowupDate);
  const dealId = createDefaultDeal(leadId, payload);

  const notificationId = enqueueNotification({
    type: 'new_lead',
    target: 'owner',
    title: `新名單｜${cleanText(payload.name)}｜${priority}`,
    content: buildNewLeadNotification(payload, leadId, score, priority),
  });

  refreshDashboard();
  writeLog('info', 'lead_created', `Lead created: ${leadId}`, { leadId, taskId, followupId, dealId, notificationId, score, priority });

  return jsonOutput({
    ok: true,
    message: '已收到你的預約資料，我們會盡快與你聯繫。',
    lead_id: leadId,
    task_id: taskId,
    followup_id: followupId,
    deal_id: dealId,
    notification_id: notificationId,
    score,
    priority,
  });
}

function handleUpdateLeadStage(payload) {
  const leadId = cleanText(payload.lead_id);
  const stage = cleanText(payload.stage);
  if (!leadId || !stage) return jsonOutput({ ok: false, message: '缺少 lead_id 或 stage。' });

  const patch = {
    stage,
    updated_at: new Date().toISOString(),
  };
  if (payload.last_contact_at !== undefined) patch.last_contact_at = payload.last_contact_at;
  if (payload.next_followup_date !== undefined) patch.next_followup_date = payload.next_followup_date;
  if (payload.note !== undefined) patch.note = payload.note;

  const updated = updateRowById(SHEET_NAMES.leads, 'lead_id', leadId, patch);
  refreshDashboard();
  writeLog('info', 'lead_stage_updated', `Lead stage updated: ${leadId} → ${stage}`, payload);
  return jsonOutput({ ok: updated, message: updated ? 'Lead 狀態已更新。' : '找不到 Lead。' });
}

function handleCreateTask(payload) {
  const taskId = createId('T');
  appendObject(SHEET_NAMES.tasks, {
    task_id: taskId,
    created_at: new Date().toISOString(),
    lead_id: cleanText(payload.lead_id),
    title: cleanText(payload.title),
    status: payload.status || 'todo',
    priority: payload.priority || 'medium',
    deadline: payload.deadline || '',
    owner: payload.owner || getSetting('default_owner') || '',
    note: payload.note || '',
    updated_at: new Date().toISOString(),
  });
  refreshDashboard();
  return jsonOutput({ ok: true, task_id: taskId, message: '任務已建立。' });
}

function handleCompleteTask(payload) {
  const taskId = cleanText(payload.task_id);
  if (!taskId) return jsonOutput({ ok: false, message: '缺少 task_id。' });
  const updated = updateRowById(SHEET_NAMES.tasks, 'task_id', taskId, {
    status: 'done',
    note: payload.note || '已完成',
    updated_at: new Date().toISOString(),
  });
  refreshDashboard();
  return jsonOutput({ ok: updated, message: updated ? '任務已完成。' : '找不到任務。' });
}

function handleCreateFollowup(payload) {
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

function handleCompleteFollowup(payload) {
  const followupId = cleanText(payload.followup_id);
  if (!followupId) return jsonOutput({ ok: false, message: '缺少 followup_id。' });
  const updated = updateRowById(SHEET_NAMES.followups, 'followup_id', followupId, {
    status: 'done',
    updated_at: new Date().toISOString(),
  });
  refreshDashboard();
  return jsonOutput({ ok: updated, message: updated ? '追蹤已完成。' : '找不到追蹤紀錄。' });
}

function handleCreateDeal(payload) {
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

function handleUpdateDealStatus(payload) {
  const dealId = cleanText(payload.deal_id);
  const status = cleanText(payload.status);
  if (!dealId || !status) return jsonOutput({ ok: false, message: '缺少 deal_id 或 status。' });
  const updated = updateRowById(SHEET_NAMES.deals, 'deal_id', dealId, {
    status,
    closed_at: status === 'won' || status === 'lost' ? new Date().toISOString() : '',
    note: payload.note || '',
    updated_at: new Date().toISOString(),
  });
  refreshDashboard();
  return jsonOutput({ ok: updated, message: updated ? '商機狀態已更新。' : '找不到商機。' });
}

function handleCreateNotification(payload) {
  const notificationId = enqueueNotification({
    type: payload.type || 'manual',
    target: payload.target || 'owner',
    title: payload.title || '系統通知',
    content: payload.content || '',
  });
  return jsonOutput({ ok: true, notification_id: notificationId, message: '通知已建立。' });
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
    owner: getSetting('default_owner') || '',
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

function createDailyReport() {
  setup();
  refreshDashboard();
  const briefing = getTodayBriefing();
  const reportId = createId('R');
  const title = `AI 總秘書每日營運報告｜${toDateString(new Date())}`;
  const content = renderDailyReportText(briefing);

  appendObject(SHEET_NAMES.reports, {
    report_id: reportId,
    created_at: new Date().toISOString(),
    type: 'daily',
    title,
    content,
    status: 'created',
    sent_at: '',
    updated_at: new Date().toISOString(),
  });

  enqueueNotification({
    type: 'daily_report',
    target: 'owner',
    title,
    content,
  });

  writeLog('info', 'daily_report_created', title, { reportId });
  return { report_id: reportId, title, content, briefing };
}

function getTodayBriefing() {
  const today = toDateString(new Date());
  const leads = getRowsAsObjects(SHEET_NAMES.leads);
  const tasks = getRowsAsObjects(SHEET_NAMES.tasks);
  const followups = getRowsAsObjects(SHEET_NAMES.followups);
  const deals = getRowsAsObjects(SHEET_NAMES.deals);

  const todoTasks = tasks.filter(x => String(x.status) === 'todo');
  const dueTasks = todoTasks.filter(x => String(x.deadline || '') <= today);
  const pendingFollowups = followups.filter(x => String(x.status) === 'pending');
  const dueFollowups = pendingFollowups.filter(x => String(x.next_followup_date || '') <= today);
  const highPriorityLeads = leads.filter(x => String(x.priority) === 'high' && String(x.stage) !== 'won' && String(x.stage) !== 'lost');
  const openDeals = deals.filter(x => String(x.status) === 'open');
  const openAmount = openDeals.reduce((sum, x) => sum + Number(x.amount || 0), 0);

  return {
    date: today,
    summary: {
      total_leads: leads.length,
      high_priority_leads: highPriorityLeads.length,
      todo_tasks: todoTasks.length,
      due_tasks: dueTasks.length,
      pending_followups: pendingFollowups.length,
      due_followups: dueFollowups.length,
      open_deals: openDeals.length,
      open_deal_amount: openAmount,
    },
    due_tasks: dueTasks.slice(0, 10),
    due_followups: dueFollowups.slice(0, 10),
    high_priority_leads: highPriorityLeads.slice(0, 10),
    open_deals: openDeals.slice(0, 10),
    ai_suggestions: buildAiSuggestions({ dueTasks, dueFollowups, highPriorityLeads, openDeals, openAmount }),
  };
}

function renderDailyReportText(briefing) {
  const s = briefing.summary;
  const lines = [];
  lines.push(`【GovBid AI ERP｜AI 總秘書每日營運報告】`);
  lines.push(`日期：${briefing.date}`);
  lines.push('');
  lines.push(`一、今日營運摘要`);
  lines.push(`- 總名單數：${s.total_leads}`);
  lines.push(`- 高優先名單：${s.high_priority_leads}`);
  lines.push(`- 待辦任務：${s.todo_tasks}，今日/逾期待處理：${s.due_tasks}`);
  lines.push(`- 待追蹤紀錄：${s.pending_followups}，今日/逾期待追蹤：${s.due_followups}`);
  lines.push(`- 開放商機：${s.open_deals}，預估金額：NT$${s.open_deal_amount}`);
  lines.push('');
  lines.push(`二、AI 建議`);
  briefing.ai_suggestions.forEach(item => lines.push(`- ${item}`));
  lines.push('');
  lines.push(`三、今日優先處理`);
  briefing.due_tasks.forEach((task, i) => lines.push(`${i + 1}. ${task.title}｜期限：${task.deadline}｜優先級：${task.priority}`));
  if (!briefing.due_tasks.length) lines.push('- 今日沒有逾期待辦。');
  lines.push('');
  lines.push(`四、今日待追蹤`);
  briefing.due_followups.forEach((f, i) => lines.push(`${i + 1}. ${f.content}｜追蹤日：${f.next_followup_date}`));
  if (!briefing.due_followups.length) lines.push('- 今日沒有逾期追蹤。');
  return lines.join('\n');
}

function buildAiSuggestions(data) {
  const suggestions = [];
  if (data.dueTasks.length > 0) suggestions.push(`今日有 ${data.dueTasks.length} 個到期/逾期任務，建議先處理 high 優先級。`);
  if (data.dueFollowups.length > 0) suggestions.push(`今日有 ${data.dueFollowups.length} 筆客戶追蹤到期，建議優先聯絡高分名單。`);
  if (data.highPriorityLeads.length > 0) suggestions.push(`目前有 ${data.highPriorityLeads.length} 位高優先名單，建議安排導入諮詢或Demo。`);
  if (data.openDeals.length > 0) suggestions.push(`開放商機 ${data.openDeals.length} 筆，預估金額 NT$${data.openAmount}，建議每週檢查成交階段。`);
  if (suggestions.length === 0) suggestions.push('目前營運狀態穩定，建議新增流量來源或啟動社群導流。');
  return suggestions;
}

function enqueueNotification(input) {
  const notificationId = createId('N');
  appendObject(SHEET_NAMES.notifications, {
    notification_id: notificationId,
    created_at: new Date().toISOString(),
    type: input.type || 'manual',
    target: input.target || 'owner',
    title: input.title || '系統通知',
    content: input.content || '',
    status: 'pending',
    sent_at: '',
    error: '',
    updated_at: new Date().toISOString(),
  });
  return notificationId;
}

function sendPendingNotifications() {
  const notifications = getRowsAsObjects(SHEET_NAMES.notifications).filter(x => String(x.status) === 'pending');
  const results = [];
  notifications.forEach(item => {
    const result = sendLineNotify(item.title + '\n\n' + item.content);
    const status = result.ok ? 'sent' : 'failed';
    updateRowById(SHEET_NAMES.notifications, 'notification_id', item.notification_id, {
      status,
      sent_at: result.ok ? new Date().toISOString() : '',
      error: result.ok ? '' : result.message,
      updated_at: new Date().toISOString(),
    });
    results.push({ notification_id: item.notification_id, status, result });
  });
  return results;
}

function sendLineNotify(message) {
  const enabled = getSetting('line_notify_enabled') === 'true';
  const token = getSetting('line_channel_access_token');
  const userId = getSetting('line_user_id');

  if (!enabled) return { ok: false, message: 'LINE 通知尚未啟用。' };
  if (!token || !userId) return { ok: false, message: '缺少 LINE token 或 user id。' };

  try {
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }],
      }),
      muteHttpExceptions: true,
    });
    const code = response.getResponseCode();
    const body = response.getContentText();
    return { ok: code >= 200 && code < 300, status: code, body };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function createSecretaryTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (['dailySecretaryJob', 'hourlyFollowupJob'].includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('dailySecretaryJob').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('hourlyFollowupJob').timeBased().everyHours(1).create();

  return {
    ok: true,
    message: '已建立每日 AI 總秘書報告與每小時追蹤檢查觸發器。',
  };
}

function dailySecretaryJob() {
  setup();
  createDailyReport();
  sendPendingNotifications();
}

function hourlyFollowupJob() {
  setup();
  const briefing = getTodayBriefing();
  if (briefing.summary.due_tasks > 0 || briefing.summary.due_followups > 0) {
    enqueueNotification({
      type: 'hourly_reminder',
      target: 'owner',
      title: 'AI 總秘書提醒｜有任務需要處理',
      content: `目前有 ${briefing.summary.due_tasks} 個任務、${briefing.summary.due_followups} 筆追蹤到期。`,
    });
    sendPendingNotifications();
  }
}

function refreshDashboard() {
  const leads = getRowsAsObjects(SHEET_NAMES.leads);
  const tasks = getRowsAsObjects(SHEET_NAMES.tasks);
  const followups = getRowsAsObjects(SHEET_NAMES.followups);
  const deals = getRowsAsObjects(SHEET_NAMES.deals);
  const today = toDateString(new Date());

  const metrics = [
    ['total_leads', leads.length, '總名單數'],
    ['new_leads', leads.filter(x => x.stage === 'new').length, '尚未聯絡名單'],
    ['high_priority_leads', leads.filter(x => x.priority === 'high').length, '高優先名單'],
    ['todo_tasks', tasks.filter(x => x.status === 'todo').length, '待辦任務'],
    ['due_tasks', tasks.filter(x => x.status === 'todo' && String(x.deadline || '') <= today).length, '今日/逾期待辦'],
    ['pending_followups', followups.filter(x => x.status === 'pending').length, '待追蹤紀錄'],
    ['due_followups', followups.filter(x => x.status === 'pending' && String(x.next_followup_date || '') <= today).length, '今日/逾期追蹤'],
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

function buildNewLeadNotification(payload, leadId, score, priority) {
  return [
    '【新名單通知】',
    `Lead ID：${leadId}`,
    `姓名/單位：${cleanText(payload.name)}`,
    `LINE：${cleanText(payload.line)}`,
    `Email：${cleanText(payload.email) || '-'}`,
    `方案：${cleanText(payload.plan)}`,
    `狀況：${cleanText(payload.status)}`,
    `AI分數：${score}`,
    `優先級：${priority}`,
    `需求：${cleanText(payload.message) || '-'}`,
    '',
    '建議：先確認需求，若是 high 優先級，24小時內安排導入諮詢。'
  ].join('\n');
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
  const keys = rows.map(x => x.key);
  const defaults = [
    { key: 'app_name', value: 'GovBid AI ERP', note: '系統名稱' },
    { key: 'default_owner', value: '', note: '預設負責人' },
    { key: 'line_notify_enabled', value: 'false', note: '是否啟用 LINE Push 通知：true/false' },
    { key: 'line_channel_access_token', value: '', note: 'LINE Messaging API Channel access token' },
    { key: 'line_user_id', value: '', note: '要推送通知的 LINE user id' },
    { key: 'daily_report_hour', value: '8', note: '每日報告時間，預設早上8點' },
  ];
  defaults.forEach(item => {
    if (!keys.includes(item.key)) {
      appendObject(SHEET_NAMES.settings, { key: item.key, value: item.value, note: item.note, updated_at: new Date().toISOString() });
    }
  });
}

function getSetting(key) {
  const row = getRowsAsObjects(SHEET_NAMES.settings).find(x => x.key === key);
  return row ? String(row.value || '') : '';
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
    headers.forEach((h, i) => obj[h] = normalizeCell(row[i]));
    return obj;
  });
}

function normalizeCell(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return toDateString(value);
  return value;
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
