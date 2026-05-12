/*
GovOps OS｜45_GovOps_SchemaGovernance.gs
目的：治理 GovOps OS 過度膨脹的 Google Sheets schema。
安全策略：
1. 不修改 37_core.gs / router。
2. 不刪除任何工作表。
3. 不移動任何資料。
4. 只建立/補齊「Schema治理中心」與「Schema稽核紀錄」。
5. 可由 Apps Script 手動執行測試函式。
*/

var GOVOPS_SCHEMA_GOVERNANCE_VERSION = '1.0.0';
var GOVOPS_SCHEMA_CENTER_SHEET = 'Schema治理中心';
var GOVOPS_SCHEMA_AUDIT_SHEET = 'Schema稽核紀錄';

var GOVOPS_SCHEMA_CENTER_HEADERS = [
  '工作表名稱',
  '分類',
  '正式狀態',
  '對應模組',
  '建議處理',
  '主表對應',
  '欄位數',
  '資料列數',
  '是否含tenantId',
  '是否含活動ID',
  '是否含標案ID',
  '是否含學員ID',
  '是否含報名ID',
  '欄位清單',
  '風險等級',
  '風險說明',
  '最後稽核時間',
  '備註'
];

var GOVOPS_SCHEMA_AUDIT_HEADERS = [
  '稽核ID',
  '稽核時間',
  '工作表總數',
  '正式主表數',
  '候選舊表數',
  '重複風險數',
  '缺tenantId數',
  '高風險數',
  '稽核摘要',
  '建立時間'
];

var GOVOPS_SCHEMA_PRIMARY_SHEETS = {
  '系統設定': 'System',
  '招生活動管理': 'Activity',
  '報名資料庫': 'Registration',
  '學員CRM': 'CRM',
  '候補名單': 'Registration',
  '當日工作任務表': 'Workflow',
  '物品清單': 'Workflow',
  '餐點管理': 'Workflow',
  '簽到表紀錄': 'Attendance',
  '核銷檢查中心': 'Reimbursement',
  '文件歸檔紀錄': 'Drive',
  '應收帳款': 'Finance',
  '收款紀錄': 'Finance',
  '支出明細': 'Finance',
  '專案損益': 'Finance',
  '提醒中心': 'Reminder',
  '秘書摘要': 'AI Secretary',
  '操作紀錄': 'Audit',
  '錯誤紀錄': 'Audit',
  '使用者常用選項': 'System',
  '同步紀錄': 'Sync',
  '標案池': 'Tender',
  '投標專案': 'Tender',
  '合作廠商': 'Vendor',
  '簡報答詢': 'Tender',
  '標案自動匯入': 'Tender',
  'AI提案產出': 'AI Tender',
  '組織資料表': 'SaaS',
  '使用者帳號表': 'SaaS',
  'SaaS訂閱表': 'SaaS',
  '登入紀錄表': 'SaaS',
  'Session紀錄表': 'SaaS',
  '系統ID中心': 'Core',
  '資料關聯索引': 'Core',
  '系統設定中心': 'Core',
  '使用者角色權限': 'SaaS',
  '權限規則': 'SaaS',
  '異動管理': 'Audit',
  '事件佇列中心': 'Workflow',
  '流程執行紀錄': 'Workflow',
  '狀態規則中心': 'State',
  '系統錯誤紀錄': 'Audit',
  '系統備份紀錄': 'Recovery',
  'AI知識庫索引': 'AI'
};

var GOVOPS_SCHEMA_DUPLICATE_GROUPS = {
  'Activity': ['招生活動管理', '活動主表', '活動行政紀錄', '課程執行紀錄'],
  'Registration': ['報名資料庫', '報名資料', '基本資料庫'],
  'CRM': ['學員CRM', 'CRM資料'],
  'Task': ['當日工作任務表', '現場任務', '開課任務清單', '報到處任務'],
  'Items': ['物品清單', '物品管理', '教材與物資準備', '場地設備確認'],
  'Attendance': ['簽到表紀錄', '簽到表'],
  'Reimbursement': ['核銷檢查中心', '核銷管理', '核銷文件管理', '領據管理', '課後回收檢核'],
  'Drive': ['文件歸檔紀錄', 'Drive歸檔', '檔案歸檔中心', '檔案版本紀錄', '文件搜尋索引'],
  'Finance': ['應收帳款', '收款紀錄', '支出明細', '專案損益', '支出紀錄', '財務收支', '財務應收', '財務收款', '財務支出'],
  'Reminder': ['提醒中心', '秘書摘要', '秘書摘要紀錄', '開課通知紀錄', 'LINE通知紀錄']
};

