/*
GovOps OS｜40_GovOps_RegistrationNormalizerPatch.gs
報名資料一致性安全補丁

目的：
1. 不修改 37_core.gs
2. 不修改 index.html
3. 不新增 Runtime
4. 統一手動新增報名與表單同步報名的欄位格式
5. 補齊 tenantId / registrationId / 報名狀態
*/

function GOVOPS_REG_NOW_() {
  try {
    if (typeof now === 'function') return now();
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  } catch (err) {
    return new Date().toISOString();
  }
}

function GOVOPS_REG_ID_() {
  try {
    if (typeof generateId === 'function') return generateId('報名');
  } catch (err) {}
  return 'REG-' + new Date().getTime() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function 標準化單筆報名資料(row, context) {
  row = row || {};
  context = context || {};

  var tenantId = row.tenantId || row['tenantId'] || row['組織ID'] || context.tenantId || context['組織ID'] || '';
  var activityId = row['活動ID'] || row.activityId || row['系統活動編號'] || context['活動ID'] || context.activityId || '';
  var registrationId = row['報名ID'] || row['報名編號'] || row.registrationId || row.regId || '';
  var studentId = row['學員ID'] || row.studentId || '';
  var status = String(row['報名狀態'] || row.status || '').trim();

  if (!registrationId) registrationId = GOVOPS_REG_ID_();
  if (!status) status = '待審核';

  return {
    tenantId: tenantId,
    組織ID: tenantId,
    報名ID: registrationId,
    registrationId: registrationId,
    報名編號: registrationId,
    活動ID: activityId,
    activityId: activityId,
    學員ID: studentId,
    姓名: row['姓名'] || row.name || row['學員姓名'] || '',
    電話: row['電話'] || row.phone || row['手機'] || row['聯絡電話'] || '',
    Email: row['Email'] || row.email || row['電子信箱'] || '',
    身分別: row['身分別'] || row.identity || '',
    服務單位: row['服務單位'] || row.organization || row.company || row['任職單位'] || '',
    所在地區: row['所在地區'] || row.area || '',
    來源渠道: row['來源渠道'] || row.source || row['來源'] || '系統匯入',
    報名方式: row['報名方式'] || row.method || '系統',
    報名狀態: status,
    出席狀態: row['出席狀態'] || '',
    備註: row['備註'] || row.note || '',
    建立時間: row['建立時間'] || row.createdAt || GOVOPS_REG_NOW_(),
    更新時間: GOVOPS_REG_NOW_(),
    _row: row._row || ''
  };
}

function 修復報名資料一致性(data) {
  data = data || {};
  try {
    if (typeof readRows !== 'function' || typeof updateRow !== 'function') {
      return {
        success: false,
        message: '報名資料修復工具尚未載入。',
        data: { 修復數: 0, 略過數: 0 }
      };
    }

    var rows = readRows('報名資料庫') || [];
    var tenantId = data.tenantId || data['組織ID'] || '';
    var activityId = data['活動ID'] || data.activityId || '';
    var fixed = 0;
    var skipped = 0;
    var samples = [];

    rows.forEach(function(row) {
      var rowTenantId = row.tenantId || row['tenantId'] || row['組織ID'] || '';
      var rowActivityId = row['活動ID'] || row.activityId || '';

      if (tenantId && rowTenantId && String(rowTenantId) !== String(tenantId)) {
        skipped++;
        return;
      }
      if (activityId && String(rowActivityId) !== String(activityId)) {
        skipped++;
        return;
      }

      var normalized = 標準化單筆報名資料(row, data);
      var patch = {};

      if (!row['報名ID']) patch['報名ID'] = normalized.報名ID;
      if (!row['報名狀態']) patch['報名狀態'] = normalized.報名狀態;
      if (!row['建立時間']) patch['建立時間'] = normalized.建立時間;
      patch['更新時間'] = normalized.更新時間;

      if (Object.keys(patch).length > 0 && row._row) {
        updateRow('報名資料庫', row._row, patch);
        fixed++;
        if (samples.length < 5) samples.push({ 報名ID: normalized.報名ID, 姓名: normalized.姓名, 修復欄位: Object.keys(patch) });
      } else {
        skipped++;
      }
    });

    return {
      success: true,
      message: '報名資料一致性修復完成。',
      data: {
        修復數: fixed,
        略過數: skipped,
        範例: samples
      }
    };
  } catch (err) {
    return {
      success: false,
      message: '報名資料一致性修復失敗，請稍後再試。',
      data: { 修復數: 0, 略過數: 0 }
    };
  }
}

function 檢查報名資料一致性(data) {
  data = data || {};
  try {
    if (typeof readRows !== 'function') {
      return {
        success: false,
        message: '報名資料讀取工具尚未載入。',
        data: {}
      };
    }

    var rows = readRows('報名資料庫') || [];
    var tenantId = data.tenantId || data['組織ID'] || '';
    var activityId = data['活動ID'] || data.activityId || '';
    var issues = [];

    rows.forEach(function(row) {
      var rowTenantId = row.tenantId || row['tenantId'] || row['組織ID'] || '';
      var rowActivityId = row['活動ID'] || row.activityId || '';
      if (tenantId && rowTenantId && String(rowTenantId) !== String(tenantId)) return;
      if (activityId && String(rowActivityId) !== String(activityId)) return;

      var rowIssues = [];
      if (!row['報名ID'] && !row.registrationId && !row['報名編號']) rowIssues.push('缺少報名ID');
      if (!row['報名狀態']) rowIssues.push('報名狀態空白');
      if (!row['建立時間']) rowIssues.push('缺少建立時間');
      if (rowIssues.length) {
        issues.push({
          row: row._row || '',
          姓名: row['姓名'] || '',
          活動ID: row['活動ID'] || row.activityId || '',
          問題: rowIssues
        });
      }
    });

    return {
      success: true,
      message: '報名資料一致性檢查完成。',
      data: {
        總筆數: rows.length,
        問題數: issues.length,
        問題: issues.slice(0, 50)
      }
    };
  } catch (err) {
    return {
      success: false,
      message: '報名資料一致性檢查失敗，請稍後再試。',
      data: {}
    };
  }
}

function 測試_檢查報名資料一致性() {
  return 檢查報名資料一致性({});
}

function 測試_修復報名資料一致性() {
  return 修復報名資料一致性({});
}
