/* GovOps OS｜Class Reminder Scheduler v1
 * 正式上線商品版：課前提醒排程。
 * 目的：開課前 1 天自動通知學生與老師一次。
 * 學生來源：88_學員名冊 / 96_學員資料庫
 * 老師來源：74_履約活動場次、90_履約工作任務、81_正式講師基本資料
 */

function handleGovOpsClassReminderAction(action, data) {
  data = data || {};
  try {
    if (action === 'class.reminder.queueOneDayBefore' || action === '建立課前一天提醒') return GovOpsClassReminder_queueOneDayBefore(data);
    if (action === 'class.reminder.queueStudents' || action === '建立學生課前提醒') return GovOpsClassReminder_queueStudents(data);
    if (action === 'class.reminder.queueLecturers' || action === '建立老師課前提醒') return GovOpsClassReminder_queueLecturers(data);
    if (action === 'class.reminder.query' || action === '查詢課前提醒') return GovOpsClassReminder_query(data);
    if (action === 'class.reminder.health' || action === '課前提醒健康檢查') return GovOpsClassReminder_health(data);
    return null;
  } catch (err) {
    GovOpsClassReminder_audit('CLASS_REMINDER_ERROR', action, data, 'fail', String(err));
    return GovOpsClassReminder_fail('課前提醒暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLASS_REMINDER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsClassReminderAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLASS_REMINDER(action, data);
  };
}

function GovOpsClassReminder_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsClassReminder_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsClassReminder_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsClassReminder_sheetName() { return '105_課前提醒紀錄'; }

function GovOpsClassReminder_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsClassReminder_sheetName(), ['提醒ID','tenantId','標案ID','場次ID','活動名稱','活動日期','提醒對象','對象ID','姓名','Email','通知類型','Email通知ID','通知狀態','建立時間','更新時間','userId','備註']);
}

function GovOpsClassReminder_queueOneDayBefore(data) {
  data = data || {};
  GovOpsClassReminder_ensureSheet();
  var s = GovOpsClassReminder_queueStudents(data);
  var l = GovOpsClassReminder_queueLecturers(data);
  return GovOpsClassReminder_success('開課前一天學生與老師提醒已建立。', { students: s.data || s, lecturers: l.data || l });
}

function GovOpsClassReminder_queueStudents(data) {
  data = data || {};
  GovOpsClassReminder_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var eventId = data.場次ID || data.eventId || '';
  var roster = GovOpsClassReminder_filterRows('88_學員名冊', data).filter(function(r){
    if (eventId && String(r.場次ID || '') !== String(eventId)) return false;
    return String(r.Email || '').trim() !== '' && String(r.名冊狀態 || '') !== '取消';
  });
  var created = 0, skipped = 0, rows = [];
  roster.forEach(function(r){
    if (GovOpsClassReminder_exists(tenantId, r.場次ID, '學生', r.報名ID || r.名冊ID || r.Email, '學生課前一天提醒')) { skipped++; return; }
    var subject = data.學生Email主旨 || data.studentSubject || '{{活動名稱}}｜開課前一天提醒';
    var body = data.學生Email內容 || data.studentBody || GovOpsClassReminder_studentTemplate();
    var email = GovOpsClassReminder_queueEmail(Object.assign({}, r, data, { 通知類型: '學生課前一天提醒', Email主旨: subject, Email內容: body }));
    var row = GovOpsClassReminder_record(r, '學生', r.報名ID || r.名冊ID || r.Email, '學生課前一天提醒', email.data && email.data.rows && email.data.rows[0] && email.data.rows[0].Email通知ID || '');
    GovOpsProduct_append(GovOpsClassReminder_sheetName(), row);
    created++; rows.push(row);
  });
  return GovOpsClassReminder_success('學生課前一天提醒已建立。', { totalTarget: roster.length, created: created, skipped: skipped, rows: rows.slice(0, 300) });
}

