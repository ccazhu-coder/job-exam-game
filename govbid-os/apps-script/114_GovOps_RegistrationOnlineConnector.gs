/* GovOps OS｜Registration Online Connector v1
 * 正式上線商品版：線上報名連結同步。
 * 支援兩種報名入口：
 * 1. 後台手動新增報名資料 registration.intake.create
 * 2. 貼上 Google Form / Google Sheet / 線上報名連結，自動同步到待審核 registration.online.connect / sync
 */

function handleGovOpsRegistrationOnlineConnectorAction(action, data) {
  data = data || {};
  try {
    if (action === 'registration.online.connect' || action === '連結線上報名表') return GovOpsRegOnline_connect(data);
    if (action === 'registration.online.sync' || action === '同步線上報名資料') return GovOpsRegOnline_sync(data);
    if (action === 'registration.online.query' || action === '查詢線上報名連結') return GovOpsRegOnline_query(data);
    if (action === 'registration.online.health' || action === '線上報名連結健康檢查') return GovOpsRegOnline_health(data);
    return null;
  } catch (err) {
    GovOpsRegOnline_audit('REG_ONLINE_ERROR', action, data, 'fail', String(err));
    return GovOpsRegOnline_fail('線上報名同步暫時無法完成操作。', { error: String(err) });
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_REG_ONLINE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsRegistrationOnlineConnectorAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_REG_ONLINE(action, data);
  };
}

function GovOpsRegOnline_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsRegOnline_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsRegOnline_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsRegOnline_sheetName() { return '94_線上報名連結'; }
function GovOpsRegOnline_syncLogSheet() { return '95_線上報名同步紀錄'; }

function GovOpsRegOnline_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsRegOnline_sheetName(), ['連結ID','tenantId','招生ID','標案ID','標案名稱','場次ID','活動名稱','活動日期','報名表URL','來源類型','FormID','SpreadsheetID','SheetName','連結狀態','授權狀態','最後同步時間','同步狀態','同步筆數','新增筆數','略過筆數','建立時間','更新時間','userId','備註']);
  GovOpsProduct_ensureSheet(GovOpsRegOnline_syncLogSheet(), ['同步ID','tenantId','連結ID','招生ID','標案ID','場次ID','來源列號','姓名','電話','Email','同步結果','報名ID','錯誤訊息','建立時間','userId','原始資料']);
}

function GovOpsRegOnline_connect(data) {
  data = data || {};
  GovOpsRegOnline_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var url = data.報名表URL || data.formUrl || data.url || data.線上報名連結 || '';
  if (!url) return GovOpsRegOnline_fail('請貼上線上報名表連結。');
  var setting = GovOpsRegOnline_findSetting(tenantId, data) || {};
  var parsed = GovOpsRegOnline_parseUrl(url);
  var linked = GovOpsRegOnline_resolveSheet(parsed);
  var row = {
    連結ID: data.連結ID || 'REGONLINE-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    招生ID: data.招生ID || setting.招生ID || '',
    標案ID: data.標案ID || setting.標案ID || '',
    標案名稱: data.標案名稱 || setting.標案名稱 || '',
    場次ID: data.場次ID || setting.場次ID || '',
    活動名稱: data.活動名稱 || setting.活動名稱 || '',
    活動日期: data.活動日期 || setting.活動日期 || '',
    報名表URL: url,
    來源類型: parsed.type,
    FormID: parsed.formId || '',
    SpreadsheetID: linked.spreadsheetId || parsed.spreadsheetId || '',
    SheetName: linked.sheetName || data.SheetName || data.sheetName || '',
    連結狀態: linked.connected ? '已連結' : '待授權/待確認',
    授權狀態: linked.authorized ? '已授權' : '需確認Google權限',
    最後同步時間: '',
    同步狀態: '尚未同步',
    同步筆數: 0,
    新增筆數: 0,
    略過筆數: 0,
    建立時間: GovOpsRegOnline_now(),
    更新時間: GovOpsRegOnline_now(),
    userId: data.userId || '',
    備註: linked.note || '使用者貼線上報名連結，系統自動解析並同步至待審核。'
  };
  var existing = GovOpsRegOnline_findExisting(tenantId, row.招生ID, row.報名表URL);
  if (existing) {
    GovOpsProduct_update(GovOpsRegOnline_sheetName(), existing._row, Object.assign({}, row, { 連結ID: existing.連結ID, 建立時間: existing.建立時間 || row.建立時間 }));
    row.連結ID = existing.連結ID;
  } else {
    GovOpsProduct_append(GovOpsRegOnline_sheetName(), row);
  }
  if (row.SpreadsheetID) GovOpsRegOnline_sync({ tenantId: tenantId, 連結ID: row.連結ID, userId: data.userId || '' });
  GovOpsRegOnline_audit('REG_ONLINE_CONNECT', 'registration.online.connect', row, 'success', '線上報名表已連結');
  return GovOpsRegOnline_success(existing ? '線上報名連結已更新。' : '線上報名表已連結。', row);
}

