/* GovOps OS｜Email Notification Dispatcher v1
 * 正式上線商品版：Email 批次通知派送。
 * 目的：錄取審核後，依使用者設定的 Email 模板，批次寄送通知給學員。
 * 支援：錄取通知、候補通知、未錄取通知、課前通知、一般通知。
 */

function handleGovOpsEmailNotificationAction(action, data) {
  data = data || {};
  try {
    if (action === 'email.template.create' || action === '建立Email模板') return GovOpsEmail_Template_create(data);
    if (action === 'email.template.query' || action === '查詢Email模板') return GovOpsEmail_Template_query(data);
    if (action === 'email.admission.queueBatch' || action === '批次建立錄取Email通知') return GovOpsEmail_Admission_queueBatch(data);
    if (action === 'email.dispatch.sendBatch' || action === '批次發送Email通知') return GovOpsEmail_Dispatch_sendBatch(data);
    if (action === 'email.dispatch.query' || action === '查詢Email發送紀錄') return GovOpsEmail_Dispatch_query(data);
    if (action === 'email.dispatch.health' || action === 'Email通知健康檢查') return GovOpsEmail_Health(data);
    return null;
  } catch (err) {
    GovOpsEmail_audit('EMAIL_DISPATCH_ERROR', action, data, 'fail', String(err));
    return GovOpsEmail_fail('Email 通知派送暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EMAIL_DISPATCH = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsEmailNotificationAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EMAIL_DISPATCH(action, data);
  };
}

function GovOpsEmail_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsEmail_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsEmail_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsEmail_sheetTemplate() { return '102_Email通知模板'; }
function GovOpsEmail_sheetQueue() { return '103_Email通知佇列'; }
function GovOpsEmail_sheetLog() { return '104_Email發送紀錄'; }

function GovOpsEmail_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsEmail_sheetTemplate(), ['模板ID','tenantId','模板類型','模板名稱','Email主旨','Email內容','啟用狀態','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsEmail_sheetQueue(), ['Email通知ID','tenantId','來源模組','來源ID','報名ID','招生ID','標案ID','場次ID','姓名','Email','通知類型','Email主旨','Email內容','通知狀態','排程時間','發送時間','錯誤訊息','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsEmail_sheetLog(), ['紀錄ID','tenantId','Email通知ID','報名ID','姓名','Email','通知類型','發送結果','發送時間','錯誤訊息','建立時間','userId','備註']);
}

