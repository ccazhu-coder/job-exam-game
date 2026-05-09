/*
GovOps OS｜41_GovOps_DAL_WriteWrappers.gs
商用 SaaS ERP 寫入層 v1.0.0

目的：
將高風險寫入操作改走 39_GovOps_DataAccessLayer.gs。
此檔處理：新增活動、新增報名、任務更新、物品更新、活動狀態更新。
*/

var GOVOPS_DAL_WRITE_WRAPPER_VERSION = '1.0.0';

function WW_ctx_(data) {
  data = data || {};
  return {
    tenantId: data.tenantId || data['組織ID'] || '',
    userId: data.userId || data['使用者ID'] || '',
    userRole: data.userRole || data['使用者角色'] || data.role || '',
    plan: data.plan || data['SaaS方案'] || ''
  };
}

function WW_success_(message, data) {
  return typeof success === 'function' ? success(message, data) : { success: true, message: message || '操作完成。', data: data || {} };
}

function WW_fail_(message, data) {
  return typeof fail === 'function' ? fail(message, data) : { success: false, message: message || '操作失敗。', data: data || {} };
}

function WW_now_() {
  return typeof now === 'function' ? now() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

function WW_today_() {
  return typeof today === 'function' ? today() : Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}

function WW_first_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function WW_id_(type) {
  return typeof generateId === 'function' ? generateId(type) : type + '-' + new Date().getTime();
}

function WW_sheet_(key) {
  if (typeof GOVOPS_CORE_SHEETS !== 'undefined' && GOVOPS_CORE_SHEETS[key]) return GOVOPS_CORE_SHEETS[key];
  var map = { 活動: '招生活動管理', 報名: '報名資料庫', CRM: '學員CRM', 任務: '當日工作任務表', 物品: '物品清單' };
  return map[key] || key;
}

function WW_requireDAL_() {
  if (typeof DAL_append !== 'function' || typeof DAL_findOne !== 'function' || typeof DAL_updateByRow !== 'function') {
    return WW_fail_('DataAccessLayer 尚未載入，請先貼上 39_GovOps_DataAccessLayer.gs。');
  }
  return null;
}

function 新增活動(data) {
  var err = WW_requireDAL_(); if (err) return err;
  data = data || {};
  var ctx = WW_ctx_(data);
  var activityId = WW_first_(data['活動ID'], data.activityId) || WW_id_('活動');
  var name = WW_first_(data['活動名稱'], data.activityName, data.name);
  if (!name) return WW_fail_('請先填寫活動名稱。');
  var obj = Object.assign({}, ctx, {
    活動ID: activityId,
    計畫名稱: WW_first_(data['計畫名稱'], data.projectName, name),
    活動名稱: name,
    活動日期: WW_first_(data['活動日期'], data.date, data.activityDate),
    開始時間: WW_first_(data['開始時間'], data.startTime),
    結束時間: WW_first_(data['結束時間'], data.endTime),
    活動地點: WW_first_(data['活動地點'], data.location),
    主辦單位: WW_first_(data['主辦單位'], data.host),
    協辦單位: WW_first_(data['協辦單位'], data.coHost),
    聯絡人: WW_first_(data['聯絡人'], data.contact),
    聯絡電話: WW_first_(data['聯絡電話'], data.contactPhone),
    講師: WW_first_(data['講師'], data.teacher),
    活動類型: WW_first_(data['活動類型'], data.type, '政府課程'),
    活動狀態: WW_first_(data['活動狀態'], data.status, '籌備中'),
    報名表單連結: WW_first_(data['報名表單連結'], data.formUrl),
    表單回覆試算表ID: WW_first_(data['表單回覆試算表ID'], data.responseSpreadsheetId),
    表單回覆分頁名稱: WW_first_(data['表單回覆分頁名稱'], data.responseSheetName),
    Drive資料夾連結: WW_first_(data['Drive資料夾連結'], data.driveUrl),
    建立時間: WW_now_(),
    更新時間: WW_now_()
  });
  DAL_append(WW_sheet_('活動'), obj);
  return WW_success_('活動新增完成。', { 活動ID: activityId, 活動: obj });
}

function 新增報名(data) {
  var err = WW_requireDAL_(); if (err) return err;
  data = data || {};
  var ctx = WW_ctx_(data);
  var activityId = WW_first_(data['活動ID'], data.activityId);
  var name = WW_first_(data['姓名'], data.name);
  var phone = WW_first_(data['電話'], data.phone);
  var email = WW_first_(data['Email'], data.email);
  if (!activityId) return WW_fail_('請提供活動ID。');
  if (!name && !phone && !email) return WW_fail_('請至少提供姓名、電話或 Email。');

  var student = DAL_findOne(WW_sheet_('CRM'), Object.assign({}, ctx, { filters: phone ? { '電話': phone } : { 'Email': email }, cache: false }));
  var studentId = student ? student['學員ID'] : WW_id_('學員');
  if (!student) {
    DAL_append(WW_sheet_('CRM'), Object.assign({}, ctx, {
      學員ID: studentId,
      姓名: name,
      電話: phone,
      Email: email,
      身分別: WW_first_(data['身分別'], data.identity),
      服務單位: WW_first_(data['服務單位'], data.org),
      所在地區: WW_first_(data['所在地區'], data.area),
      來源渠道: WW_first_(data['來源渠道'], data.source, '手動新增'),
      報名次數: 1,
      出席次數: 0,
      未出席次數: 0,
      最後報名日期: WW_today_(),
      建立時間: WW_now_(),
      更新時間: WW_now_()
    }));
  } else {
    DAL_updateByRow(WW_sheet_('CRM'), student._row, {
      報名次數: Number(student['報名次數'] || 0) + 1,
      最後報名日期: WW_today_(),
      更新時間: WW_now_()
    });
  }

  var regId = WW_id_('報名');
  DAL_append(WW_sheet_('報名'), Object.assign({}, ctx, {
    報名ID: regId,
    活動ID: activityId,
    學員ID: studentId,
    姓名: name,
    電話: phone,
    Email: email,
    身分別: WW_first_(data['身分別'], data.identity),
    服務單位: WW_first_(data['服務單位'], data.org),
    所在地區: WW_first_(data['所在地區'], data.area),
    來源渠道: WW_first_(data['來源渠道'], data.source, '手動新增'),
    報名方式: WW_first_(data['報名方式'], data.method, '手動新增'),
    報名狀態: WW_first_(data['報名狀態'], data.status, '已報名'),
    出席狀態: WW_first_(data['出席狀態'], data.attendStatus, '未簽到'),
    備註: WW_first_(data['備註'], data.note),
    建立時間: WW_now_(),
    更新時間: WW_now_()
  }));
  return WW_success_('報名新增完成。', { 報名ID: regId, 學員ID: studentId });
}

function 更新活動狀態(data) {
  var err = WW_requireDAL_(); if (err) return err;
  data = data || {};
  var ctx = WW_ctx_(data);
  var id = WW_first_(data['活動ID'], data.activityId);
  var status = WW_first_(data['活動狀態'], data.status);
  if (!id) return WW_fail_('請提供活動ID。');
  if (!status) return WW_fail_('請提供活動狀態。');
  var row = DAL_findOne(WW_sheet_('活動'), Object.assign({}, ctx, { filters: { '活動ID': id }, cache: false }));
  if (!row) return WW_fail_('查無活動。');
  DAL_updateByRow(WW_sheet_('活動'), row._row, { 活動狀態: status, 更新時間: WW_now_() });
  return WW_success_('活動狀態已更新。', { 活動ID: id, 活動狀態: status });
}

function 更新任務狀態(data) {
  var err = WW_requireDAL_(); if (err) return err;
  data = data || {};
  var ctx = WW_ctx_(data);
  var id = WW_first_(data['任務ID'], data.taskId);
  var status = WW_first_(data['任務狀態'], data.status, '已完成');
  if (!id) return WW_fail_('請提供任務ID。');
  var row = DAL_findOne(WW_sheet_('任務'), Object.assign({}, ctx, { filters: { '任務ID': id }, cache: false }));
  if (!row) return WW_fail_('查無任務。');
  DAL_updateByRow(WW_sheet_('任務'), row._row, { 任務狀態: status, 完成時間: status === '已完成' ? WW_now_() : '', 更新時間: WW_now_() });
  return WW_success_('任務狀態已更新。', { 任務ID: id, 任務狀態: status });
}

function 更新物品狀態(data) {
  var err = WW_requireDAL_(); if (err) return err;
  data = data || {};
  var ctx = WW_ctx_(data);
  var id = WW_first_(data['物品ID'], data.itemId);
  if (!id) return WW_fail_('請提供物品ID。');
  var row = DAL_findOne(WW_sheet_('物品'), Object.assign({}, ctx, { filters: { '物品ID': id }, cache: false }));
  if (!row) return WW_fail_('查無物品。');
  DAL_updateByRow(WW_sheet_('物品'), row._row, {
    是否已帶出: WW_first_(data['是否已帶出'], data.outStatus, row['是否已帶出']),
    是否已取回: WW_first_(data['是否已取回'], data.backStatus, row['是否已取回']),
    更新時間: WW_now_()
  });
  return WW_success_('物品狀態已更新。', { 物品ID: id });
}

function 測試_DAL_WriteWrappers() {
  var ctx = { tenantId: 'QA-DAL-WRITE', userId: 'QA-USER', userRole: 'owner', plan: 'PRO' };
  var act = 新增活動(Object.assign({}, ctx, { 活動名稱: 'DAL 寫入測試活動', 活動日期: WW_today_(), 活動地點: '測試地點' }));
  var activityId = act.data && act.data.活動ID;
  var reg = 新增報名(Object.assign({}, ctx, { 活動ID: activityId, 姓名: 'DAL 寫入測試學員', 電話: '0911222333', Email: 'dal.write@govops.local' }));
  return WW_success_('DAL 寫入層測試完成。', { 新增活動: act, 新增報名: reg });
}
