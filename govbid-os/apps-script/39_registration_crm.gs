/*
GovOps OS｜第39檔：報名與 CRM 正式模組
版本：MVP v1.0.0
依賴：37_core.gs、38_activity_workflow.gs
*/

function 新增報名(data) {
  try {
    初始化系統();
    requireField(data, '活動ID', '系統活動編號');
    requireField(data, '姓名', '姓名');
    requireField(data, '電話', '電話');

    const activity = getActivityById(data.活動ID);
    if (!activity) return fail('找不到活動資料，請重新選擇。');
    if (String(activity.活動狀態) === '已取消') return fail('活動已取消，無法新增報名。');

    const existing = findRegistration(data.活動ID, data.電話, data.Email, data.姓名);
    if (existing) return success('此學員已報名過本活動，系統已略過重複新增。', { 報名ID: existing.報名ID, 學員ID: existing.學員ID });

    const crm = 建立或更新CRM(data, activity);
    const 報名ID = generateId('報名');
    const record = {
      報名ID: 報名ID,
      活動ID: data.活動ID,
      學員ID: crm.學員ID,
      姓名: data.姓名 || '',
      電話: data.電話 || '',
      Email: data.Email || '',
      身分別: data.身分別 || '',
      服務單位: data.服務單位 || '',
      所在地區: data.所在地區 || '',
      來源渠道: data.來源渠道 || '',
      報名方式: data.報名方式 || '手動輸入',
      報名狀態: data.報名狀態 || '待審核',
      出席狀態: data.出席狀態 || '未出席',
      備註: data.備註 || '',
      建立時間: now(),
      更新時間: now()
    };

    appendObject(SHEETS.報名, record);
    writeLog('新增報名', SHEETS.報名, 報名ID, record.姓名 + '／' + record.活動ID, '完成');
    return success('報名資料已新增，學員CRM已同步更新。', { 報名ID: 報名ID, 學員ID: crm.學員ID });
  } catch (err) {
    logError('新增報名', err);
    return fail(err.message || '報名資料新增失敗。');
  }
}

function 從報名表單同步報名資料(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID;
    const sheetId = data.表單回覆試算表ID || data.responseSheetId;
    const sheetName = data.表單回覆分頁名稱 || data.responseSheetName || '表單回應 1';
    if (!活動ID) return fail('請先選擇活動。');
    if (!sheetId) return fail('請先貼上表單回覆試算表ID。');

    const activity = getActivityById(活動ID);
    if (!activity) return fail('找不到活動資料，請重新選擇。');

    const sourceSS = SpreadsheetApp.openById(sheetId);
    const sourceSheet = sourceSS.getSheetByName(sheetName);
    if (!sourceSheet) return fail('找不到表單回覆分頁，請確認分頁名稱。');
    if (sourceSheet.getLastRow() < 2) return success('目前表單尚無新報名資料。', { 新增筆數: 0, 略過筆數: 0 });

    const values = sourceSheet.getDataRange().getValues();
    const headers = values[0].map(String);
    let added = 0;
    let skipped = 0;

    for (let i = 1; i < values.length; i++) {
      const raw = rowToObject(headers, values[i]);
      const mapped = mapFormRegistration(raw);
      if (!mapped.姓名 || !mapped.電話) { skipped++; continue; }
      mapped.活動ID = 活動ID;
      mapped.報名方式 = '表單同步';
      mapped.來源渠道 = mapped.來源渠道 || '線上表單';
      const result = 新增報名(mapped);
      if (result.success && result.message.indexOf('略過') < 0) added++; else skipped++;
    }

    writeLog('同步報名資料', SHEETS.報名, 活動ID, '來源試算表：' + sheetId + '／分頁：' + sheetName, '完成');
    return success('報名資料同步完成。', { 新增筆數: added, 略過筆數: skipped });
  } catch (err) {
    logError('從報名表單同步報名資料', err);
    return fail('報名表單無法同步，請確認表單設定。');
  }
}