function GovOpsClassReminder_queueLecturers(data) {
  data = data || {};
  GovOpsClassReminder_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var event = GovOpsClassReminder_findEvent(tenantId, data) || {};
  var lecturers = GovOpsClassReminder_findLecturers(tenantId, event, data);
  var created = 0, skipped = 0, rows = [];
  lecturers.forEach(function(t){
    if (!t.Email) { skipped++; return; }
    if (GovOpsClassReminder_exists(tenantId, event.場次ID || data.場次ID || '', '老師', t.講師ID || t.Email, '老師課前一天提醒')) { skipped++; return; }
    var payload = Object.assign({}, event, t, data, { 姓名: t.姓名 || t.名稱 || event['講師/主持人'] || '老師', Email: t.Email, 通知類型: '老師課前一天提醒', Email主旨: data.老師Email主旨 || data.lecturerSubject || '{{活動名稱}}｜明日授課提醒', Email內容: data.老師Email內容 || data.lecturerBody || GovOpsClassReminder_lecturerTemplate() });
    var email = GovOpsClassReminder_queueEmail(payload);
    var row = GovOpsClassReminder_record(payload, '老師', t.講師ID || t.Email, '老師課前一天提醒', email.data && email.data.rows && email.data.rows[0] && email.data.rows[0].Email通知ID || '');
    GovOpsProduct_append(GovOpsClassReminder_sheetName(), row);
    created++; rows.push(row);
  });
  return GovOpsClassReminder_success('老師課前一天提醒已建立。', { totalTarget: lecturers.length, created: created, skipped: skipped, rows: rows.slice(0, 100) });
}

function GovOpsClassReminder_queueEmail(payload) {
  if (typeof GovOpsEmail_Admission_queueBatch === 'function') {
    // 這裡不用 admission batch，直接建立 Email 佇列，避免依錄取狀態篩選。
  }
  if (typeof GovOpsProduct_append !== 'function') return GovOpsClassReminder_fail('缺少資料寫入能力。');
  if (typeof GovOpsEmail_sheetQueue === 'function') {
    var subject = GovOpsClassReminder_render(payload.Email主旨, payload);
    var body = GovOpsClassReminder_render(payload.Email內容, payload);
    var row = {
      Email通知ID: 'EMAIL-' + Utilities.getUuid().slice(0, 8),
      tenantId: payload.tenantId || 'TENANT-DEMO',
      來源模組: 'class.reminder',
      來源ID: payload.場次ID || payload.eventId || '',
      報名ID: payload.報名ID || '',
      招生ID: payload.招生ID || '',
      標案ID: payload.標案ID || '',
      場次ID: payload.場次ID || payload.eventId || '',
      姓名: payload.姓名 || '',
      Email: payload.Email || '',
      通知類型: payload.通知類型 || '課前提醒',
      Email主旨: subject,
      Email內容: body,
      通知狀態: 'queued',
      排程時間: payload.排程時間 || GovOpsClassReminder_now(),
      發送時間: '',
      錯誤訊息: '',
      建立時間: GovOpsClassReminder_now(),
      更新時間: GovOpsClassReminder_now(),
      userId: payload.userId || '',
      備註: '由課前提醒排程建立'
    };
    GovOpsProduct_append(GovOpsEmail_sheetQueue(), row);
    if (typeof GovOpsNotify_Queue_create === 'function') GovOpsNotify_Queue_create({ tenantId: row.tenantId, 來源模組: 'class.reminder', 來源ID: row.Email通知ID, 通知類型: row.通知類型, 通知渠道: 'Email', 收件人: row.Email, 收件人姓名: row.姓名, 標題: row.Email主旨, 內容: row.Email內容, 優先級: 10, userId: row.userId });
    return GovOpsClassReminder_success('Email 課前提醒已排入佇列。', { rows: [row] });
  }
  return GovOpsClassReminder_fail('Email 模組尚未載入。');
}

function GovOpsClassReminder_query(data) {
  data = data || {};
  GovOpsClassReminder_ensureSheet();
  var rows = GovOpsClassReminder_filterRows(GovOpsClassReminder_sheetName(), data);
  return GovOpsClassReminder_success('課前提醒查詢完成。', { total: rows.length, rows: rows.slice(-500).reverse() });
}

function GovOpsClassReminder_health(data) {
  var rows = GovOpsClassReminder_query(data).data.rows || [];
  var out = { total: rows.length, students: 0, lecturers: 0, queued: 0, sent: 0 };
  rows.forEach(function(r){ if(r.提醒對象==='學生')out.students++; if(r.提醒對象==='老師')out.lecturers++; if(r.通知狀態==='queued')out.queued++; if(r.通知狀態==='已發送')out.sent++; });
  return GovOpsClassReminder_success('課前提醒健康檢查完成。', out);
}