function GovOpsRegOnline_sync(data) {
  data = data || {};
  GovOpsRegOnline_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var connectors = GovOpsRegOnline_targetRows(tenantId, data);
  if (!connectors.length) return GovOpsRegOnline_fail('找不到可同步的線上報名連結。');
  var totalSynced = 0, totalCreated = 0, totalSkipped = 0, results = [];
  connectors.forEach(function(conn) {
    var stats = { synced: 0, created: 0, skipped: 0 };
    try {
      var rows = GovOpsRegOnline_readRows(conn);
      rows.forEach(function(item, idx) {
        stats.synced++;
        var mapped = GovOpsRegOnline_mapRegistration(item, conn, data);
        if (!mapped.姓名) {
          stats.skipped++;
          GovOpsRegOnline_log(conn, idx + 2, mapped, '略過', '', '缺少姓名', data);
          return;
        }
        var existing = GovOpsRegOnline_findDuplicate(conn.tenantId, conn.招生ID, mapped.姓名, mapped.電話, mapped.Email);
        if (existing) {
          stats.skipped++;
          GovOpsRegOnline_log(conn, idx + 2, mapped, '重複略過', existing.報名ID, '', data);
          return;
        }
        var created = GovOpsReg_Intake_create ? GovOpsReg_Intake_create(Object.assign({}, mapped, { tenantId: conn.tenantId, 招生ID: conn.招生ID, 標案ID: conn.標案ID, 標案名稱: conn.標案名稱, 場次ID: conn.場次ID, 活動名稱: conn.活動名稱, 活動日期: conn.活動日期, 審核狀態: '待審核', 錄取狀態: '待審核', 報名狀態: '線上報名', userId: data.userId || '' })) : null;
        if (created && created.success) {
          stats.created++;
          GovOpsRegOnline_log(conn, idx + 2, mapped, '已新增待審核', created.data && created.data.報名ID || '', '', data);
        } else {
          stats.skipped++;
          GovOpsRegOnline_log(conn, idx + 2, mapped, '同步失敗', '', created && created.message || '建立報名失敗', data);
        }
      });
      GovOpsProduct_update(GovOpsRegOnline_sheetName(), conn._row, { 最後同步時間: GovOpsRegOnline_now(), 同步狀態: '已同步', 同步筆數: stats.synced, 新增筆數: stats.created, 略過筆數: stats.skipped, 更新時間: GovOpsRegOnline_now() });
      totalSynced += stats.synced; totalCreated += stats.created; totalSkipped += stats.skipped;
      results.push({ 連結ID: conn.連結ID, synced: stats.synced, created: stats.created, skipped: stats.skipped });
    } catch (err) {
      GovOpsProduct_update(GovOpsRegOnline_sheetName(), conn._row, { 同步狀態: '同步失敗', 更新時間: GovOpsRegOnline_now(), 備註: String(err) });
      results.push({ 連結ID: conn.連結ID, error: String(err) });
    }
  });
  return GovOpsRegOnline_success('線上報名同步完成。', { synced: totalSynced, created: totalCreated, skipped: totalSkipped, results: results });
}

function GovOpsRegOnline_query(data) {
  data = data || {};
  GovOpsRegOnline_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.招生ID || data.場次ID || '').trim();
  var rows = GovOpsProduct_readRows(GovOpsRegOnline_sheetName()).filter(function(r) {
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
  return GovOpsRegOnline_success('線上報名連結查詢完成。', { total: rows.length, rows: rows.slice(0, 500) });
}

function GovOpsRegOnline_health(data) {
  var q = GovOpsRegOnline_query(data).data.rows || [];
  var out = { total: q.length, connected: 0, needAuth: 0, synced: 0, failed: 0 };
  q.forEach(function(r) { if (r.連結狀態 === '已連結') out.connected++; if (String(r.授權狀態 || '').indexOf('需') >= 0) out.needAuth++; if (r.同步狀態 === '已同步') out.synced++; if (r.同步狀態 === '同步失敗') out.failed++; });
  return GovOpsRegOnline_success('線上報名連結健康檢查完成。', out);
}

function GovOpsRegOnline_parseUrl(url) {
  url = String(url || '').trim();
  var out = { type: '其他線上報名', formId: '', spreadsheetId: '', rawUrl: url };
  var formMatch = url.match(/\/forms\/d\/(?:e\/)?([^\/]+)/);
  if (formMatch) { out.type = 'Google表單'; out.formId = formMatch[1]; return out; }
  var sheetMatch = url.match(/\/spreadsheets\/d\/([^\/]+)/);
  if (sheetMatch) { out.type = 'Google試算表回覆'; out.spreadsheetId = sheetMatch[1]; return out; }
  if (/docs\.google\.com\/forms/.test(url)) out.type = 'Google表單';
  return out;
}

function GovOpsRegOnline_resolveSheet(parsed) {
  var out = { connected: false, authorized: false, spreadsheetId: '', sheetName: '', note: '' };
  try {
    if (parsed.spreadsheetId) {
      var ss = SpreadsheetApp.openById(parsed.spreadsheetId);
      out.connected = true; out.authorized = true; out.spreadsheetId = parsed.spreadsheetId; out.sheetName = ss.getSheets()[0].getName(); out.note = '使用者貼的是 Google 回覆試算表，系統已自動解析。'; return out;
    }
    if (parsed.formId && typeof FormApp !== 'undefined') {
      var form = FormApp.openById(parsed.formId);
      var destId = form.getDestinationId ? form.getDestinationId() : '';
      if (destId) {
        var ss2 = SpreadsheetApp.openById(destId);
        out.connected = true; out.authorized = true; out.spreadsheetId = destId; out.sheetName = ss2.getSheets()[0].getName(); out.note = '系統已由 Google Form 自動取得回覆試算表。';
      } else {
        out.connected = false; out.authorized = true; out.note = 'Google Form 尚未連結回覆試算表，請先於 Google Form 設定回覆目的地。';
      }
      return out;
    }
  } catch (err) {
    out.note = '無法讀取報名表或回覆表，可能權限不足或連結非同帳號擁有：' + err;
  }
  return out;
}

function GovOpsRegOnline_readRows(conn) {
  if (!conn.SpreadsheetID) throw new Error('缺少系統解析出的回覆試算表ID。');
  var ss = SpreadsheetApp.openById(conn.SpreadsheetID);
  var sheet = conn.SheetName ? ss.getSheetByName(conn.SheetName) : ss.getSheets()[0];
  if (!sheet) throw new Error('找不到報名回覆工作表。');
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  var headers = values[0].map(function(h) { return String(h || '').trim(); });
  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h || ('欄位' + i)] = row[i]; });
    return obj;
  });
}