function 審核報名(data) {
  try {
    初始化系統();
    const 報名ID = data.報名ID || data.registrationId;
    const 審核結果 = data.審核結果 || data.status;
    if (!報名ID) return fail('請先輸入報名編號。');
    if (!審核結果) return fail('請選擇審核結果。');

    const row = readRows(SHEETS.報名).find(r => String(r.報名ID) === String(報名ID));
    if (!row) return fail('找不到報名資料，請重新確認報名編號。');

    updateRow(SHEETS.報名, row._row, { 報名狀態: 審核結果, 更新時間: now() });
    if (審核結果 === '候補') upsertWaitlist(row);
    if (審核結果 === '已確認參加') updateCrmAttendanceIntent(row.學員ID, row.活動ID);

    writeLog('審核報名', SHEETS.報名, 報名ID, '審核結果：' + 審核結果, '完成');
    return success('報名狀態已更新。', { 報名ID: 報名ID, 報名狀態: 審核結果 });
  } catch (err) {
    logError('審核報名', err);
    return fail('報名狀態更新失敗。');
  }
}

function 建立或更新CRM(data, activity) {
  const rows = readRows(SHEETS.CRM);
  const phone = String(data.電話 || '').trim();
  const email = String(data.Email || '').trim();
  const lineUid = String(data['LINE UID'] || data.LINEUID || '').trim();
  const name = String(data.姓名 || '').trim();

  let row = rows.find(r => phone && String(r.電話) === phone)
    || rows.find(r => email && String(r.Email) === email)
    || rows.find(r => lineUid && String(r['LINE UID']) === lineUid)
    || rows.find(r => name && String(r.姓名) === name && String(r.電話 || '') === phone);

  const courseName = activity ? activity.活動名稱 : '';
  const date = activity ? normalizeDate(activity.活動日期) : today();

  if (row) {
    updateRow(SHEETS.CRM, row._row, {
      姓名: data.姓名 || row.姓名,
      電話: data.電話 || row.電話,
      Email: data.Email || row.Email,
      身分別: data.身分別 || row.身分別,
      服務單位: data.服務單位 || row.服務單位,
      所在地區: data.所在地區 || row.所在地區,
      來源渠道: data.來源渠道 || row.來源渠道,
      興趣標籤: mergeTextList(row.興趣標籤, activity ? activity.活動類型 : ''),
      曾報名課程: mergeTextList(row.曾報名課程, courseName),
      報名次數: Number(row.報名次數 || 0) + 1,
      最後報名日期: date,
      更新時間: now()
    });
    return Object.assign({}, row, { 學員ID: row.學員ID });
  }

  const 學員ID = generateId('學員');
  const record = {
    學員ID: 學員ID, 姓名: data.姓名 || '', 電話: data.電話 || '', Email: data.Email || '', 'LINE UID': lineUid,
    LINE名稱: data.LINE名稱 || '', 性別: data.性別 || '', 年齡區間: data.年齡區間 || '', 身分別: data.身分別 || '',
    職業: data.職業 || '', 服務單位: data.服務單位 || '', 所在地區: data.所在地區 || '', 興趣標籤: activity ? activity.活動類型 : '',
    課程偏好: '', 曾報名課程: courseName, 曾出席課程: '', 報名次數: 1, 出席次數: 0, 未出席次數: 0,
    最後報名日期: date, 最後出席日期: '', 來源渠道: data.來源渠道 || '', 行銷同意: data.行銷同意 || '未確認',
    LINE好友狀態: data.LINE好友狀態 || '未確認', Email訂閱狀態: data.Email訂閱狀態 || '未確認', 備註: data.備註 || '',
    建立時間: now(), 更新時間: now()
  };
  appendObject(SHEETS.CRM, record);
  return record;
}

