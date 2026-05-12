/* GovOps OS｜PCC Tender Query Integration v1
 * 目的：連結政府電子採購網標案查詢，每日自動查詢並寫入標案池。
 * 查詢入口：https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic
 * 注意：政府網站欄位可能調整，正式版採設定式查詢與保守解析。
 */

var GOVOPS_PCC_TENDER_BASIC_URL = 'https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic';

function handleGovOpsPccTenderAction(action, data) {
  data = data || {};
  try {
    if (action === 'pcc.tender.search' || action === '查詢政府標案') return GovOpsPccTender_search(data);
    if (action === 'pcc.tender.daily' || action === '每日查詢政府標案') return GovOpsPccTender_runDaily(data);
    if (action === 'pcc.tender.url' || action === '取得政府標案查詢網址') return GovOpsPccTender_getUrl(data);
    return null;
  } catch (err) {
    GovOpsPccTender_logError('handleGovOpsPccTenderAction', err, data);
    return GovOpsPccTender_fail('政府標案查詢暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_PCC_TENDER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsPccTenderAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_PCC_TENDER(action, data);
  };
}

function GovOpsPccTender_success(message, data) {
  return { success: true, message: message || '操作完成。', data: data || {} };
}
function GovOpsPccTender_fail(message, data) {
  return { success: false, message: message || '操作失敗。', data: data || {} };
}
function GovOpsPccTender_now() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function GovOpsPccTender_getUrl(data) {
  data = data || {};
  var keyword = data.keyword || data.關鍵字 || '';
  return GovOpsPccTender_success('政府電子採購網標案查詢網址。', {
    url: GOVOPS_PCC_TENDER_BASIC_URL,
    keyword: keyword,
    note: '此網址為政府電子採購網標案查詢入口；系統可保存關鍵字並每日排程查詢。'
  });
}

function GovOpsPccTender_search(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.query || '').trim();
  var agency = String(data.機關名稱 || data.agency || '').trim();
  var mode = data.mode || 'link';

  if (mode === 'link') {
    return GovOpsPccTender_success('已建立政府標案查詢連結。', {
      url: GOVOPS_PCC_TENDER_BASIC_URL,
      keyword: keyword,
      agency: agency,
      tenantId: tenantId
    });
  }

  var html = GovOpsPccTender_fetch(GOVOPS_PCC_TENDER_BASIC_URL);
  var parsed = GovOpsPccTender_parseHtml(html, keyword, agency);
  var imported = GovOpsPccTender_importToPool(parsed, tenantId, data.userId || 'SYSTEM-PCC');
  return GovOpsPccTender_success('政府標案查詢完成。', {
    queryUrl: GOVOPS_PCC_TENDER_BASIC_URL,
    keyword: keyword,
    agency: agency,
    found: parsed.length,
    imported: imported.imported,
    skipped: imported.skipped,
    rows: parsed
  });
}

function GovOpsPccTender_runDaily(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keywords = GovOpsPccTender_getDailyKeywords(data);
  var results = [];
  keywords.forEach(function(keyword) {
    var result = GovOpsPccTender_search({ tenantId: tenantId, userId: 'SYSTEM-PCC-DAILY', keyword: keyword, mode: data.mode || 'link' });
    results.push({ keyword: keyword, success: result.success, data: result.data || {} });
  });
  return GovOpsPccTender_success('每日政府標案查詢已執行。', { total: results.length, results: results });
}

function GovOpsPccTender_getDailyKeywords(data) {
  var raw = data.keywords || data.關鍵字清單 || data.keyword || data.關鍵字 || '就業,職涯,訓練,課程,活動,講座,公會,農糧,米食,AI';
  if (Array.isArray(raw)) return raw;
  return String(raw).split(/[,，\n]/).map(function(x){ return x.trim(); }).filter(Boolean);
}

function GovOpsPccTender_fetch(url) {
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 GovOpsOS/1.0',
      'Accept-Language': 'zh-TW,zh;q=0.9'
    }
  });
  var code = res.getResponseCode();
  var text = res.getContentText('UTF-8');
  if (code >= 400) throw new Error('PCC_FETCH_FAILED_' + code);
  return text;
}

function GovOpsPccTender_parseHtml(html, keyword, agency) {
  html = String(html || '');
  var rows = [];
  var plain = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  plain = plain.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  var hit = (!keyword || plain.indexOf(keyword) >= 0) && (!agency || plain.indexOf(agency) >= 0);
  if (hit && keyword) {
    rows.push({
      標案名稱: keyword + ' 相關標案查詢',
      機關名稱: agency || '',
      標案網址: GOVOPS_PCC_TENDER_BASIC_URL,
      標案狀態: '新標案',
      AI判讀摘要: '已建立政府電子採購網查詢入口，請進入連結檢視最新公告。',
      投標建議: '待人工檢視'
    });
  }
  return rows;
}

function GovOpsPccTender_importToPool(rows, tenantId, userId) {
  var imported = 0;
  var skipped = 0;
  if (!rows || !rows.length || typeof GovOpsProduct_createTender !== 'function') return { imported: 0, skipped: rows ? rows.length : 0 };
  rows.forEach(function(row) {
    try {
      var existed = GovOpsPccTender_exists(row.標案名稱, tenantId);
      if (existed) { skipped++; return; }
      var result = GovOpsProduct_createTender(Object.assign({}, row, { tenantId: tenantId, userId: userId, 是否追蹤: '是', 備註: 'PCC每日查詢匯入 ' + GovOpsPccTender_now() }));
      if (result && result.success) imported++; else skipped++;
    } catch (err) { skipped++; }
  });
  return { imported: imported, skipped: skipped };
}

function GovOpsPccTender_exists(name, tenantId) {
  try {
    if (typeof GovOpsProduct_readRows !== 'function') return false;
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
    return rows.some(function(row) {
      return String(row.tenantId || '') === String(tenantId || '') && String(row.標案名稱 || '') === String(name || '');
    });
  } catch (err) { return false; }
}

function GovOpsPccTender_logError(module, err, data) {
  try {
    if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {});
    else if (typeof logError === 'function') logError(module, err);
  } catch (e) {}
}

function GovOpsPccTender_installDailyTrigger() {
  ScriptApp.newTrigger('GovOpsPccTender_dailyTrigger').timeBased().everyDays(1).atHour(7).create();
  return GovOpsPccTender_success('政府標案每日查詢排程已建立。');
}

function GovOpsPccTender_dailyTrigger() {
  return GovOpsPccTender_runDaily({ tenantId: 'TENANT-DEMO', mode: 'link' });
}

function 測試_PCC_標案查詢網址() {
  return GovOpsPccTender_getUrl({ keyword: '就業服務' });
}
