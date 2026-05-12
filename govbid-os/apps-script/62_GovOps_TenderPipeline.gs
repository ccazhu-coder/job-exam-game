/* GovOps OS｜Tender Pipeline v1
 * 目的：建立標案從發現、評估、備標、投標、得標到履約的流程追蹤。
 */

function handleGovOpsTenderPipelineAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.pipeline.create' || action === '建立標案流程') return GovOpsTenderPipeline_create(data);
    if (action === 'tender.pipeline.update' || action === '更新標案流程') return GovOpsTenderPipeline_update(data);
    if (action === 'tender.pipeline.query' || action === '查詢標案流程') return GovOpsTenderPipeline_query(data);
    if (action === 'tender.pipeline.next' || action === '標案流程下一步') return GovOpsTenderPipeline_next(data);
    return null;
  } catch (err) {
    GovOpsTenderPipeline_logError('handleGovOpsTenderPipelineAction', err, data);
    return GovOpsTenderPipeline_fail('標案流程功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_PIPELINE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderPipelineAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_PIPELINE(action, data);
  };
}

function GovOpsTenderPipeline_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderPipeline_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderPipeline_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderPipeline_sheetName() { return '32_標案流程追蹤'; }

function GovOpsTenderPipeline_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderPipeline_sheetName(), ['流程ID','tenantId','標案ID','標案名稱','機關名稱','目前階段','流程狀態','負責人','截止投標日','開標日期','下一步行動','下一步期限','完成率','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderPipeline_stages() {
  return ['發現標案','評估中','決定投標','備標中','已投標','開標等待','已得標','未得標','履約中','已結案'];
}

function GovOpsTenderPipeline_create(data) {
  data = data || {};
  GovOpsTenderPipeline_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var tender = GovOpsTenderPipeline_findTender(tenderId, tenantId) || {};
  var title = data.標案名稱 || tender.標案名稱 || '';
  if (!title && !tenderId) return GovOpsTenderPipeline_fail('請提供標案ID或標案名稱。');
  var existed = GovOpsTenderPipeline_findPipeline(tenderId, tenantId);
  if (existed) return GovOpsTenderPipeline_success('標案流程已存在。', existed);
  var row = {
    流程ID: 'TPL-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    機關名稱: data.機關名稱 || tender.機關名稱 || '',
    目前階段: data.目前階段 || '發現標案',
    流程狀態: data.流程狀態 || '進行中',
    負責人: data.負責人 || data.userId || '',
    截止投標日: data.截止投標日 || tender.截止投標日 || '',
    開標日期: data.開標日期 || tender.開標日期 || '',
    下一步行動: data.下一步行動 || '完成標案初步評估',
    下一步期限: data.下一步期限 || data.截止投標日 || tender.截止投標日 || '',
    完成率: GovOpsTenderPipeline_progress('發現標案'),
    建立時間: GovOpsTenderPipeline_now(),
    更新時間: GovOpsTenderPipeline_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderPipeline_sheetName(), row);
  return GovOpsTenderPipeline_success('標案流程已建立。', row);
}

function GovOpsTenderPipeline_update(data) {
  data = data || {};
  GovOpsTenderPipeline_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var found = GovOpsTenderPipeline_findPipeline(data.標案ID || data.tenderId || '', tenantId, data.流程ID || data.pipelineId || '');
  if (!found) return GovOpsTenderPipeline_fail('找不到標案流程。');
  var stage = data.目前階段 || data.stage || found.目前階段;
  var patch = { 更新時間: GovOpsTenderPipeline_now(), 完成率: GovOpsTenderPipeline_progress(stage) };
  ['目前階段','流程狀態','負責人','截止投標日','開標日期','下一步行動','下一步期限','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = data[k]; });
  if (data.stage !== undefined) patch.目前階段 = data.stage;
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderPipeline_sheetName(), found._row, patch);
  GovOpsTenderPipeline_writeBackTender(found.標案ID, tenantId, patch.目前階段 || stage);
  return GovOpsTenderPipeline_success('標案流程已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderPipeline_next(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var found = GovOpsTenderPipeline_findPipeline(data.標案ID || data.tenderId || '', tenantId, data.流程ID || data.pipelineId || '');
  if (!found) return GovOpsTenderPipeline_fail('找不到標案流程。');
  var stages = GovOpsTenderPipeline_stages();
  var idx = stages.indexOf(found.目前階段 || '發現標案');
  var next = stages[Math.min(stages.length - 1, idx + 1)];
  return GovOpsTenderPipeline_update(Object.assign({}, data, { 流程ID: found.流程ID, 目前階段: next, 下一步行動: GovOpsTenderPipeline_defaultNextAction(next) }));
}

function GovOpsTenderPipeline_query(data) {
  data = data || {};
  GovOpsTenderPipeline_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderPipeline_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderPipeline_success('標案流程查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderPipeline_progress(stage) {
  var stages = GovOpsTenderPipeline_stages();
  var idx = stages.indexOf(stage || '發現標案');
  if (idx < 0) idx = 0;
  return Math.round((idx + 1) / stages.length * 100) + '%';
}

function GovOpsTenderPipeline_defaultNextAction(stage) {
  var map = {
    '發現標案': '完成標案初步評估',
    '評估中': '完成投標決策評分',
    '決定投標': '建立備標工作清單',
    '備標中': '完成標單與附件檢查',
    '已投標': '追蹤開標結果',
    '開標等待': '確認得標或未得標結果',
    '已得標': '建立履約專案',
    '未得標': '建立復盤紀錄',
    '履約中': '追蹤履約與核銷',
    '已結案': '歸檔並回寫經驗庫'
  };
  return map[stage] || '請設定下一步行動';
}

function GovOpsTenderPipeline_findTender(tenderId, tenantId) {
  if (!tenderId || typeof GovOpsProduct_readRows !== 'function') return null;
  var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
  return rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId); }) || null;
}

function GovOpsTenderPipeline_findPipeline(tenderId, tenantId, pipelineId) {
  try {
    if (typeof GovOpsProduct_readRows !== 'function') return null;
    var rows = GovOpsProduct_readRows(GovOpsTenderPipeline_sheetName());
    return rows.find(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (pipelineId && String(row.流程ID || '') === String(pipelineId)) return true;
      return tenderId && String(row.標案ID || '') === String(tenderId);
    }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderPipeline_writeBackTender(tenderId, tenantId, stage) {
  try {
    if (!tenderId || typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return;
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var rows = GovOpsProduct_readRows(sheetName);
    var found = rows.find(function(row){ return String(row.tenantId || '') === String(tenantId) && String(row.標案ID || '') === String(tenderId); });
    if (found) GovOpsProduct_update(sheetName, found._row, { 標案狀態: stage, 更新時間: GovOpsTenderPipeline_now() });
  } catch (err) {}
}

function GovOpsTenderPipeline_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderPipeline_Create() { return GovOpsTenderPipeline_create({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案流程' }); }