function 執行Schema治理稽核() {
  try {
    ensureSchemaGovernanceSheets_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var rows = [];
    var stats = {
      total: sheets.length,
      primary: 0,
      legacy: 0,
      duplicateRisk: 0,
      missingTenant: 0,
      highRisk: 0
    };

    sheets.forEach(function(sheet) {
      var analysis = analyzeGovOpsSheet_(sheet);
      rows.push(analysis);
      if (analysis.正式狀態 === '正式主表') stats.primary++;
      if (analysis.正式狀態 === '舊版候選' || analysis.正式狀態 === '測試/棄用候選') stats.legacy++;
      if (String(analysis.風險說明 || '').indexOf('重複') >= 0) stats.duplicateRisk++;
      if (analysis.是否含tenantId === '否' && shouldHaveTenantId_(analysis)) stats.missingTenant++;
      if (analysis.風險等級 === '高') stats.highRisk++;
    });

    writeSchemaGovernanceRows_(rows);
    appendSchemaAuditLog_(stats);

    return success('Schema治理稽核完成。', {
      version: GOVOPS_SCHEMA_GOVERNANCE_VERSION,
      工作表總數: stats.total,
      正式主表數: stats.primary,
      舊版候選數: stats.legacy,
      重複風險數: stats.duplicateRisk,
      缺tenantId數: stats.missingTenant,
      高風險數: stats.highRisk,
      治理中心: GOVOPS_SCHEMA_CENTER_SHEET,
      稽核紀錄: GOVOPS_SCHEMA_AUDIT_SHEET
    });
  } catch (err) {
    if (typeof logError === 'function') logError('執行Schema治理稽核', err);
    return fail('Schema治理稽核失敗：' + (err && err.message ? err.message : String(err)));
  }
}

function 取得Schema治理報告(data) {
  try {
    ensureSchemaGovernanceSheets_();
    var rows = readSchemaRows_();
    var status = data && data.正式狀態 ? String(data.正式狀態) : '';
    var moduleName = data && data.對應模組 ? String(data.對應模組) : '';

    if (status) rows = rows.filter(function(r) { return String(r.正式狀態) === status; });
    if (moduleName) rows = rows.filter(function(r) { return String(r.對應模組) === moduleName; });

    return success('Schema治理報告已取得。', {
      筆數: rows.length,
      結果: rows,
      正式主表: rows.filter(function(r) { return r.正式狀態 === '正式主表'; }).map(function(r) { return r.工作表名稱; }),
      舊版候選: rows.filter(function(r) { return r.正式狀態 === '舊版候選'; }).map(function(r) { return r.工作表名稱; }),
      高風險: rows.filter(function(r) { return r.風險等級 === '高'; }).map(function(r) { return r.工作表名稱; })
    });
  } catch (err) {
    if (typeof logError === 'function') logError('取得Schema治理報告', err);
    return fail('Schema治理報告讀取失敗。');
  }
}

function analyzeGovOpsSheet_(sheet) {
  var name = sheet.getName();
  var headers = getGovOpsSchemaHeaders_(sheet);
  var moduleName = classifyGovOpsSheetModule_(name);
  var officialStatus = classifyGovOpsSheetStatus_(name);
  var duplicateInfo = findDuplicateGroupInfo_(name);
  var rowCount = Math.max(0, sheet.getLastRow() - 1);
  var risk = evaluateGovOpsSheetRisk_(name, headers, officialStatus, duplicateInfo);

  return {
    工作表名稱: name,
    分類: classifyGovOpsSheetCategory_(name, moduleName),
    正式狀態: officialStatus,
    對應模組: moduleName,
    建議處理: recommendGovOpsSheetAction_(name, officialStatus, duplicateInfo),
    主表對應: duplicateInfo.primary || (officialStatus === '正式主表' ? name : ''),
    欄位數: headers.length,
    資料列數: rowCount,
    是否含tenantId: headers.indexOf('tenantId') >= 0 ? '是' : '否',
    是否含活動ID: headers.indexOf('活動ID') >= 0 ? '是' : '否',
    是否含標案ID: headers.indexOf('標案ID') >= 0 ? '是' : '否',
    是否含學員ID: headers.indexOf('學員ID') >= 0 ? '是' : '否',
    是否含報名ID: headers.indexOf('報名ID') >= 0 ? '是' : '否',
    欄位清單: headers.join('｜'),
    風險等級: risk.level,
    風險說明: risk.reason,
    最後稽核時間: nowSchemaSafe_(),
    備註: ''
  };
}