function GovOpsRegOnline_mapRegistration(item, conn, data) {
  function pick(keys) { for (var i = 0; i < keys.length; i++) { var k = keys[i]; if (item[k] !== undefined && String(item[k]).trim() !== '') return String(item[k]).trim(); } return ''; }
  return {
    姓名: pick(['姓名','學員姓名','報名者姓名','參加者姓名','Name','name']),
    識別碼: pick(['身分證後四碼','識別碼','身分證字號','ID','id']),
    電話: pick(['電話','手機','聯絡電話','行動電話','Phone','phone','mobile']),
    Email: pick(['Email','email','電子郵件','信箱']),
    LineID: pick(['LINE ID','LineID','lineId','LINE','line']),
    身分類別: pick(['身分類別','身份別','資格身分','身分','類別']),
    資格文件URL: pick(['資格文件','附件','上傳檔案','證明文件','檔案上傳']),
    備註: pick(['備註','其他需求','問題','留言'])
  };
}

function GovOpsRegOnline_targetRows(tenantId, data) {
  return GovOpsProduct_readRows(GovOpsRegOnline_sheetName()).filter(function(r) {
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (data.連結ID && String(r.連結ID || '') === String(data.連結ID)) return true;
    var keyword = String(data.keyword || data.關鍵字 || data.招生ID || data.場次ID || '').trim();
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
}

function GovOpsRegOnline_findSetting(tenantId, data) { try { return GovOpsProduct_readRows('85_招生設定').find(function(r) { return String(r.tenantId || '') === String(tenantId) && ((data.招生ID && String(r.招生ID || '') === String(data.招生ID)) || (data.場次ID && String(r.場次ID || '') === String(data.場次ID))); }) || null; } catch(e) { return null; } }
function GovOpsRegOnline_findExisting(tenantId, settingId, url) { try { return GovOpsProduct_readRows(GovOpsRegOnline_sheetName()).find(function(r) { return String(r.tenantId || '') === String(tenantId) && String(r.招生ID || '') === String(settingId || '') && String(r.報名表URL || '') === String(url || ''); }) || null; } catch(e) { return null; } }
function GovOpsRegOnline_findDuplicate(tenantId, settingId, name, phone, email) { try { return GovOpsProduct_readRows('86_報名資料').find(function(r) { return String(r.tenantId || '') === String(tenantId) && String(r.招生ID || '') === String(settingId || '') && String(r.姓名 || '') === String(name || '') && ((phone && String(r.電話 || '') === String(phone)) || (email && String(r.Email || '') === String(email))); }) || null; } catch(e) { return null; } }
function GovOpsRegOnline_log(conn, sourceRow, mapped, result, regId, error, data) { try { GovOpsProduct_append(GovOpsRegOnline_syncLogSheet(), { 同步ID: 'REGSYNC-' + Utilities.getUuid().slice(0, 8), tenantId: conn.tenantId, 連結ID: conn.連結ID, 招生ID: conn.招生ID, 標案ID: conn.標案ID, 場次ID: conn.場次ID, 來源列號: sourceRow, 姓名: mapped.姓名 || '', 電話: mapped.電話 || '', Email: mapped.Email || '', 同步結果: result, 報名ID: regId || '', 錯誤訊息: error || '', 建立時間: GovOpsRegOnline_now(), userId: data.userId || '', 原始資料: JSON.stringify(mapped).slice(0, 10000) }); } catch(e) {} }
function GovOpsRegOnline_audit(eventType, action, data, result, message) { try { if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write(eventType, action, data, result, message); } catch(e){} }