function GovOpsClassReminder_filterRows(sheetName, data) {
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.場次ID || data.標案ID || '').trim();
  return GovOpsProduct_readRows(sheetName).filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (data.場次ID && String(r.場次ID || '') !== String(data.場次ID)) return false;
    if (data.標案ID && String(r.標案ID || '') !== String(data.標案ID)) return false;
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
}

function GovOpsClassReminder_findEvent(tenantId, data) {
  try { return GovOpsProduct_readRows('74_履約活動場次').find(function(r){ return String(r.tenantId||'')===String(tenantId) && ((data.場次ID && String(r.場次ID||'')===String(data.場次ID)) || (data.eventId && String(r.場次ID||'')===String(data.eventId))); }) || null; } catch(e){ return null; }
}

function GovOpsClassReminder_findLecturers(tenantId, event, data) {
  var list = [];
  try {
    var lecturerName = event['講師/主持人'] || event.講師 || data.講師姓名 || '';
    if (lecturerName) {
      var teachers = GovOpsProduct_readRows('81_正式講師基本資料').filter(function(t){ return String(t.tenantId||'')===String(tenantId) && String(t.姓名||'').indexOf(lecturerName) >= 0; });
      list = list.concat(teachers);
      if (!teachers.length && data.老師Email) list.push({ 姓名: lecturerName, Email: data.老師Email });
    }
    if (data.講師ID) {
      var byId = GovOpsProduct_readRows('81_正式講師基本資料').filter(function(t){ return String(t.tenantId||'')===String(tenantId) && String(t.講師ID||'')===String(data.講師ID); });
      list = list.concat(byId);
    }
  } catch(e) {}
  var seen = {};
  return list.filter(function(x){ var key = x.講師ID || x.Email || x.姓名; if(seen[key]) return false; seen[key]=true; return true; });
}

function GovOpsClassReminder_record(data, target, targetId, type, emailId) {
  return { 提醒ID:'CREM-' + Utilities.getUuid().slice(0,8), tenantId:data.tenantId||'TENANT-DEMO', 標案ID:data.標案ID||'', 場次ID:data.場次ID||data.eventId||'', 活動名稱:data.活動名稱||data.eventName||'', 活動日期:data.活動日期||data.eventDate||'', 提醒對象:target, 對象ID:targetId||'', 姓名:data.姓名||'', Email:data.Email||'', 通知類型:type, Email通知ID:emailId||'', 通知狀態:'queued', 建立時間:GovOpsClassReminder_now(), 更新時間:GovOpsClassReminder_now(), userId:data.userId||'', 備註:'' };
}
function GovOpsClassReminder_exists(tenantId, eventId, target, targetId, type) { try { return GovOpsProduct_readRows(GovOpsClassReminder_sheetName()).some(function(r){ return String(r.tenantId||'')===String(tenantId) && String(r.場次ID||'')===String(eventId||'') && String(r.提醒對象||'')===String(target) && String(r.對象ID||'')===String(targetId||'') && String(r.通知類型||'')===String(type); }); } catch(e){ return false; } }
function GovOpsClassReminder_render(tpl, data) { var text=String(tpl||''); Object.keys(data||{}).forEach(function(k){ text=text.split('{{'+k+'}}').join(data[k]||''); }); return text; }
function GovOpsClassReminder_studentTemplate(){ return '親愛的 {{姓名}} 您好：\n\n提醒您，您錄取/報名的「{{活動名稱}}」將於明天開課。\n\n活動日期：{{活動日期}}\n地點：{{地點}}\n\n請準時出席，謝謝。'; }
function GovOpsClassReminder_lecturerTemplate(){ return '親愛的 {{姓名}} 老師您好：\n\n提醒您，「{{活動名稱}}」將於明天進行。\n\n活動日期：{{活動日期}}\n地點：{{地點}}\n\n請協助確認教材、授課內容與抵達時間，謝謝老師。'; }
function GovOpsClassReminder_audit(eventType, action, data, result, message) { try { if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write(eventType, action, data, result, message); } catch(e){} }
