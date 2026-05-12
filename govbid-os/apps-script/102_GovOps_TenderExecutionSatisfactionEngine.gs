/* GovOps OS｜Tender Execution Satisfaction Engine v1
 * 目的：管理每個履約場次的滿意度資料，支援紙本問卷、Google表單、其他線上問卷，並同步 KPI 與結案報告。
 */

function handleGovOpsTenderExecutionSatisfactionAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.executionSatisfaction.create' || action === '建立場次滿意度') return GovOpsTenderExecutionSatisfaction_create(data);
    if (action === 'tender.executionSatisfaction.query' || action === '查詢場次滿意度') return GovOpsTenderExecutionSatisfaction_query(data);
    if (action === 'tender.executionSatisfaction.update' || action === '更新場次滿意度') return GovOpsTenderExecutionSatisfaction_update(data);
    if (action === 'tender.executionSatisfaction.summary' || action === '場次滿意度統計') return GovOpsTenderExecutionSatisfaction_summary(data);
    if (action === 'tender.executionSatisfaction.syncClosing' || action === '同步滿意度到結案') return GovOpsTenderExecutionSatisfaction_syncClosing(data);
    return null;
  } catch (err) {
    GovOpsTenderExecutionSatisfaction_logError('handleGovOpsTenderExecutionSatisfactionAction', err, data);
    return GovOpsTenderExecutionSatisfaction_fail('場次滿意度管理功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_SATISFACTION = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderExecutionSatisfactionAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_EXECUTION_SATISFACTION(action, data);
  };
}

function GovOpsTenderExecutionSatisfaction_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderExecutionSatisfaction_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderExecutionSatisfaction_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderExecutionSatisfaction_sheetName() { return '76_履約場次滿意度'; }

function GovOpsTenderExecutionSatisfaction_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderExecutionSatisfaction_sheetName(), ['滿意度ID','tenantId','標案ID','標案名稱','場次ID','活動名稱','活動日期','問卷方式','問卷工具','問卷連結','紙本附件ID','線上回覆試算表ID','回收份數','有效份數','平均分數','滿意度百分比','是否達標','達標標準','優點摘要','改善建議','原始資料狀態','同步狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderExecutionSatisfaction_create(data) {
  data = data || {};
  GovOpsTenderExecutionSatisfaction_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var event = GovOpsTenderExecutionSatisfaction_findEvent(tenantId, data) || {};
  var mode = data.問卷方式 || data.mode || GovOpsTenderExecutionSatisfaction_guessMode(data);
  var valid = Number(data.有效份數 || data.validResponses || data.回收份數 || data.responses || 0);
  var collected = Number(data.回收份數 || data.responses || valid || 0);
  var avg = GovOpsTenderExecutionSatisfaction_score(data);
  var percent = GovOpsTenderExecutionSatisfaction_percent(avg, data.滿分 || data.maxScore || 5);
  var standard = Number(data.達標標準 || data.targetPercent || 80);
  var row = {
    滿意度ID: 'TES-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: data.標案ID || data.tenderId || event.標案ID || '',
    標案名稱: data.標案名稱 || event.標案名稱 || '',
    場次ID: data.場次ID || data.eventId || event.場次ID || '',
    活動名稱: data.活動名稱 || data.eventName || event.活動名稱 || '',
    活動日期: data.活動日期 || data.eventDate || event.活動日期 || '',
    問卷方式: mode,
    問卷工具: data.問卷工具 || data.tool || GovOpsTenderExecutionSatisfaction_tool(mode, data),
    問卷連結: data.問卷連結 || data.surveyUrl || '',
    紙本附件ID: data.紙本附件ID || data.paperArtifactId || '',
    線上回覆試算表ID: data.線上回覆試算表ID || data.responseSheetId || '',
    回收份數: collected,
    有效份數: valid,
    平均分數: avg,
    滿意度百分比: percent + '%',
    是否達標: percent >= standard ? '是' : '否',
    達標標準: standard + '%',
    優點摘要: data.優點摘要 || data.strengths || '待彙整',
    改善建議: data.改善建議 || data.suggestions || '待彙整',
    原始資料狀態: data.原始資料狀態 || (mode === '紙本問卷' ? '紙本已建檔/待OCR' : '線上資料已連結'),
    同步狀態: '已建立',
    建立時間: GovOpsTenderExecutionSatisfaction_now(),
    更新時間: GovOpsTenderExecutionSatisfaction_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (GovOpsTenderExecutionSatisfaction_exists(tenantId, row.場次ID, row.標案ID, row.問卷方式)) return GovOpsTenderExecutionSatisfaction_update(Object.assign({}, data, { 場次ID: row.場次ID, 標案ID: row.標案ID }));
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderExecutionSatisfaction_sheetName(), row);
  GovOpsTenderExecutionSatisfaction_updateEvent(row);
  GovOpsTenderExecutionSatisfaction_syncClosing({ tenantId: tenantId, 標案ID: row.標案ID, 場次ID: row.場次ID, userId: data.userId || '' });
  return GovOpsTenderExecutionSatisfaction_success('場次滿意度已建立。', row);
}

