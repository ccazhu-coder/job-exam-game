/* GovOps OS｜Tender Intelligence Scheduler v1
 * 目的：串接政府標案每日查詢、歷史分析、廠商知識庫摘要，形成每日標案智慧化作業。
 */

function handleGovOpsTenderIntelligenceAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.intel.daily' || action === '每日標案智慧分析') return GovOpsTenderIntel_daily(data);
    if (action === 'tender.intel.install' || action === '安裝標案智慧排程') return GovOpsTenderIntel_installTrigger(data);
    if (action === 'tender.intel.health' || action === '檢查標案智慧排程') return GovOpsTenderIntel_health(data);
    return null;
  } catch (err) {
    GovOpsTenderIntel_logError('handleGovOpsTenderIntelligenceAction', err, data);
    return GovOpsTenderIntel_fail('標案智慧分析暫時無法完成操作，請稍後再試。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_INTEL = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderIntelligenceAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_INTEL(action, data);
  };
}

function GovOpsTenderIntel_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderIntel_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderIntel_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }

function GovOpsTenderIntel_daily(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var result = { pcc: null, history: null, vendors: null, updated: 0 };

  if (typeof GovOpsPccTender_runDaily === 'function') {
    result.pcc = GovOpsPccTender_runDaily({ tenantId: tenantId, userId: data.userId || 'SYSTEM-TENDER-INTEL', mode: data.mode || 'link', keywords: data.keywords || data.關鍵字清單 });
  }

  if (typeof GovOpsTenderHistory_daily === 'function') {
    result.history = GovOpsTenderHistory_daily({ tenantId: tenantId, userId: data.userId || 'SYSTEM-TENDER-INTEL', limit: data.limit || 20 });
  }

  result.vendors = GovOpsTenderIntel_refreshVendorSummary({ tenantId: tenantId, userId: data.userId || 'SYSTEM-TENDER-INTEL' });

  return GovOpsTenderIntel_success('每日標案智慧分析完成。', result);
}

function GovOpsTenderIntel_refreshVendorSummary(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var updated = 0;
  try {
    if (typeof GovOpsProduct_readRows !== 'function' || typeof GovOpsProduct_update !== 'function') return { updated: 0, message: 'Product Core 尚未載入。' };
    var sheetName = GOVOPS_PRODUCT_SHEETS.標案池 || '04_標案池';
    var tenders = GovOpsProduct_readRows(sheetName).filter(function(row) {
      return String(row.tenantId || '') === String(tenantId) && row.標案ID;
    });
    tenders.slice(0, Number(data.limit || 100)).forEach(function(tender) {
      var summary = typeof GovOpsTenderVendorKB_summary === 'function' ? GovOpsTenderVendorKB_summary({ tenantId: tenantId, keyword: tender.標案名稱 }) : null;
      if (summary && summary.success) {
        var d = summary.data || {};
        var text = '歷史投標廠商：' + (d.bidders || []).join('、') + '\n歷史得標廠商：' + (d.winners || []).join('、') + '\n是否疑似新標案：' + (d.isNew ? '是' : '否');
        GovOpsProduct_update(sheetName, tender._row, { AI判讀摘要: tender.AI判讀摘要 || text, 更新時間: GovOpsTenderIntel_now() });
        updated++;
      }
    });
  } catch (err) {
    GovOpsTenderIntel_logError('GovOpsTenderIntel_refreshVendorSummary', err, data);
  }
  return { updated: updated };
}

function GovOpsTenderIntel_installTrigger(data) {
  data = data || {};
  GovOpsTenderIntel_removeTrigger();
  ScriptApp.newTrigger('GovOpsTenderIntel_dailyTrigger').timeBased().everyDays(1).atHour(Number(data.hour || 7)).create();
  return GovOpsTenderIntel_success('標案智慧分析每日排程已安裝。', GovOpsTenderIntel_health({}).data);
}

function GovOpsTenderIntel_removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'GovOpsTenderIntel_dailyTrigger') ScriptApp.deleteTrigger(trigger);
  });
}

function GovOpsTenderIntel_health(data) {
  var exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'GovOpsTenderIntel_dailyTrigger';
  });
  return GovOpsTenderIntel_success('標案智慧排程檢查完成。', { installed: exists });
}

function GovOpsTenderIntel_dailyTrigger() {
  return GovOpsTenderIntel_daily({ tenantId: 'TENANT-DEMO', userId: 'SYSTEM-TENDER-INTEL' });
}

function GovOpsTenderIntel_logError(module, err, data) {
  try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {}
}

function 測試_TenderIntel_Daily() { return GovOpsTenderIntel_daily({ tenantId: 'TENANT-DEMO' }); }
