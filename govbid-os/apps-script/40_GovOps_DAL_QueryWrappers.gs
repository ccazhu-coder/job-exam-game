/*
GovOps OS｜40_GovOps_DAL_QueryWrappers.gs
商用 SaaS ERP 查詢層 v1.0.0

目的：
將高頻查詢改走 39_GovOps_DataAccessLayer.gs，降低全表掃描風險。
此檔只處理查詢，不處理寫入與財務。
*/

var GOVOPS_DAL_QUERY_WRAPPER_VERSION = '1.0.0';

function QW_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || data.role || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function QW_success_(message, data) {
  return typeof success === 'function'
    ? success(message, data)
    : { success: true, message: message || '操作完成。', data: data || {} };
}

function QW_fail_(message, data) {
  return typeof fail === 'function'
    ? fail(message, data)
    : { success: false, message: message || '操作失敗。', data: data || {} };
}

function QW_first_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function QW_sheet_(key) {
  if (typeof GOVOPS_CORE_SHEETS !== 'undefined' && GOVOPS_CORE_SHEETS[key]) return GOVOPS_CORE_SHEETS[key];
  var map = {
    活動: '招生活動管理',
    報名: '報名資料庫',
    CRM: '學員CRM',
    任務: '當日工作任務表',
    物品: '物品清單',
    簽到: '簽到表紀錄',
    文件: '文件歸檔紀錄'
  };
  return map[key] || key;
}

function QW_requireDAL_() {
  if (typeof DAL_query !== 'function') {
    return QW_fail_('DataAccessLayer 尚未載入，請先貼上 39_GovOps_DataAccessLayer.gs。');
  }
  return null;
}

function QW_query_(sheetName, data, options) {
  options = options || {};
  data = data || {};
  var ctx = QW_ctx_(data);
  return DAL_query(sheetName, Object.assign({}, ctx, {
    keyword: QW_first_(data.keyword, data['關鍵字'], data.q),
    page: data.page || 1,
    limit: data.limit || options.limit || 100,
    filters: options.filters || {},
    fields: options.fields || [],
    sortBy: options.sortBy || '建立時間',
    sortDir: options.sortDir || 'desc',
    cache: options.cache !== false
  }));
}

function 取得儀表板(data) {
  var err = QW_requireDAL_();
  if (err) return err;
  data = data || {};
  var ctx = QW_ctx_(data);

  var activities = DAL_query(QW_sheet_('活動'), Object.assign({}, ctx, {
    limit: 5,
    page: 1,
    sortBy: '建立時間',
    sortDir: 'desc'
  }));

  var regs = DAL_query(QW_sheet_('報名'), Object.assign({}, ctx, {
    limit: 1,
    page: 1
  }));

  var crm = DAL_query(QW_sheet_('CRM'), Object.assign({}, ctx, {
    limit: 1,
    page: 1
  }));

  var tasks = DAL_query(QW_sheet_('任務'), Object.assign({}, ctx, {
    limit: 10,
    page: 1,
    filters: { '任務狀態': '未完成' },
    cache: false
  }));

  return QW_success_('儀表板資料取得成功。', {
    活動數: activities.data.total,
    報名數: regs.data.total,
    CRM筆數: crm.data.total,
    任務數: tasks.data.total,
    最近活動: activities.data.rows,
    今日任務: tasks.data.rows
  });
}

function 查詢(data) {
  var err = QW_requireDAL_();
  if (err) return err;
  data = data || {};
  var activities = QW_query_(QW_sheet_('活動'), data, { limit: data.limit || 30 });
  var regs = QW_query_(QW_sheet_('報名'), data, { limit: data.limit || 30 });
  return QW_success_('查詢完成。', {
    活動: activities.data.rows,
    報名: regs.data.rows,
    活動總數: activities.data.total,
    報名總數: regs.data.total
  });
}

function 查詢學員(data) {
  var err = QW_requireDAL_();
  if (err) return err;
  data = data || {};
  var res = QW_query_(QW_sheet_('CRM'), data, { limit: data.limit || 100 });
  return QW_success_('學員查詢完成。', {
    學員: res.data.rows,
    筆數: res.data.total,
    page: res.data.page,
    totalPages: res.data.totalPages
  });
}

function 查詢可行銷名單(data) {
  var err = QW_requireDAL_();
  if (err) return err;
  data = data || {};
  var res = QW_query_(QW_sheet_('CRM'), data, { limit: data.limit || 300 });
  var rows = res.data.rows.filter(function(r) {
    return String(r['行銷同意'] || '').indexOf('否') < 0;
  });
  return QW_success_('可行銷名單查詢完成。', {
    學員: rows,
    筆數: rows.length,
    page: res.data.page,
    totalPages: res.data.totalPages
  });
}

function 查詢今日任務(data) {
  var err = QW_requireDAL_();
  if (err) return err;
  data = data || {};
  var res = QW_query_(QW_sheet_('任務'), data, {
    limit: data.limit || 50,
    cache: false
  });
  var rows = res.data.rows.filter(function(r) {
    return String(r['任務狀態'] || '') !== '已完成';
  });
  return QW_success_('今日任務查詢完成。', {
    任務: rows,
    筆數: rows.length
  });
}

function 查詢物品(data) {
  var err = QW_requireDAL_();
  if (err) return err;
  data = data || {};
  var res = QW_query_(QW_sheet_('物品'), data, { limit: data.limit || 100 });
  return QW_success_('物品查詢完成。', {
    資料: res.data.rows,
    筆數: res.data.total
  });
}

function 查詢簽到名單(data) {
  var err = QW_requireDAL_();
  if (err) return err;
  data = data || {};
  var activityId = QW_first_(data['活動ID'], data.activityId);
  var filters = activityId ? { '活動ID': activityId } : {};
  var res = QW_query_(QW_sheet_('簽到'), data, {
    limit: data.limit || 200,
    filters: filters
  });
  return QW_success_('簽到名單查詢完成。', {
    資料: res.data.rows,
    筆數: res.data.total
  });
}

function 查詢文件歸檔(data) {
  var err = QW_requireDAL_();
  if (err) return err;
  data = data || {};
  var res = QW_query_(QW_sheet_('文件'), data, { limit: data.limit || 200 });
  return QW_success_('文件歸檔查詢完成。', {
    資料: res.data.rows,
    筆數: res.data.total
  });
}

function 測試_DAL_QueryWrappers() {
  if (typeof DAL_healthCheck !== 'function') {
    return QW_fail_('DAL 尚未載入。');
  }
  return QW_success_('DAL 查詢層載入正常。', {
    version: GOVOPS_DAL_QUERY_WRAPPER_VERSION,
    dal: DAL_healthCheck()
  });
}
