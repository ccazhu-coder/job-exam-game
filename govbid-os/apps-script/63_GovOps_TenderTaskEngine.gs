/* GovOps OS｜Tender Task Engine v1
 * 目的：依標案流程階段自動建立備標、投標、開標、履約任務。
 */

function handleGovOpsTenderTaskAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.task.generate' || action === '生成標案任務') return GovOpsTenderTask_generate(data);
    if (action === 'tender.task.query' || action === '查詢標案任務') return GovOpsTenderTask_query(data);
    if (action === 'tender.task.update' || action === '更新標案任務') return GovOpsTenderTask_update(data);
    return null;
  } catch (err) {
    GovOpsTenderTask_logError('handleGovOpsTenderTaskAction', err, data);
    return GovOpsTenderTask_fail('標案任務功能暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_TASK = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderTaskAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_TASK(action, data);
  };
}

function GovOpsTenderTask_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderTask_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderTask_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderTask_sheetName() { return '33_標案工作任務'; }

function GovOpsTenderTask_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderTask_sheetName(), ['任務ID','tenantId','標案ID','流程ID','標案名稱','任務階段','任務名稱','任務說明','負責人','截止日期','任務狀態','優先級','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderTask_generate(data) {
  data = data || {};
  GovOpsTenderTask_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var pipeline = GovOpsTenderTask_findPipeline(tenderId, tenantId, data.流程ID || data.pipelineId || '') || {};
  var stage = data.任務階段 || data.目前階段 || pipeline.目前階段 || '評估中';
  var title = data.標案名稱 || pipeline.標案名稱 || tenderId || '未命名標案';
  var templates = GovOpsTenderTask_templates(stage);
  var created = 0;
  var skipped = 0;
  templates.forEach(function(tpl) {
    var row = {
      任務ID: 'TTK-' + Utilities.getUuid().slice(0, 8),
      tenantId: tenantId,
      標案ID: tenderId,
      流程ID: pipeline.流程ID || data.流程ID || '',
      標案名稱: title,
      任務階段: stage,
      任務名稱: tpl.name,
      任務說明: tpl.desc,
      負責人: data.負責人 || pipeline.負責人 || data.userId || '',
      截止日期: data.截止日期 || pipeline.下一步期限 || pipeline.截止投標日 || '',
      任務狀態: '待執行',
      優先級: tpl.priority,
      建立時間: GovOpsTenderTask_now(),
      更新時間: GovOpsTenderTask_now(),
      userId: data.userId || '',
      備註: ''
    };
    if (GovOpsTenderTask_exists(row)) { skipped++; return; }
    if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderTask_sheetName(), row);
    created++;
  });
  return GovOpsTenderTask_success('標案任務已生成。', { created: created, skipped: skipped, stage: stage });
}

function GovOpsTenderTask_query(data) {
  data = data || {};
  GovOpsTenderTask_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderTask_sheetName()) : [];
  rows = rows.filter(function(row) {
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderTask_success('標案任務查詢完成。', { total: rows.length, rows: rows.slice(0, 200) });
}

function GovOpsTenderTask_update(data) {
  data = data || {};
  GovOpsTenderTask_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var taskId = data.任務ID || data.taskId || '';
  if (!taskId) return GovOpsTenderTask_fail('請提供任務ID。');
  var rows = GovOpsProduct_readRows(GovOpsTenderTask_sheetName());
  var found = rows.find(function(row) { return String(row.tenantId || '') === String(tenantId) && String(row.任務ID || '') === String(taskId); });
  if (!found) return GovOpsTenderTask_fail('找不到標案任務。');
  var patch = { 更新時間: GovOpsTenderTask_now() };
  ['任務狀態','負責人','截止日期','優先級','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = data[k]; });
  if (typeof GovOpsProduct_update === 'function') GovOpsProduct_update(GovOpsTenderTask_sheetName(), found._row, patch);
  return GovOpsTenderTask_success('標案任務已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderTask_templates(stage) {
  var map = {
    '評估中': [
      ['閱讀招標公告與資格條件','確認投標資格、截止時間、押標金、履約地點','高'],
      ['執行歷史標案分析','查詢近5年相似案、得標廠商與決標金額','高'],
      ['產生投標決策評分','完成得標機率、競爭風險與利潤潛力分析','中']
    ],
    '決定投標': [
      ['建立備標資料夾','建立行政、企劃、報價、附件與核印資料夾','高'],
      ['整理資格文件','公司登記、納稅、信用、實績與人員資料','高'],
      ['建立備標時程','倒排投標截止日前所有工作節點','高']
    ],
    '備標中': [
      ['撰寫服務建議書','依評選項目撰寫計畫內容與加值服務','高'],
      ['製作預算與報價','完成標價清單、成本估算與利潤檢查','高'],
      ['附件與核印檢查','確認用印、頁碼、份數、電子檔與封裝方式','高']
    ],
    '已投標': [
      ['保存投標證明','保存收件證明、郵寄證明或電子投標紀錄','中'],
      ['建立開標提醒','追蹤開標日期與評選簡報通知','高']
    ],
    '已得標': [
      ['建立履約專案','轉入 GovOps 活動/履約管理流程','高'],
      ['建立合約與核銷清單','整理契約、請款、核銷與成果報告需求','高']
    ],
    '未得標': [
      ['建立未得標復盤','記錄得標廠商、決標金額、評選原因與下次改善','中']
    ],
    '履約中': [
      ['建立履約任務包','建立活動、報名、執行、核銷、成果報告任務','高']
    ]
  };
  var arr = map[stage] || map['評估中'];
  return arr.map(function(x){ return { name: x[0], desc: x[1], priority: x[2] }; });
}

function GovOpsTenderTask_exists(row) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderTask_sheetName());
    return rows.some(function(r){ return String(r.tenantId || '') === String(row.tenantId) && String(r.標案ID || '') === String(row.標案ID) && String(r.任務名稱 || '') === String(row.任務名稱); });
  } catch (err) { return false; }
}

function GovOpsTenderTask_findPipeline(tenderId, tenantId, pipelineId) {
  try {
    if (typeof GovOpsProduct_readRows !== 'function') return null;
    var rows = GovOpsProduct_readRows('32_標案流程追蹤');
    return rows.find(function(row) {
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (pipelineId && String(row.流程ID || '') === String(pipelineId)) return true;
      return tenderId && String(row.標案ID || '') === String(tenderId);
    }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderTask_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderTask_Generate() { return GovOpsTenderTask_generate({ tenantId: 'TENANT-DEMO', 標案ID: 'TEST', 標案名稱: '測試標案', 目前階段: '備標中' }); }
