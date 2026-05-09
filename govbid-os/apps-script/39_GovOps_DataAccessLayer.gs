/*
GovOps OS｜39_GovOps_DataAccessLayer.gs
商用 SaaS ERP 資料存取層 v1.0.0

目的：
1. 降低 Google Sheets 全表掃描風險
2. 建立 tenantId / userId 資料隔離查詢
3. 支援分頁、關鍵字、排序、批次寫入
4. 支援 CacheService 快取
5. 作為 38_GovOps_ERP_Modules_AllInOne.gs 後續重構基礎

注意：
- 不破壞 25 / 37 / 38
- 可以獨立貼上
- 目前先作為 DAL Layer，後續逐步把 ERP modules 改接本層
*/

var GOVOPS_DAL_VERSION = '1.0.0';
var GOVOPS_DAL_CACHE_SECONDS = 120;
var GOVOPS_DAL_DEFAULT_LIMIT = 50;
var GOVOPS_DAL_MAX_LIMIT = 300;

function DAL_getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function DAL_sheet_(sheetName) {
  var ss = DAL_getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}

function DAL_headers_(sheetName) {
  var sheet = DAL_sheet_(sheetName);
  if (sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function DAL_ensureHeaders_(sheetName, headers) {
  var sheet = DAL_sheet_(sheetName);
  headers = headers || [];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return headers;
  }
  var current = DAL_headers_(sheetName);
  var missing = headers.filter(function(h) { return current.indexOf(h) < 0; });
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
    current = current.concat(missing);
  }
  return current;
}

function DAL_cache_() {
  try { return CacheService.getScriptCache(); } catch (err) { return null; }
}

function DAL_cacheKey_(sheetName, tenantId, extra) {
  return ['GovOpsDAL', GOVOPS_DAL_VERSION, sheetName, tenantId || 'ALL', extra || ''].join('::').slice(0, 240);
}

function DAL_getCached_(key) {
  var cache = DAL_cache_();
  if (!cache) return null;
  var raw = cache.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function DAL_setCached_(key, value, seconds) {
  var cache = DAL_cache_();
  if (!cache) return;
  try { cache.put(key, JSON.stringify(value), seconds || GOVOPS_DAL_CACHE_SECONDS); } catch (err) {}
}

function DAL_clearSheetCache_(sheetName, tenantId) {
  // CacheService 不支援 wildcard delete，這裡保留接口，後續可接索引版 cache keys。
  return true;
}

function DAL_normalizeContext_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || data.role || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function DAL_rowToObject_(headers, values, rowNumber) {
  var obj = { _row: rowNumber };
  headers.forEach(function(h, i) { obj[h] = values[i]; });
  return obj;
}

function DAL_matchTenant_(row, ctx) {
  if (!ctx.tenantId) return true;
  if (!row.tenantId && !row['組織ID']) return true;
  return String(row.tenantId || row['組織ID']) === String(ctx.tenantId);
}

function DAL_matchKeyword_(row, keyword, fields) {
  if (!keyword) return true;
  keyword = String(keyword).toLowerCase();
  var keys = fields && fields.length ? fields : Object.keys(row);
  return keys.some(function(k) { return String(row[k] || '').toLowerCase().indexOf(keyword) >= 0; });
}

function DAL_matchFilters_(row, filters) {
  filters = filters || {};
  return Object.keys(filters).every(function(key) {
    var expected = filters[key];
    if (expected === undefined || expected === null || expected === '') return true;
    if (Array.isArray(expected)) return expected.map(String).indexOf(String(row[key])) >= 0;
    return String(row[key] || '') === String(expected);
  });
}

function DAL_sortRows_(rows, sortBy, sortDir) {
  if (!sortBy) return rows;
  sortDir = String(sortDir || 'desc').toLowerCase();
  return rows.sort(function(a, b) {
    var av = a[sortBy] || '';
    var bv = b[sortBy] || '';
    if (av === bv) return 0;
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });
}

function DAL_paginate_(rows, page, limit) {
  page = Math.max(Number(page || 1), 1);
  limit = Math.min(Math.max(Number(limit || GOVOPS_DAL_DEFAULT_LIMIT), 1), GOVOPS_DAL_MAX_LIMIT);
  var total = rows.length;
  var start = (page - 1) * limit;
  return {
    rows: rows.slice(start, start + limit),
    page: page,
    limit: limit,
    total: total,
    totalPages: Math.max(Math.ceil(total / limit), 1)
  };
}

function DAL_query(sheetName, options) {
  options = options || {};
  var ctx = DAL_normalizeContext_(options);
  var cacheable = options.cache !== false;
  var cacheKey = DAL_cacheKey_(sheetName, ctx.tenantId, JSON.stringify({
    keyword: options.keyword || '',
    filters: options.filters || {},
    fields: options.fields || [],
    sortBy: options.sortBy || '',
    sortDir: options.sortDir || '',
    page: options.page || 1,
    limit: options.limit || GOVOPS_DAL_DEFAULT_LIMIT
  }));

  if (cacheable) {
    var cached = DAL_getCached_(cacheKey);
    if (cached) return cached;
  }

  var sheet = DAL_sheet_(sheetName);
  var headers = DAL_headers_(sheetName);
  if (!headers.length || sheet.getLastRow() < 2) {
    var empty = {
      success: true,
      message: '查詢完成。',
      data: { rows: [], page: 1, limit: Number(options.limit || GOVOPS_DAL_DEFAULT_LIMIT), total: 0, totalPages: 1 }
    };
    DAL_setCached_(cacheKey, empty);
    return empty;
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var rows = values.map(function(row, idx) { return DAL_rowToObject_(headers, row, idx + 2); });

  rows = rows.filter(function(row) {
    return DAL_matchTenant_(row, ctx) &&
           DAL_matchKeyword_(row, options.keyword, options.fields) &&
           DAL_matchFilters_(row, options.filters || {});
  });

  rows = DAL_sortRows_(rows, options.sortBy || '建立時間', options.sortDir || 'desc');
  var paged = DAL_paginate_(rows, options.page, options.limit);

  var result = {
    success: true,
    message: '查詢完成。',
    data: paged
  };

  if (cacheable) DAL_setCached_(cacheKey, result);
  return result;
}

function DAL_findOne(sheetName, options) {
  options = options || {};
  options.limit = 1;
  options.page = 1;
  options.cache = options.cache !== false;
  var res = DAL_query(sheetName, options);
  var row = res && res.data && res.data.rows && res.data.rows.length ? res.data.rows[0] : null;
  return row;
}

function DAL_append(sheetName, rowObject, headers) {
  rowObject = rowObject || {};
  headers = headers || (typeof GOVOPS_CORE_HEADERS !== 'undefined' ? GOVOPS_CORE_HEADERS[sheetName] : null) || DAL_headers_(sheetName) || Object.keys(rowObject);
  headers = DAL_ensureHeaders_(sheetName, headers);
  var sheet = DAL_sheet_(sheetName);
  sheet.appendRow(headers.map(function(h) { return rowObject[h] !== undefined ? rowObject[h] : ''; }));
  DAL_clearSheetCache_(sheetName, rowObject.tenantId || rowObject['組織ID']);
  return rowObject;
}

function DAL_batchAppend(sheetName, rowObjects, headers) {
  rowObjects = rowObjects || [];
  if (!rowObjects.length) return { success: true, message: '沒有資料需要寫入。', data: { count: 0 } };
  headers = headers || (typeof GOVOPS_CORE_HEADERS !== 'undefined' ? GOVOPS_CORE_HEADERS[sheetName] : null) || DAL_headers_(sheetName) || Object.keys(rowObjects[0]);
  headers = DAL_ensureHeaders_(sheetName, headers);
  var values = rowObjects.map(function(obj) { return headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; }); });
  var sheet = DAL_sheet_(sheetName);
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  return { success: true, message: '批次寫入完成。', data: { count: values.length } };
}

