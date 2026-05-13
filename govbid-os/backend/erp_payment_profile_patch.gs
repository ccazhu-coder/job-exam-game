/**
 * GovOps OS ERP Payment Profile Patch
 * 目的：廠商、講師、工作人員都可能付款，必須同步建立匯款資訊與扣繳文件資料。
 */

function erpPaymentProfileEnsureTables_(){
  ERP_TABLES.payment_profiles = ERP_TABLES.payment_profiles || [
    '付款資料ID','對象類型','對象ID','對象名稱','聯絡人','聯絡電話','身分證字號或統一編號','銀行名稱','銀行代碼','分行名稱','帳號','戶名','付款方式','所得類別','扣繳方式','二代健保','可配合文件','文件狀態','備註','建立時間','更新時間'
  ];
  erpEnsureSheet_('payment_profiles', ERP_TABLES.payment_profiles);
}

function erpPaymentProfileUpsert(params){
  erpPaymentProfileEnsureTables_();
  const targetType = params['對象類型'] || params.targetType || params.resourceType || '合作廠商';
  const targetId = params['對象ID'] || params.targetId || params['廠商ID'] || params['講師ID'] || params['工作人員ID'] || '';
  const targetName = params['對象名稱'] || params.targetName || params['廠商名稱'] || params['講師姓名'] || params['工作人員姓名'] || params['名稱'];
  if (!targetName) return erpFail_('請填寫付款對象名稱');
  const rows = erpReadRows_('payment_profiles');
  const existing = rows.find(r => (targetId && r['對象ID'] === targetId) || (!targetId && r['對象名稱'] === targetName && r['對象類型'] === targetType));
  const patch = {
    '對象類型': targetType,
    '對象ID': targetId,
    '對象名稱': targetName,
    '聯絡人': params['聯絡人'] || params.contactName || '',
    '聯絡電話': params['聯絡電話'] || params.contactPhone || '',
    '身分證字號或統一編號': params['身分證字號或統一編號'] || params['統一編號'] || params['身分證字號'] || params.taxId || '',
    '銀行名稱': params['銀行名稱'] || params.bankName || '',
    '銀行代碼': params['銀行代碼'] || params.bankCode || '',
    '分行名稱': params['分行名稱'] || params.branchName || '',
    '帳號': params['帳號'] || params.bankAccount || '',
    '戶名': params['戶名'] || params.accountName || targetName,
    '付款方式': params['付款方式'] || params.paymentMethod || '匯款',
    '所得類別': params['所得類別'] || params.incomeType || '',
    '扣繳方式': params['扣繳方式'] || params.withholdingType || '',
    '二代健保': params['二代健保'] || params.nhi2 || '',
    '可配合文件': params['可配合文件'] || params.availableDocs || '',
    '文件狀態': params['文件狀態'] || params.documentStatus || '待確認',
    '備註': params['備註'] || params.note || '',
    '更新時間': erpNow_()
  };
  if (existing) {
    erpUpdateRow_('payment_profiles', existing._row, patch);
    return erpOk_('付款／匯款資料已更新', { 付款資料ID: existing['付款資料ID'] });
  }
  patch['付款資料ID'] = erpUuid_('PAYPROFILE');
  patch['建立時間'] = erpNow_();
  erpAppend_('payment_profiles', patch);
  erpAudit_(params, '建立付款匯款資料', 'payment_profiles', patch['付款資料ID'], 'success', '');
  return erpOk_('付款／匯款資料已建立', { 付款資料ID: patch['付款資料ID'] });
}

function erpPaymentProfileQuery(params){
  erpPaymentProfileEnsureTables_();
  const keyword = String(params.keyword || params.q || params['關鍵字'] || '').trim();
  const targetType = String(params['對象類型'] || params.targetType || '').trim();
  let rows = erpReadRows_('payment_profiles');
  if (targetType) rows = rows.filter(r => String(r['對象類型']).indexOf(targetType) >= 0);
  if (keyword) rows = rows.filter(r => JSON.stringify(r).indexOf(keyword) >= 0);
  return erpOk_('付款／匯款資料查詢完成', { 付款資料: rows, rows: rows });
}

function erpPaymentProfileRoute(params){
  const action = String((params && params.action) || '');
  try {
    if (action === '儲存付款資料' || action === '儲存匯款資訊' || action === '更新付款資料') return erpPaymentProfileUpsert(params);
    if (action === '查詢付款資料' || action === '查詢匯款資訊') return erpPaymentProfileQuery(params);
    return null;
  } catch (err) {
    erpAudit_(params, action, 'payment_profiles', '', 'fail', err.message);
    return erpFail_('付款／匯款資料處理失敗：' + err.message);
  }
}

/**
 * 主 router 接法：
 * const paymentProfileResult = erpPaymentProfileRoute(params);
 * if (paymentProfileResult) return jsonOutput(paymentProfileResult);
 */