function classifyGovOpsSheetModule_(name) {
  if (GOVOPS_SCHEMA_PRIMARY_SHEETS[name]) return GOVOPS_SCHEMA_PRIMARY_SHEETS[name];
  for (var group in GOVOPS_SCHEMA_DUPLICATE_GROUPS) {
    if (GOVOPS_SCHEMA_DUPLICATE_GROUPS[group].indexOf(name) >= 0) return group;
  }
  if (/財務|應收|收款|支出|損益/.test(name)) return 'Finance';
  if (/報名|候補|簽到/.test(name)) return 'Registration';
  if (/CRM|學員|名單|互動|標籤/.test(name)) return 'CRM';
  if (/活動|課程|開課|場地|教材|物品|餐點|任務/.test(name)) return 'Activity/Workflow';
  if (/核銷|領據|回收/.test(name)) return 'Reimbursement';
  if (/Drive|歸檔|檔案|文件/.test(name)) return 'Drive';
  if (/LINE|秘書|提醒|通知/.test(name)) return 'Reminder/LINE';
  if (/標案|投標|廠商|簡報|提案|心智圖/.test(name)) return 'Tender';
  if (/系統|權限|角色|Session|登入|SaaS|設定|異動|事件|流程|狀態|備份|錯誤|日誌|ID/.test(name)) return 'System/Runtime';
  return 'Unknown';
}

function classifyGovOpsSheetStatus_(name) {
  if (name === GOVOPS_SCHEMA_CENTER_SHEET || name === GOVOPS_SCHEMA_AUDIT_SHEET) return '治理表';
  if (GOVOPS_SCHEMA_PRIMARY_SHEETS[name]) return '正式主表';

  for (var group in GOVOPS_SCHEMA_DUPLICATE_GROUPS) {
    var list = GOVOPS_SCHEMA_DUPLICATE_GROUPS[group];
    if (list.indexOf(name) >= 1) return '舊版候選';
  }

  if (/工作表\d+/.test(name)) return '測試/棄用候選';
  if (/Runtime|健康|測試|QA|暫存/.test(name)) return 'Runtime/測試';
  return '待判斷';
}

function classifyGovOpsSheetCategory_(name, moduleName) {
  if (/System|Runtime|SaaS|Core|Audit|Recovery|State/.test(moduleName)) return '系統治理';
  if (/Activity|Workflow|Registration|CRM|Attendance|Reimbursement|Drive|Finance|Reminder/.test(moduleName)) return 'ERP營運';
  if (/Tender|Vendor/.test(moduleName)) return '標案履約';
  if (/AI/.test(moduleName)) return 'AI';
  return '其他';
}

function findDuplicateGroupInfo_(name) {
  for (var group in GOVOPS_SCHEMA_DUPLICATE_GROUPS) {
    var list = GOVOPS_SCHEMA_DUPLICATE_GROUPS[group];
    var idx = list.indexOf(name);
    if (idx >= 0) {
      return {
        group: group,
        primary: list[0],
        isDuplicate: idx > 0,
        all: list.join('、')
      };
    }
  }
  return { group: '', primary: '', isDuplicate: false, all: '' };
}

function recommendGovOpsSheetAction_(name, officialStatus, duplicateInfo) {
  if (officialStatus === '正式主表') return '保留為正式主表；後續程式應優先讀寫此表。';
  if (officialStatus === '治理表') return '保留；作為Schema治理與稽核用途。';
  if (duplicateInfo && duplicateInfo.isDuplicate) return '暫停新寫入；只讀參考；後續資料應逐步合併到「' + duplicateInfo.primary + '」。';
  if (officialStatus === '測試/棄用候選') return '暫停使用；確認無資料依賴後可封存。';
  if (officialStatus === 'Runtime/測試') return '保留但不得承載ERP主資料。';
  return '暫不改動；待人工確認是否納入正式資料流。';
}

