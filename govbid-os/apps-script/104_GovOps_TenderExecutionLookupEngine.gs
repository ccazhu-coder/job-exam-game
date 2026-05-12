/* GovOps OS｜Tender Execution Lookup Engine v1
 * 目的：標案/場次資料只建立一次，後續履約執行透過下拉選單選擇並自動帶入，減少重複輸入。
 */

function handleGovOpsTenderExecutionLookupAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.executionLookup.tenders' || action === '查詢履約標案選單') return GovOpsTenderExecutionLookup_tenders(data);
    if (action === 'tender.executionLookup.events' || action === '查詢履約場次選單') return GovOpsTenderExecutionLookup_events(data);
    if (action === 'tender.executionLookup.eventDetail' || action === '查詢履約場次明細') return GovOpsTenderExecutionLookup_eventDetail(data);
    if (action === 'tender.executionLookup.options' || action === '查詢履約執行選單') return GovOpsTenderExecutionLookup_options(data);
    return null;
  } catch (err) {
    GovOpsTenderExecutionLookup_logError('handleGovOpsTenderExecutionLookupAction', err, data);
    return GovOpsTenderExecutionLookup_fail('履約執行選單資料暫時無法讀取。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_LOOKUP = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderExecutionLookupAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_LOOKUP(action, data);
  };
}

function GovOpsTenderExecutionLookup_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderExecutionLookup_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }

function GovOpsTenderExecutionLookup_tenders(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || '').trim();
  var rows = [];
  try {
    rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
  } catch (err) { rows = []; }
  rows = rows.filter(function(r){
    if (String(r.tenantId || tenantId) !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
  var options = rows.map(function(r){
    return {
      value: r.標案ID || r.TenderID || r.id || r.標案名稱 || '',
      label: (r.標案名稱 || r.name || r.案名 || '未命名標案') + (r.標案ID ? '｜' + r.標案ID : ''),
      tenderId: r.標案ID || r.TenderID || r.id || '',
      tenderName: r.標案名稱 || r.name || r.案名 || '',
      status: r.標案狀態 || r.狀態 || '',
      raw: r
    };
  }).filter(function(x){ return x.value || x.tenderName; });
  return GovOpsTenderExecutionLookup_success('履約標案選單查詢完成。', { total: options.length, options: options.slice(0, 500) });
}

function GovOpsTenderExecutionLookup_events(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = String(data.標案ID || data.tenderId || '').trim();
  var keyword = String(data.keyword || data.關鍵字 || '').trim();
  var rows = [];
  try { rows = GovOpsProduct_readRows('74_履約活動場次'); } catch (err) { rows = []; }
  rows = rows.filter(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (tenderId && String(r.標案ID || '') !== String(tenderId)) return false;
    if (!keyword) return true;
    return JSON.stringify(r).indexOf(keyword) >= 0;
  });
  var options = rows.map(function(r){
    return {
      value: r.場次ID || '',
      label: (r.活動日期 || '') + '｜' + (r.活動名稱 || '未命名場次') + (r.地點 ? '｜' + r.地點 : ''),
      eventId: r.場次ID || '',
      tenderId: r.標案ID || '',
      tenderName: r.標案名稱 || '',
      eventName: r.活動名稱 || '',
      eventDate: r.活動日期 || '',
      location: r.地點 || '',
      expectedAttendance: r.應出席人數 || r.預計人數 || '',
      actualAttendance: r.實際人數 || '',
      status: r.活動狀態 || '',
      artifactStatus: r.結案資料狀態 || '',
      raw: r
    };
  });
  return GovOpsTenderExecutionLookup_success('履約場次選單查詢完成。', { total: options.length, options: options.slice(0, 500) });
}

function GovOpsTenderExecutionLookup_eventDetail(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var eventId = String(data.場次ID || data.eventId || '').trim();
  if (!eventId) return GovOpsTenderExecutionLookup_fail('請提供場次ID。');
  var rows = [];
  try { rows = GovOpsProduct_readRows('74_履約活動場次'); } catch (err) { rows = []; }
  var event = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.場次ID || '') === String(eventId); });
  if (!event) return GovOpsTenderExecutionLookup_fail('找不到場次資料。');
  return GovOpsTenderExecutionLookup_success('履約場次明細查詢完成。', { event: event });
}

function GovOpsTenderExecutionLookup_options(data) {
  data = data || {};
  var tenders = GovOpsTenderExecutionLookup_tenders(data).data.options || [];
  var tenderId = data.標案ID || data.tenderId || (tenders[0] && tenders[0].tenderId) || '';
  var events = GovOpsTenderExecutionLookup_events(Object.assign({}, data, { 標案ID: tenderId })).data.options || [];
  return GovOpsTenderExecutionLookup_success('履約執行選單查詢完成。', {
    tenders: tenders,
    events: events,
    dataEntryRule: '標案與場次資料只建立一次；後續照片、簽到、滿意度、核銷與結案資料皆使用選單選取，不重複輸入。'
  });
}

function GovOpsTenderExecutionLookup_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderExecutionLookup_Options() { return GovOpsTenderExecutionLookup_options({ tenantId: 'TENANT-DEMO' }); }
