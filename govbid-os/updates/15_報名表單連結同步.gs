/* GovOps OS｜報名表單連結與自動同步模組
請在 Apps Script 新增檔案：15_報名表單連結同步
用途：讓每場活動可以儲存線上報名表單連結，並支援表單回覆自動寫入報名資料庫與學員CRM。
*/

function 更新活動報名表單連結(data) {
  const activityId = data.活動ID || data.activityId || '';
  const formUrl = data.報名表單連結 || data.formUrl || data.url || '';
  const responseSheetId = data.表單回覆試算表ID || data.responseSheetId || '';
  const responseSheetName = data.表單回覆分頁名稱 || data.responseSheetName || '表單回應 1';

  if (!activityId) throw new Error('缺少活動ID');
  if (!formUrl) throw new Error('缺少報名表單連結');

  const row = 依ID查(分頁.活動, activityId);
  if (!row) return 回應(false, '找不到活動資料', { 活動ID: activityId });

  更新列(分頁.活動, row._row, {
    報名表單連結: formUrl,
    表單回覆試算表ID: responseSheetId,
    表單回覆分頁名稱: responseSheetName,
    報名資料來源: '表單連結',
    更新時間: 現在()
  });

  寫操作('更新報名表單連結', 分頁.活動, activityId, '', formUrl);

  return 回應(true, '報名表單連結已儲存', {
    活動ID: activityId,
    報名表單連結: formUrl,
    表單回覆試算表ID: responseSheetId,
    表單回覆分頁名稱: responseSheetName
  });
}

function 查詢活動報名表單連結(data) {
  const activityId = data.活動ID || data.activityId || '';
  if (!activityId) throw new Error('缺少活動ID');

  const row = 依ID查(分頁.活動, activityId);
  if (!row) return 回應(false, '找不到活動資料', { 活動ID: activityId });

  return 回應(true, '報名表單資料已取得', {
    活動ID: activityId,
    活動名稱: row.活動名稱 || '',
    報名表單連結: row.報名表單連結 || '',
    表單回覆試算表ID: row.表單回覆試算表ID || '',
    表單回覆分頁名稱: row.表單回覆分頁名稱 || '',
    報名資料來源: row.報名資料來源 || ''
  });
}

function 從報名表單同步報名資料(data) {
  const activityId = data.活動ID || data.activityId || '';
  if (!activityId) throw new Error('缺少活動ID');

  const activity = 依ID查(分頁.活動, activityId);
  if (!activity) return 回應(false, '找不到活動資料', { 活動ID: activityId });

  const responseSheetId = data.表單回覆試算表ID || data.responseSheetId || activity.表單回覆試算表ID || '';
  const responseSheetName = data.表單回覆分頁名稱 || data.responseSheetName || activity.表單回覆分頁名稱 || '表單回應 1';

  if (!responseSheetId) {
    return 回應(false, '尚未設定表單回覆試算表ID，無法自動同步', {
      活動ID: activityId,
      建議: '請先在活動中貼上表單回覆試算表ID'
    });
  }

  const sourceSS = SpreadsheetApp.openById(responseSheetId);
  const sourceSheet = sourceSS.getSheetByName(responseSheetName);
  if (!sourceSheet) return 回應(false, '找不到表單回覆分頁：' + responseSheetName, {});

  const values = sourceSheet.getDataRange().getValues();
  if (values.length < 2) return 回應(true, '目前沒有新的表單回覆資料', { 新增筆數: 0 });

  const headers = values[0].map(String);
  let created = 0;
  let skipped = 0;
  const results = [];

  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = values[i][idx]);

    const name = 取表單欄位(obj, ['姓名', '學員姓名', '中文姓名', '您的姓名']);
    const phone = 取表單欄位(obj, ['電話', '手機', '聯絡電話', '手機號碼']);
    const email = 取表單欄位(obj, ['Email', '電子郵件', '電子信箱']);

    if (!name || !phone) {
      skipped++;
      continue;
    }

    const exists = 讀列(分頁.報名).find(r => {
      return String(r.活動ID || '') === String(activityId) &&
             (String(r.電話 || '') === String(phone) || String(r.Email || '') === String(email));
    });

    if (exists) {
      skipped++;
      continue;
    }

    const reg = 新增報名({
      活動ID: activityId,
      姓名: name,
      電話: phone,
      Email: email,
      身分別: 取表單欄位(obj, ['身分別', '身份別', '身分', '身分類型']),
      服務單位: 取表單欄位(obj, ['服務單位', '公司名稱', '任職單位', '單位']),
      所在地區: 取表單欄位(obj, ['所在地區', '居住地', '縣市']),
      來源渠道: '線上報名表單',
      興趣標籤: activity.活動名稱 || '',
      備註: '由表單回覆自動匯入'
    });

    created++;
    results.push(reg.data || {});
  }

  寫操作('同步表單報名資料', 分頁.報名, activityId, '', '新增' + created + '筆，略過' + skipped + '筆');

  return 回應(true, '表單報名資料同步完成', {
    活動ID: activityId,
    新增筆數: created,
    略過筆數: skipped,
    明細: results
  });
}

function 取表單欄位(obj, names) {
  for (let i = 0; i < names.length; i++) {
    const key = names[i];
    if (obj[key] !== undefined && obj[key] !== '') return String(obj[key]).trim();
  }
  return '';
}
