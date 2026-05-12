/* GovOps OS｜Tender AI Copilot v1
 * 目的：用自然語言指令整合標案查詢、推薦、風險、合規、任務、財務與報告。
 */

function handleGovOpsTenderCopilotAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.copilot.ask' || action === '標案AI助理') return GovOpsTenderCopilot_ask(data);
    if (action === 'tender.copilot.route' || action === '標案指令解析') return GovOpsTenderCopilot_route(data);
    return null;
  } catch (err) {
    GovOpsTenderCopilot_logError('handleGovOpsTenderCopilotAction', err, data);
    return GovOpsTenderCopilot_fail('標案AI助理暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_COPILOT = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderCopilotAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_COPILOT(action, data);
  };
}

function GovOpsTenderCopilot_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderCopilot_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderCopilot_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderCopilot_sheetName() { return '46_標案AI助理紀錄'; }

function GovOpsTenderCopilot_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderCopilot_sheetName(), ['紀錄ID','tenantId','userId','使用者指令','解析意圖','關鍵字','執行Action','回覆摘要','建立時間','備註']);
  }
}

function GovOpsTenderCopilot_ask(data) {
  data = data || {};
  GovOpsTenderCopilot_ensureSheet();
  var text = String(data.text || data.query || data.指令 || '').trim();
  if (!text) return GovOpsTenderCopilot_fail('請輸入標案指令。');
  var route = GovOpsTenderCopilot_route({ text: text, tenantId: data.tenantId || 'TENANT-DEMO', userId: data.userId || '' }).data;
  var result = GovOpsTenderCopilot_execute(route, data);
  var reply = GovOpsTenderCopilot_reply(route, result);
  var row = {
    紀錄ID: 'TAC-' + Utilities.getUuid().slice(0, 8),
    tenantId: data.tenantId || 'TENANT-DEMO',
    userId: data.userId || '',
    使用者指令: text,
    解析意圖: route.intent,
    關鍵字: route.keyword,
    執行Action: route.action,
    回覆摘要: reply,
    建立時間: GovOpsTenderCopilot_now(),
    備註: ''
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderCopilot_sheetName(), row);
  return GovOpsTenderCopilot_success(reply, { route: route, result: result, log: row });
}

function GovOpsTenderCopilot_route(data) {
  var text = String((data || {}).text || '').trim();
  var keyword = GovOpsTenderCopilot_extractKeyword(text);
  var intent = 'query';
  var action = 'tender.query';
  if (/推薦|要不要投|投標建議|值得投/.test(text)) { intent = 'recommend'; action = 'tender.recommend.generate'; }
  else if (/風險|雷達|危險|高風險/.test(text)) { intent = 'risk'; action = 'tender.risk.analyze'; }
  else if (/合規|缺件|文件|附件|資格|用印/.test(text)) { intent = 'compliance'; action = 'tender.compliance.check'; }
  else if (/任務|待辦|下一步|工作/.test(text)) { intent = 'task'; action = 'tender.task.query'; }
  else if (/財務|毛利|請款|收款|簽約|核定/.test(text)) { intent = 'finance'; action = 'tender.finance.summary'; }
  else if (/報告|週報|月報|老闆摘要/.test(text)) { intent = 'report'; action = 'tender.report.generate'; }
  else if (/知識|案例|策略|加分/.test(text)) { intent = 'knowledge'; action = 'tender.kb.recommend'; }
  else if (/得標|機率|勝率/.test(text)) { intent = 'win'; action = 'tender.win.predict'; }
  else if (/競爭|廠商|對手/.test(text)) { intent = 'competition'; action = 'tender.competition.analyze'; }
  return GovOpsTenderCopilot_success('標案指令解析完成。', { intent: intent, action: action, keyword: keyword, text: text });
}

