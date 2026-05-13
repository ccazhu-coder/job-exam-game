/**
 * GovOps OS｜LINE 官方帳號整合模組
 * 令牌透過 Script Properties 儲存，不寫入程式碼。
 */

// ── 讀取令牌 ──────────────────────────────────────────
function govopsLineToken_() {
  return PropertiesService.getScriptProperties().getProperty('LINE_TOKEN') || '';
}

// ── 一次性設定（在 Apps Script 編輯器中執行一次） ──────
function govopsLineSetupToken() {
  // ★ 將下面的字串換成你的 LINE Channel Access Token，執行一次即可
  var token = 'REPLACE_WITH_TOKEN';
  PropertiesService.getScriptProperties().setProperty('LINE_TOKEN', token);
  Logger.log('LINE_TOKEN 已設定完成');
}

// ── 發送 Push Message ──────────────────────────────────
function govopsLinePush_(userId, messages) {
  var token = govopsLineToken_();
  if (!token || !userId) return { ok: false, reason: 'missing token or userId' };
  var payload = JSON.stringify({ to: userId, messages: messages });
  var resp = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: payload,
    muteHttpExceptions: true
  });
  return { ok: resp.getResponseCode() === 200, status: resp.getResponseCode() };
}

// ── Reply Message ──────────────────────────────────────
function govopsLineReply_(replyToken, messages) {
  var token = govopsLineToken_();
  if (!token) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true
  });
}

// ── 處理 LINE Webhook ──────────────────────────────────
function govopsLineHandleWebhook_(body) {
  try {
    var data = JSON.parse(body);
    var events = data.events || [];
    events.forEach(function(ev) {
      if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
        var text = ev.message.text || '';
        var userId = (ev.source || {}).userId || '';
        govopsLineProcessCommand_(ev.replyToken, userId, text);
      }
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── 指令處理 ──────────────────────────────────────────
function govopsLineProcessCommand_(replyToken, userId, text) {
  var t = text.trim();
  var msg;
  if (t === '儀表板' || t === '狀態' || t === 'status') {
    try {
      var ss = SpreadsheetApp.openById(GOVOPS_SHEET_ID);
      var proj = (ss.getSheetByName('01_專案主檔') || {getLastRow: function(){return 1;}}).getLastRow() - 1;
      var act  = (ss.getSheetByName('02_場次活動') || {getLastRow: function(){return 1;}}).getLastRow() - 1;
      msg = '📊 GovOps OS 即時狀態\n' +
            '專案數：' + Math.max(0,proj) + '\n' +
            '活動數：' + Math.max(0,act) + '\n' +
            '更新時間：' + Utilities.formatDate(new Date(),'Asia/Taipei','MM/dd HH:mm');
    } catch(e) { msg = '查詢失敗：' + e.message; }
  } else if (t === '說明' || t === 'help' || t === '?') {
    msg = '🏛 GovOps OS 指令說明\n' +
          '輸入「儀表板」查詢即時狀態\n' +
          '輸入「專案」查詢進行中專案\n' +
          '輸入「說明」顯示此訊息';
  } else if (t === '專案') {
    try {
      var rows = govopsRows_('01_專案主檔', ['專案ID','專案計畫名稱','狀態','開始日期']);
      var active = rows.filter(function(r){ return r['狀態'] !== 'closed' && r['狀態'] !== 'cancelled'; }).slice(0,5);
      msg = active.length ?
        '📁 進行中專案 (' + active.length + ' 件)\n' + active.map(function(r){ return '• '+r['專案計畫名稱']; }).join('\n') :
        '目前無進行中專案';
    } catch(e) { msg = '查詢失敗：' + e.message; }
  } else {
    msg = '收到：「' + t + '」\n請輸入「說明」查看可用指令。';
  }
  govopsLineReply_(replyToken, [{ type: 'text', text: msg }]);
}

// ── API 路由（供主 router 呼叫） ──────────────────────
function govopsLineRoute_(params, action) {
  if (action === 'LINE.sendPush') {
    var result = govopsLinePush_(params.userId || params.lineUserId, [{ type: 'text', text: params.message || '測試訊息' }]);
    return { success: result.ok, message: result.ok ? 'LINE 訊息已發送' : 'LINE 發送失敗', data: result };
  }
  if (action === 'LINE.getProfile') {
    var token = govopsLineToken_();
    return { success: !!token, message: token ? 'LINE 令牌已設定' : 'LINE 令牌未設定', data: { tokenSet: !!token } };
  }
  return null;
}
