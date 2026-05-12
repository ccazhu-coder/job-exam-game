/* GovOps OS｜Tender Mind Map Engine v1
 * 目的：將招標文件解析結果轉為心智圖結構，協助用戶理解資格、評選、工作項目、請款、驗收、風險。
 */

function handleGovOpsTenderMindMapAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.mindmap.generate' || action === '產生標案心智圖') return GovOpsTenderMindMap_generate(data);
    if (action === 'tender.mindmap.query' || action === '查詢標案心智圖') return GovOpsTenderMindMap_query(data);
    return null;
  } catch (err) {
    GovOpsTenderMindMap_logError('handleGovOpsTenderMindMapAction', err, data);
    return GovOpsTenderMindMap_fail('標案心智圖功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_MINDMAP = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderMindMapAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_MINDMAP(action, data);
  };
}

function GovOpsTenderMindMap_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderMindMap_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderMindMap_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderMindMap_sheetName() { return '58_標案心智圖'; }

function GovOpsTenderMindMap_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderMindMap_sheetName(), ['心智圖ID','tenantId','標案ID','標案名稱','心智圖類型','中心主題','節點JSON','文字版摘要','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderMindMap_generate(data) {
  data = data || {};
  GovOpsTenderMindMap_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var rows = GovOpsTenderMindMap_sourceRows(tenantId, keyword);
  if (!rows.length) return GovOpsTenderMindMap_fail('找不到文件解析結果，請先完成 Parser 解析。');
  var tenderId = data.標案ID || rows[0].標案ID || '';
  var title = data.標案名稱 || GovOpsTenderMindMap_findTenderTitle(tenantId, tenderId) || rows[0].標案ID || keyword || '未命名標案';
  var tree = GovOpsTenderMindMap_buildTree(title, rows);
  var text = GovOpsTenderMindMap_toText(tree);
  var row = {
    心智圖ID: 'TMM-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    心智圖類型: data.心智圖類型 || '招標文件解讀',
    中心主題: title,
    節點JSON: JSON.stringify(tree),
    文字版摘要: text,
    建立時間: GovOpsTenderMindMap_now(),
    更新時間: GovOpsTenderMindMap_now(),
    userId: data.userId || '',
    備註: '由標案文件解析結果自動產生。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderMindMap_sheetName(), row);
  return GovOpsTenderMindMap_success('標案心智圖已產生。', row);
}

function GovOpsTenderMindMap_query(data) {
  data = data || {};
  GovOpsTenderMindMap_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderMindMap_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderMindMap_success('標案心智圖查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderMindMap_sourceRows(tenantId, keyword) {
  try {
    var rows = GovOpsProduct_readRows('49_標案文件解析結果').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (!keyword) return true;
      return JSON.stringify(row).indexOf(keyword) >= 0;
    });
    return rows;
  } catch (err) { return []; }
}

function GovOpsTenderMindMap_buildTree(title, rows) {
  var grouped = { qualification: [], evaluation: [], work: [], deliverables: [], acceptance: [], payment: [], penalty: [], risk: [] };
  rows.forEach(function(r){
    if (r.資格條件) grouped.qualification.push(GovOpsTenderMindMap_clean(r.文件類型 + '｜' + r.資格條件));
    if (r.評選標準) grouped.evaluation.push(GovOpsTenderMindMap_clean(r.文件類型 + '｜' + r.評選標準));
    if (r.工作項目) grouped.work.push(GovOpsTenderMindMap_clean(r.文件類型 + '｜' + r.工作項目));
    if (r.交付成果) grouped.deliverables.push(GovOpsTenderMindMap_clean(r.文件類型 + '｜' + r.交付成果));
    if (r.驗收方式) grouped.acceptance.push(GovOpsTenderMindMap_clean(r.文件類型 + '｜' + r.驗收方式));
    if (r.請款條件) grouped.payment.push(GovOpsTenderMindMap_clean(r.文件類型 + '｜' + r.請款條件));
    if (r.罰則條款) grouped.penalty.push(GovOpsTenderMindMap_clean(r.文件類型 + '｜' + r.罰則條款));
    if (r.風險提醒) grouped.risk.push(GovOpsTenderMindMap_clean(r.文件類型 + '｜' + r.風險提醒));
  });
  return {
    id: 'root',
    label: title,
    children: [
      GovOpsTenderMindMap_node('qualification', '投標資格', grouped.qualification),
      GovOpsTenderMindMap_node('evaluation', '評選重點', grouped.evaluation),
      GovOpsTenderMindMap_node('work', '工作項目', grouped.work),
      GovOpsTenderMindMap_node('deliverables', '交付成果', grouped.deliverables),
      GovOpsTenderMindMap_node('acceptance', '驗收方式', grouped.acceptance),
      GovOpsTenderMindMap_node('payment', '請款條件', grouped.payment),
      GovOpsTenderMindMap_node('penalty', '罰則與扣款', grouped.penalty),
      GovOpsTenderMindMap_node('risk', '風險提醒', grouped.risk)
    ]
  };
}

function GovOpsTenderMindMap_node(id, label, items) {
  items = GovOpsTenderMindMap_unique(items).slice(0, 12);
  return { id: id, label: label, children: items.length ? items.map(function(x, i){ return { id: id + '-' + i, label: x, children: [] }; }) : [{ id: id + '-empty', label: '尚無明確資料，需補充文件解析。', children: [] }] };
}

function GovOpsTenderMindMap_toText(tree) {
  var lines = [];
  function walk(node, depth) {
    lines.push(new Array(depth + 1).join('  ') + '- ' + node.label);
    (node.children || []).forEach(function(c){ walk(c, depth + 1); });
  }
  walk(tree, 0);
  return lines.join('\n');
}

function GovOpsTenderMindMap_findTenderTitle(tenantId, tenderId) {
  try {
    if (!tenderId) return '';
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
    return found && found.標案名稱 || '';
  } catch (err) { return ''; }
}

function GovOpsTenderMindMap_clean(text) { return String(text || '').replace(/\s+/g, ' ').trim(); }
function GovOpsTenderMindMap_unique(arr) { var seen = {}; return (arr || []).filter(function(x){ if (!x || seen[x]) return false; seen[x] = true; return true; }); }
function GovOpsTenderMindMap_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderMindMap_Generate() { return GovOpsTenderMindMap_generate({ tenantId: 'TENANT-DEMO' }); }
