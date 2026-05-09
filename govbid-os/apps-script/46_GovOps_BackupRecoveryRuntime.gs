/*
GovOps OS｜46_GovOps_BackupRecoveryRuntime.gs
商用 SaaS ERP Backup / Recovery Runtime v1.0.0

用途：
1. 建立系統快照紀錄
2. 支援租戶資料匯出
3. 建立備份索引
4. 建立復原紀錄
5. 為正式商用備援做基礎
*/

var GOVOPS_BACKUP_VERSION = '1.0.0';
var GOVOPS_BACKUP_INDEX_SHEET = '系統備份索引';
var GOVOPS_BACKUP_LOG_SHEET = '系統復原紀錄';

function BK_indexHeaders_() {
  return ['backupId','tenantId','backupType','sourceSheet','targetSheet','筆數','狀態','建立時間','建立者','備註'];
}

function BK_logHeaders_() {
  return ['restoreId','backupId','tenantId','restoreType','狀態','訊息','建立時間','執行者'];
}

function BK_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function BK_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function BK_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function BK_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function BK_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || ''
  };
}

function 初始化備份復原系統() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_BACKUP_INDEX_SHEET, BK_indexHeaders_());
    DAL_ensureHeaders_(GOVOPS_BACKUP_LOG_SHEET, BK_logHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_BACKUP_INDEX_SHEET, BK_indexHeaders_());
    ensureSheet(GOVOPS_BACKUP_LOG_SHEET, BK_logHeaders_());
  }
  return BK_success_('備份復原系統初始化完成。', { version: GOVOPS_BACKUP_VERSION });
}

function BK_getCoreSheets_() {
  if (typeof GOVOPS_CORE_SHEETS !== 'undefined') {
    return Object.keys(GOVOPS_CORE_SHEETS).map(function(k){ return GOVOPS_CORE_SHEETS[k]; });
  }
  return ['招生活動管理','報名資料庫','學員CRM','當日工作任務表','物品清單','簽到表紀錄','文件歸檔紀錄','應收帳款','收款紀錄','支出紀錄'];
}

function 建立系統快照(data) {
  初始化備份復原系統();
  data = data || {};
  var ctx = BK_ctx_(data);
  var backupId = BK_id_('BKP');
  var sheets = data.sheets || BK_getCoreSheets_();
  var created = [];

  if (typeof DAL_query !== 'function' || typeof DAL_batchAppend !== 'function') {
    return BK_fail_('DataAccessLayer 尚未載入，無法建立快照。');
  }

  sheets.forEach(function(sheetName) {
    try {
      var res = DAL_query(sheetName, { tenantId: ctx.tenantId, limit: 500, cache: false });
      var rows = res.data.rows || [];
      if (!rows.length) return;
      var targetSheet = '備份_' + backupId + '_' + sheetName;
      var cleanRows = rows.map(function(r) {
        var obj = {};
        Object.keys(r).forEach(function(k){ if (k !== '_row') obj[k] = r[k]; });
        return obj;
      });
      var headers = Object.keys(cleanRows[0] || {});
      DAL_batchAppend(targetSheet, cleanRows, headers);
      BK_recordBackupIndex_(backupId, ctx, 'snapshot', sheetName, targetSheet, cleanRows.length, '完成', data.note || '系統快照');
      created.push({ sourceSheet: sheetName, targetSheet: targetSheet, count: cleanRows.length });
    } catch (err) {
      BK_recordBackupIndex_(backupId, ctx, 'snapshot', sheetName, '', 0, '失敗', '快照失敗');
    }
  });

  return BK_success_('系統快照建立完成。', { backupId: backupId, sheets: created });
}

function 匯出租戶資料(data) {
  初始化備份復原系統();
  data = data || {};
  var ctx = BK_ctx_(data);
  if (!ctx.tenantId) return BK_fail_('缺少 tenantId，無法匯出租戶資料。');
  return 建立系統快照(Object.assign({}, data, { note: '租戶資料匯出' }));
}

function BK_recordBackupIndex_(backupId, ctx, type, source, target, count, status, note) {
  var row = {
    backupId: backupId,
    tenantId: ctx.tenantId || '',
    backupType: type || 'snapshot',
    sourceSheet: source || '',
    targetSheet: target || '',
    筆數: count || 0,
    狀態: status || '完成',
    建立時間: BK_now_(),
    建立者: ctx.userId || '',
    備註: note || ''
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_BACKUP_INDEX_SHEET, row, BK_indexHeaders_());
}

function 查詢備份索引(data) {
  初始化備份復原系統();
  data = data || {};
  if (typeof DAL_query !== 'function') return BK_fail_('DataAccessLayer 尚未載入。');
  var ctx = BK_ctx_(data);
  var res = DAL_query(GOVOPS_BACKUP_INDEX_SHEET, {
    tenantId: ctx.tenantId,
    keyword: data.keyword || data['關鍵字'] || '',
    limit: data.limit || 100,
    page: data.page || 1,
    cache: false
  });
  return BK_success_('備份索引查詢完成。', { 備份: res.data.rows, 筆數: res.data.total });
}

function 記錄復原作業(data) {
  初始化備份復原系統();
  data = data || {};
  var ctx = BK_ctx_(data);
  var row = {
    restoreId: BK_id_('RST'),
    backupId: data.backupId || '',
    tenantId: ctx.tenantId,
    restoreType: data.restoreType || 'manual',
    狀態: data.status || 'recorded',
    訊息: data.message || '已記錄復原作業。',
    建立時間: BK_now_(),
    執行者: ctx.userId
  };
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_BACKUP_LOG_SHEET, row, BK_logHeaders_());
  return BK_success_('復原作業已記錄。', row);
}

function 建立備份觸發器() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === '每日系統快照') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('每日系統快照').timeBased().everyDays(1).atHour(3).create();
  return BK_success_('每日系統快照觸發器已建立。');
}

function 每日系統快照() {
  return 建立系統快照({ note: '每日自動快照' });
}

function 測試_BackupRecoveryRuntime() {
  初始化備份復原系統();
  var ctx = { tenantId: 'QA-BACKUP', userId: 'QA-USER' };
  var log = 記錄復原作業(Object.assign({}, ctx, { backupId: 'QA-BKP', restoreType: 'test', status: 'success', message: '測試復原紀錄' }));
  var index = 查詢備份索引(ctx);
  return BK_success_('Backup Recovery Runtime 測試完成。', { 復原紀錄: log, 備份索引: index });
}