function evaluateGovOpsSheetRisk_(name, headers, officialStatus, duplicateInfo) {
  var reasons = [];
  var level = '低';

  if (!headers.length) reasons.push('無表頭');
  if (duplicateInfo && duplicateInfo.isDuplicate) reasons.push('與正式主表「' + duplicateInfo.primary + '」功能重複');
  if (officialStatus === '正式主表' && shouldHaveTenantByName_(name) && headers.indexOf('tenantId') < 0) reasons.push('正式主表缺tenantId');
  if (/活動|報名|CRM|財務|核銷|歸檔|任務|餐點|物品|簽到|標案/.test(name) && headers.length > 0 && headers.length < 5) reasons.push('營運表欄位過少，可能不是正式結構');
  if (/工作表\d+/.test(name)) reasons.push('疑似預設測試表');

  if (reasons.length >= 2 || reasons.join('').indexOf('缺tenantId') >= 0) level = '高';
  else if (reasons.length === 1) level = '中';

  return {
    level: level,
    reason: reasons.length ? reasons.join('；') : '目前未見明顯風險'
  };
}

function shouldHaveTenantByName_(name) {
  return /活動|報名|CRM|候補|任務|物品|餐點|簽到|核銷|文件|應收|收款|支出|損益|提醒|標案|投標|廠商|LINE|Session|使用者|組織/.test(name);
}

function shouldHaveTenantId_(analysis) {
  return shouldHaveTenantByName_(analysis.工作表名稱) && analysis.正式狀態 !== '治理表';
}

function ensureSchemaGovernanceSheets_() {
  ensureSheetWithHeaders_(GOVOPS_SCHEMA_CENTER_SHEET, GOVOPS_SCHEMA_CENTER_HEADERS);
  ensureSheetWithHeaders_(GOVOPS_SCHEMA_AUDIT_SHEET, GOVOPS_SCHEMA_AUDIT_HEADERS);
}

function ensureSheetWithHeaders_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  var current = getGovOpsSchemaHeaders_(sheet);
  if (!current.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  var missing = headers.filter(function(h) { return current.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function writeSchemaGovernanceRows_(rows) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_SCHEMA_CENTER_SHEET);
  var headers = getGovOpsSchemaHeaders_(sheet);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  if (!rows.length) return;

  var values = rows.map(function(row) {
    return headers.map(function(h) { return row[h] !== undefined ? row[h] : ''; });
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function appendSchemaAuditLog_(stats) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_SCHEMA_AUDIT_SHEET);
  var headers = getGovOpsSchemaHeaders_(sheet);
  var record = {
    稽核ID: generateSchemaAuditId_(),
    稽核時間: nowSchemaSafe_(),
    工作表總數: stats.total,
    正式主表數: stats.primary,
    候選舊表數: stats.legacy,
    重複風險數: stats.duplicateRisk,
    缺tenantId數: stats.missingTenant,
    高風險數: stats.highRisk,
    稽核摘要: '正式主表 ' + stats.primary + '；舊版候選 ' + stats.legacy + '；重複風險 ' + stats.duplicateRisk + '；缺tenantId ' + stats.missingTenant + '；高風險 ' + stats.highRisk,
    建立時間: nowSchemaSafe_()
  };
  sheet.appendRow(headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; }));
}

function readSchemaRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_SCHEMA_CENTER_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = getGovOpsSchemaHeaders_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function getGovOpsSchemaHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim(); });
}

function generateSchemaAuditId_() {
  var roc = String(Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy')) - 1911);
  var prefix = 'SCHEMA-' + roc + '-';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GOVOPS_SCHEMA_AUDIT_SHEET);
  var max = 0;
  if (sheet && sheet.getLastRow() >= 2) {
    var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    ids.forEach(function(row) {
      var id = String(row[0] || '');
      if (id.indexOf(prefix) === 0) {
        var n = Number(id.replace(prefix, ''));
        if (!isNaN(n) && n > max) max = n;
      }
    });
  }
  return prefix + String(max + 1).padStart(4, '0');
}

function nowSchemaSafe_() {
  if (typeof now === 'function') return now();
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function 測試_Schema治理稽核() {
  return 執行Schema治理稽核();
}

function 測試_取得Schema治理報告() {
  return 取得Schema治理報告({});
}
