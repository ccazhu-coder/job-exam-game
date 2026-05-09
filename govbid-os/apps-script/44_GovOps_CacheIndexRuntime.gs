/*
GovOps OS｜44_GovOps_CacheIndexRuntime.gs
商用 SaaS ERP Cache / Index Runtime v1.0.0

用途：
1. 建立查詢索引紀錄
2. 建立 Cache Key Registry
3. 支援 tenant 級快取失效
4. 為 DAL 商用效能升級做基礎
*/

var GOVOPS_CACHE_INDEX_VERSION = '1.0.0';
var GOVOPS_CACHE_REGISTRY_SHEET = '系統快取索引表';
var GOVOPS_QUERY_INDEX_SHEET = '系統查詢索引表';

function CIR_cacheHeaders_() {
  return ['cacheKey','tenantId','sheetName','queryHash','建立時間','更新時間','狀態'];
}

function CIR_indexHeaders_() {
  return ['indexId','tenantId','sheetName','indexType','indexValue','rowNumber','建立時間','更新時間','狀態'];
}

function CIR_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function CIR_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function CIR_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function CIR_id_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function 初始化快取索引系統() {
  if (typeof DAL_ensureHeaders_ === 'function') {
    DAL_ensureHeaders_(GOVOPS_CACHE_REGISTRY_SHEET, CIR_cacheHeaders_());
    DAL_ensureHeaders_(GOVOPS_QUERY_INDEX_SHEET, CIR_indexHeaders_());
  } else if (typeof ensureSheet === 'function') {
    ensureSheet(GOVOPS_CACHE_REGISTRY_SHEET, CIR_cacheHeaders_());
    ensureSheet(GOVOPS_QUERY_INDEX_SHEET, CIR_indexHeaders_());
  }
  return CIR_success_('快取索引系統初始化完成。', { version: GOVOPS_CACHE_INDEX_VERSION });
}

function CIR_hash_(obj) {
  var text = typeof obj === 'string' ? obj : JSON.stringify(obj || {});
  var hash = 0;
  for (var i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  return 'H' + Math.abs(hash);
}

function CIR_registerCacheKey(data) {
  初始化快取索引系統();
  data = data || {};
  var row = {
    cacheKey: data.cacheKey || '',
    tenantId: data.tenantId || data['組織ID'] || '',
    sheetName: data.sheetName || '',
    queryHash: data.queryHash || CIR_hash_(data.query || {}),
    建立時間: CIR_now_(),
    更新時間: CIR_now_(),
    狀態: 'active'
  };
  if (!row.cacheKey) return CIR_fail_('缺少 cacheKey。');
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_CACHE_REGISTRY_SHEET, row, CIR_cacheHeaders_());
  return CIR_success_('快取索引已登錄。', row);
}

function CIR_registerRowIndex(data) {
  初始化快取索引系統();
  data = data || {};
  var row = {
    indexId: CIR_id_('IDX'),
    tenantId: data.tenantId || data['組織ID'] || '',
    sheetName: data.sheetName || '',
    indexType: data.indexType || '',
    indexValue: data.indexValue || '',
    rowNumber: data.rowNumber || '',
    建立時間: CIR_now_(),
    更新時間: CIR_now_(),
    狀態: 'active'
  };
  if (!row.sheetName || !row.indexType || !row.indexValue) return CIR_fail_('索引資料不足。');
  if (typeof DAL_append === 'function') DAL_append(GOVOPS_QUERY_INDEX_SHEET, row, CIR_indexHeaders_());
  return CIR_success_('查詢索引已建立。', row);
}

function CIR_invalidateTenantCache(data) {
  初始化快取索引系統();
  data = data || {};
  var tenantId = data.tenantId || data['組織ID'] || '';
  var sheetName = data.sheetName || '';
  if (!tenantId) return CIR_fail_('缺少 tenantId，無法清除租戶快取。');

  if (typeof DAL_query !== 'function' || typeof DAL_updateByRow !== 'function') {
    return CIR_fail_('DataAccessLayer 尚未載入。');
  }

  var filters = { tenantId: tenantId };
  if (sheetName) filters.sheetName = sheetName;

  var res = DAL_query(GOVOPS_CACHE_REGISTRY_SHEET, {
    tenantId: tenantId,
    filters: filters,
    limit: 500,
    cache: false
  });

  var rows = res.data.rows || [];
  rows.forEach(function(r) {
    DAL_updateByRow(GOVOPS_CACHE_REGISTRY_SHEET, r._row, {
      狀態: 'invalidated',
      更新時間: CIR_now_()
    });
  });

  return CIR_success_('租戶快取已標記失效。', { 筆數: rows.length });
}

function CIR_findIndex(data) {
  初始化快取索引系統();
  data = data || {};
  if (typeof DAL_query !== 'function') return CIR_fail_('DataAccessLayer 尚未載入。');
  var res = DAL_query(GOVOPS_QUERY_INDEX_SHEET, {
    tenantId: data.tenantId || data['組織ID'] || '',
    filters: {
      sheetName: data.sheetName || '',
      indexType: data.indexType || '',
      indexValue: data.indexValue || '',
      狀態: 'active'
    },
    limit: data.limit || 50,
    cache: false
  });
  return CIR_success_('索引查詢完成。', { 索引: res.data.rows, 筆數: res.data.total });
}

function CIR_rebuildTenantIndex(data) {
  初始化快取索引系統();
  data = data || {};
  var tenantId = data.tenantId || data['組織ID'] || '';
  var sheetName = data.sheetName || '';
  var indexFields = data.indexFields || [];
  if (!tenantId || !sheetName || !indexFields.length) return CIR_fail_('請提供 tenantId、sheetName 與 indexFields。');
  if (typeof DAL_query !== 'function') return CIR_fail_('DataAccessLayer 尚未載入。');

  var res = DAL_query(sheetName, { tenantId: tenantId, limit: 500, cache: false });
  var rows = res.data.rows || [];
  var count = 0;

  rows.forEach(function(row) {
    indexFields.forEach(function(field) {
      if (row[field] !== undefined && row[field] !== '') {
        CIR_registerRowIndex({
          tenantId: tenantId,
          sheetName: sheetName,
          indexType: field,
          indexValue: row[field],
          rowNumber: row._row
        });
        count++;
      }
    });
  });

  return CIR_success_('租戶查詢索引重建完成。', { 筆數: count });
}

function 測試_CacheIndexRuntime() {
  var init = 初始化快取索引系統();
  var tenantId = 'QA-CACHE';
  var cache = CIR_registerCacheKey({
    cacheKey: 'QA-CACHE-KEY',
    tenantId: tenantId,
    sheetName: '測試表',
    query: { keyword: '測試' }
  });
  var index = CIR_registerRowIndex({
    tenantId: tenantId,
    sheetName: '測試表',
    indexType: '測試欄位',
    indexValue: '測試值',
    rowNumber: 2
  });
  var find = CIR_findIndex({
    tenantId: tenantId,
    sheetName: '測試表',
    indexType: '測試欄位',
    indexValue: '測試值'
  });
  return CIR_success_('Cache Index Runtime 測試完成。', { 初始化: init, 快取: cache, 索引: index, 查詢: find });
}
