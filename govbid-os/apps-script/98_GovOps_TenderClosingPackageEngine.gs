/* GovOps OS｜Tender Closing Package Engine v1
 * 目的：整合 Word、PDF、結案檢查清單、核銷附件與佐證需求，產生結案交付包清單。
 */

function handleGovOpsTenderClosingPackageAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.closingPackage.generate' || action === '產生結案交付包') return GovOpsTenderClosingPackage_generate(data);
    if (action === 'tender.closingPackage.query' || action === '查詢結案交付包') return GovOpsTenderClosingPackage_query(data);
    if (action === 'tender.closingPackage.status' || action === '結案交付包狀態') return GovOpsTenderClosingPackage_status(data);
    return null;
  } catch (err) {
    GovOpsTenderClosingPackage_logError('handleGovOpsTenderClosingPackageAction', err, data);
    return GovOpsTenderClosingPackage_fail('結案交付包功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_PACKAGE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderClosingPackageAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_PACKAGE(action, data);
  };
}

function GovOpsTenderClosingPackage_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderClosingPackage_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderClosingPackage_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderClosingPackage_sheetName() { return '70_標案結案交付包'; }
function GovOpsTenderClosingPackageItem_sheetName() { return '71_標案結案交付包明細'; }

function GovOpsTenderClosingPackage_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderClosingPackage_sheetName(), ['交付包ID','tenantId','標案ID','標案名稱','交付包狀態','Word連結','PDF連結','Drive資料夾','總項目數','已完成數','缺件數','建立時間','更新時間','userId','備註']);
    GovOpsProduct_ensureSheet(GovOpsTenderClosingPackageItem_sheetName(), ['明細ID','tenantId','交付包ID','標案ID','標案名稱','資料類型','交付項目','必要性','檔案連結','資料狀態','缺件風險','排序','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderClosingPackage_generate(data) {
  data = data || {};
  GovOpsTenderClosingPackage_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = data.keyword || data.關鍵字 || data.標案ID || data.標案名稱 || '';
  var title = data.標案名稱 || keyword || '未命名標案';
  var tenderId = data.標案ID || data.tenderId || keyword || '';
  var sources = GovOpsTenderClosingPackage_sources(tenantId, keyword);
  var word = sources.word[0] || {};
  var pdf = sources.pdf[0] || {};
  var packageId = 'TCPKG-' + Utilities.getUuid().slice(0, 8);
  var items = GovOpsTenderClosingPackage_buildItems(tenantId, packageId, tenderId, title, sources, data);
  var done = items.filter(function(x){ return x.資料狀態 === '已完成'; }).length;
  var missing = items.filter(function(x){ return x.資料狀態 !== '已完成' && x.必要性 === '必要'; }).length;
  var row = {
    交付包ID: packageId,
    tenantId: tenantId,
    標案ID: tenderId,
    標案名稱: title,
    交付包狀態: missing > 0 ? '待補件' : '可交付',
    Word連結: word.Word下載URL || word.GoogleDocURL || '',
    PDF連結: pdf.PDF下載URL || pdf.PDFDriveURL || '',
    Drive資料夾: data.folderUrl || '',
    總項目數: items.length,
    已完成數: done,
    缺件數: missing,
    建立時間: GovOpsTenderClosingPackage_now(),
    更新時間: GovOpsTenderClosingPackage_now(),
    userId: data.userId || '',
    備註: '結案交付包整合 Word、PDF、佐證資料、核銷附件與驗收文件。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderClosingPackage_sheetName(), row);
  items.forEach(function(item){ if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderClosingPackageItem_sheetName(), item); });
  return GovOpsTenderClosingPackage_success('結案交付包已產生。', { package: row, items: items });
}

function GovOpsTenderClosingPackage_query(data) {
  data = data || {};
  GovOpsTenderClosingPackage_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = GovOpsTenderClosingPackage_read(GovOpsTenderClosingPackage_sheetName(), tenantId, keyword);
  var items = GovOpsTenderClosingPackage_read(GovOpsTenderClosingPackageItem_sheetName(), tenantId, keyword);
  return GovOpsTenderClosingPackage_success('結案交付包查詢完成。', { total: rows.length, packages: rows.slice(0, 100), items: items.slice(0, 300) });
}

function GovOpsTenderClosingPackage_status(data) {
  var result = GovOpsTenderClosingPackage_query(data).data;
  var items = result.items || [];
  var total = items.length;
  var done = items.filter(function(x){ return x.資料狀態 === '已完成'; }).length;
  var missing = items.filter(function(x){ return x.資料狀態 !== '已完成' && x.必要性 === '必要'; }).length;
  var optional = items.filter(function(x){ return x.必要性 !== '必要'; }).length;
  return GovOpsTenderClosingPackage_success('結案交付包狀態完成。', { total: total, done: done, missing: missing, optional: optional, status: missing > 0 ? '待補件' : '可交付' });
}

function GovOpsTenderClosingPackage_buildItems(tenantId, packageId, tenderId, title, sources, data) {
  var items = [];
  var seq = 1;
  function add(type, name, required, link, status, risk) {
    items.push({
      明細ID: 'TCPKGI-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      交付包ID: packageId,
      標案ID: tenderId,
      標案名稱: title,
      資料類型: type,
      交付項目: name,
      必要性: required,
      檔案連結: link || '',
      資料狀態: status || (link ? '已完成' : '待準備'),
      缺件風險: risk || '缺件可能影響驗收或請款。',
      排序: seq++,
      建立時間: GovOpsTenderClosingPackage_now(),
      更新時間: GovOpsTenderClosingPackage_now(),
      userId: data.userId || '',
      備註: ''
    });
  }
  var word = sources.word[0] || {};
  var pdf = sources.pdf[0] || {};
  add('正式文件', '結案報告 Word', '必要', word.Word下載URL || word.GoogleDocURL || '', '', '缺少 Word 會影響後續編修。');
  add('正式文件', '結案報告 PDF', '必要', pdf.PDF下載URL || pdf.PDFDriveURL || '', '', '缺少 PDF 會影響正式送件。');
  (sources.checklist || []).forEach(function(r){ add(r.資料類型 || '佐證資料', r.檢查項目 || '未命名項目', r.必要性 || '必要', r.檔案連結 || '', r.資料狀態 || '待準備', r.缺件風險 || '缺件可能影響驗收。'); });
  if (!sources.checklist.length) {
    ['成果照片','簽到表/名冊','滿意度問卷統計','KPI成果統計','發票/收據/憑證','經費支出明細','驗收對照表'].forEach(function(x){ add('標準附件', x, '必要', '', '待準備', '標準結案附件，缺少可能造成補正。'); });
  }
  return items;
}

function GovOpsTenderClosingPackage_sources(tenantId, keyword) {
  return {
    word: GovOpsTenderClosingPackage_read('68_標案結案報告Word匯出', tenantId, keyword),
    pdf: GovOpsTenderClosingPackage_read('69_標案結案報告PDF匯出', tenantId, keyword),
    checklist: GovOpsTenderClosingPackage_read('65_標案結案報告檢查清單', tenantId, keyword),
    sync: GovOpsTenderClosingPackage_read('64_標案驗收結案報告同步', tenantId, keyword)
  };
}

function GovOpsTenderClosingPackage_read(sheetName, tenantId, keyword) {
  try {
    return GovOpsProduct_readRows(sheetName).filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (!keyword) return true;
      return JSON.stringify(row).indexOf(keyword) >= 0;
    }).slice(0, 200);
  } catch (err) { return []; }
}

function GovOpsTenderClosingPackage_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderClosingPackage_Generate() { return GovOpsTenderClosingPackage_generate({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案' }); }
