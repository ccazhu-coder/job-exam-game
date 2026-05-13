/**
 * GovOps OS ERP Vendor Schema Patch v2
 * 23_合作廠商主檔正式欄位：
 * 廠商編號、名稱、類型、聯絡人、電話、Email、支付方式、銀行、帳號、戶名、統編/身分證、是否開發票、是否扣繳、扣繳類型、預設單價、評價、常用、備註
 */

function erpVendorEnsureTables_(){
  ERP_TABLES.vendor_types = ERP_TABLES.vendor_types || ['類型ID','類型分類','類型名稱','類型說明','狀態','建立時間','更新時間'];
  ERP_TABLES.vendors = ERP_TABLES.vendors || ['廠商編號','名稱','類型','聯絡人','電話','Email','支付方式','銀行','帳號','戶名','統編/身分證','是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註','建立時間','更新時間'];
  erpEnsureSheet_('vendor_types', ERP_TABLES.vendor_types);
  erpEnsureSheet_('vendors', ERP_TABLES.vendors);
  erpEnsureSheet_('23_合作廠商主檔', ERP_TABLES.vendors);
  erpVendorSeedTypes_();
}

function erpVendorSeedTypes_(){
  const rows = erpReadRows_('vendor_types');
  const types = ['場地','餐廳/餐飲','原材料/物料','印刷/設計','交通/接駁','設備租借','住宿','保險','攝影錄影','其他廠商'];
  types.forEach(name => {
    if (rows.some(r => r['類型分類'] === '合作廠商類型' && r['類型名稱'] === name)) return;
    erpAppend_('vendor_types', {'類型ID': erpUuid_('TYPE'),'類型分類': '合作廠商類型','類型名稱': name,'類型說明': '','狀態': '啟用','建立時間': erpNow_(),'更新時間': erpNow_()});
  });
}

function erpVendorAppendOfficial_(obj){
  const sh = erpEnsureSheet_('23_合作廠商主檔', ERP_TABLES.vendors);
  sh.appendRow(ERP_TABLES.vendors.map(h => obj[h] !== undefined ? obj[h] : ''));
}

function erpVendorCreate(params){
  erpVendorEnsureTables_();
  const name = params['名稱'] || params['廠商名稱'] || params.vendorName || params.resourceName;
  if (!name) return erpFail_('請填寫廠商名稱');
  const type = params['類型'] || params['廠商類型'] || params.vendorType || '其他廠商';
  const rows = erpReadRows_('23_合作廠商主檔');
  const exists = rows.find(v => v['名稱'] === name && v['類型'] === type);
  if (exists) return erpOk_('廠商資料已存在', { 廠商編號: exists['廠商編號'] });
  const obj = {
    '廠商編號': params['廠商編號'] || erpUuid_('VEN'),
    '名稱': name,
    '類型': type,
    '聯絡人': params['聯絡人'] || params.contactName || '',
    '電話': params['電話'] || params['聯絡電話'] || params.contactPhone || '',
    'Email': params['Email'] || params.email || '',
    '支付方式': params['支付方式'] || params['付款方式'] || '匯款',
    '銀行': params['銀行'] || params['銀行名稱'] || params.bankName || '',
    '帳號': params['帳號'] || params.bankAccount || '',
    '戶名': params['戶名'] || params.accountName || name,
    '統編/身分證': params['統編/身分證'] || params['統一編號'] || params['身分證字號'] || params.taxId || '',
    '是否開發票': params['是否開發票'] || params.invoiceRequired || '',
    '是否扣繳': params['是否扣繳'] || params.withholdingRequired || '',
    '扣繳類型': params['扣繳類型'] || params.withholdingType || '',
    '預設單價': params['預設單價'] || params.defaultPrice || '',
    '評價': params['評價'] || params.rating || '',
    '常用': params['常用'] || params.favorite || '',
    '備註': params['備註'] || params.note || '',
    '建立時間': erpNow_(),
    '更新時間': erpNow_()
  };
  erpVendorAppendOfficial_(obj);
  erpAudit_(params, '新增合作廠商', '23_合作廠商主檔', obj['廠商編號'], 'success', '');
  return erpOk_('合作廠商資料已建立', { 廠商編號: obj['廠商編號'], 廠商ID: obj['廠商編號'] });
}

function erpVendorUpdate(params){
  erpVendorEnsureTables_();
  const vendorId = params['廠商編號'] || params['廠商ID'];
  if (!vendorId) return erpFail_('請提供廠商編號');
  const row = erpReadRows_('23_合作廠商主檔').find(v => v['廠商編號'] === vendorId);
  if (!row) return erpFail_('找不到廠商資料');
  const patch = {};
  ['名稱','類型','聯絡人','電話','Email','支付方式','銀行','帳號','戶名','統編/身分證','是否開發票','是否扣繳','扣繳類型','預設單價','評價','常用','備註'].forEach(k => { if (params[k] !== undefined && params[k] !== '') patch[k] = params[k]; });
  if (params['廠商名稱']) patch['名稱'] = params['廠商名稱'];
  if (params['廠商類型']) patch['類型'] = params['廠商類型'];
  if (params['聯絡電話']) patch['電話'] = params['聯絡電話'];
  patch['更新時間'] = erpNow_();
  erpUpdateRow_('23_合作廠商主檔', row._row, patch);
  erpAudit_(params, '修改合作廠商', '23_合作廠商主檔', vendorId, 'success', '');
  return erpOk_('合作廠商資料已修改', { 廠商編號: vendorId });
}

function erpVendorQuery(params){
  erpVendorEnsureTables_();
  const keyword = String(params.keyword || params.q || params['關鍵字'] || '').trim();
  const type = String(params['類型'] || params['廠商類型'] || params.vendorType || '').trim();
  let rows = erpReadRows_('23_合作廠商主檔');
  if (type) rows = rows.filter(v => String(v['類型']).indexOf(type) >= 0);
  if (keyword) rows = rows.filter(v => JSON.stringify(v).indexOf(keyword) >= 0);
  return erpOk_('合作廠商查詢完成', { 廠商: rows, rows: rows });
}

function erpVendorTypeQuery(params){
  erpVendorEnsureTables_();
  const rows = erpReadRows_('vendor_types').filter(r => r['類型分類'] === '合作廠商類型' && String(r['狀態']) !== '停用');
  return erpOk_('合作廠商類型查詢完成', { 類型: rows, rows: rows });
}

function erpVendorRoute(params){
  const action = String((params && params.action) || '');
  try {
    if (action === '新增合作廠商' || action === '儲存合作廠商') return erpVendorCreate(params);
    if (action === '修改合作廠商' || action === '更新合作廠商') return erpVendorUpdate(params);
    if (action === '查詢合作廠商') return erpVendorQuery(params);
    if (action === '查詢合作廠商類型') return erpVendorTypeQuery(params);
    return null;
  } catch (err) {
    erpAudit_(params, action, '23_合作廠商主檔', '', 'fail', err.message);
    return erpFail_('合作廠商資料處理失敗：' + err.message);
  }
}