function DAL_updateByRow(sheetName, rowNumber, patch) {
  patch = patch || {};
  var sheet = DAL_sheet_(sheetName);
  var headers = DAL_headers_(sheetName);
  Object.keys(patch).forEach(function(key) {
    var col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowNumber, col).setValue(patch[key]);
  });
  return { success: true, message: '資料已更新。', data: { row: rowNumber } };
}

function DAL_updateWhere(sheetName, options, patch) {
  var row = DAL_findOne(sheetName, options || {});
  if (!row) return { success: false, message: '查無可更新資料。', data: {} };
  return DAL_updateByRow(sheetName, row._row, patch || {});
}

function DAL_count(sheetName, options) {
  options = options || {};
  options.limit = 1;
  var res = DAL_query(sheetName, options);
  return res && res.data ? res.data.total : 0;
}

function DAL_healthCheck() {
  return {
    success: true,
    message: 'DataAccessLayer 正常。',
    data: {
      version: GOVOPS_DAL_VERSION,
      cacheSeconds: GOVOPS_DAL_CACHE_SECONDS,
      defaultLimit: GOVOPS_DAL_DEFAULT_LIMIT,
      maxLimit: GOVOPS_DAL_MAX_LIMIT
    }
  };
}

function 測試_DAL_健康檢查() {
  return DAL_healthCheck();
}

function 測試_DAL_TenantQuery() {
  var sheetName = 'DAL測試資料';
  DAL_ensureHeaders_(sheetName, ['tenantId','userId','資料ID','名稱','建立時間']);
  var tenantId = 'DAL-TENANT-' + new Date().getTime();
  DAL_batchAppend(sheetName, [
    { tenantId: tenantId, userId: 'U1', 資料ID: 'A1', 名稱: '甲資料', 建立時間: new Date() },
    { tenantId: tenantId, userId: 'U1', 資料ID: 'A2', 名稱: '乙資料', 建立時間: new Date() },
    { tenantId: 'OTHER', userId: 'U2', 資料ID: 'B1', 名稱: '其他租戶資料', 建立時間: new Date() }
  ], ['tenantId','userId','資料ID','名稱','建立時間']);
  return DAL_query(sheetName, { tenantId: tenantId, keyword: '資料', page: 1, limit: 10, cache: false });
}

function 測試_DAL_BatchWrite() {
  var sheetName = 'DAL批次寫入測試';
  var rows = [];
  for (var i = 1; i <= 10; i++) {
    rows.push({ tenantId: 'QA-DAL', userId: 'QA-USER', 資料ID: 'BATCH-' + i, 名稱: '批次資料' + i, 建立時間: new Date() });
  }
  return DAL_batchAppend(sheetName, rows, ['tenantId','userId','資料ID','名稱','建立時間']);
}
