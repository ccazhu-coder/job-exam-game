/*
GovOps OS｜第38檔：活動與 Workflow 正式模組
版本：MVP v1.0.0
依賴：37_core.gs
*/

function 新增活動(data) {
  try {
    初始化系統();
    requireField(data, '活動名稱', '活動名稱');
    requireField(data, '活動日期', '活動日期');
    requireField(data, '活動地點', '活動地點');

    const 活動ID = generateId('活動');
    const record = {
      活動ID: 活動ID,
      計畫名稱: data.計畫名稱 || '',
      活動名稱: data.活動名稱 || '',
      活動日期: normalizeDate(data.活動日期),
      開始時間: data.開始時間 || '',
      結束時間: data.結束時間 || '',
      活動地點: data.活動地點 || '',
      主辦單位: data.主辦單位 || '',
      協辦單位: data.協辦單位 || '',
      聯絡人: data.聯絡人 || '',
      聯絡電話: data.聯絡電話 || '',
      講師: data.講師 || '',
      活動類型: data.活動類型 || '',
      活動狀態: '籌備中',
      報名表單連結: '',
      表單回覆試算表ID: '',
      表單回覆分頁名稱: '',
      Drive資料夾連結: '',
      建立時間: now(),
      更新時間: now()
    };

    appendObject(SHEETS.活動, record);
    rememberCommonOptionsFromActivity(record);
    writeLog('新增活動', SHEETS.活動, 活動ID, record.活動名稱, '完成');

    return success('活動已建立完成。', { 活動ID: 活動ID, 活動名稱: record.活動名稱 });
  } catch (err) {
    logError('新增活動', err);
    return fail(err.message || '活動建立失敗。');
  }
}

function 生成活動作業包(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID;
    if (!活動ID) return fail('請先選擇活動。');

    const activity = readRows(SHEETS.活動).find(r => String(r.活動ID) === String(活動ID));
    if (!activity) return fail('找不到活動資料，請重新選擇。');

    const 任務新增數 = 建立預設任務(activity);
    const 物品新增數 = 建立預設物品(activity);
    const 餐點新增數 = 建立預設餐點(activity);
    const 核銷新增數 = 建立預設核銷(activity);

    writeLog('生成活動作業包', 'Workflow', 活動ID, '任務、物品、餐點、核銷檢查', '完成');

    return success('活動作業包已建立完成。', {
      活動ID: 活動ID,
      任務新增數: 任務新增數,
      物品新增數: 物品新增數,
      餐點新增數: 餐點新增數,
      核銷新增數: 核銷新增數
    });
  } catch (err) {
    logError('生成活動作業包', err);
    return fail('活動作業包建立失敗。');
  }
}

function 更新活動狀態(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID;
    const 狀態 = data.狀態 || data.status || '';
    if (!活動ID) return fail('請先選擇活動。');
    if (!狀態) return fail('請選擇活動狀態。');

    const row = readRows(SHEETS.活動).find(r => String(r.活動ID) === String(活動ID));
    if (!row) return fail('找不到活動資料，請重新選擇。');

    updateRow(SHEETS.活動, row._row, { 活動狀態: 狀態, 更新時間: now() });
    if (狀態 === '已取消') markRelatedTasksCancelled(活動ID);

    writeLog('更新活動狀態', SHEETS.活動, 活動ID, '狀態改為：' + 狀態, '完成');
    return success('活動狀態已更新。', { 活動ID: 活動ID, 活動狀態: 狀態 });
  } catch (err) {
    logError('更新活動狀態', err);
    return fail('活動狀態更新失敗。');
  }
}

function 更新活動報名表單連結(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID;
    if (!活動ID) return fail('請先選擇活動。');
    const row = readRows(SHEETS.活動).find(r => String(r.活動ID) === String(活動ID));
    if (!row) return fail('找不到活動資料，請重新選擇。');

    updateRow(SHEETS.活動, row._row, {
      報名表單連結: data.報名表單連結 || data.formUrl || '',
      表單回覆試算表ID: data.表單回覆試算表ID || data.responseSheetId || '',
      表單回覆分頁名稱: data.表單回覆分頁名稱 || data.responseSheetName || '表單回應 1',
      更新時間: now()
    });

    writeLog('更新活動報名表單連結', SHEETS.活動, 活動ID, '更新表單設定', '完成');
    return success('報名表單設定已儲存。', { 活動ID: 活動ID });
  } catch (err) {
    logError('更新活動報名表單連結', err);
    return fail('報名表單設定無法儲存。');
  }
}

function 取得儀表板(data) {
  try {
    初始化系統();
    const 活動 = readRows(SHEETS.活動);
    const 報名 = readRows(SHEETS.報名);
    const 任務 = readRows(SHEETS.任務);
    const 核銷 = readRows(SHEETS.核銷);
    const 今日 = today();

    return success('儀表板已更新。', {
      今日活動: 活動.filter(r => normalizeDate(r.活動日期) === 今日 && r.活動狀態 !== '已取消').length,
      招生中活動: 活動.filter(r => ['招生中','籌備中'].indexOf(String(r.活動狀態)) >= 0).length,
      待審核報名: 報名.filter(r => String(r.報名狀態 || '') === '待審核').length,
      未完成任務: 任務.filter(r => ['','待執行','進行中','異常'].indexOf(String(r.任務狀態 || '')) >= 0).length,
      核銷缺件: 核銷.filter(r => ['','未完成','缺件'].indexOf(String(r.核銷狀態 || '')) >= 0).length,
      最近異動: readRows(SHEETS.操作).slice(-10).length
    });
  } catch (err) {
    logError('取得儀表板', err);
    return fail('儀表板資料讀取失敗。');
  }
}