function GovOpsTenderExecutionSatisfaction_update(data) {
  data = data || {};
  GovOpsTenderExecutionSatisfaction_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.滿意度ID || data.satisfactionId || '';
  var rows = GovOpsProduct_readRows(GovOpsTenderExecutionSatisfaction_sheetName());
  var found = rows.find(function(r){
    if (String(r.tenantId || '') !== String(tenantId)) return false;
    if (id && String(r.滿意度ID || '') === String(id)) return true;
    return String(r.場次ID || '') === String(data.場次ID || data.eventId || '') && String(r.標案ID || '') === String(data.標案ID || data.tenderId || '');
  });
  if (!found) return GovOpsTenderExecutionSatisfaction_fail('找不到場次滿意度資料。');
  var patch = { 更新時間: GovOpsTenderExecutionSatisfaction_now() };
  ['問卷方式','問卷工具','問卷連結','紙本附件ID','線上回覆試算表ID','回收份數','有效份數','平均分數','滿意度百分比','是否達標','達標標準','優點摘要','改善建議','原始資料狀態','同步狀態','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = data[k]; });
  if (data.responses !== undefined) patch.回收份數 = Number(data.responses || 0);
  if (data.validResponses !== undefined) patch.有效份數 = Number(data.validResponses || 0);
  if (data.averageScore !== undefined || data.平均分數 !== undefined) {
    var avg = GovOpsTenderExecutionSatisfaction_score(data);
    var percent = GovOpsTenderExecutionSatisfaction_percent(avg, data.滿分 || data.maxScore || 5);
    var standard = Number(data.達標標準 || data.targetPercent || String(found.達標標準 || '80').replace('%','') || 80);
    patch.平均分數 = avg;
    patch.滿意度百分比 = percent + '%';
    patch.是否達標 = percent >= standard ? '是' : '否';
  }
  GovOpsProduct_update(GovOpsTenderExecutionSatisfaction_sheetName(), found._row, patch);
  return GovOpsTenderExecutionSatisfaction_success('場次滿意度已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderExecutionSatisfaction_query(data) {
  data = data || {};
  GovOpsTenderExecutionSatisfaction_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || data.場次ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderExecutionSatisfaction_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderExecutionSatisfaction_success('場次滿意度查詢完成。', { total: rows.length, summary: GovOpsTenderExecutionSatisfaction_count(rows), rows: rows.slice(0, 500) });
}

function GovOpsTenderExecutionSatisfaction_summary(data) {
  var q = GovOpsTenderExecutionSatisfaction_query(data);
  return GovOpsTenderExecutionSatisfaction_success('場次滿意度統計完成。', q.data.summary || {});
}

function GovOpsTenderExecutionSatisfaction_syncClosing(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var q = GovOpsTenderExecutionSatisfaction_query({ tenantId: tenantId, keyword: data.場次ID || data.eventId || data.標案ID || data.tenderId || data.keyword || '' });
  var rows = q.data.rows || [];
  if (!rows.length) return GovOpsTenderExecutionSatisfaction_fail('找不到可同步的滿意度資料。');
  var text = GovOpsTenderExecutionSatisfaction_reportText(rows);
  try {
    var drafts = GovOpsProduct_readRows('67_標案結案報告草稿').filter(function(r){ return String(r.tenantId || '') === String(tenantId) && (!data.標案ID || String(r.標案ID || '') === String(data.標案ID)); });
    if (drafts.length) {
      var draft = drafts[drafts.length - 1];
      GovOpsProduct_update('67_標案結案報告草稿', draft._row, { 報告內容: String(draft.報告內容 || '') + '\n\n【滿意度統計】\n' + text, 更新時間: GovOpsTenderExecutionSatisfaction_now(), 備註: '已同步滿意度統計。' });
    }
  } catch (err) {}
  return GovOpsTenderExecutionSatisfaction_success('滿意度統計已同步到結案資料。', { rows: rows.length, summary: q.data.summary, reportText: text });
}

function GovOpsTenderExecutionSatisfaction_updateEvent(row) {
  try {
    if (typeof GovOpsTenderExecutionEvent_update === 'function') {
      GovOpsTenderExecutionEvent_update({ tenantId: row.tenantId, 場次ID: row.場次ID, 標案ID: row.標案ID, 活動日期: row.活動日期, 活動名稱: row.活動名稱, 滿意度狀態: '已登錄', 備註: '滿意度：' + row.滿意度百分比 + '；是否達標：' + row.是否達標 });
    }
  } catch (err) {}
}

function GovOpsTenderExecutionSatisfaction_findEvent(tenantId, data) {
  try {
    var rows = GovOpsProduct_readRows('74_履約活動場次').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (data.場次ID && String(row.場次ID || '') === String(data.場次ID)) return true;
      if (data.eventId && String(row.場次ID || '') === String(data.eventId)) return true;
      return String(row.標案ID || '') === String(data.標案ID || data.tenderId || '') && String(row.活動日期 || '') === String(data.活動日期 || data.eventDate || '') && String(row.活動名稱 || '') === String(data.活動名稱 || data.eventName || '');
    });
    return rows[0] || null;
  } catch (err) { return null; }
}

