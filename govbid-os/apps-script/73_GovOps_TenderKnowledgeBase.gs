/* GovOps OS｜Tender Knowledge Base v1
 * 目的：沉澱標案策略、歷史案例、評選加分、風險提醒與復盤知識。
 */

function handleGovOpsTenderKnowledgeAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.kb.create' || action === '新增標案知識') return GovOpsTenderKB_create(data);
    if (action === 'tender.kb.query' || action === '查詢標案知識') return GovOpsTenderKB_query(data);
    if (action === 'tender.kb.fromAnalysis' || action === '由分析建立標案知識') return GovOpsTenderKB_fromAnalysis(data);
    if (action === 'tender.kb.recommend' || action === '推薦標案知識') return GovOpsTenderKB_recommend(data);
    return null;
  } catch (err) {
    GovOpsTenderKB_logError('handleGovOpsTenderKnowledgeAction', err, data);
    return GovOpsTenderKB_fail('標案知識庫暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_KB = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderKnowledgeAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_KB(action, data);
  };
}

function GovOpsTenderKB_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderKB_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderKB_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderKB_sheetName() { return '41_標案知識庫'; }

function GovOpsTenderKB_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderKB_sheetName(), ['知識ID','tenantId','知識類型','主題','關鍵字','適用標案類型','內容摘要','策略建議','風險提醒','來源標案ID','來源模組','可信度','使用次數','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderKB_create(data) {
  data = data || {};
  GovOpsTenderKB_ensureSheet();
  var row = {
    知識ID: 'TKB-' + Utilities.getUuid().slice(0, 8),
    tenantId: data.tenantId || 'TENANT-DEMO',
    知識類型: data.知識類型 || '策略',
    主題: data.主題 || data.title || '',
    關鍵字: data.關鍵字 || data.keyword || '',
    適用標案類型: data.適用標案類型 || '',
    內容摘要: data.內容摘要 || data.summary || '',
    策略建議: data.策略建議 || data.strategy || '',
    風險提醒: data.風險提醒 || data.risk || '',
    來源標案ID: data.來源標案ID || data.標案ID || '',
    來源模組: data.來源模組 || '人工建立',
    可信度: data.可信度 || '中',
    使用次數: 0,
    建立時間: GovOpsTenderKB_now(),
    更新時間: GovOpsTenderKB_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (!row.主題 && !row.內容摘要) return GovOpsTenderKB_fail('請提供知識主題或內容摘要。');
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderKB_sheetName(), row);
  return GovOpsTenderKB_success('標案知識已新增。', row);
}

function GovOpsTenderKB_query(data) {
  data = data || {};
  GovOpsTenderKB_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.主題 || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderKB_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderKB_success('標案知識查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderKB_fromAnalysis(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var created = [];
  var sources = [
    { sheet: '40_標案競爭分析', type: '競爭策略', module: 'Competition' },
    { sheet: '39_標案得標預測', type: '得標策略', module: 'WinPrediction' },
    { sheet: '31_投標決策評分', type: '投標決策', module: 'Decision' }
  ];
  sources.forEach(function(src){
    try {
      var rows = GovOpsProduct_readRows(src.sheet).filter(function(row){ return String(row.tenantId || '') === String(tenantId); });
      rows.slice(-5).forEach(function(row){
        var result = GovOpsTenderKB_create({
          tenantId: tenantId,
          userId: data.userId || '',
          知識類型: src.type,
          主題: row.標案名稱 || src.type,
          關鍵字: row.標案名稱 || '',
          內容摘要: row.判斷摘要 || row.競爭風險 || row.策略建議 || row.投標建議 || '',
          策略建議: row.策略建議 || row.差異化策略 || row.投標建議 || '',
          風險提醒: row.主要風險 || row.競爭風險 || '',
          來源標案ID: row.標案ID || '',
          來源模組: src.module,
          可信度: '中'
        });
        if (result && result.success) created.push(result.data);
      });
    } catch (err) {}
  });
  return GovOpsTenderKB_success('已由分析結果建立標案知識。', { created: created.length, rows: created });
}

function GovOpsTenderKB_recommend(data) {
  data = data || {};
  var keyword = data.keyword || data.關鍵字 || data.標案名稱 || '';
  var result = GovOpsTenderKB_query({ tenantId: data.tenantId || 'TENANT-DEMO', keyword: keyword });
  var rows = result.data.rows || [];
  if (!rows.length && keyword) rows = GovOpsTenderKB_query({ tenantId: data.tenantId || 'TENANT-DEMO', keyword: GovOpsTenderKB_extractMainKeyword(keyword) }).data.rows || [];
  return GovOpsTenderKB_success('標案知識推薦完成。', { keyword: keyword, total: rows.length, recommendations: rows.slice(0, 10) });
}

function GovOpsTenderKB_extractMainKeyword(text) {
  text = String(text || '');
  var keys = ['就業','職涯','訓練','課程','活動','講座','AI','農糧','中高齡','婦女','公會'];
  for (var i = 0; i < keys.length; i++) if (text.indexOf(keys[i]) >= 0) return keys[i];
  return text.slice(0, 10);
}

function GovOpsTenderKB_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderKB_Create() { return GovOpsTenderKB_create({ tenantId: 'TENANT-DEMO', 主題: 'AI標案加分策略', 內容摘要: '需具體說明AI流程、資料安全與驗收成果。' }); }
