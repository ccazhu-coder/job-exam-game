/*
GovOps OS｜38_GovOps_ERP_Modules_AllInOne.gs
報名審核資料流修正層

目的：
1. 讓手動新增報名與表單同步報名都能進入報名審核名單
2. 不新增 Runtime
3. 不破壞既有 ERP 模組
*/

function 查詢報名審核名單(data) {
  data = data || {};
  try {
    var tenantId = data.tenantId || data['組織ID'] || '';
    var activityId = data['活動ID'] || data.activityId || data['系統活動編號'] || '';
    var rows = [];

    if (typeof readRows === 'function') {
      rows = readRows('報名資料庫') || [];
    } else if (typeof DAL_query === 'function') {
      var q = DAL_query('報名資料庫', { tenantId: tenantId, limit: 1000, cache: false });
      rows = q && q.data && q.data.rows ? q.data.rows : [];
    } else {
      return { success: false, message: '報名資料讀取工具尚未載入。', data: { 報名: [], 結果: [], 筆數: 0 } };
    }

    rows = rows.filter(function(row) {
      var rowTenantId = row.tenantId || row['tenantId'] || row['組織ID'] || '';
      var rowActivityId = row['活動ID'] || row.activityId || '';
      var status = String(row['報名狀態'] || '').trim();
      var allowedStatus = ['', '待審核', '已報名', '已入選', '候補', '未錄取', '資格不符', '已取消', '已確認參加', '未回覆'];

      if (tenantId && rowTenantId && String(rowTenantId) !== String(tenantId)) return false;
      if (activityId && String(rowActivityId) !== String(activityId)) return false;
      return allowedStatus.indexOf(status) >= 0;
    }).map(function(row) {
      return {
        報名ID: row['報名ID'] || row.registrationId || row['報名編號'] || '',
        姓名: row['姓名'] || row.name || '',
        電話: row['電話'] || row.phone || '',
        Email: row['Email'] || row.email || '',
        身分別: row['身分別'] || row.identity || '',
        服務單位: row['服務單位'] || row.organization || '',
        來源渠道: row['來源渠道'] || row.source || '',
        報名狀態: row['報名狀態'] || '',
        建立時間: row['建立時間'] || row.createdAt || '',
        活動ID: row['活動ID'] || row.activityId || '',
        學員ID: row['學員ID'] || row.studentId || '',
        _row: row._row || ''
      };
    });

    return {
      success: true,
      message: '報名審核名單已取得。',
      data: {
        報名: rows,
        結果: rows,
        筆數: rows.length
      }
    };
  } catch (err) {
    return { success: false, message: '報名審核名單讀取失敗，請稍後再試。', data: { 報名: [], 結果: [], 筆數: 0 } };
  }
}

function 審核報名相容修正(data) {
  data = data || {};
  try {
    var registrationId = data['報名ID'] || data['報名編號'] || data.registrationId || data.regId || '';
    var status = data['報名狀態'] || data['審核結果'] || data.status || '';
    if (!registrationId) return { success: false, message: '請提供報名編號。' };
    if (!status) return { success: false, message: '請提供審核結果。' };

    if (typeof readRows !== 'function' || typeof updateRow !== 'function') {
      return { success: false, message: '報名審核工具尚未載入。' };
    }

    var rows = readRows('報名資料庫') || [];
    var target = rows.filter(function(row) {
      return String(row['報名ID'] || row.registrationId || row['報名編號'] || '') === String(registrationId);
    })[0];

    if (!target) return { success: false, message: '查無報名資料：' + registrationId };

    updateRow('報名資料庫', target._row, {
      '報名狀態': status,
      '更新時間': typeof now === 'function' ? now() : new Date().toISOString()
    });

    return {
      success: true,
      message: '報名審核結果已更新。',
      data: {
        報名ID: registrationId,
        報名狀態: status
      }
    };
  } catch (err) {
    return { success: false, message: '報名審核更新失敗，請稍後再試。' };
  }
}
