/* GovOps OS｜Participant Master Database v1
 * 正式上線商品版：學員資料庫主檔。
 * 目的：學員名冊不只掛在單一場次，也要同步進入學員資料庫，支援跨標案、跨課程、CRM、再行銷、完訓紀錄與出席歷史管理。
 */

function handleGovOpsParticipantMasterAction(action, data) {
  data = data || {};
  try {
    if (action === 'participant.master.upsert' || action === '建立或更新學員主檔') return GovOpsParticipantMaster_upsert(data);
    if (action === 'participant.master.query' || action === '查詢學員主檔') return GovOpsParticipantMaster_query(data);
    if (action === 'participant.master.syncRoster' || action === '同步名冊到學員主檔') return GovOpsParticipantMaster_syncRoster(data);
    if (action === 'participant.history.query' || action === '查詢學員參與歷程') return GovOpsParticipantHistory_query(data);
    if (action === 'participant.master.dashboard' || action === '學員資料庫總覽') return GovOpsParticipantMaster_dashboard(data);
    return null;
  } catch (err) {
    GovOpsParticipantMaster_audit('PARTICIPANT_MASTER_ERROR', action, data, 'fail', String(err));
    return GovOpsParticipantMaster_fail('學員資料庫暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_PARTICIPANT_MASTER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsParticipantMasterAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_PARTICIPANT_MASTER(action, data);
  };
}

function GovOpsParticipantMaster_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsParticipantMaster_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsParticipantMaster_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsParticipantMaster_sheetName() { return '96_學員資料庫'; }
function GovOpsParticipantHistory_sheetName() { return '97_學員參與歷程'; }

function GovOpsParticipantMaster_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsParticipantMaster_sheetName(), [
    '學員ID','tenantId','姓名','識別碼','電話','Email','LineID','身分類別','主要地區','最近參與日期','累計報名次數','累計出席次數','累計完訓次數','最近標案ID','最近場次ID','最近活動名稱','CRM狀態','行銷同意','資料來源','建立時間','更新時間','userId','備註'
  ]);
  GovOpsProduct_ensureSheet(GovOpsParticipantHistory_sheetName(), [
    '歷程ID','tenantId','學員ID','報名ID','招生ID','標案ID','標案名稱','場次ID','活動名稱','活動日期','報名狀態','錄取狀態','報到狀態','出席狀態','完訓狀態','滿意度分數','來源','建立時間','更新時間','userId','備註'
  ]);
}

function GovOpsParticipantMaster_upsert(data) {
  data = data || {};
  GovOpsParticipantMaster_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var name = data.姓名 || data.name || '';
  if (!name) return GovOpsParticipantMaster_fail('請提供學員姓名。');
  var phone = data.電話 || data.phone || '';
  var email = data.Email || data.email || '';
  var lineId = data.LineID || data.lineId || '';
  var identifier = data.識別碼 || data.identifier || '';
  var existing = GovOpsParticipantMaster_findExisting(tenantId, name, phone, email, lineId, identifier);
  var current = existing || {};
  var row = {
    學員ID: current.學員ID || 'PART-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    姓名: name,
    識別碼: identifier || current.識別碼 || '',
    電話: phone || current.電話 || '',
    Email: email || current.Email || '',
    LineID: lineId || current.LineID || '',
    身分類別: data.身分類別 || data.identityType || current.身分類別 || '',
    主要地區: data.主要地區 || data.area || current.主要地區 || '',
    最近參與日期: data.活動日期 || data.eventDate || current.最近參與日期 || '',
    累計報名次數: Number(current.累計報名次數 || 0) + Number(data._incrementRegistration || 0),
    累計出席次數: Number(current.累計出席次數 || 0) + Number(data._incrementAttendance || 0),
    累計完訓次數: Number(current.累計完訓次數 || 0) + Number(data._incrementCompletion || 0),
    最近標案ID: data.標案ID || data.tenderId || current.最近標案ID || '',
    最近場次ID: data.場次ID || data.eventId || current.最近場次ID || '',
    最近活動名稱: data.活動名稱 || data.eventName || current.最近活動名稱 || '',
    CRM狀態: data.CRM狀態 || data.crmStatus || current.CRM狀態 || '可追蹤',
    行銷同意: data.行銷同意 || data.marketingConsent || current.行銷同意 || '待確認',
    資料來源: data.資料來源 || data.source || current.資料來源 || '學員名冊同步',
    建立時間: current.建立時間 || GovOpsParticipantMaster_now(),
    更新時間: GovOpsParticipantMaster_now(),
    userId: data.userId || current.userId || '',
    備註: data.備註 || current.備註 || ''
  };
  if (existing) GovOpsProduct_update(GovOpsParticipantMaster_sheetName(), existing._row, row);
  else GovOpsProduct_append(GovOpsParticipantMaster_sheetName(), row);
  GovOpsParticipantMaster_writeHistory(row, data);
  GovOpsParticipantMaster_audit('PARTICIPANT_UPSERT', 'participant.master.upsert', row, 'success', existing ? '學員主檔已更新' : '學員主檔已建立');
  return GovOpsParticipantMaster_success(existing ? '學員主檔已更新。' : '學員主檔已建立。', row);
}

