/* GovOps OS｜Tender Delivery Timeline Engine v1
 * 目的：從招標文件解析結果與契約/工作說明資料中建立履約時間、交付節點、驗收與請款時程。
 */

function handleGovOpsTenderDeliveryTimelineAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.timeline.generate' || action === '產生標案履約時程') return GovOpsTenderTimeline_generate(data);
    if (action === 'tender.timeline.query' || action === '查詢標案履約時程') return GovOpsTenderTimeline_query(data);
    if (action === 'tender.timeline.mindmap' || action === '產生履約時程心智圖') return GovOpsTenderTimeline_mindmap(data);
    return null;
  } catch (err) {
    GovOpsTenderTimeline_logError('handleGovOpsTenderDeliveryTimelineAction', err, data);
    return GovOpsTenderTimeline_fail('標案履約時程功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_TIMELINE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderDeliveryTimelineAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_TIMELINE(action, data);
  };
}

function GovOpsTenderTimeline_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderTimeline_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderTimeline_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderTimeline_sheetName() { return '59_標案履約時程'; }

function GovOpsTenderTimeline_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderTimeline_sheetName(), ['時程ID','tenantId','標案ID','標案名稱','時程類型','階段名稱','起始日','截止日','相對期限','交付成果','驗收方式','請款關聯','逾期風險','提醒狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderTimeline_generate(data) {
  data = data || {};
  GovOpsTenderTimeline_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var rows = GovOpsTenderTimeline_sourceRows(tenantId, keyword);
  if (!rows.length) return GovOpsTenderTimeline_fail('找不到文件解析結果，請先完成 Parser 解析。');
  var tenderId = data.標案ID || rows[0].標案ID || '';
  var title = data.標案名稱 || GovOpsTenderTimeline_findTenderTitle(tenantId, tenderId) || keyword || '未命名標案';
  var nodes = GovOpsTenderTimeline_buildNodes(tenantId, tenderId, title, rows, data);
  var created = 0;
  nodes.forEach(function(n){
    if (GovOpsTenderTimeline_exists(tenantId, tenderId, n.階段名稱, n.截止日)) return;
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderTimeline_sheetName(), n);
    created++;
  });
  return GovOpsTenderTimeline_success('標案履約時程已產生。', { created: created, total: nodes.length, rows: nodes });
}

function GovOpsTenderTimeline_query(data) {
  data = data || {};
  GovOpsTenderTimeline_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderTimeline_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderTimeline_success('標案履約時程查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderTimeline_mindmap(data) {
  data = data || {};
  var r = GovOpsTenderTimeline_query(data);
  var rows = r.data.rows || [];
  if (!rows.length) return GovOpsTenderTimeline_fail('找不到履約時程，請先產生標案履約時程。');
  var title = data.標案名稱 || rows[0].標案名稱 || '履約時程';
  var tree = {
    id: 'timeline-root',
    label: title + '｜履約時間',
    children: [
      GovOpsTenderTimeline_mmNode('contract', '契約期間', rows.filter(function(x){ return String(x.時程類型 || '') === '契約期間'; })),
      GovOpsTenderTimeline_mmNode('work', '工作執行', rows.filter(function(x){ return String(x.時程類型 || '') === '工作執行'; })),
      GovOpsTenderTimeline_mmNode('deliver', '交付成果', rows.filter(function(x){ return String(x.時程類型 || '') === '交付成果'; })),
      GovOpsTenderTimeline_mmNode('accept', '驗收期限', rows.filter(function(x){ return String(x.時程類型 || '') === '驗收期限'; })),
      GovOpsTenderTimeline_mmNode('payment', '請款期限', rows.filter(function(x){ return String(x.時程類型 || '') === '請款期限'; })),
      GovOpsTenderTimeline_mmNode('risk', '逾期風險', rows.filter(function(x){ return String(x.逾期風險 || ''); }))
    ]
  };
  if (typeof GovOpsTenderMindMap_ensureSheet === 'function') GovOpsTenderMindMap_ensureSheet();
  var row = {
    心智圖ID: 'TMM-' + Utilities.getUuid().slice(0, 8),
    tenantId: data.tenantId || 'TENANT-DEMO',
    標案ID: rows[0].標案ID || '',
    標案名稱: title,
    心智圖類型: '履約時程心智圖',
    中心主題: title + '｜履約時間',
    節點JSON: JSON.stringify(tree),
    文字版摘要: GovOpsTenderTimeline_treeText(tree),
    建立時間: GovOpsTenderTimeline_now(),
    更新時間: GovOpsTenderTimeline_now(),
    userId: data.userId || '',
    備註: '由標案履約時程自動產生。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append('58_標案心智圖', row);
  return GovOpsTenderTimeline_success('履約時程心智圖已產生。', row);
}

function GovOpsTenderTimeline_buildNodes(tenantId, tenderId, title, rows, data) {
  var nodes = [];
  var contract = GovOpsTenderTimeline_contractRow(tenantId, tenderId, title, data);
  nodes.push(contract);
  var hasWork = false, hasDeliver = false, hasAccept = false, hasPayment = false, hasPenalty = false;
  rows.forEach(function(r){
    if (r.工作項目) { hasWork = true; nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '工作執行', '依工作說明書執行工作項目', '', '', '依契約/工作說明書期限', r.工作項目, '', '', '若未按期完成工作項目，可能影響驗收與請款。', data)); }
    if (r.交付成果) { hasDeliver = true; nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '交付成果', '成果交付', '', '', '依工作說明書或契約約定期限', r.交付成果, '', '', '成果缺漏可能造成補正、扣款或延後請款。', data)); }
    if (r.驗收方式) { hasAccept = true; nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '驗收期限', '驗收與補正', '', '', '依契約驗收規定', '', r.驗收方式, '', '驗收未通過會影響收款與結案。', data)); }
    if (r.請款條件) { hasPayment = true; nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '請款期限', '請款送件', '', '', '依請款條件與核銷期限', '', '', r.請款條件, '逾期或缺件可能導致不可請款。', data)); }
    if (r.罰則條款) { hasPenalty = true; nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '逾期風險', '罰則與扣款檢查', '', '', '依契約罰則條款', '', '', '', r.罰則條款, data)); }
  });
  if (!hasWork) nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '工作執行', '待補工作期程', '', '', '待人工確認', '', '', '', '尚未從文件中解析出明確工作時間。', data));
  if (!hasDeliver) nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '交付成果', '待補成果交付日', '', '', '待人工確認', '', '', '', '需補成果交付期限。', data));
  if (!hasAccept) nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '驗收期限', '待補驗收日', '', '', '待人工確認', '', '', '', '需補驗收方式與驗收期限。', data));
  if (!hasPayment) nodes.push(GovOpsTenderTimeline_node(tenantId, tenderId, title, '請款期限', '待補請款日', '', '', '待人工確認', '', '', '', '需補請款條件與期限。', data));
  return nodes;
}

