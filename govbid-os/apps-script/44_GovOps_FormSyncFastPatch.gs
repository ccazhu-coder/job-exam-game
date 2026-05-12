/*
GovOps OS｜44_GovOps_FormSyncFastPatch.gs
目的：修正報名表單同步慢、抓不到分頁、需手動貼試算表 ID、重複同步等問題。
安全策略：
1. 不修改 37_core.gs / router。
2. 以同名 function 覆蓋舊版「從報名表單同步報名資料」。
3. 相容既有 SHEETS / GOVOPS_CORE_SHEETS / success / fail / readRows / updateRow / appendObject。
4. 自動建立「同步紀錄」工作表，不重建既有主表。
*/

var GOVOPS_FORM_SYNC_PATCH_VERSION = '1.0.0';
var GOVOPS_SYNC_LOG_SHEET = '同步紀錄';
var GOVOPS_SYNC_LOG_HEADERS = [
  '同步ID',
  'tenantId',
  '活動ID',
  '來源試算表ID',
  '來源試算表網址',
  '分頁名稱',
  '最後同步列數',
  '最後同步時間',
  '新增筆數',
  '略過筆數',
  '同步狀態',
  '錯誤訊息',
  '建立時間',
  '更新時間'
];

function 從報名表單同步報名資料(data) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    data = data || {};
    初始化系統();
    ensureGovOpsSyncLogSheet_();

    lock.waitLock(30000);
    lockAcquired = true;

    var activityId = String(data.活動ID || data.activityId || '').trim();
    if (!activityId) return fail('請先選擇活動。');

    var activity = getGovOpsActivityById_(activityId);
    if (!activity) return fail('找不到活動資料，請重新選擇。');

    var tenantId = String(data.tenantId || activity.tenantId || activity['tenantId'] || 'default').trim() || 'default';
    var sourceUrl = String(
      data.表單回覆試算表網址 ||
      data.responseSheetUrl ||
      data.spreadsheetUrl ||
      data.表單回覆試算表ID ||
      data.responseSheetId ||
      activity.表單回覆試算表ID ||
      activity.報名表單連結 ||
      ''
    ).trim();

    var spreadsheetId = extractSpreadsheetId(sourceUrl);
    if (!spreadsheetId) spreadsheetId = String(data.表單回覆試算表ID || data.responseSheetId || activity.表單回覆試算表ID || '').trim();
    spreadsheetId = extractSpreadsheetId(spreadsheetId) || spreadsheetId;
    if (!spreadsheetId) return fail('找不到表單回覆試算表，請貼上 Google 試算表網址或試算表ID。');

    var sourceSS = SpreadsheetApp.openById(spreadsheetId);
    var preferredSheetName = String(data.表單回覆分頁名稱 || data.responseSheetName || activity.表單回覆分頁名稱 || '').trim();
    var sourceSheet = findResponseSheet(sourceSS, preferredSheetName);
    if (!sourceSheet) return fail('找不到可同步的表單回覆分頁。');

    var sheetName = sourceSheet.getName();
    var lastRow = sourceSheet.getLastRow();
    var lastCol = sourceSheet.getLastColumn();

    if (lastRow < 2 || lastCol < 1) {
      setLastSyncRow(activityId, spreadsheetId, sheetName, 1, tenantId, 0, 0, '無資料', '');
      return success('目前表單尚無新報名資料。', {
        活動ID: activityId,
        使用分頁: sheetName,
        新增筆數: 0,
        略過筆數: 0,
        最後同步列數: 1
      });
    }

    var headers = sourceSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
    var startRow = Math.max(2, Number(getLastSyncRow(activityId, spreadsheetId, sheetName, tenantId) || 1) + 1);

    if (startRow > lastRow) {
      return success('目前沒有新的報名資料需要同步。', {
        活動ID: activityId,
        使用分頁: sheetName,
        新增筆數: 0,
        略過筆數: 0,
        最後同步列數: lastRow
      });
    }

    var numRows = lastRow - startRow + 1;
    var values = sourceSheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var added = 0;
    var skipped = 0;

    for (var i = 0; i < values.length; i++) {
      var raw = govOpsRowToObject_(headers, values[i]);
      var mapped = mapGovOpsFormRegistration_(raw);

      if (!mapped.姓名 || !mapped.電話) {
        skipped++;
        continue;
      }

      mapped.活動ID = activityId;
      mapped.tenantId = tenantId;
      mapped.userId = data.userId || activity.userId || activity['userId'] || '';
      mapped.報名方式 = '表單同步';
      mapped.來源渠道 = mapped.來源渠道 || '線上表單';
      mapped.報名狀態 = mapped.報名狀態 || '待審核';
      mapped.出席狀態 = mapped.出席狀態 || '未出席';

      var result = 新增報名(mapped);
      if (result && result.success && String(result.message || '').indexOf('略過') < 0 && String(result.message || '').indexOf('已報名過') < 0) {
        added++;
      } else {
        skipped++;
      }
    }

    setLastSyncRow(activityId, spreadsheetId, sheetName, lastRow, tenantId, added, skipped, '完成', '');
    updateActivityFormSyncInfo_(activity, spreadsheetId, sheetName, sourceUrl);

    if (typeof writeLog === 'function') {
      writeLog('同步報名資料', getSheetName_('報名'), activityId, '來源試算表：' + spreadsheetId + '／分頁：' + sheetName + '／新增：' + added + '／略過：' + skipped, '完成');
    }

    return success('報名資料同步完成。', {
      活動ID: activityId,
      tenantId: tenantId,
      來源試算表ID: spreadsheetId,
      使用分頁: sheetName,
      起始同步列: startRow,
      最後同步列數: lastRow,
      新增筆數: added,
      略過筆數: skipped,
      patchVersion: GOVOPS_FORM_SYNC_PATCH_VERSION
    });
  } catch (err) {
    try {
      setLastSyncRow(
        data && data.活動ID ? data.活動ID : '',
        extractSpreadsheetId(String(data && (data.表單回覆試算表ID || data.responseSheetId || data.spreadsheetUrl || '') || '')) || '',
        String(data && (data.表單回覆分頁名稱 || data.responseSheetName || '') || ''),
        1,
        String(data && data.tenantId || 'default'),
        0,
        0,
        '失敗',
        err && err.message ? err.message : String(err)
      );
    } catch (ignore) {}

    if (typeof logError === 'function') logError('從報名表單同步報名資料_FastPatch', err);
    return fail('報名表單無法同步：' + (err && err.message ? err.message : '請確認表單設定。'));
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (ignore2) {}
    }
  }
}

