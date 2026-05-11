/*
GovOps OS｜39_GovOps_RegistrationReviewPatch.gs
報名審核名單安全補丁

目的：
1. 不修改 37_core.gs
2. 不修改 index.html
3. 先提供獨立函式，供 Apps Script 手動測試
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
      var query = DAL_query('報名資料庫', {
        tenantId: tenantId,
        limit: 1000,
        cache: false
      });
      rows = query && query.data && query.data.rows ? query.data.rows : [];
    } else {
      return {
        success: false,
        message: '報名資料讀取工具尚未載入。',
        data: {
          報名: [],
          結果: [],
          筆數: 0
        }
      };
    }

    var allowedStatuses = [
      '',
      '待審核',
      '已報名',
      '已入選',
      '候補',
      '未錄取'
    ];

    var resultRows = rows.filter(function(row) {
      var rowTenantId = row.tenantId || row['tenantId'] || row['組織ID'] || '';
      var rowActivityId = row['活動ID'] || row.activityId || row['系統活動編號'] || '';
      var status = String(row['報名狀態'] || '').trim();

      if (tenantId && rowTenantId && String(rowTenantId) !== String(tenantId)) return false;
      if (activityId && String(rowActivityId) !== String(activityId)) return false;
      return allowedStatuses.indexOf(status) >= 0;
    }).map(function(row) {
      return {
        報名ID: row['報名ID'] || row['報名編號'] || row.registrationId || row.regId || '',
        姓名: row['姓名'] || row.name || '',
        電話: row['電話'] || row.phone || '',
        Email: row['Email'] || row.email || '',
        身分別: row['身分別'] || row.identity || '',
        服務單位: row['服務單位'] || row.organization || row.company || '',
        來源渠道: row['來源渠道'] || row.source || '',
        報名狀態: row['報名狀態'] || '',
        建立時間: row['建立時間'] || row.createdAt || '',
        活動ID: row['活動ID'] || row.activityId || row['系統活動編號'] || '',
        學員ID: row['學員ID'] || row.studentId || '',
        _row: row._row || ''
      };
    });

    return {
      success: true,
      message: '報名審核名單已取得。',
      data: {
        報名: resultRows,
        結果: resultRows,
        筆數: resultRows.length
      }
    };
  } catch (err) {
    return {
      success: false,
      message: '報名審核名單讀取失敗，請稍後再試。',
      data: {
        報名: [],
        結果: [],
        筆數: 0
      }
    };
  }
}

function 測試_查詢報名審核名單() {
  return 查詢報名審核名單({});
}
