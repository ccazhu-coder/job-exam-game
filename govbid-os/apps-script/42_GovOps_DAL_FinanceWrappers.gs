/*
GovOps OS｜42_GovOps_DAL_FinanceWrappers.gs
商用 SaaS ERP 財務 DAL 層 v1.0.0

目的：
1. 將財務模組正式改接 DataAccessLayer
2. 建立 tenant 財務隔離
3. 統一應收／收款／支出／損益邏輯
4. 降低 legacy appendRow / readRows 風險
*/

var GOVOPS_DAL_FINANCE_VERSION = '1.0.0';

function FW_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || data.role || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function FW_success_(message, data) {
  return typeof success === 'function'
    ? success(message, data)
    : { success: true, message: message || '操作完成。', data: data || {} };
}

function FW_fail_(message, data) {
  return typeof fail === 'function'
    ? fail(message, data)
    : { success: false, message: message || '操作失敗。', data: data || {} };
}

function FW_now_() {
  return typeof now === 'function'
    ? now()
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function FW_today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function FW_first_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function FW_requireDAL_() {
  if (
    typeof DAL_query !== 'function' ||
    typeof DAL_append !== 'function' ||
    typeof DAL_findOne !== 'function' ||
    typeof DAL_updateByRow !== 'function'
  ) {
    return FW_fail_('DataAccessLayer 尚未載入。');
  }
  return null;
}

function FW_initFinanceSheets_() {
  if (typeof DAL_ensureHeaders_ !== 'function') return;

  DAL_ensureHeaders_('應收帳款', [
    'tenantId','userId','應收ID','活動ID','對象名稱','應收項目',
    '應收金額','已收金額','未收金額','預計收款日',
    '收款狀態','備註','建立時間','更新時間'
  ]);

  DAL_ensureHeaders_('收款紀錄', [
    'tenantId','userId','收款ID','應收ID','活動ID','收款金額',
    '收款日期','收款方式','付款人','備註','建立時間'
  ]);

  DAL_ensureHeaders_('支出紀錄', [
    'tenantId','userId','支出ID','活動ID','支出日期','支出金額',
    '支出類型','支出項目','付款方式','收據狀態','備註','建立時間'
  ]);
}

function FW_paymentStatus_(total, paid) {
  total = Number(total || 0);
  paid = Number(paid || 0);

  if (paid <= 0) return '未收款';
  if (paid < total) return '部分收款';
  return '已收款';
}

function 建立應收帳款(data) {
  var err = FW_requireDAL_();
  if (err) return err;

  FW_initFinanceSheets_();

  data = data || {};
  var ctx = FW_ctx_(data);

  var amount = Number(FW_first_(data['應收金額'], data.amount, 0));
  var activityId = FW_first_(data['活動ID'], data.activityId);

  if (!activityId) return FW_fail_('請提供活動ID。');
  if (!amount || amount <= 0) return FW_fail_('應收金額必須大於 0。');

  var arId = 'AR-' + new Date().getTime();

  DAL_append('應收帳款', Object.assign({}, ctx, {
    應收ID: arId,
    活動ID: activityId,
    對象名稱: FW_first_(data['對象名稱'], data.target),
    應收項目: FW_first_(data['應收項目'], data.item, '活動費用'),
    應收金額: amount,
    已收金額: 0,
    未收金額: amount,
    預計收款日: FW_first_(data['預計收款日'], data.dueDate),
    收款狀態: '未收款',
    備註: FW_first_(data['備註'], data.note),
    建立時間: FW_now_(),
    更新時間: FW_now_()
  }));

  return FW_success_('應收帳款已建立。', {
    應收ID: arId,
    應收金額: amount
  });
}

function 登錄收款(data) {
  var err = FW_requireDAL_();
  if (err) return err;

  FW_initFinanceSheets_();

  data = data || {};
  var ctx = FW_ctx_(data);

  var amount = Number(FW_first_(data['收款金額'], data.amount, 0));
  var arId = FW_first_(data['應收ID'], data.arId);

  if (!arId) return FW_fail_('請提供應收ID。');
  if (!amount || amount <= 0) return FW_fail_('收款金額必須大於 0。');

  var ar = DAL_findOne('應收帳款', Object.assign({}, ctx, {
    filters: { '應收ID': arId },
    cache: false
  }));

  if (!ar) return FW_fail_('查無應收帳款。');

  var payId = 'PAY-' + new Date().getTime();

  DAL_append('收款紀錄', Object.assign({}, ctx, {
    收款ID: payId,
    應收ID: arId,
    活動ID: ar['活動ID'],
    收款金額: amount,
    收款日期: FW_first_(data['收款日期'], data.payDate, FW_today_()),
    收款方式: FW_first_(data['收款方式'], data.method),
    付款人: FW_first_(data['付款人'], data.payer),
    備註: FW_first_(data['備註'], data.note),
    建立時間: FW_now_()
  }));

  var paid = Number(ar['已收金額'] || 0) + amount;
  var total = Number(ar['應收金額'] || 0);
  var unpaid = Math.max(total - paid, 0);

  DAL_updateByRow('應收帳款', ar._row, {
    已收金額: paid,
    未收金額: unpaid,
    收款狀態: FW_paymentStatus_(total, paid),
    更新時間: FW_now_()
  });

  return FW_success_('收款已登錄。', {
    收款ID: payId,
    應收ID: arId,
    已收金額: paid,
    未收金額: unpaid,
    收款狀態: FW_paymentStatus_(total, paid)
  });
}

function 登錄支出(data) {
  var err = FW_requireDAL_();
  if (err) return err;

  FW_initFinanceSheets_();

  data = data || {};
  var ctx = FW_ctx_(data);

  var amount = Number(FW_first_(data['支出金額'], data.amount, 0));
  var activityId = FW_first_(data['活動ID'], data.activityId);

  if (!activityId) return FW_fail_('請提供活動ID。');
  if (!amount || amount <= 0) return FW_fail_('支出金額必須大於 0。');

  var expId = 'EXP-' + new Date().getTime();

  DAL_append('支出紀錄', Object.assign({}, ctx, {
    支出ID: expId,
    活動ID: activityId,
    支出日期: FW_first_(data['支出日期'], data.expDate, FW_today_()),
    支出金額: amount,
    支出類型: FW_first_(data['支出類型'], data.type),
    支出項目: FW_first_(data['支出項目'], data.item),
    付款方式: FW_first_(data['付款方式'], data.method),
    收據狀態: FW_first_(data['收據狀態'], data.receiptStatus),
    備註: FW_first_(data['備註'], data.note),
    建立時間: FW_now_()
  }));

  return FW_success_('支出已登錄。', {
    支出ID: expId,
    支出金額: amount
  });
}

function 查詢未收款(data) {
  var err = FW_requireDAL_();
  if (err) return err;

  FW_initFinanceSheets_();

  data = data || {};

  var res = DAL_query('應收帳款', Object.assign({}, FW_ctx_(data), {
    keyword: FW_first_(data.keyword, data['關鍵字']),
    page: data.page || 1,
    limit: data.limit || 100,
    cache: false
  }));

  var rows = res.data.rows.filter(function(r) {
    return String(r['收款狀態']) !== '已收款';
  });

  return FW_success_('未收款查詢完成。', {
    結果: rows,
    筆數: rows.length
  });
}

function 查詢專案損益(data) {
  var err = FW_requireDAL_();
  if (err) return err;

  FW_initFinanceSheets_();

  data = data || {};
  var ctx = FW_ctx_(data);

  var activityId = FW_first_(data['活動ID'], data.activityId, data.keyword);
  var filters = activityId ? { '活動ID': activityId } : {};

  var ar = DAL_query('應收帳款', Object.assign({}, ctx, {
    filters: filters,
    limit: 300,
    cache: false
  })).data.rows;

  var pay = DAL_query('收款紀錄', Object.assign({}, ctx, {
    filters: filters,
    limit: 300,
    cache: false
  })).data.rows;

  var exp = DAL_query('支出紀錄', Object.assign({}, ctx, {
    filters: filters,
    limit: 300,
    cache: false
  })).data.rows;

  var revenue = pay.reduce(function(sum, r) {
    return sum + Number(r['收款金額'] || 0);
  }, 0);

  var expense = exp.reduce(function(sum, r) {
    return sum + Number(r['支出金額'] || 0);
  }, 0);

  return FW_success_('專案損益查詢完成。', {
    活動ID: activityId,
    收入: revenue,
    支出: expense,
    損益: revenue - expense,
    應收資料: ar.length,
    收款資料: pay.length,
    支出資料: exp.length
  });
}

function 測試_DAL_FinanceWrappers() {
  var ctx = {
    tenantId: 'QA-FINANCE',
    userId: 'QA-USER',
    userRole: 'owner',
    plan: 'PRO'
  };

  var ar = 建立應收帳款(Object.assign({}, ctx, {
    活動ID: 'QA-ACTIVITY',
    應收金額: 5000,
    對象名稱: '測試單位'
  }));

  var pay = 登錄收款(Object.assign({}, ctx, {
    應收ID: ar.data && ar.data.應收ID,
    收款金額: 2000,
    收款方式: '匯款'
  }));

  var pl = 查詢專案損益(Object.assign({}, ctx, {
    活動ID: 'QA-ACTIVITY'
  }));

  return FW_success_('DAL 財務層測試完成。', {
    建立應收: ar,
    登錄收款: pay,
    損益: pl
  });
}