function extractSpreadsheetId(input) {
  var text = String(input || '').trim();
  if (!text) return '';

  var patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /[?&]id=([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]{20,})$/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match && match[1]) return match[1];
  }
  return '';
}

function findResponseSheet(spreadsheetOrId, preferredName) {
  var sourceSS = typeof spreadsheetOrId === 'string' ? SpreadsheetApp.openById(spreadsheetOrId) : spreadsheetOrId;
  if (!sourceSS) return null;

  if (preferredName) {
    var preferred = sourceSS.getSheetByName(preferredName);
    if (preferred) return preferred;
  }

  var names = ['Form_Responses', 'Form Responses 1', '表單回應 1', '表單回覆 1', '表單回應', '表單回覆'];
  for (var i = 0; i < names.length; i++) {
    var sheet = sourceSS.getSheetByName(names[i]);
    if (sheet) return sheet;
  }

  var sheets = sourceSS.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    var name = sheets[j].getName();
    if (/form|responses|回應|回覆/i.test(name)) return sheets[j];
  }

  return sheets.length ? sheets[0] : null;
}

function getLastSyncRow(activityId, spreadsheetId, sheetName, tenantId) {
  ensureGovOpsSyncLogSheet_();
  var rows = readGovOpsSyncRows_();
  var key = buildGovOpsSyncKey_(activityId, spreadsheetId, sheetName, tenantId);
  var latest = null;

  rows.forEach(function(row) {
    var rowKey = buildGovOpsSyncKey_(row.活動ID, row.來源試算表ID, row.分頁名稱, row.tenantId || 'default');
    if (rowKey === key) latest = row;
  });

  return latest ? Number(latest.最後同步列數 || 1) : 1;
}

