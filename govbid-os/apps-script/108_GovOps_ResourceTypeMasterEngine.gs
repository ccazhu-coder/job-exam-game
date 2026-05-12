/* GovOps OS｜Resource Type Master Engine v1
 * 正式上線版：資源類型主檔。
 * 目的：講師專業類型、工作人員類型、合作廠商類型皆可由使用者自行新增、查詢、停用。
 * 原則：不把類型寫死在前端；前端選單應讀取此主檔。
 */

function handleGovOpsResourceTypeMasterAction(action, data) {
  data = data || {};
  try {
    if (action === 'resource.type.create' || action === '建立資源類型') return GovOpsResourceType_create(data);
    if (action === 'resource.type.query' || action === '查詢資源類型') return GovOpsResourceType_query(data);
    if (action === 'resource.type.update' || action === '更新資源類型') return GovOpsResourceType_update(data);
    if (action === 'resource.type.options' || action === '查詢資源類型選單') return GovOpsResourceType_options(data);
    if (action === 'resource.type.seedDefaults' || action === '建立預設資源類型') return GovOpsResourceType_seedDefaults(data);
    return null;
  } catch (err) {
    GovOpsResourceType_logError('handleGovOpsResourceTypeMasterAction', err, data);
    return GovOpsResourceType_fail('資源類型主檔暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_RESOURCE_TYPE_MASTER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsResourceTypeMasterAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_RESOURCE_TYPE_MASTER(action, data);
  };
}

function GovOpsResourceType_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsResourceType_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsResourceType_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsResourceType_sheetName() { return '84_資源類型主檔'; }

function GovOpsResourceType_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsResourceType_sheetName(), ['類型ID','tenantId','資源類別','類型名稱','上層類型','排序','狀態','是否系統預設','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsResourceType_create(data) {
  data = data || {};
  GovOpsResourceType_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var category = data.資源類別 || data.category || '講師';
  var name = data.類型名稱 || data.typeName || data.專業類型 || data.廠商類型 || data.人員類型 || '';
  if (!name) return GovOpsResourceType_fail('請提供類型名稱。');
  var existing = GovOpsResourceType_findExisting(tenantId, category, name);
  var row = {
    類型ID: existing && existing.類型ID || 'RT-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    資源類別: category,
    類型名稱: name,
    上層類型: data.上層類型 || data.parentType || '',
    排序: Number(data.排序 || data.sort || 999),
    狀態: data.狀態 || '啟用',
    是否系統預設: data.是否系統預設 || '否',
    建立時間: existing && existing.建立時間 || GovOpsResourceType_now(),
    更新時間: GovOpsResourceType_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (existing && typeof GovOpsProduct_update === 'function') {
    GovOpsProduct_update(GovOpsResourceType_sheetName(), existing._row, row);
    return GovOpsResourceType_success('資源類型已更新。', row);
  }
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsResourceType_sheetName(), row);
  return GovOpsResourceType_success('資源類型已建立。', row);
}

function GovOpsResourceType_query(data) {
  data = data || {};
  GovOpsResourceType_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var category = String(data.資源類別 || data.category || '').trim();
  var keyword = String(data.keyword || data.關鍵字 || '').trim();
  var includeDisabled = data.includeDisabled === true || data.包含停用 === true;
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsResourceType_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (category && String(row.資源類別 || '') !== category) return false;
    if (!includeDisabled && String(row.狀態 || '') === '停用') return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  }).sort(function(a,b){ return Number(a.排序 || 999) - Number(b.排序 || 999); });
  return GovOpsResourceType_success('資源類型查詢完成。', { total: rows.length, rows: rows.slice(0, 1000), grouped: GovOpsResourceType_group(rows) });
}

function GovOpsResourceType_update(data) {
  data = data || {};
  GovOpsResourceType_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.類型ID || data.typeId || '';
  var rows = GovOpsProduct_readRows(GovOpsResourceType_sheetName());
  var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.類型ID || '') === String(id); });
  if (!found) return GovOpsResourceType_fail('找不到資源類型。');
  var patch = { 更新時間: GovOpsResourceType_now() };
  ['資源類別','類型名稱','上層類型','排序','狀態','是否系統預設','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = k === '排序' ? Number(data[k] || 999) : data[k]; });
  if (data.typeName !== undefined) patch.類型名稱 = data.typeName;
  if (data.category !== undefined) patch.資源類別 = data.category;
  GovOpsProduct_update(GovOpsResourceType_sheetName(), found._row, patch);
  return GovOpsResourceType_success('資源類型已更新。', Object.assign({}, found, patch));
}

function GovOpsResourceType_options(data) {
  data = data || {};
  var q = GovOpsResourceType_query(data).data.rows || [];
  var options = q.map(function(r){ return { value: r.類型名稱, label: r.類型名稱, typeId: r.類型ID, category: r.資源類別, parentType: r.上層類型 || '', raw: r }; });
  return GovOpsResourceType_success('資源類型選單查詢完成。', { total: options.length, options: options, grouped: GovOpsResourceType_groupOptions(options) });
}

function GovOpsResourceType_seedDefaults(data) {
  data = data || {};
  var defaults = [
    ['講師','AI數位應用類',10],['講師','職涯就業類',20],['講師','財務稅務類',30],['講師','食品農糧類',40],['講師','助人專業類',50],['講師','創業行銷類',60],['講師','法律法規類',70],['講師','其他專業類',999],
    ['工作人員','行政人員',10],['工作人員','現場工作人員',20],['工作人員','助教',30],['工作人員','報到人員',40],['工作人員','攝影紀錄',50],['工作人員','活動主持',60],['工作人員','財務核銷',70],['工作人員','專案管理',80],['工作人員','其他支援',999],
    ['合作廠商','場地',10],['合作廠商','原材料/物料',20],['合作廠商','餐廳/餐飲',30],['合作廠商','印刷/設計',40],['合作廠商','交通/接駁',50],['合作廠商','設備租借',60],['合作廠商','住宿',70],['合作廠商','保險',80],['合作廠商','攝影錄影',90],['合作廠商','其他廠商',999]
  ];
  var created = 0, updated = 0;
  defaults.forEach(function(d){
    var before = GovOpsResourceType_findExisting(data.tenantId || 'TENANT-DEMO', d[0], d[1]);
    GovOpsResourceType_create({ tenantId: data.tenantId || 'TENANT-DEMO', userId: data.userId || '', 資源類別: d[0], 類型名稱: d[1], 排序: d[2], 是否系統預設: '是', 狀態: '啟用' });
    if (before) updated++; else created++;
  });
  return GovOpsResourceType_success('預設資源類型已建立。', { created: created, updated: updated });
}

function GovOpsResourceType_findExisting(tenantId, category, name) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsResourceType_sheetName());
    return rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.資源類別 || '') === String(category) && String(r.類型名稱 || '') === String(name); }) || null;
  } catch (err) { return null; }
}

function GovOpsResourceType_group(rows) {
  var g = {};
  rows.forEach(function(r){ var k = r.資源類別 || '未分類'; if (!g[k]) g[k] = []; g[k].push(r); });
  return g;
}

function GovOpsResourceType_groupOptions(options) {
  var g = {};
  options.forEach(function(o){ var k = o.category || '未分類'; if (!g[k]) g[k] = []; g[k].push(o); });
  return g;
}

function GovOpsResourceType_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
