/**
 * GovOps OS ERP Vendor Schema Patch
 * 來源：GovBid AI ERP｜政府標案全流程營運系統
 * 目的：合作廠商資料沿用正式後端較完整版本，不再用簡化 resources 欄位取代。
 */

function erpVendorEnsureTables_(){
  ERP_TABLES.vendor_types = ERP_TABLES.vendor_types || ['類型ID','類型分類','類型名稱','類型說明','狀態','建立時間','更新時間'];
  ERP_TABLES.vendors = ERP_TABLES.vendors || ['廠商ID','廠商名稱','廠商類型','服務項目','聯絡人','聯絡電話','統一編號','報價方式','可服務地區','可配合文件','備註','建立時間','更新時間'];
  erpEnsureSheet_('vendor_types', ERP_TABLES.vendor_types);
  erpEnsureSheet_('vendors', ERP_TABLES.vendors);
  erpVendorSeedTypes_();
}

function erpVendorSeedTypes_(){
  const rows = erpReadRows_('vendor_types');
  const types = ['場地','餐廳/餐飲','原材料/物料','印刷/設計','交通/接駁','設備租借','住宿','保險','攝影錄影','其他廠商'];
  types.forEach(name => {
    if (rows.some(r => r['類型分類'] === '合作廠商類型' && r['類型名稱'] === name)) return;
    erpAppend_('vendor_types', {
      '類型ID': erpUuid_('TYPE'),
      '類型分類': '合作廠商類型',
      '類型名稱': name,
      '類型說明': '',
      '狀態': '啟用',
      '建立時間': erpNow_(),
      '更新時間': erpNow_()
    });
  });
}

function erpVendorCreate(params){
  erpVendorEnsureTables_();
  const name = params['廠商名稱'] || params.vendorName || params.resourceName || params['名稱'];
  if (!name) return erpFail_('請填寫廠商名稱');
  const type = params['廠商類型'] || params.vendorType || params.resourceType || '其他廠商';
  const exists = erpReadRows_('vendors').find(v => v['廠商名稱'] === name && v['廠商類型'] === type);
  if (exists) return erpOk_('廠商資料已存在', { 廠商ID: exists['廠商ID'] });
  const obj = erpAppend_('vendors', {
    '廠商ID': erpUuid_('VEN'),
    '廠商名稱': name,
    '廠商類型': type,
    '服務項目': params['服務項目'] || params.serviceItems || params.specialty || '',
    '聯絡人': params['聯絡人'] || params.contactName || params.masterContact || '',
    '聯絡電話': params['聯絡電話'] || params.contactPhone || params.masterPhone || '',
    '統一編號': params['統一編號'] || params.taxId || '',
    '報價方式': params['報價方式'] || params.priceMethod || params.priceNote || '',
    '可服務地區': params['可服務地區'] || params.serviceArea || '',
    '可配合文件': params['可配合文件'] || params.availableDocs || '',
    '備註': params['備註'] || params.note || params.masterNote || '',
    '建立時間': erpNow_(),
    '更新時間': erpNow_()
  });
  erpAudit_(params, '新增合作廠商', 'vendors', obj['廠商ID'], 'success', '');
  return erpOk_('合作廠商資料已建立', { 廠商ID: obj['廠商ID'] });
}

function erpVendorQuery(params){
  erpVendorEnsureTables_();
  const keyword = String(params.keyword || params.q || params['關鍵字'] || '').trim();
  const type = String(params['廠商類型'] || params.vendorType || '').trim();
  let rows = erpReadRows_('vendors');
  if (type) rows = rows.filter(v => String(v['廠商類型']).indexOf(type) >= 0);
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
    if (action === '查詢合作廠商') return erpVendorQuery(params);
    if (action === '查詢合作廠商類型') return erpVendorTypeQuery(params);
    return null;
  } catch (err) {
    erpAudit_(params, action, 'vendors', '', 'fail', err.message);
    return erpFail_('合作廠商資料處理失敗：' + err.message);
  }
}

/**
 * 主 router 接法：
 * const vendorResult = erpVendorRoute(params);
 * if (vendorResult) return jsonOutput(vendorResult);
 */