function setLastSyncRow(activityId, spreadsheetId, sheetName, lastSyncRow, tenantId, added, skipped, status, errorMessage) {
  ensureGovOpsSyncLogSheet_();
  tenantId = tenantId || 'default';
  sheetName = sheetName || '';
  spreadsheetId = spreadsheetId || '';
  activityId = activityId || '';

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_SYNC_LOG_SHEET);
  var headers = getSheetHeaders_(sheet);
  var rows = readGovOpsSyncRows_();
  var key = buildGovOpsSyncKey_(activityId, spreadsheetId, sheetName, tenantId);
  var existed = null;

  rows.forEach(function(row) {
    var rowKey = buildGovOpsSyncKey_(row.活動ID, row.來源試算表ID, row.分頁名稱, row.tenantId || 'default');
    if (rowKey === key) existed = row;
  });

  var record = {
    同步ID: existed && existed.同步ID ? existed.同步ID : generateGovOpsSyncId_(),
    tenantId: tenantId,
    活動ID: activityId,
    來源試算表ID: spreadsheetId,
    來源試算表網址: spreadsheetId ? 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit' : '',
    分頁名稱: sheetName,
    最後同步列數: Number(lastSyncRow || 1),
    最後同步時間: nowSafe_(),
    新增筆數: Number(added || 0),
    略過筆數: Number(skipped || 0),
    同步狀態: status || '完成',
    錯誤訊息: errorMessage || '',
    建立時間: existed && existed.建立時間 ? existed.建立時間 : nowSafe_(),
    更新時間: nowSafe_()
  };

  if (existed && existed._row) updateSheetRowByHeaders_(sheet, existed._row, headers, record);
  else appendRowByHeaders_(sheet, headers, record);

  return record;
}

function ensureGovOpsSyncLogSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(GOVOPS_SYNC_LOG_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(GOVOPS_SYNC_LOG_SHEET);
    sheet.getRange(1, 1, 1, GOVOPS_SYNC_LOG_HEADERS.length).setValues([GOVOPS_SYNC_LOG_HEADERS]);
    return sheet;
  }

  var current = getSheetHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, GOVOPS_SYNC_LOG_HEADERS.length).setValues([GOVOPS_SYNC_LOG_HEADERS]);
    return sheet;
  }

  var missing = GOVOPS_SYNC_LOG_HEADERS.filter(function(h) { return current.indexOf(h) < 0; });
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function readGovOpsSyncRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_SYNC_LOG_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getSheetHeaders_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row, idx) {
    var obj = { _row: idx + 2 };
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function buildGovOpsSyncKey_(activityId, spreadsheetId, sheetName, tenantId) {
  return [tenantId || 'default', activityId || '', spreadsheetId || '', sheetName || ''].join('::');
}

function govOpsRowToObject_(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) {
    if (h) obj[h] = row[i];
  });
  return obj;
}