function 建立預設任務(activity) {
  const existed = readRows(SHEETS.任務).filter(r => String(r.活動ID) === String(activity.活動ID));
  if (existed.length) return 0;
  const tasks = [
    ['活動前','確認講師與場地','確認講師、場地、設備與交通資訊'],
    ['活動前','確認報名與簽到資料','確認入選名單、簽到表、名牌或桌牌'],
    ['活動當日','場地佈置','確認報到處、投影設備、座位、海報布條'],
    ['活動當日','報到作業','確認簽到、資料發放、臨時問題處理'],
    ['活動當日','餐點確認','確認餐點數量、葷素、送達時間與收據'],
    ['活動當日','成果照片拍攝','拍攝講師授課、學員互動、簽到、場地等照片'],
    ['活動後','資料回收','回收簽到表、滿意度、領據、收據'],
    ['活動後','文件歸檔','將活動資料與照片歸檔到Drive']
  ];
  tasks.forEach(t => appendObject(SHEETS.任務, {
    任務ID: generateId('任務'), 活動ID: activity.活動ID, 時段: t[0], 工作任務: t[1], 動作說明: t[2],
    負責人: activity.聯絡人 || '', 備註道具: '', 任務狀態: '待執行', 完成時間: '', 建立時間: now(), 更新時間: now()
  }));
  return tasks.length;
}

function 建立預設物品(activity) {
  const existed = readRows(SHEETS.物品).filter(r => String(r.活動ID) === String(activity.活動ID));
  if (existed.length) return 0;
  const items = ['簽到表','講義','文具箱','布條／海報','講師領據','工作人員領據','滿意度調查表','活動禮品'];
  items.forEach(name => appendObject(SHEETS.物品, {
    物品ID: generateId('物品'), 活動ID: activity.活動ID, 物品類型: '活動物品', 物品名稱: name, 數量: '', 負責人: activity.聯絡人 || '',
    是否已帶出: '否', 是否已取回: '否', 備註: '', 建立時間: now(), 更新時間: now()
  }));
  return items.length;
}

function 建立預設餐點(activity) {
  const existed = readRows(SHEETS.餐點).filter(r => String(r.活動ID) === String(activity.活動ID));
  if (existed.length) return 0;
  appendObject(SHEETS.餐點, { 餐點ID: generateId('餐點'), 活動ID: activity.活動ID, 便當店名稱: '', 便當店電話: '', 單價: '', 葷食數量: '', 素食數量: '', 總數量: '', 預計送達時間: '', 付款方式: '', 收據狀態: '未取得', 建立時間: now(), 更新時間: now() });
  return 1;
}

function 建立預設核銷(activity) {
  const existed = readRows(SHEETS.核銷).filter(r => String(r.活動ID) === String(activity.活動ID));
  if (existed.length) return 0;
  const checks = [['簽到表已回收','活動結束後回收紙本簽到表'],['講師領據已簽回','確認講師簽名與金額'],['工作人員領據已簽回','確認工作人員簽名與金額'],['滿意度調查表已回收','確認回收數量'],['便當收據／發票已取得','確認抬頭、統編與金額'],['成果照片已上傳','確認照片類別完整'],['活動文件已歸檔','確認Drive資料夾與文件連結']];
  checks.forEach(c => appendObject(SHEETS.核銷, { 核銷ID: generateId('核銷'), 活動ID: activity.活動ID, 核銷項目: c[0], 核銷狀態: '未完成', 負責人: activity.聯絡人 || '', 建議處理方式: c[1], 完成時間: '', 建立時間: now(), 更新時間: now() }));
  return checks.length;
}

function markRelatedTasksCancelled(活動ID) {
  readRows(SHEETS.任務).filter(r => String(r.活動ID) === String(活動ID)).forEach(r => updateRow(SHEETS.任務, r._row, { 任務狀態: '已取消', 更新時間: now() }));
}

function rememberCommonOptionsFromActivity(record) {
  [['主辦單位', record.主辦單位], ['協辦單位', record.協辦單位], ['活動地點', record.活動地點], ['聯絡人', record.聯絡人], ['聯絡電話', record.聯絡電話], ['講師', record.講師], ['活動類型', record.活動類型]].forEach(pair => rememberOption(pair[0], pair[1]));
}

function rememberOption(type, name) {
  if (!name) return;
  const rows = readRows(SHEETS.常用選項);
  const existed = rows.find(r => String(r.選項類型) === String(type) && String(r.選項名稱) === String(name));
  if (existed) updateRow(SHEETS.常用選項, existed._row, { 使用次數: Number(existed.使用次數 || 0) + 1, 最後使用時間: now(), 更新時間: now() });
  else appendObject(SHEETS.常用選項, { 選項ID: generateId('選項'), 選項類型: type, 選項名稱: name, 使用次數: 1, 最後使用時間: now(), 是否預設: '否', 狀態: '啟用', 建立時間: now(), 更新時間: now() });
}

function normalizeDate(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
  return String(v).replace(/-/g, '/').trim();
}