function GovOpsParticipantMaster_syncRoster(data) {
  data = data || {};
  GovOpsParticipantMaster_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var rows = GovOpsParticipantMaster_filterRows('88_學員名冊', data);
  var synced = 0, failed = 0, results = [];
  rows.forEach(function(r) {
    try {
      var up = GovOpsParticipantMaster_upsert(Object.assign({}, r, {
        tenantId: tenantId,
        資料來源: '學員名冊同步',
        _incrementRegistration: 1,
        _incrementAttendance: String(r.報到狀態 || r.出席狀態 || '').indexOf('已') >= 0 ? 1 : 0,
        _incrementCompletion: String(r.完訓狀態 || '').indexOf('已') >= 0 ? 1 : 0,
        userId: data.userId || r.userId || ''
      }));
      if (up.success) { synced++; results.push(up.data); } else failed++;
    } catch (err) { failed++; }
  });
  return GovOpsParticipantMaster_success('學員名冊已同步至學員資料庫。', { totalRoster: rows.length, synced: synced, failed: failed, rows: results.slice(0, 300) });
}

function GovOpsParticipantMaster_query(data) {
  data = data || {};
  GovOpsParticipantMaster_ensureSheets();
  var rows = GovOpsParticipantMaster_filterRows(GovOpsParticipantMaster_sheetName(), data);
  return GovOpsParticipantMaster_success('學員主檔查詢完成。', { total: rows.length, summary: GovOpsParticipantMaster_count(rows), rows: rows.slice(0, 1000) });
}

function GovOpsParticipantHistory_query(data) {
  data = data || {};
  GovOpsParticipantMaster_ensureSheets();
  var rows = GovOpsParticipantMaster_filterRows(GovOpsParticipantHistory_sheetName(), data);
  return GovOpsParticipantMaster_success('學員參與歷程查詢完成。', { total: rows.length, rows: rows.slice(0, 1000) });
}

function GovOpsParticipantMaster_dashboard(data) {
  var participants = GovOpsParticipantMaster_query(data).data;
  var history = GovOpsParticipantHistory_query(data).data;
  return GovOpsParticipantMaster_success('學員資料庫總覽完成。', { participants: participants.summary, participantTotal: participants.total, historyTotal: history.total });
}

function GovOpsParticipantMaster_writeHistory(master, data) {
  try {
    var hist = {
      歷程ID: 'PH-' + Utilities.getUuid().slice(0, 8),
      tenantId: master.tenantId,
      學員ID: master.學員ID,
      報名ID: data.報名ID || data.registrationId || '',
      招生ID: data.招生ID || data.registrationSettingId || '',
      標案ID: data.標案ID || data.tenderId || master.最近標案ID || '',
      標案名稱: data.標案名稱 || '',
      場次ID: data.場次ID || data.eventId || master.最近場次ID || '',
      活動名稱: data.活動名稱 || data.eventName || master.最近活動名稱 || '',
      活動日期: data.活動日期 || data.eventDate || master.最近參與日期 || '',
      報名狀態: data.報名狀態 || '',
      錄取狀態: data.錄取狀態 || '',
      報到狀態: data.報到狀態 || '',
      出席狀態: data.出席狀態 || '',
      完訓狀態: data.完訓狀態 || '',
      滿意度分數: data.滿意度分數 || '',
      來源: data.資料來源 || data.source || '學員名冊同步',
      建立時間: GovOpsParticipantMaster_now(),
      更新時間: GovOpsParticipantMaster_now(),
      userId: data.userId || '',
      備註: data.備註 || ''
    };
    if (!GovOpsParticipantMaster_historyExists(hist)) GovOpsProduct_append(GovOpsParticipantHistory_sheetName(), hist);
  } catch (err) {}
}

function GovOpsParticipantMaster_filterRows(sheetName, data) {
  GovOpsParticipantMaster_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.學員ID || data.姓名 || data.電話 || data.Email || data.標案ID || data.場次ID || '').trim();
  return GovOpsProduct_readRows(sheetName).filter(function(r) {
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (data.學員ID && String(r.學員ID || '') !== String(data.學員ID)) return false;
    if (data.場次ID && String(r.場次ID || r.最近場次ID || '') !== String(data.場次ID)) return false;
    if (data.標案ID && String(r.標案ID || r.最近標案ID || '') !== String(data.標案ID)) return false;
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
}

function GovOpsParticipantMaster_findExisting(tenantId, name, phone, email, lineId, identifier) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsParticipantMaster_sheetName());
    return rows.find(function(r) {
      if (String(r.tenantId || '') !== String(tenantId)) return false;
      if (identifier && String(r.識別碼 || '') === String(identifier)) return true;
      if (email && String(r.Email || '') === String(email)) return true;
      if (phone && String(r.電話 || '') === String(phone) && String(r.姓名 || '') === String(name)) return true;
      if (lineId && String(r.LineID || '') === String(lineId)) return true;
      return String(r.姓名 || '') === String(name) && !phone && !email && !identifier && !lineId;
    }) || null;
  } catch (err) { return null; }
}

function GovOpsParticipantMaster_historyExists(hist) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsParticipantHistory_sheetName());
    return rows.some(function(r) {
      return String(r.tenantId || '') === String(hist.tenantId || '') && String(r.學員ID || '') === String(hist.學員ID || '') && String(r.場次ID || '') === String(hist.場次ID || '') && String(r.報名ID || '') === String(hist.報名ID || '');
    });
  } catch (err) { return false; }
}

function GovOpsParticipantMaster_count(rows) {
  var out = { total: rows.length, trackable: 0, marketingConsentYes: 0, totalRegistration: 0, totalAttendance: 0, totalCompletion: 0 };
  rows.forEach(function(r) {
    if (String(r.CRM狀態 || '') === '可追蹤') out.trackable++;
    if (String(r.行銷同意 || '') === '是') out.marketingConsentYes++;
    out.totalRegistration += Number(r.累計報名次數 || 0);
    out.totalAttendance += Number(r.累計出席次數 || 0);
    out.totalCompletion += Number(r.累計完訓次數 || 0);
  });
  return out;
}

function GovOpsParticipantMaster_audit(eventType, action, data, result, message) { try { if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write(eventType, action, data, result, message); } catch(e){} }
