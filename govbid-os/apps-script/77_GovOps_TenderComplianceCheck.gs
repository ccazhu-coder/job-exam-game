/* GovOps OS｜Tender Compliance Check v1
 * 目的：檢查投標資格、文件、附件、憑證、時程與履約核銷缺件。
 */

function handleGovOpsTenderComplianceAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.compliance.check' || action === '標案合規檢查') return GovOpsTenderCompliance_check(data);
    if (action === 'tender.compliance.query' || action === '查詢標案合規檢查') return GovOpsTenderCompliance_query(data);
    if (action === 'tender.compliance.generate' || action === '生成標案合規清單') return GovOpsTenderCompliance_generate(data);
    return null;
  } catch (err) {
    GovOpsTenderCompliance_logError('handleGovOpsTenderComplianceAction', err, data);
    return GovOpsTenderCompliance_fail('標案合規檢查暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_COMPLIANCE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderComplianceAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_COMPLIANCE(action, data);
  };
}

function GovOpsTenderCompliance_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderCompliance_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderCompliance_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderCompliance_sheetName() { return '45_標案合規檢查'; }

function GovOpsTenderCompliance_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderCompliance_sheetName(), ['檢查ID','tenantId','標案ID','標案名稱','檢查階段','檢查項目','檢查類型','檢查狀態','風險等級','負責人','截止日期','處理建議','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderCompliance_generate(data) {
  data = data || {};
  GovOpsTenderCompliance_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var title = data.標案名稱 || data.keyword || tenderId || '未命名標案';
  var stage = data.檢查階段 || data.stage || '投標前';
  var items = GovOpsTenderCompliance_templates(stage);
  var created = 0, skipped = 0;
  items.forEach(function(item){
    var row = {
      檢查ID: 'TCC-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      標案ID: tenderId,
      標案名稱: title,
      檢查階段: stage,
      檢查項目: item.name,
      檢查類型: item.type,
      檢查狀態: '待檢查',
      風險等級: item.risk,
      負責人: data.負責人 || data.userId || '',
      截止日期: data.截止日期 || '',
      處理建議: item.advice,
      建立時間: GovOpsTenderCompliance_now(),
      更新時間: GovOpsTenderCompliance_now(),
      userId: data.userId || '',
      備註: ''
    };
    if (GovOpsTenderCompliance_exists(row)) { skipped++; return; }
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderCompliance_sheetName(), row);
    created++;
  });
  return GovOpsTenderCompliance_success('標案合規清單已生成。', { created: created, skipped: skipped, stage: stage });
}

function GovOpsTenderCompliance_check(data) {
  data = data || {};
  GovOpsTenderCompliance_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = GovOpsTenderCompliance_query({ tenantId: tenantId, keyword: keyword }).data.rows || [];
  if (!rows.length) return GovOpsTenderCompliance_fail('尚未建立合規清單，請先執行生成標案合規清單。');
  var missing = rows.filter(function(r){ return ['待檢查','缺件','未完成','異常'].indexOf(String(r.檢查狀態 || '')) >= 0; });
  var high = missing.filter(function(r){ return String(r.風險等級 || '') === '高'; });
  return GovOpsTenderCompliance_success('標案合規檢查完成。', {
    total: rows.length,
    missing: missing.length,
    highRiskMissing: high.length,
    status: high.length ? '高風險缺件' : (missing.length ? '尚有缺件' : '合規完成'),
    rows: missing
  });
}

function GovOpsTenderCompliance_query(data) {
  data = data || {};
  GovOpsTenderCompliance_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderCompliance_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderCompliance_success('標案合規清單查詢完成。', { total: rows.length, rows: rows.slice(0, 300) });
}

function GovOpsTenderCompliance_templates(stage) {
  var common = [
    ['確認投標資格','資格','高','確認廠商資格、經驗、證照、實績是否符合。'],
    ['確認投標截止時間','時程','高','建立投標截止前檢查與送件提醒。'],
    ['確認招標文件版本','文件','高','避免使用舊版文件或漏看補充公告。'],
    ['確認應附文件清單','附件','高','逐項比對招標文件規定附件。'],
    ['確認用印與簽章','文件','高','檢查大小章、負責人章、騎縫章。'],
    ['確認標價清單','報價','高','確認報價、稅額、合計與文字金額一致。'],
    ['確認押標金/保證金規定','財務','中','確認是否需押標金、格式與金額。']
  ];
  var delivery = [
    ['確認契約履約項目','履約','高','逐項建立履約任務與交付物。'],
    ['確認請款文件','核銷','高','確認請款、發票、領據、成果報告。'],
    ['確認成果照片與佐證','核銷','中','確認照片、簽到、滿意度、新聞露出。'],
    ['確認可請款與不可請款項目','財務','高','避免簽約金額與實際可請款落差。']
  ];
  var arr = String(stage).indexOf('履約') >= 0 ? common.concat(delivery) : common;
  return arr.map(function(x){ return { name: x[0], type: x[1], risk: x[2], advice: x[3] }; });
}

function GovOpsTenderCompliance_exists(row) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderCompliance_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(row.tenantId) && String(r.標案ID || '') === String(row.標案ID) && String(r.檢查項目 || '') === String(row.檢查項目); });
  } catch (err) { return false; }
}

function GovOpsTenderCompliance_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderCompliance_Generate() { return GovOpsTenderCompliance_generate({ tenantId: 'TENANT-DEMO', 標案ID: 'TEST', 標案名稱: '測試標案' }); }