function mapGovOpsFormRegistration_(raw) {
  function pick(names) {
    for (var i = 0; i < names.length; i++) {
      if (raw[names[i]] !== undefined && raw[names[i]] !== '') return raw[names[i]];
    }
    return '';
  }

  return {
    姓名: String(pick(['姓名', '學員姓名', '名字', 'Name', '姓名 / Name']) || '').trim(),
    電話: normalizeGovOpsPhone_(pick(['電話', '手機', '聯絡電話', '手機號碼', 'Phone', '行動電話', '聯絡手機'])),
    Email: String(pick(['Email', '電子郵件', '信箱', 'Email Address', '電子信箱']) || '').trim(),
    'LINE UID': String(pick(['LINE UID', 'LINE ID', 'LINE', 'Line ID']) || '').trim(),
    身分別: String(pick(['身分別', '身份別', '學員身分', '參訓身分']) || '').trim(),
    服務單位: String(pick(['服務單位', '公司', '單位', '任職單位', '服務機關']) || '').trim(),
    所在地區: String(pick(['所在地區', '縣市', '居住地', '地區']) || '').trim(),
    來源渠道: String(pick(['來源渠道', '從哪裡得知', '報名來源', '資訊來源']) || '').trim(),
    備註: String(pick(['備註', '其他需求', '問題', '特殊需求']) || '').trim(),
    報名時間: pick(['時間戳記', 'Timestamp', '報名時間', '提交時間']) || nowSafe_()
  };
}

function normalizeGovOpsPhone_(value) {
  return String(value || '').replace(/\s/g, '').replace(/-/g, '').replace(/[()（）]/g, '').trim();
}

function getGovOpsActivityById_(activityId) {
  var sheetName = getSheetName_('活動');
  var rows = typeof readRows === 'function' ? readRows(sheetName) : [];
  return rows.find(function(row) { return String(row.活動ID) === String(activityId); }) || null;
}

function updateActivityFormSyncInfo_(activity, spreadsheetId, sheetName, sourceUrl) {
  try {
    if (!activity || !activity._row) return;
    var sheetNameMain = getSheetName_('活動');
    var patch = {
      表單回覆試算表ID: spreadsheetId,
      表單回覆分頁名稱: sheetName,
      更新時間: nowSafe_()
    };
    if (sourceUrl && String(sourceUrl).indexOf('docs.google.com') >= 0) patch.報名表單連結 = sourceUrl;
    updateRow(sheetNameMain, activity._row, patch);
  } catch (err) {
    if (typeof logError === 'function') logError('updateActivityFormSyncInfo_', err);
  }
}

function getSheetName_(key) {
  if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS[key]) return SHEETS[key];
  if (typeof GOVOPS_CORE_SHEETS !== 'undefined' && GOVOPS_CORE_SHEETS && GOVOPS_CORE_SHEETS[key]) return GOVOPS_CORE_SHEETS[key];
  var fallback = {
    活動: '招生活動管理',
    報名: '報名資料庫',
    CRM: '學員CRM',
    操作: '操作紀錄',
    錯誤: '錯誤紀錄'
  };
  return fallback[key] || key;
}

function getSheetHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim(); });
}

function appendRowByHeaders_(sheet, headers, obj) {
  var row = headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
}

function updateSheetRowByHeaders_(sheet, rowNumber, headers, obj) {
  Object.keys(obj).forEach(function(key) {
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowNumber, col).setValue(obj[key]);
  });
}

function generateGovOpsSyncId_() {
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  var rows = readGovOpsSyncRows_();
  var prefix = 'SYNC-' + roc + '-';
  var max = 0;
  rows.forEach(function(row) {
    var id = String(row.同步ID || '');
    if (id.indexOf(prefix) === 0) {
      var n = Number(id.replace(prefix, ''));
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return prefix + String(max + 1).padStart(4, '0');
}

function nowSafe_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_FormSync_解析試算表ID() {
  return success('測試完成。', {
    url: extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY/edit?usp=sharing'),
    raw: extractSpreadsheetId('1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY')
  });
}

function 測試_FormSync_初始化同步紀錄() {
  ensureGovOpsSyncLogSheet_();
  return success('同步紀錄表已確認。', { sheet: GOVOPS_SYNC_LOG_SHEET, headers: GOVOPS_SYNC_LOG_HEADERS });
}