function 查詢學員(data) {
  try {
    初始化系統();
    const keyword = String(data.keyword || data.query || '').trim();
    let rows = readRows(SHEETS.CRM);
    if (keyword) rows = rows.filter(r => JSON.stringify(r).indexOf(keyword) >= 0);
    return success('學員資料已取得。', { 學員: rows.slice(0, 50), 結果: rows.slice(0, 50) });
  } catch (err) {
    logError('查詢學員', err);
    return fail('學員資料查詢失敗。');
  }
}

function 查詢可行銷名單(data) {
  try {
    初始化系統();
    const keyword = String(data.keyword || '').trim();
    let rows = readRows(SHEETS.CRM).filter(r => String(r.行銷同意 || '').indexOf('否') < 0);
    if (keyword) rows = rows.filter(r => JSON.stringify(r).indexOf(keyword) >= 0);
    return success('可行銷名單已取得。', { 學員: rows.slice(0, 100), 結果: rows.slice(0, 100) });
  } catch (err) {
    logError('查詢可行銷名單', err);
    return fail('可行銷名單查詢失敗。');
  }
}

function findRegistration(activityId, phone, email, name) {
  return readRows(SHEETS.報名).find(r => String(r.活動ID) === String(activityId) && ((phone && String(r.電話) === String(phone)) || (email && String(r.Email) === String(email)) || (name && String(r.姓名) === String(name))));
}

function getActivityById(id) { return readRows(SHEETS.活動).find(r => String(r.活動ID) === String(id)); }
function rowToObject(headers, row) { const obj = {}; headers.forEach((h, i) => obj[h] = row[i]); return obj; }

function mapFormRegistration(raw) {
  function pick(names) { for (let i = 0; i < names.length; i++) if (raw[names[i]] !== undefined && raw[names[i]] !== '') return raw[names[i]]; return ''; }
  return {
    姓名: pick(['姓名','學員姓名','名字','Name']),
    電話: normalizePhone(pick(['電話','手機','聯絡電話','手機號碼','Phone'])),
    Email: pick(['Email','電子郵件','信箱','Email Address']),
    身分別: pick(['身分別','身份別','學員身分']),
    服務單位: pick(['服務單位','公司','單位','任職單位']),
    所在地區: pick(['所在地區','縣市','居住地']),
    來源渠道: pick(['來源渠道','從哪裡得知','報名來源']),
    備註: pick(['備註','其他需求','問題'])
  };
}

function normalizePhone(v) { return String(v || '').replace(/\s/g, '').replace(/-/g, '').trim(); }
function mergeTextList(oldText, newText) { const arr = String(oldText || '').split(/[、,，;；]/).map(s => s.trim()).filter(Boolean); if (newText && arr.indexOf(String(newText).trim()) < 0) arr.push(String(newText).trim()); return arr.join('、'); }

function upsertWaitlist(reg) {
  const existed = readRows(SHEETS.候補).find(r => String(r.報名ID) === String(reg.報名ID));
  if (existed) return;
  const sameActivity = readRows(SHEETS.候補).filter(r => String(r.活動ID) === String(reg.活動ID));
  appendObject(SHEETS.候補, { 候補ID: generateId('候補'), 活動ID: reg.活動ID, 報名ID: reg.報名ID, 學員ID: reg.學員ID, 姓名: reg.姓名, 電話: reg.電話, 候補順位: sameActivity.length + 1, 候補狀態: '候補中', 建立時間: now(), 更新時間: now() });
}

function updateCrmAttendanceIntent(studentId, activityId) {
  const crm = readRows(SHEETS.CRM).find(r => String(r.學員ID) === String(studentId));
  const activity = getActivityById(activityId);
  if (!crm || !activity) return;
  updateRow(SHEETS.CRM, crm._row, { 曾出席課程: mergeTextList(crm.曾出席課程, activity.活動名稱), 出席次數: Number(crm.出席次數 || 0) + 1, 最後出席日期: normalizeDate(activity.活動日期), 更新時間: now() });
}
