/* GovOps OS｜Tender Closing Report Generator v1
 * 目的：整合驗收同步、結案檢查清單、檢討建議、履約時程與財務核銷資料，產生正式結案報告草稿。
 */

function handleGovOpsTenderClosingReportGeneratorAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.closingReport.generate' || action === '產生標案結案報告') return GovOpsTenderClosingReport_generate(data);
    if (action === 'tender.closingReport.query' || action === '查詢標案結案報告') return GovOpsTenderClosingReport_query(data);
    return null;
  } catch (err) {
    GovOpsTenderClosingReport_logError('handleGovOpsTenderClosingReportGeneratorAction', err, data);
    return GovOpsTenderClosingReport_fail('標案結案報告生成暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_REPORT_GENERATOR = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderClosingReportGeneratorAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_REPORT_GENERATOR(action, data);
  };
}

function GovOpsTenderClosingReport_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderClosingReport_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderClosingReport_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderClosingReport_sheetName() { return '67_標案結案報告草稿'; }

function GovOpsTenderClosingReport_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderClosingReport_sheetName(), ['報告ID','tenantId','標案ID','標案名稱','報告版本','報告狀態','報告內容','缺件提醒','資料來源摘要','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderClosingReport_generate(data) {
  data = data || {};
  GovOpsTenderClosingReport_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var tender = GovOpsTenderClosingReport_findTender(tenantId, data.標案ID || data.tenderId || '', keyword) || {};
  var tenderId = data.標案ID || data.tenderId || tender.標案ID || keyword || '';
  var title = data.標案名稱 || tender.標案名稱 || keyword || '未命名標案';
  var sources = GovOpsTenderClosingReport_sources(tenantId, tenderId || title);
  var content = GovOpsTenderClosingReport_buildContent(title, sources, data);
  var missing = GovOpsTenderClosingReport_missing(sources);
  var row = {
    報告ID: 'TCRPT-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    報告版本: data.報告版本 || 'v1',
    報告狀態: missing ? '草稿-待補資料' : '草稿-可審閱',
    報告內容: content,
    缺件提醒: missing || '目前未偵測到重大缺件，仍需人工確認原始驗收要求。',
    資料來源摘要: GovOpsTenderClosingReport_sourceSummary(sources),
    建立時間: GovOpsTenderClosingReport_now(),
    更新時間: GovOpsTenderClosingReport_now(),
    userId: data.userId || '',
    備註: '可直接複製到 Word 後再依機關格式調整。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderClosingReport_sheetName(), row);
  return GovOpsTenderClosingReport_success('標案結案報告草稿已產生。', row);
}

function GovOpsTenderClosingReport_query(data) {
  data = data || {};
  GovOpsTenderClosingReport_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderClosingReport_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderClosingReport_success('標案結案報告草稿查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderClosingReport_buildContent(title, sources, data) {
  var sync = sources.acceptanceClosing[0] || {};
  var checklist = sources.checklist || [];
  var reviewRows = sources.review || [];
  var timeline = sources.timeline || [];
  var finance = sources.finance[0] || {};
  var reviewSection = GovOpsTenderClosingReport_reviewText(reviewRows);
  return [
    title + ' 結案報告',
    '',
    '一、計畫概述',
    '本案依契約及工作需求完成相關執行作業，並依驗收條件彙整成果資料、執行紀錄、佐證文件與核銷附件。本報告依據系統內之驗收條款、履約時程、結案檢查清單及檢討建議資料彙整產出。',
    '',
    '二、執行內容與期程',
    GovOpsTenderClosingReport_timelineText(timeline),
    '',
    '三、量化成果統計',
    '本案成果數據包含服務人次、場次、完成率、滿意度、成果產出及其他契約要求之量化指標。' + (sync.成果數據需求 ? '\n成果數據需求：' + sync.成果數據需求 : '\n待補：請依實際執行資料補入量化成果。'),
    '',
    '四、成果照片與佐證資料',
    sync.必要佐證資料 || '待補：成果照片、簽到表、名冊、活動紀錄、問卷統計等。',
    '',
    '五、經費執行與核銷',
    GovOpsTenderClosingReport_financeText(finance, sync),
    '',
    '六、驗收對照表',
    '驗收條款摘要：' + (sync.驗收條款摘要 || '待補'),
    '\n結案資料檢查：\n' + GovOpsTenderClosingReport_checklistText(checklist),
    '',
    reviewSection,
    '',
    '八、附件清單',
    GovOpsTenderClosingReport_attachmentText(checklist, sync)
  ].join('\n');
}

function GovOpsTenderClosingReport_timelineText(rows) {
  if (!rows || !rows.length) return '待補：尚未建立履約時程資料。';
  return rows.slice(0, 20).map(function(r){ return '- ' + (r.時程類型 || '') + '｜' + (r.階段名稱 || '') + '｜' + (r.截止日 || r.相對期限 || '待補日期') + '｜風險：' + (r.逾期風險 || '無'); }).join('\n');
}

function GovOpsTenderClosingReport_financeText(finance, sync) {
  var lines = [];
  lines.push(sync.核銷附件需求 || '核銷附件需求待確認。');
  if (finance && Object.keys(finance).length) {
    lines.push('財務摘要：簽約金額 ' + (finance.簽約金額 || '-') + '，可請款金額 ' + (finance.可請款金額 || '-') + '，未收款 ' + (finance.未收款 || '-') + '。');
  } else {
    lines.push('待補：尚未建立財務摘要或請款資料。');
  }
  return lines.join('\n');
}

function GovOpsTenderClosingReport_checklistText(rows) {
  if (!rows || !rows.length) return '待補：尚未產生結案報告檢查清單。';
  return rows.slice(0, 30).map(function(r){ return '- [' + (r.資料狀態 || '待準備') + '] ' + (r.資料類型 || '') + '｜' + (r.檢查項目 || '') + '｜必要性：' + (r.必要性 || '') + '｜風險：' + (r.缺件風險 || ''); }).join('\n');
}

function GovOpsTenderClosingReport_reviewText(rows) {
  if (!rows || !rows.length) return '七、檢討與改進建議\n本案尚未產生檢討建議資料，建議先執行「產生結案檢討建議」。';
  var text = '七、檢討與改進建議\n';
  rows.slice(0, 20).forEach(function(r, i){
    text += '\n' + (i + 1) + '. ' + (r.檢討類型 || '檢討事項') + '\n';
    text += '問題摘要：' + (r.問題摘要 || '') + '\n';
    text += '原因分析：' + (r.原因分析 || '') + '\n';
    text += '改善建議：' + (r.改善建議 || '') + '\n';
    text += '後續追蹤：' + (r.後續追蹤事項 || '') + '\n';
  });
  return text;
}

function GovOpsTenderClosingReport_attachmentText(checklist, sync) {
  var items = [];
  if (sync.必要佐證資料) items = items.concat(String(sync.必要佐證資料).split('、'));
  (checklist || []).forEach(function(r){ if (r.檢查項目) items.push(r.檢查項目); });
  var seen = {};
  items = items.map(function(x){ return String(x || '').trim(); }).filter(function(x){ if (!x || seen[x]) return false; seen[x] = true; return true; });
  return items.length ? items.map(function(x){ return '- ' + x; }).join('\n') : '待補：請依機關要求附上成果照片、簽到表、經費憑證、驗收文件。';
}

function GovOpsTenderClosingReport_missing(sources) {
  var missing = [];
  if (!sources.acceptanceClosing.length) missing.push('尚未同步驗收結案報告');
  if (!sources.checklist.length) missing.push('尚未建立結案報告檢查清單');
  if (!sources.review.length) missing.push('尚未產生檢討建議');
  if (!sources.timeline.length) missing.push('尚未建立履約時程');
  return missing.join('；');
}

function GovOpsTenderClosingReport_sourceSummary(sources) {
  return '驗收同步 ' + sources.acceptanceClosing.length + ' 筆；檢查清單 ' + sources.checklist.length + ' 筆；檢討建議 ' + sources.review.length + ' 筆；履約時程 ' + sources.timeline.length + ' 筆；財務摘要 ' + sources.finance.length + ' 筆。';
}

function GovOpsTenderClosingReport_sources(tenantId, keyword) {
  return {
    acceptanceClosing: GovOpsTenderClosingReport_read('64_標案驗收結案報告同步', tenantId, keyword),
    checklist: GovOpsTenderClosingReport_read('65_標案結案報告檢查清單', tenantId, keyword),
    review: GovOpsTenderClosingReport_read('66_標案結案檢討建議', tenantId, keyword),
    timeline: GovOpsTenderClosingReport_read('59_標案履約時程', tenantId, keyword),
    finance: GovOpsTenderClosingReport_read('38_標案財務摘要', tenantId, keyword)
  };
}

function GovOpsTenderClosingReport_read(sheetName, tenantId, keyword) {
  try {
    return GovOpsProduct_readRows(sheetName).filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (!keyword) return true;
      return JSON.stringify(row).indexOf(keyword) >= 0;
    }).slice(0, 200);
  } catch (err) { return []; }
}

function GovOpsTenderClosingReport_findTender(tenantId, tenderId, keyword) {
  try {
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池').filter(function(r){ return String(r.tenantId || '') === String(tenantId); });
    if (tenderId) { var byId = rows.find(function(r){ return String(r.標案ID || '') === String(tenderId); }); if (byId) return byId; }
    if (keyword) return rows.find(function(r){ return JSON.stringify(r).indexOf(keyword) >= 0; }) || null;
  } catch (err) {}
  return null;
}

function GovOpsTenderClosingReport_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderClosingReport_Generate() { return GovOpsTenderClosingReport_generate({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案' }); }
