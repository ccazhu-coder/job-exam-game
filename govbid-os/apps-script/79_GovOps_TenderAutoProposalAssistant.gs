/* GovOps OS｜Tender Auto Proposal Assistant v1
 * 目的：依標案分析、推薦、風險、知識庫與財務資料，產生服務建議書骨架與投標策略內容。
 */

function handleGovOpsTenderProposalAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.proposal.generate' || action === '產生標案企劃骨架') return GovOpsTenderProposal_generate(data);
    if (action === 'tender.proposal.query' || action === '查詢標案企劃骨架') return GovOpsTenderProposal_query(data);
    return null;
  } catch (err) {
    GovOpsTenderProposal_logError('handleGovOpsTenderProposalAction', err, data);
    return GovOpsTenderProposal_fail('標案企劃助理暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_PROPOSAL = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderProposalAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_PROPOSAL(action, data);
  };
}

function GovOpsTenderProposal_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderProposal_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderProposal_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderProposal_sheetName() { return '47_標案企劃助理'; }

function GovOpsTenderProposal_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderProposal_sheetName(), ['企劃ID','tenantId','標案ID','標案名稱','企劃類型','投標主軸','服務建議書大綱','評選回應策略','加值服務策略','風險控管章節','KPI與驗收設計','預算與成本提醒','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderProposal_generate(data) {
  data = data || {};
  GovOpsTenderProposal_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var tenderId = data.標案ID || data.tenderId || '';
  var keyword = data.keyword || data.關鍵字 || data.標案名稱 || tenderId || '';
  var tender = GovOpsTenderProposal_findTender(tenantId, tenderId, keyword) || {};
  var title = data.標案名稱 || tender.標案名稱 || keyword || '未命名標案';
  var recommend = GovOpsTenderProposal_latest('42_標案AI推薦', tenantId, tenderId, title);
  var risk = GovOpsTenderProposal_latest('43_標案風險分析', tenantId, tenderId, title);
  var finance = GovOpsTenderProposal_latest('38_標案財務摘要', tenantId, tenderId, title);
  var kb = GovOpsTenderProposal_kb(tenantId, title);
  var row = {
    企劃ID: 'TPA-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    標案ID: tenderId || tender.標案ID || '',
    標案名稱: title,
    企劃類型: data.企劃類型 || '服務建議書骨架',
    投標主軸: GovOpsTenderProposal_theme(title, recommend),
    服務建議書大綱: GovOpsTenderProposal_outline(title),
    評選回應策略: GovOpsTenderProposal_reviewStrategy(title, recommend, kb),
    加值服務策略: GovOpsTenderProposal_bonus(title, kb),
    風險控管章節: GovOpsTenderProposal_risk(risk),
    KPI與驗收設計: GovOpsTenderProposal_kpi(title),
    預算與成本提醒: GovOpsTenderProposal_finance(finance),
    建立時間: GovOpsTenderProposal_now(),
    更新時間: GovOpsTenderProposal_now(),
    userId: data.userId || '',
    備註: '此為投標企劃骨架，正式送件前需依招標文件逐項確認。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderProposal_sheetName(), row);
  return GovOpsTenderProposal_success('標案企劃骨架已產生。', row);
}

function GovOpsTenderProposal_query(data) {
  data = data || {};
  GovOpsTenderProposal_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderProposal_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderProposal_success('標案企劃骨架查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderProposal_theme(title, recommend) {
  var base = '以「專業執行、風險控管、成果可驗收」為核心主軸';
  if (String(title).indexOf('AI') >= 0) base = '以「AI應用落地、流程自動化、成果可量化」為核心主軸';
  if (String(title).indexOf('就業') >= 0 || String(title).indexOf('職涯') >= 0) base = '以「就業促進、職涯支持、資源串聯與成效追蹤」為核心主軸';
  if (String(title).indexOf('農糧') >= 0 || String(title).indexOf('米') >= 0) base = '以「在地產業、品牌推廣、教育體驗與社群擴散」為核心主軸';
  return base + '。' + (recommend.推薦結論 ? 'AI推薦：' + recommend.推薦結論 : '');
}

function GovOpsTenderProposal_outline(title) {
  return [
    '一、計畫理解與需求分析',
    '二、執行目標與服務對象',
    '三、服務內容與工作方法',
    '四、執行期程與人力分工',
    '五、品質管理與風險控管',
    '六、KPI、驗收指標與成果產出',
    '七、創新加值服務',
    '八、經費運用與成本合理性',
    '九、結案、核銷與成果報告'
  ].join('\n');
}

function GovOpsTenderProposal_reviewStrategy(title, recommend, kb) {
  var text = '逐項對應評選項目，避免只寫理念，需用表格呈現「評選項目 → 回應內容 → 佐證資料 → 加分亮點」。';
  if (recommend.推薦等級) text += '\n目前推薦等級：' + recommend.推薦等級 + '，建議依推薦結論補強投標策略。';
  if (kb) text += '\n可參考知識庫：' + kb;
  return text;
}

function GovOpsTenderProposal_bonus(title, kb) {
  var items = ['數位化管理儀表板', '成果照片與數據化報告', 'LINE/表單/CRM追蹤', '風險預警與缺件控管'];
  if (String(title).indexOf('AI') >= 0) items.push('AI工具教學與實作成果包');
  if (String(title).indexOf('農糧') >= 0 || String(title).indexOf('米') >= 0) items.push('社群推廣與在地品牌故事素材');
  return items.map(function(x, i){ return (i+1) + '. ' + x; }).join('\n');
}

function GovOpsTenderProposal_risk(risk) {
  return '主要風險：' + (risk.主要風險摘要 || '資料不足，需補做風險分析。') + '\n處理方式：' + (risk.風險處理建議 || '建立缺件清單、負責人、截止日與追蹤機制。');
}

function GovOpsTenderProposal_kpi(title) {
  return [
    '1. 執行完成率：依契約項目達成率計算',
    '2. 參與/服務人次：依簽到、報名或服務紀錄統計',
    '3. 滿意度：以問卷平均分數或滿意比例呈現',
    '4. 成果產出：照片、報告、名冊、教材、影音或社群數據',
    '5. 核銷完整率：應附文件與憑證完整率'
  ].join('\n');
}

function GovOpsTenderProposal_finance(finance) {
  if (!finance || !finance.標案ID) return '尚無財務摘要，建議先建立簽約金額、可請款金額與成本明細。';
  return '簽約金額：' + (finance.簽約金額 || '-') + '\n可請款金額：' + (finance.可請款金額 || '-') + '\n毛利率：' + (finance.毛利率 || '-') + '\n提醒：簽約金額不等於實際可收款，需確認核定金額、扣款與不可請款項目。';
}

function GovOpsTenderProposal_kb(tenantId, title) {
  try {
    if (typeof GovOpsTenderKB_recommend === 'function') {
      var r = GovOpsTenderKB_recommend({ tenantId: tenantId, keyword: title });
      var rows = r.data && r.data.recommendations || [];
      return rows.slice(0, 3).map(function(x){ return x.主題 || x.內容摘要 || ''; }).filter(Boolean).join('；');
    }
  } catch (err) {}
  return '';
}

function GovOpsTenderProposal_latest(sheetName, tenantId, tenderId, title) {
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

function GovOpsTenderProposal_findTender(tenantId, tenderId, keyword) {
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

function GovOpsTenderProposal_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderProposal_Generate() { return GovOpsTenderProposal_generate({ tenantId: 'TENANT-DEMO', 標案名稱: '中高齡就業促進課程計畫' }); }