function GovOpsTenderCopilot_execute(route, original) {
  var data = { tenantId: original.tenantId || 'TENANT-DEMO', userId: original.userId || '', keyword: route.keyword, 標案ID: route.keyword, 標案名稱: route.keyword };
  try {
    if (route.action === 'tender.recommend.generate' && typeof GovOpsTenderRecommend_generate === 'function') return GovOpsTenderRecommend_generate(data);
    if (route.action === 'tender.risk.analyze' && typeof GovOpsTenderRisk_analyze === 'function') return GovOpsTenderRisk_analyze(data);
    if (route.action === 'tender.compliance.check' && typeof GovOpsTenderCompliance_check === 'function') return GovOpsTenderCompliance_check(data);
    if (route.action === 'tender.task.query' && typeof GovOpsTenderTask_query === 'function') return GovOpsTenderTask_query(data);
    if (route.action === 'tender.finance.summary' && typeof GovOpsTenderFinance_summary === 'function') return GovOpsTenderFinance_summary(data);
    if (route.action === 'tender.report.generate' && typeof GovOpsTenderReport_generate === 'function') return GovOpsTenderReport_generate(Object.assign({}, data, { 報告類型: /月報/.test(route.text) ? '月報' : '週報' }));
    if (route.action === 'tender.kb.recommend' && typeof GovOpsTenderKB_recommend === 'function') return GovOpsTenderKB_recommend(data);
    if (route.action === 'tender.win.predict' && typeof GovOpsTenderWin_predict === 'function') return GovOpsTenderWin_predict(data);
    if (route.action === 'tender.competition.analyze' && typeof GovOpsTenderCompetition_analyze === 'function') return GovOpsTenderCompetition_analyze(data);
    if (typeof GovOpsTenderPool_query === 'function') return GovOpsTenderPool_query(data);
  } catch (err) {
    return GovOpsTenderCopilot_fail('執行指令時發生錯誤。', { error: String(err) });
  }
  return GovOpsTenderCopilot_fail('目前找不到可執行的標案功能。');
}

function GovOpsTenderCopilot_reply(route, result) {
  if (!result || !result.success) return '目前無法完成：「' + route.text + '」。請確認資料是否已建立。';
  var d = result.data || {};
  if (route.intent === 'recommend') return '投標推薦：' + (d.推薦等級 || '') + '｜' + (d.推薦結論 || result.message);
  if (route.intent === 'risk') return '風險分析：' + (d.風險等級 || '') + '｜' + (d.主要風險摘要 || result.message);
  if (route.intent === 'finance') return '財務摘要：簽約 ' + (d.簽約金額 || '-') + '，可請款 ' + (d.可請款金額 || '-') + '，毛利 ' + (d.毛利 || '-') + '。';
  if (route.intent === 'report') return '營運報告：' + (d.老闆摘要 || result.message);
  if (route.intent === 'win') return '得標預測：' + (d.得標機率 || '-') + '｜' + (d.策略建議 || result.message);
  if (route.intent === 'competition') return '競爭分析：' + (d.競爭強度 || '-') + '｜' + (d.競爭風險 || result.message);
  if (route.intent === 'knowledge') return '知識推薦：共 ' + ((d.recommendations || []).length || d.total || 0) + ' 筆。';
  if (route.intent === 'task') return '任務查詢：共 ' + (d.total || 0) + ' 筆。';
  if (route.intent === 'compliance') return '合規檢查：' + (d.status || result.message) + '，缺件 ' + (d.missing || 0) + ' 項。';
  return result.message || '標案查詢完成。';
}

function GovOpsTenderCopilot_extractKeyword(text) {
  text = String(text || '').replace(/請|幫我|查詢|分析|產生|一下|標案|的/g, ' ').trim();
  var m = text.match(/[A-Z]{2,}-?\d{2,}-?\d{1,}|TDR-[\w-]+|ACT-[\w-]+/i);
  if (m) return m[0];
  return text.split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
}

function GovOpsTenderCopilot_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderCopilot_Ask() { return GovOpsTenderCopilot_ask({ tenantId: 'TENANT-DEMO', text: '幫我分析這個標案要不要投 中高齡就業促進課程' }); }
