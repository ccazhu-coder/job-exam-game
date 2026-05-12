/* GovOps OS｜Production Resource Master Data v1
 * 正式上線版：講師基本資料、工作人員基本資料、合作廠商基本資料。
 * 原則：
 * 1. 主檔資料只建立一次。
 * 2. 後續標案、場次、派工、核銷、結案皆用選單帶入。
 * 3. 不使用測試函式、不放測試資料。
 * 4. 合作廠商需具備類型：場地、原材料、餐廳、印刷設計、交通接駁、設備租借、住宿、其他。
 */

function handleGovOpsProductionResourceAction(action, data) {
  data = data || {};
  try {
    if (action === 'resource.lecturer.create' || action === '建立正式講師基本資料') return GovOpsProdLecturer_create(data);
    if (action === 'resource.lecturer.query' || action === '查詢正式講師基本資料') return GovOpsProdLecturer_query(data);
    if (action === 'resource.lecturer.update' || action === '更新正式講師基本資料') return GovOpsProdLecturer_update(data);
    if (action === 'resource.staff.create' || action === '建立正式工作人員基本資料') return GovOpsProdStaff_create(data);
    if (action === 'resource.staff.query' || action === '查詢正式工作人員基本資料') return GovOpsProdStaff_query(data);
    if (action === 'resource.staff.update' || action === '更新正式工作人員基本資料') return GovOpsProdStaff_update(data);
    if (action === 'resource.vendor.create' || action === '建立正式合作廠商基本資料') return GovOpsProdVendor_create(data);
    if (action === 'resource.vendor.query' || action === '查詢正式合作廠商基本資料') return GovOpsProdVendor_query(data);
    if (action === 'resource.vendor.update' || action === '更新正式合作廠商基本資料') return GovOpsProdVendor_update(data);
    if (action === 'resource.master.options' || action === '查詢正式資源選單') return GovOpsProdResource_options(data);
    return null;
  } catch (err) {
    GovOpsProdResource_logError('handleGovOpsProductionResourceAction', err, data);
    return GovOpsProdResource_fail('正式資源主檔暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_PRODUCTION_RESOURCE = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsProductionResourceAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_PRODUCTION_RESOURCE(action, data);
  };
}

function GovOpsProdResource_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsProdResource_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsProdResource_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsProdLecturer_sheetName() { return '81_正式講師基本資料'; }
function GovOpsProdStaff_sheetName() { return '82_正式工作人員基本資料'; }
function GovOpsProdVendor_sheetName() { return '83_正式合作廠商基本資料'; }

function GovOpsProdResource_ensureSheets() {
  if (typeof GovOpsProduct_ensureSheet !== 'function') return;
  GovOpsProduct_ensureSheet(GovOpsProdLecturer_sheetName(), [
    '講師ID','tenantId','姓名','專業類型','課程領域','可授課主題','服務對象專長','證照資格','學經歷摘要','授課地區','授課方式','鐘點費/報價','聯絡電話','Email','LineID','銀行名稱','銀行帳號','戶名','身分證/統編','可配合文件','狀態','評價','建立時間','更新時間','userId','備註'
  ]);
  GovOpsProduct_ensureSheet(GovOpsProdStaff_sheetName(), [
    '工作人員ID','tenantId','姓名','人員類型','可支援工作','專長技能','可服務地區','聯絡電話','Email','LineID','銀行名稱','銀行帳號','戶名','身分證/統編','時薪/日薪/報價','可配合時段','狀態','評價','建立時間','更新時間','userId','備註'
  ]);
  GovOpsProduct_ensureSheet(GovOpsProdVendor_sheetName(), [
    '廠商ID','tenantId','廠商名稱','廠商類型','服務項目','聯絡人','電話','Email','LineID','地址','統一編號','銀行名稱','銀行帳號','戶名','報價方式','可服務地區','可配合文件','狀態','評價','建立時間','更新時間','userId','備註'
  ]);
}

function GovOpsProdLecturer_create(data) {
  data = data || {};
  GovOpsProdResource_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var name = data.姓名 || data.name || data.講師姓名 || '';
  if (!name) return GovOpsProdResource_fail('請提供講師姓名。');
  var existing = GovOpsProdResource_findExisting(GovOpsProdLecturer_sheetName(), tenantId, '姓名', name, data.Email || data.email || '', data.聯絡電話 || data.phone || '');
  var row = {
    講師ID: existing && existing.講師ID || 'LECT-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    姓名: name,
    專業類型: data.專業類型 || data.professionalType || GovOpsProdResource_guessLecturerType(data),
    課程領域: data.課程領域 || data.courseField || '',
    可授課主題: data.可授課主題 || data.topics || '',
    服務對象專長: data.服務對象專長 || data.audience || '',
    證照資格: data.證照資格 || data.certificates || '',
    學經歷摘要: data.學經歷摘要 || data.bio || '',
    授課地區: data.授課地區 || data.area || '',
    授課方式: data.授課方式 || data.teachingMode || '實體/線上皆可',
    '鐘點費/報價': data['鐘點費/報價'] || data.鐘點費 || data.fee || '',
    聯絡電話: data.聯絡電話 || data.phone || '',
    Email: data.Email || data.email || '',
    LineID: data.LineID || data.lineId || '',
    銀行名稱: data.銀行名稱 || data.bankName || '',
    銀行帳號: data.銀行帳號 || data.bankAccount || '',
    戶名: data.戶名 || data.accountName || '',
    '身分證/統編': data['身分證/統編'] || data.idNumber || data.taxId || '',
    可配合文件: data.可配合文件 || '講師簡歷、授課大綱、領據/發票',
    狀態: data.狀態 || '可邀課',
    評價: data.評價 || '',
    建立時間: existing && existing.建立時間 || GovOpsProdResource_now(),
    更新時間: GovOpsProdResource_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  return GovOpsProdResource_upsert(GovOpsProdLecturer_sheetName(), existing, row, '正式講師基本資料');
}

function GovOpsProdStaff_create(data) {
  data = data || {};
  GovOpsProdResource_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var name = data.姓名 || data.name || data.工作人員姓名 || '';
  if (!name) return GovOpsProdResource_fail('請提供工作人員姓名。');
  var existing = GovOpsProdResource_findExisting(GovOpsProdStaff_sheetName(), tenantId, '姓名', name, data.Email || data.email || '', data.聯絡電話 || data.phone || '');
  var row = {
    工作人員ID: existing && existing.工作人員ID || 'STAFF-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    姓名: name,
    人員類型: data.人員類型 || data.staffType || GovOpsProdResource_guessStaffType(data),
    可支援工作: data.可支援工作 || data.supportTasks || '',
    專長技能: data.專長技能 || data.skills || '',
    可服務地區: data.可服務地區 || data.area || '',
    聯絡電話: data.聯絡電話 || data.phone || '',
    Email: data.Email || data.email || '',
    LineID: data.LineID || data.lineId || '',
    銀行名稱: data.銀行名稱 || data.bankName || '',
    銀行帳號: data.銀行帳號 || data.bankAccount || '',
    戶名: data.戶名 || data.accountName || '',
    '身分證/統編': data['身分證/統編'] || data.idNumber || data.taxId || '',
    '時薪/日薪/報價': data['時薪/日薪/報價'] || data.rate || '',
    可配合時段: data.可配合時段 || data.availableTime || '',
    狀態: data.狀態 || '可派工',
    評價: data.評價 || '',
    建立時間: existing && existing.建立時間 || GovOpsProdResource_now(),
    更新時間: GovOpsProdResource_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  return GovOpsProdResource_upsert(GovOpsProdStaff_sheetName(), existing, row, '正式工作人員基本資料');
}

function GovOpsProdVendor_create(data) {
  data = data || {};
  GovOpsProdResource_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var name = data.廠商名稱 || data.vendorName || data.公司名稱 || data.name || '';
  if (!name) return GovOpsProdResource_fail('請提供合作廠商名稱。');
  var vendorType = data.廠商類型 || data.vendorType || GovOpsProdResource_guessVendorType(data);
  var existing = GovOpsProdResource_findExisting(GovOpsProdVendor_sheetName(), tenantId, '廠商名稱', name, data.Email || data.email || '', data.電話 || data.phone || '');
  var row = {
    廠商ID: existing && existing.廠商ID || 'VEND-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    廠商名稱: name,
    廠商類型: vendorType,
    服務項目: data.服務項目 || data.services || '',
    聯絡人: data.聯絡人 || data.contact || '',
    電話: data.電話 || data.phone || '',
    Email: data.Email || data.email || '',
    LineID: data.LineID || data.lineId || '',
    地址: data.地址 || data.address || '',
    統一編號: data.統一編號 || data.taxId || '',
    銀行名稱: data.銀行名稱 || data.bankName || '',
    銀行帳號: data.銀行帳號 || data.bankAccount || '',
    戶名: data.戶名 || data.accountName || '',
    報價方式: data.報價方式 || data.quoteMethod || '',
    可服務地區: data.可服務地區 || data.area || '',
    可配合文件: data.可配合文件 || GovOpsProdResource_vendorDocs(vendorType),
    狀態: data.狀態 || '可合作',
    評價: data.評價 || '',
    建立時間: existing && existing.建立時間 || GovOpsProdResource_now(),
    更新時間: GovOpsProdResource_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  return GovOpsProdResource_upsert(GovOpsProdVendor_sheetName(), existing, row, '正式合作廠商基本資料');
}

function GovOpsProdLecturer_query(data) { return GovOpsProdResource_querySheet(GovOpsProdLecturer_sheetName(), data, ['專業類型','課程領域','姓名']); }
function GovOpsProdStaff_query(data) { return GovOpsProdResource_querySheet(GovOpsProdStaff_sheetName(), data, ['人員類型','姓名']); }
function GovOpsProdVendor_query(data) { return GovOpsProdResource_querySheet(GovOpsProdVendor_sheetName(), data, ['廠商類型','廠商名稱']); }

function GovOpsProdLecturer_update(data) { return GovOpsProdResource_updateSheet(GovOpsProdLecturer_sheetName(), data, '講師ID', data.講師ID || data.lecturerId || ''); }
function GovOpsProdStaff_update(data) { return GovOpsProdResource_updateSheet(GovOpsProdStaff_sheetName(), data, '工作人員ID', data.工作人員ID || data.staffId || ''); }
function GovOpsProdVendor_update(data) { return GovOpsProdResource_updateSheet(GovOpsProdVendor_sheetName(), data, '廠商ID', data.廠商ID || data.vendorId || ''); }

function GovOpsProdResource_options(data) {
  data = data || {};
  var lecturers = GovOpsProdLecturer_query(data).data.rows || [];
  var staff = GovOpsProdStaff_query(data).data.rows || [];
  var vendors = GovOpsProdVendor_query(data).data.rows || [];
  return GovOpsProdResource_success('正式資源選單查詢完成。', {
    lecturers: lecturers.map(function(r){ return { value: r.講師ID, label: r.姓名 + '｜' + r.專業類型 + '｜' + (r.可授課主題 || ''), raw: r }; }),
    staff: staff.map(function(r){ return { value: r.工作人員ID, label: r.姓名 + '｜' + r.人員類型 + '｜' + (r.可支援工作 || ''), raw: r }; }),
    vendors: vendors.map(function(r){ return { value: r.廠商ID, label: r.廠商名稱 + '｜' + r.廠商類型 + '｜' + (r.服務項目 || ''), raw: r }; }),
    vendorTypes: ['場地','原材料/物料','餐廳/餐飲','印刷/設計','交通/接駁','設備租借','住宿','保險','攝影錄影','其他廠商'],
    lecturerTypes: ['AI數位應用類','職涯就業類','財務稅務類','食品農糧類','助人專業類','創業行銷類','法律法規類','其他專業類'],
    staffTypes: ['行政人員','現場工作人員','助教','報到人員','攝影紀錄','活動主持','財務核銷','專案管理','其他支援']
  });
}

function GovOpsProdResource_querySheet(sheetName, data, groupKeys) {
  data = data || {};
  GovOpsProdResource_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || '').trim();
  var type = String(data.類型 || data.type || data.專業類型 || data.人員類型 || data.廠商類型 || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(sheetName) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (type && JSON.stringify(row).indexOf(type) < 0) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsProdResource_success('查詢完成。', { total: rows.length, rows: rows.slice(0, 1000), grouped: GovOpsProdResource_group(rows, groupKeys && groupKeys[0]) });
}

function GovOpsProdResource_updateSheet(sheetName, data, idKey, id) {
  data = data || {};
  GovOpsProdResource_ensureSheets();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  if (!id) return GovOpsProdResource_fail('請提供資料ID。');
  var rows = GovOpsProduct_readRows(sheetName);
  var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r[idKey] || '') === String(id); });
  if (!found) return GovOpsProdResource_fail('找不到資料。');
  var patch = { 更新時間: GovOpsProdResource_now() };
  Object.keys(data).forEach(function(k){ if (['action','tenantId','userId'].indexOf(k) < 0) patch[k] = data[k]; });
  GovOpsProduct_update(sheetName, found._row, patch);
  return GovOpsProdResource_success('資料已更新。', Object.assign({}, found, patch));
}

function GovOpsProdResource_upsert(sheetName, existing, row, label) {
  if (existing && typeof GovOpsProduct_update === 'function') {
    GovOpsProduct_update(sheetName, existing._row, row);
    return GovOpsProdResource_success(label + '已更新。', row);
  }
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(sheetName, row);
  return GovOpsProdResource_success(label + '已建立。', row);
}

function GovOpsProdResource_findExisting(sheetName, tenantId, nameKey, name, email, phone) {
  try {
    var rows = GovOpsProduct_readRows(sheetName);
    return rows.find(function(r){
      if (String(r.tenantId || '') !== String(tenantId)) return false;
      if (email && String(r.Email || '') === String(email)) return true;
      if (phone && String(r.電話 || r.聯絡電話 || '') === String(phone)) return true;
      return String(r[nameKey] || '') === String(name);
    }) || null;
  } catch (err) { return null; }
}

function GovOpsProdResource_guessLecturerType(data) {
  var text = JSON.stringify(data || '');
  if (/AI|人工智慧|ChatGPT|生成式/.test(text)) return 'AI數位應用類';
  if (/職涯|就業|履歷|面試|職場/.test(text)) return '職涯就業類';
  if (/稅務|會計|財務|核銷/.test(text)) return '財務稅務類';
  if (/食品|衛生|餐飲|農糧|米/.test(text)) return '食品農糧類';
  if (/心理|溝通|同理|助人|團督/.test(text)) return '助人專業類';
  if (/創業|行銷|品牌|社群/.test(text)) return '創業行銷類';
  if (/法律|法規|勞動|採購法/.test(text)) return '法律法規類';
  return '其他專業類';
}

function GovOpsProdResource_guessStaffType(data) {
  var text = JSON.stringify(data || '');
  if (/報到|簽到/.test(text)) return '報到人員';
  if (/助教|課務/.test(text)) return '助教';
  if (/攝影|拍照|紀錄/.test(text)) return '攝影紀錄';
  if (/核銷|財務|發票/.test(text)) return '財務核銷';
  if (/專案|PM|管理/.test(text)) return '專案管理';
  return '現場工作人員';
}

function GovOpsProdResource_guessVendorType(data) {
  var text = JSON.stringify(data || '');
  if (/場地|教室|會議室|活動中心|venue/i.test(text)) return '場地';
  if (/原材料|材料|物料|食材|耗材/i.test(text)) return '原材料/物料';
  if (/餐廳|便當|餐盒|餐點|茶水|飲料|restaurant/i.test(text)) return '餐廳/餐飲';
  if (/印刷|輸出|設計|海報|手冊/i.test(text)) return '印刷/設計';
  if (/交通|遊覽車|接駁|租車/i.test(text)) return '交通/接駁';
  if (/設備|音響|投影|麥克風|租借/i.test(text)) return '設備租借';
  if (/住宿|旅館|飯店/i.test(text)) return '住宿';
  if (/保險/i.test(text)) return '保險';
  if (/攝影|錄影|剪輯/i.test(text)) return '攝影錄影';
  return '其他廠商';
}

function GovOpsProdResource_vendorDocs(type) {
  if (type === '場地') return '報價單、場地租借證明、收據/發票';
  if (type === '餐廳/餐飲') return '報價單、菜單、發票/收據';
  if (type === '原材料/物料') return '報價單、出貨單、發票/收據';
  if (type === '交通/接駁') return '報價單、行程表、發票/收據';
  return '報價單、發票/收據、合作紀錄';
}

function GovOpsProdResource_group(rows, key) {
  var g = {};
  rows.forEach(function(r){ var k = r[key] || '未分類'; if (!g[k]) g[k] = []; g[k].push(r); });
  return g;
}

function GovOpsProdResource_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