function GovOpsEmail_Template_create(data) {
  data = data || {};
  GovOpsEmail_ensureSheets();
  var row = {
    模板ID: data.模板ID || data.templateId || 'EMAILTPL-' + Utilities.getUuid().slice(0, 8),
    tenantId: data.tenantId || 'TENANT-DEMO',
    模板類型: data.模板類型 || data.templateType || '錄取通知',
    模板名稱: data.模板名稱 || data.templateName || '錄取通知模板',
    Email主旨: data.Email主旨 || data.subject || '{{活動名稱}} 錄取通知',
    Email內容: data.Email內容 || data.body || GovOpsEmail_defaultTemplate(data.模板類型 || data.templateType || '錄取通知'),
    啟用狀態: data.啟用狀態 || '啟用',
    建立時間: GovOpsEmail_now(),
    更新時間: GovOpsEmail_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  GovOpsProduct_append(GovOpsEmail_sheetTemplate(), row);
  return GovOpsEmail_success('Email 模板已建立。', row);
}

function GovOpsEmail_Template_query(data) {
  data = data || {};
  GovOpsEmail_ensureSheets();
  var rows = GovOpsEmail_filterRows(GovOpsEmail_sheetTemplate(), data);
  return GovOpsEmail_success('Email 模板查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsEmail_Admission_queueBatch(data) {
  data = data || {};
  GovOpsEmail_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var admissionStatus = data.錄取狀態 || data.admissionStatus || '已錄取';
  var noticeType = data.通知類型 || data.noticeType || GovOpsEmail_noticeTypeByAdmission(admissionStatus);
  var template = GovOpsEmail_findTemplate(tenantId, noticeType, data.模板ID || data.templateId || '') || { Email主旨: '{{活動名稱}} ' + noticeType, Email內容: GovOpsEmail_defaultTemplate(noticeType) };
  var regs = GovOpsEmail_filterRows('86_報名資料', Object.assign({}, data, { keyword: data.keyword || '' })).filter(function(r){
    if (data.招生ID && String(r.招生ID || '') !== String(data.招生ID)) return false;
    if (data.場次ID && String(r.場次ID || '') !== String(data.場次ID)) return false;
    if (String(r.錄取狀態 || '') !== String(admissionStatus)) return false;
    return String(r.Email || '').trim() !== '';
  });
  var created = 0, skipped = 0, rows = [];
  regs.forEach(function(r){
    if (GovOpsEmail_queueExists(tenantId, r.報名ID, noticeType)) { skipped++; return; }
    var subject = GovOpsEmail_render(template.Email主旨, r);
    var body = GovOpsEmail_render(template.Email內容, r);
    var row = {
      Email通知ID: 'EMAIL-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      來源模組: 'registration.admission',
      來源ID: r.報名ID,
      報名ID: r.報名ID,
      招生ID: r.招生ID,
      標案ID: r.標案ID,
      場次ID: r.場次ID,
      姓名: r.姓名,
      Email: r.Email,
      通知類型: noticeType,
      Email主旨: subject,
      Email內容: body,
      通知狀態: 'queued',
      排程時間: data.排程時間 || GovOpsEmail_now(),
      發送時間: '',
      錯誤訊息: '',
      建立時間: GovOpsEmail_now(),
      更新時間: GovOpsEmail_now(),
      userId: data.userId || '',
      備註: data.備註 || ''
    };
    GovOpsProduct_append(GovOpsEmail_sheetQueue(), row);
    if (typeof GovOpsNotify_Queue_create === 'function') {
      GovOpsNotify_Queue_create({ tenantId: tenantId, 來源模組: 'email.dispatch', 來源ID: row.Email通知ID, 通知類型: noticeType, 通知渠道: 'Email', 收件人: r.Email, 收件人姓名: r.姓名, 標題: subject, 內容: body, 優先級: 20, userId: data.userId || '' });
    }
    created++; rows.push(row);
  });
  GovOpsEmail_audit('EMAIL_ADMISSION_QUEUE_BATCH', 'email.admission.queueBatch', data, 'success', '批次建立錄取 Email 通知');
  return GovOpsEmail_success('批次 Email 通知已建立。', { totalTarget: regs.length, created: created, skipped: skipped, rows: rows.slice(0, 300) });
}

function GovOpsEmail_Dispatch_sendBatch(data) {
  data = data || {};
  GovOpsEmail_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var limit = Number(data.limit || 50);
  var rows = GovOpsProduct_readRows(GovOpsEmail_sheetQueue()).filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (String(r.通知狀態 || '') !== 'queued') return false;
    if (data.招生ID && String(r.招生ID || '') !== String(data.招生ID)) return false;
    if (data.場次ID && String(r.場次ID || '') !== String(data.場次ID)) return false;
    if (data.通知類型 && String(r.通知類型 || '') !== String(data.通知類型)) return false;
    return true;
  }).slice(0, limit);
  var sent = 0, failed = 0, results = [];
  rows.forEach(function(r){
    try {
      GmailApp.sendEmail(r.Email, r.Email主旨, GovOpsEmail_plainText(r.Email內容), { htmlBody: GovOpsEmail_html(r.Email內容), name: data.senderName || 'GovOps OS' });
      GovOpsProduct_update(GovOpsEmail_sheetQueue(), r._row, { 通知狀態: '已發送', 發送時間: GovOpsEmail_now(), 更新時間: GovOpsEmail_now() });
      GovOpsProduct_append(GovOpsEmail_sheetLog(), GovOpsEmail_logRow(r, '已發送', ''));
      GovOpsEmail_updateRegistrationNotice(r, '已通知');
      sent++; results.push({ Email通知ID: r.Email通知ID, Email: r.Email, result: '已發送' });
    } catch (err) {
      GovOpsProduct_update(GovOpsEmail_sheetQueue(), r._row, { 通知狀態: '失敗', 錯誤訊息: String(err), 更新時間: GovOpsEmail_now() });
      GovOpsProduct_append(GovOpsEmail_sheetLog(), GovOpsEmail_logRow(r, '失敗', String(err)));
      failed++; results.push({ Email通知ID: r.Email通知ID, Email: r.Email, result: '失敗', error: String(err) });
    }
  });
  return GovOpsEmail_success('批次 Email 發送完成。', { sent: sent, failed: failed, results: results });
}