function GovOpsTenderTimeline_contractRow(tenantId, tenderId, title, data) {
  return GovOpsTenderTimeline_node(tenantId, tenderId, title, '契約期間', '履約起訖', data.合約起日 || '', data.合約迄日 || '', data.履約期間 || '依契約起迄日或決標後起算', '', '', '', '若未明確登錄履約起訖日，後續提醒與請款控管會失準。', data);
}

function GovOpsTenderTimeline_node(tenantId, tenderId, title, type, stage, start, end, relative, deliver, acceptance, payment, risk, data) {
  return {
    時程ID: 'TTL-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    時程類型: type,
    階段名稱: stage,
    起始日: start || '',
    截止日: end || '',
    相對期限: relative || '',
    交付成果: deliver || '',
    驗收方式: acceptance || '',
    請款關聯: payment || '',
    逾期風險: risk || '',
    提醒狀態: '未建立提醒',
    建立時間: GovOpsTenderTimeline_now(),
    更新時間: GovOpsTenderTimeline_now(),
    userId: data.userId || '',
    備註: '由文件解析結果建立；日期不足時需人工補齊。'
  };
}

function GovOpsTenderTimeline_mmNode(id, label, rows) {
  return { id: id, label: label, children: (rows.length ? rows : [{階段名稱:'尚無資料', 相對期限:'需人工補齊'}]).slice(0, 20).map(function(r, i){ return { id: id + '-' + i, label: (r.階段名稱 || label) + '｜' + (r.截止日 || r.相對期限 || '待補日期'), children: [
    { id: id + '-' + i + '-deliver', label: '交付：' + (r.交付成果 || '無'), children: [] },
    { id: id + '-' + i + '-accept', label: '驗收：' + (r.驗收方式 || '無'), children: [] },
    { id: id + '-' + i + '-risk', label: '風險：' + (r.逾期風險 || '無'), children: [] }
  ]}; }) };
}

function GovOpsTenderTimeline_sourceRows(tenantId, keyword) {
  try {
    return GovOpsProduct_readRows('49_標案文件解析結果').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (!keyword) return true;
      return JSON.stringify(row).indexOf(keyword) >= 0;
    });
  } catch (err) { return []; }
}

function GovOpsTenderTimeline_findTenderTitle(tenantId, tenderId) {
  try {
    if (!tenderId) return '';
    var rows = GovOpsProduct_readRows(GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池');
    var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId); });
    return found && found.標案名稱 || '';
  } catch (err) { return ''; }
}

function GovOpsTenderTimeline_exists(tenantId, tenderId, stage, deadline) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderTimeline_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.標案ID || '') === String(tenderId) && String(r.階段名稱 || '') === String(stage) && String(r.截止日 || '') === String(deadline || ''); });
  } catch (err) { return false; }
}

function GovOpsTenderTimeline_treeText(tree) {
  var lines = [];
  function walk(node, depth) { lines.push(new Array(depth + 1).join('  ') + '- ' + node.label); (node.children || []).forEach(function(c){ walk(c, depth + 1); }); }
  walk(tree, 0);
  return lines.join('\n');
}

function GovOpsTenderTimeline_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderTimeline_Generate() { return GovOpsTenderTimeline_generate({ tenantId: 'TENANT-DEMO' }); }
