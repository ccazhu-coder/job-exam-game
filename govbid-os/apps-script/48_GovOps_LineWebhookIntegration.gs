/*
GovOps OS｜LINE Webhook Integration v1
目的：補齊正式 LINE Webhook / Reply / Command Router，不重寫既有 AI秘書查詢。
接法：既有 doPost -> handleRequest -> router，如需正式 webhook，可在 doPost 入口判斷 LINE event 後呼叫 GovOpsLine_handleWebhook(e)。
*/

var GOVOPS_LINE_PROP_CHANNEL_ACCESS_TOKEN = 'GOVOPS_LINE_CHANNEL_ACCESS_TOKEN';
var GOVOPS_LINE_PROP_CHANNEL_SECRET = 'GOVOPS_LINE_CHANNEL_SECRET';
var GOVOPS_LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

function GovOpsLine_handleWebhook(e) {
  try {
    var body = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (!body) return GovOpsLine_textOutput('OK');

    var payload = JSON.parse(body);
    var events = payload.events || [];
    events.forEach(function(event) {
      try { GovOpsLine_handleEvent(event); } catch (err) { GovOpsLine_logError('GovOpsLine_handleEvent', err, { event: event }); }
    });
    return GovOpsLine_textOutput('OK');
  } catch (err) {
    GovOpsLine_logError('GovOpsLine_handleWebhook', err, {});
    return GovOpsLine_textOutput('OK');
  }
}

function GovOpsLine_handleEvent(event) {
  if (!event || !event.replyToken) return;
  if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;

  var text = String(event.message.text || '').trim();
  var lineUserId = event.source && event.source.userId ? event.source.userId : '';
  var context = GovOpsLine_resolveContext(lineUserId);
  var result = GovOpsLine_routeCommand(text, context);
  GovOpsLine_replyText(event.replyToken, result.message || '已收到。');
}

function GovOpsLine_resolveContext(lineUserId) {
  var tenantId = 'TENANT-DEMO';
  var userId = lineUserId || 'LINE-USER';
  try {
    if (typeof GovOpsProduct_readRows === 'function') {
      var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.CRM || '08_學員CRM');
      var found = rows.find(function(r){ return String(r['LINE UID'] || '') === String(lineUserId || ''); });
      if (found) {
        tenantId = found.tenantId || tenantId;
        userId = found.userId || lineUserId || userId;
      }
    }
  } catch (err) {}
  return { tenantId: tenantId, userId: userId, lineUserId: lineUserId, userRole: 'owner', plan: 'pro' };
}

function GovOpsLine_routeCommand(text, context) {
  var data = Object.assign({}, context || {}, { lineText: text, text: text, 指令: text });
  try {
    if (/今日任務|今天要做什麼|今日工作/.test(text)) {
      if (typeof 查詢今日任務 === 'function') return GovOpsLine_formatApiResult(查詢今日任務(data));
      return { message: '今日任務功能尚未載入。' };
    }
    if (/未收款|應收/.test(text)) {
      if (typeof 查詢未收款 === 'function') return GovOpsLine_formatApiResult(查詢未收款(data));
      return { message: '未收款查詢功能尚未載入。' };
    }
    if (/缺件|核銷/.test(text)) {
      if (typeof AI缺件檢查 === 'function') return GovOpsLine_formatApiResult(AI缺件檢查(data));
      return { message: '缺件檢查功能尚未載入。' };
    }
    if (/提醒/.test(text)) {
      if (typeof 查詢今日提醒 === 'function') return GovOpsLine_formatApiResult(查詢今日提醒(data));
      return { message: '提醒功能尚未載入。' };
    }
    if (/標案/.test(text)) {
      if (typeof GovOpsProduct_queryTender === 'function') return GovOpsLine_formatApiResult(GovOpsProduct_queryTender(Object.assign({}, data, { 關鍵字: text.replace(/查詢|標案/g, '').trim() })), '標案池');
      return { message: '標案池功能尚未載入。' };
    }
    if (/完成/.test(text)) {
      var task = text.replace('完成', '').trim();
      if (typeof 更新任務狀態 === 'function') return GovOpsLine_formatApiResult(更新任務狀態(Object.assign({}, data, { 任務項目: task, 狀態: '已完成' })));
      return { message: '任務更新功能尚未載入。' };
    }
    if (typeof AI秘書查詢 === 'function') return GovOpsLine_formatApiResult(AI秘書查詢(data));
    return { message: '我已收到：「' + text + '」\n目前可用指令：今日任務、查詢未收款、查詢缺件、查詢提醒、查詢標案。' };
  } catch (err) {
    GovOpsLine_logError('GovOpsLine_routeCommand', err, data);
    return { message: '系統暫時無法完成操作，請稍後再試。' };
  }
}

function GovOpsLine_formatApiResult(result, title) {
  if (!result) return { message: '系統沒有回應。' };
  var msg = title ? '【' + title + '】\n' : '';
  msg += result.message || (result.success ? '操作完成。' : '操作失敗。');
  var data = result.data || {};
  var rows = data.rows || data.結果 || data.任務 || data.缺件 || data.提醒 || data.明細 || [];
  if (Array.isArray(rows) && rows.length) {
    msg += '\n\n';
    msg += rows.slice(0, 8).map(function(r, idx) {
      if (typeof r === 'string') return (idx + 1) + '. ' + r;
      var name = r.活動名稱 || r.工作任務 || r.標案名稱 || r.提醒內容 || r.檢查項目 || r.姓名 || r.說明 || JSON.stringify(r).slice(0, 80);
      var status = r.活動狀態 || r.任務狀態 || r.標案狀態 || r.提醒狀態 || r.核銷狀態 || '';
      return (idx + 1) + '. ' + name + (status ? '｜' + status : '');
    }).join('\n');
  }
  if (msg.length > 1800) msg = msg.slice(0, 1800) + '\n…內容較多，請回系統查看完整資料。';
  return { message: msg };
}

function GovOpsLine_replyText(replyToken, text) {
  var token = PropertiesService.getScriptProperties().getProperty(GOVOPS_LINE_PROP_CHANNEL_ACCESS_TOKEN);
  if (!token) {
    GovOpsLine_logError('GovOpsLine_replyText', new Error('LINE Channel Access Token 尚未設定'), {});
    return;
  }
  UrlFetchApp.fetch(GOVOPS_LINE_REPLY_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: String(text || '已收到。') }] }),
    muteHttpExceptions: true
  });
}

function GovOpsLine_textOutput(text) {
  return ContentService.createTextOutput(String(text || 'OK')).setMimeType(ContentService.MimeType.TEXT);
}

function GovOpsLine_logError(module, err, data) {
  try {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {});
    else if (typeof logError === 'function') logError(module, err);
  } catch (e) {}
}

function 測試_LineWebhook_Command() {
  return GovOpsLine_routeCommand('今日任務', { tenantId: 'TENANT-DEMO', userId: 'LINE-QA' });
}
