/* GovOps OS｜Tender Risk Engine v1
 * 目的：整合財務、競爭、履約、資格、時程、文件缺件，形成標案風險雷達。
 */

function handleGovOpsTenderRiskAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.risk.analyze' || action === '標案風險分析') return GovOpsTenderRisk_analyze(data);
    if (action === 'tender.risk.query' || action === '查詢標案風險') return GovOpsTenderRisk_query(data);
    return null;
  } catch (err) {
    GovOpsTenderRisk_logError('handleGovOpsTenderRiskAction', err, data);
    return GovOpsTenderRisk_fail('標案風險分析暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_RISK = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderRiskAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_RISK(action, data);
  };
}

function GovOpsTenderRisk_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderRisk_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderRisk_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderRisk_sheetName() { return '43_標案風險分析'; }
function GovOpsTenderRisk_num(v) { return Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0; }

function GovOpsTenderRisk_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderRisk_sheetName(), ['風險ID','tenantId','標案ID','標案名稱','總風險分數','風險等級','財務風險','競爭風險','時程風險','任務風險','文件風險','履約風險','主要風險摘要','風險處理建議','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderRisk_analyze(data) {
  data = data || {};
  GovOpsTenderRisk_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var keyword = data.keyword || data.關鍵字 || tenderId || data.標案名稱 || '';
  var tender = GovOpsTenderRisk_findTender(tenantId, tenderId, keyword) || {};
  var title = data.標案名稱 || tender.標案名稱 || keyword;
  var finance = GovOpsTenderRisk_latest('38_標案財務摘要', tenantId, tenderId, title);
  var competition = GovOpsTenderRisk_latest('40_標案競爭分析', tenantId, tenderId, title);
  var tasks = GovOpsTenderRisk_tasks(tenantId, tenderId, title);
  var financialRisk = GovOpsTenderRisk_financial(finance);
  var competitionRisk = GovOpsTenderRisk_competition(competition);
  var taskRisk = GovOpsTenderRisk_task(tasks);
  var scheduleRisk = GovOpsTenderRisk_schedule(tender);
  var documentRisk = GovOpsTenderRisk_document(tasks, finance);
  var deliveryRisk = GovOpsTenderRisk_delivery(tender, tasks);
  var total = Math.round(financialRisk.score * 0.25 + competitionRisk.score * 0.2 + scheduleRisk.score * 0.15 + taskRisk.score * 0.15 + documentRisk.score * 0.15 + deliveryRisk.score * 0.1);
  var row = {
    風險ID: 'TRK-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId || tender.標案ID || '',
    標案名稱: title,
    總風險分數: total,
    風險等級: total >= 70 ? '高' : total >= 40 ? '中' : '低',
    財務風險: financialRisk.text,
    競爭風險: competitionRisk.text,
    時程風險: scheduleRisk.text,
    任務風險: taskRisk.text,
    文件風險: documentRisk.text,
    履約風險: deliveryRisk.text,
    主要風險摘要: GovOpsTenderRisk_summary([financialRisk, competitionRisk, scheduleRisk, taskRisk, documentRisk, deliveryRisk]),
    風險處理建議: GovOpsTenderRisk_action(total),
    建立時間: GovOpsTenderRisk_now(),
    更新時間: GovOpsTenderRisk_now(),
    userId: data.userId || '',
    備註: '風險結果為輔助判斷，仍需人工檢視招標文件與契約條款。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderRisk_sheetName(), row);
  GovOpsTenderRisk_writeBackTender(row.標案ID, tenantId, row);
  return GovOpsTenderRisk_success('標案風險分析完成。', row);
}

function GovOpsTenderRisk_query(data) {
  data = data || {};
  GovOpsTenderRisk_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderRisk_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderRisk_success('標案風險查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderRisk_financial(finance) {
  var margin = GovOpsTenderRisk_num(finance.毛利率);
  var missing = GovOpsTenderRisk_num(finance.缺憑證數);
  var uncollected = GovOpsTenderRisk_num(finance.未收款金額);
  var score = 15;
  var text = [];
  if (margin && margin < 15) { score += 35; text.push('毛利率偏低'); }
  if (missing > 0) { score += 20; text.push('存在缺憑證'); }
  if (uncollected > 0) { score += 15; text.push('仍有未收款'); }
  return { score: Math.min(100, score), text: text.join('、') || '財務風險低' };
}

function GovOpsTenderRisk_competition(c) {
  var high = c.競爭強度 === '高';
  return { score: high ? 80 : c.競爭強度 === '中' ? 50 : 25, text: c.競爭風險 || (high ? '競爭強度高' : '競爭風險可控') };
}

function GovOpsTenderRisk_task(tasks) {
  var open = tasks.filter(function(t){ return ['待執行','進行中','異常'].indexOf(String(t.任務狀態 || '')) >= 0; }).length;
  var abnormal = tasks.filter(function(t){ return String(t.任務狀態 || '') === '異常'; }).length;
  var score = Math.min(100, open * 8 + abnormal * 25);
  return { score: score, text: open ? '尚有待處理任務 ' + open + ' 項' : '任務風險低' };
}

function GovOpsTenderRisk_schedule(tender) {
  var deadline = tender.截止投標日 || tender.開標日期 || '';
  if (!deadline) return { score: 35, text: '缺少截止或開標日期' };
  var d = new Date(String(deadline).replace(/-/g, '/'));
  if (isNaN(d.getTime())) return { score: 40, text: '日期格式需檢查' };
  var days = Math.ceil((d.getTime() - new Date().getTime()) / 86400000);
  if (days < 0) return { score: 85, text: '期限已過' };
  if (days <= 3) return { score: 75, text: '距離期限少於3天' };
  if (days <= 7) return { score: 50, text: '距離期限少於7天' };
  return { score: 20, text: '時程風險低' };
}

function GovOpsTenderRisk_document(tasks, finance) {
  var missing = GovOpsTenderRisk_num(finance.缺憑證數);
  var docTasks = tasks.filter(function(t){ return String(t.任務名稱 || '').match(/文件|附件|憑證|用印|簽到|照片|領據/); });
  var openDocs = docTasks.filter(function(t){ return String(t.任務狀態 || '') !== '已完成'; }).length;
  var score = Math.min(100, missing * 15 + openDocs * 15);
  return { score: score, text: score ? '文件或憑證仍需補強' : '文件風險低' };
}

function GovOpsTenderRisk_delivery(tender, tasks) {
  var deliveryTasks = tasks.filter(function(t){ return String(t.任務階段 || '').indexOf('履約') >= 0; }).length;
  if (String(tender.標案狀態 || '').indexOf('履約') >= 0 && deliveryTasks === 0) return { score: 70, text: '履約中但尚未建立履約任務' };
  return { score: 25, text: '履約風險可控' };
}

function GovOpsTenderRisk_summary(items) {
  return items.filter(function(x){ return x.score >= 50; }).map(function(x){ return x.text; }).join('；') || '目前無重大風險。';
}

function GovOpsTenderRisk_action(total) {
  if (total >= 70) return '暫停投標或立即進行風險處理會議，先補齊資格、文件、成本與時程控管。';
  if (total >= 40) return '可續行，但需建立補強任務與負責人，追蹤財務、文件與時程風險。';
  return '風險可控，可持續推進投標或履約作業。';
}

function GovOpsTenderRisk_findTender(tenantId, tenderId, keyword) {
  try {
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池').filter(function(r){ return String(r.tenantId || '') === String(tenantId); });
    if (tenderId) {
      var byId = rows.find(function(r){ return String(r.標案ID || '') === String(tenderId); });
      if (byId) return byId;
    }
    if (keyword) return rows.find(function(r){ return JSON.stringify(r).indexOf(keyword) >= 0; }) || null;
    return null;
  } catch (err) { return null; }
}

function GovOpsTenderRisk_latest(sheetName, tenantId, tenderId, title) {
  try {
    var rows = GovOpsProduct_readRows(sheetName).filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (tenderId && String(row.標案ID || '') === String(tenderId)) return true;
      if (title && String(row.標案名稱 || '') === String(title)) return true;
      return false;
    });
    return rows[rows.length - 1] || {};
  } catch (err) { return {}; }
}

function GovOpsTenderRisk_tasks(tenantId, tenderId, title) {
  try {
    return GovOpsProduct_readRows('33_標案工作任務').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (tenderId && String(row.標案ID || '') === String(tenderId)) return true;
      if (title && String(row.標案名稱 || '') === String(title)) return true;
      return false;
    });
  } catch (err) { return []; }
}

function GovOpsTenderRisk_writeBackTender(tenderId, tenantId, row) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
    if (found) GovOpsProduct_update(sheetName, found._row, { AI判讀摘要: '風險等級：' + row.風險等級 + '｜' + row.主要風險摘要, 更新時間: GovOpsTenderRisk_now() });
  } catch (err) {}
}

function GovOpsTenderRisk_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderRisk_Analyze() { return GovOpsTenderRisk_analyze({ tenantId: 'TENANT-DEMO', 標案名稱: '中高齡就業促進課程計畫' }); }