function GovOpsEmail_Dispatch_query(data) {
  data = data || {};
  GovOpsEmail_ensureSheets();
  var rows = GovOpsEmail_filterRows(GovOpsEmail_sheetQueue(), data);
  return GovOpsEmail_success('Email 通知查詢完成。', { total: rows.length, summary: GovOpsEmail_count(rows), rows: rows.slice(-500).reverse() });
}

function GovOpsEmail_Health(data) {
  var q = GovOpsEmail_Dispatch_query(data).data.summary;
  return GovOpsEmail_success('Email 通知健康檢查完成。', q);
}

function GovOpsEmail_filterRows(sheetName, data) {
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.通知類型 || data.Email || '').trim();
  return GovOpsProduct_readRows(sheetName).filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
}

function GovOpsEmail_findTemplate(tenantId, type, templateId) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsEmail_sheetTemplate());
    return rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.啟用狀態 || '') === '啟用' && ((templateId && String(r.模板ID || '') === String(templateId)) || (!templateId && String(r.模板類型 || '') === String(type))); }) || null;
  } catch (err) { return null; }
}

function GovOpsEmail_queueExists(tenantId, regId, type) {
  try { return GovOpsProduct_readRows(GovOpsEmail_sheetQueue()).some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.報名ID || '') === String(regId) && String(r.通知類型 || '') === String(type); }); } catch(e){ return false; }
}

function GovOpsEmail_noticeTypeByAdmission(status) {
  if (status === '已錄取') return '錄取通知';
  if (status === '候補') return '候補通知';
  if (status === '不錄取') return '未錄取通知';
  return '審核結果通知';
}

function GovOpsEmail_defaultTemplate(type) {
  if (type === '錄取通知') return '親愛的 {{姓名}} 您好：\n\n恭喜您錄取「{{活動名稱}}」。\n活動日期：{{活動日期}}\n\n請留意後續課前通知，謝謝。';
  if (type === '候補通知') return '親愛的 {{姓名}} 您好：\n\n您報名的「{{活動名稱}}」目前為候補狀態。\n如有名額釋出，將再通知您。';
  if (type === '未錄取通知') return '親愛的 {{姓名}} 您好：\n\n感謝您報名「{{活動名稱}}」。本次因名額或資格條件限制，未能錄取，敬請見諒。';
  return '親愛的 {{姓名}} 您好：\n\n{{活動名稱}} 通知如下：\n{{通知內容}}';
}

function GovOpsEmail_render(tpl, data) {
  var text = String(tpl || '');
  Object.keys(data || {}).forEach(function(k){ text = text.split('{{' + k + '}}').join(data[k] || ''); });
  return text;
}
function GovOpsEmail_plainText(html) { return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''); }
function GovOpsEmail_html(text) { return String(text || '').replace(/\n/g, '<br>'); }
function GovOpsEmail_logRow(r, result, error) { return { 紀錄ID:'EMAILLOG-' + Utilities.getUuid().slice(0,8), tenantId:r.tenantId, Email通知ID:r.Email通知ID, 報名ID:r.報名ID, 姓名:r.姓名, Email:r.Email, 通知類型:r.通知類型, 發送結果:result, 發送時間:GovOpsEmail_now(), 錯誤訊息:error || '', 建立時間:GovOpsEmail_now(), userId:r.userId || '', 備註:'' }; }
function GovOpsEmail_updateRegistrationNotice(r, status) { try { var rows = GovOpsProduct_readRows('86_報名資料'); var reg = rows.find(function(x){ return String(x.tenantId||'')===String(r.tenantId) && String(x.報名ID||'')===String(r.報名ID); }); if (reg) GovOpsProduct_update('86_報名資料', reg._row, { 通知狀態: status, 更新時間: GovOpsEmail_now() }); } catch(e){} }
function GovOpsEmail_count(rows) { var out={total:rows.length,queued:0,sent:0,failed:0}; rows.forEach(function(r){ if(r.通知狀態==='queued')out.queued++; else if(r.通知狀態==='已發送')out.sent++; else if(r.通知狀態==='失敗')out.failed++; }); return out; }
function GovOpsEmail_audit(eventType, action, data, result, message) { try { if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write(eventType, action, data, result, message); } catch(e){} }