function GovOpsTenderExecutionSatisfaction_guessMode(data) {
  var text = JSON.stringify(data || '');
  if (/google|forms|表單|線上|url|http|試算表/.test(text.toLowerCase())) return '線上問卷';
  if (/紙本|掃描|附件|pdf|jpg|png/.test(text.toLowerCase())) return '紙本問卷';
  return '待確認';
}

function GovOpsTenderExecutionSatisfaction_tool(mode, data) {
  if (mode === '線上問卷') return data.問卷工具 || 'Google表單/線上問卷';
  if (mode === '紙本問卷') return '紙本問卷';
  return '待確認';
}

function GovOpsTenderExecutionSatisfaction_score(data) {
  return Number(data.平均分數 || data.averageScore || data.score || 0);
}

function GovOpsTenderExecutionSatisfaction_percent(avg, maxScore) {
  avg = Number(avg || 0); maxScore = Number(maxScore || 5);
  return maxScore > 0 ? Math.round((avg / maxScore) * 10000) / 100 : 0;
}

function GovOpsTenderExecutionSatisfaction_count(rows) {
  var out = { totalEvents: rows.length, paperCount: 0, onlineCount: 0, responseTotal: 0, validTotal: 0, averageScore: 0, averageSatisfactionPercent: '0%', passedEvents: 0, failedEvents: 0 };
  var scoreSum = 0, scoreCount = 0, pctSum = 0, pctCount = 0;
  rows.forEach(function(r){
    if (String(r.問卷方式 || '') === '紙本問卷') out.paperCount++;
    if (String(r.問卷方式 || '') === '線上問卷') out.onlineCount++;
    out.responseTotal += Number(r.回收份數 || 0);
    out.validTotal += Number(r.有效份數 || 0);
    var score = Number(r.平均分數 || 0); if (score > 0) { scoreSum += score; scoreCount++; }
    var pct = Number(String(r.滿意度百分比 || '0').replace('%','')); if (pct > 0) { pctSum += pct; pctCount++; }
    if (String(r.是否達標 || '') === '是') out.passedEvents++;
    if (String(r.是否達標 || '') === '否') out.failedEvents++;
  });
  out.averageScore = scoreCount ? Math.round((scoreSum / scoreCount) * 100) / 100 : 0;
  out.averageSatisfactionPercent = pctCount ? (Math.round((pctSum / pctCount) * 100) / 100) + '%' : '0%';
  return out;
}

function GovOpsTenderExecutionSatisfaction_reportText(rows) {
  var s = GovOpsTenderExecutionSatisfaction_count(rows);
  var lines = [];
  lines.push('本案滿意度統計：共回收 ' + s.responseTotal + ' 份問卷，有效問卷 ' + s.validTotal + ' 份，平均分數 ' + s.averageScore + '，平均滿意度 ' + s.averageSatisfactionPercent + '。');
  lines.push('問卷來源：紙本問卷 ' + s.paperCount + ' 場，線上問卷 ' + s.onlineCount + ' 場。');
  rows.forEach(function(r){ lines.push('- ' + (r.活動日期 || '') + '｜' + (r.活動名稱 || '') + '｜方式：' + (r.問卷方式 || '') + '｜回收 ' + (r.回收份數 || 0) + ' 份｜平均 ' + (r.平均分數 || 0) + '｜滿意度 ' + (r.滿意度百分比 || '0%') + '｜是否達標：' + (r.是否達標 || '待確認')); });
  return lines.join('\n');
}

function GovOpsTenderExecutionSatisfaction_exists(tenantId, eventId, tenderId, mode) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderExecutionSatisfaction_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId || '') && String(r.場次ID || '') === String(eventId || '') && String(r.問卷方式 || '') === String(mode || ''); });
  } catch (err) { return false; }
}

function GovOpsTenderExecutionSatisfaction_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderExecutionSatisfaction_Create() { return GovOpsTenderExecutionSatisfaction_create({ tenantId: 'TENANT-DEMO', 標案ID: 'TEST', 活動名稱: '測試課程', 活動日期: '2026/01/01', 問卷方式: '線上問卷', 回收份數: 30, 有效份數: 28, 平均分數: 4.6 }); }
