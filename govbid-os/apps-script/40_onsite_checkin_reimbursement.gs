/*
GovOps OS｜第40檔：現場任務、簽到、核銷正式模組
版本：MVP v1.0.0
依賴：37_core.gs、38_activity_workflow.gs、39_registration_crm.gs
*/

function 查詢今日任務(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    const 今日 = today();
    let rows = readRows(SHEETS.任務);
    if (活動ID) rows = rows.filter(r => String(r.活動ID) === String(活動ID));
    if (!活動ID) {
      const todayActs = readRows(SHEETS.活動).filter(a => normalizeDate(a.活動日期) === 今日).map(a => String(a.活動ID));
      rows = rows.filter(r => todayActs.indexOf(String(r.活動ID)) >= 0);
    }
    return success('今日任務已取得。', { 任務: rows, 結果: rows });
  } catch (err) {
    logError('查詢今日任務', err);
    return fail('今日任務查詢失敗。');
  }
}

function 更新任務狀態(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    const keyword = data.keyword || data.任務項目 || '';
    const status = data.status || data.任務狀態 || '已完成';
    if (!活動ID) return fail('請先選擇活動。');
    if (!keyword) return fail('請輸入任務項目。');

    const row = readRows(SHEETS.任務).find(r => String(r.活動ID) === String(活動ID) && String(r.工作任務 || '').indexOf(keyword) >= 0);
    if (!row) return fail('找不到任務資料，請確認任務項目。');
    updateRow(SHEETS.任務, row._row, { 任務狀態: status, 完成時間: status === '已完成' ? now() : '', 更新時間: now() });
    writeLog('更新任務狀態', SHEETS.任務, row.任務ID, row.工作任務 + '→' + status, '完成');
    return success('任務狀態已更新。', { 任務ID: row.任務ID, 任務狀態: status });
  } catch (err) {
    logError('更新任務狀態', err);
    return fail('任務狀態更新失敗。');
  }
}

function 查詢物品(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    let rows = readRows(SHEETS.物品);
    if (活動ID) rows = rows.filter(r => String(r.活動ID) === String(活動ID));
    return success('物品清單已取得。', { 資料: rows, 結果: rows });
  } catch (err) {
    logError('查詢物品', err);
    return fail('物品清單查詢失敗。');
  }
}

function 更新物品狀態(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    const keyword = data.keyword || data.物品名稱 || '';
    if (!活動ID) return fail('請先選擇活動。');
    if (!keyword) return fail('請輸入物品名稱。');
    const row = readRows(SHEETS.物品).find(r => String(r.活動ID) === String(活動ID) && String(r.物品名稱 || '').indexOf(keyword) >= 0);
    if (!row) return fail('找不到物品資料，請確認物品名稱。');
    updateRow(SHEETS.物品, row._row, { 是否已帶出: data.是否已帶出 || row.是否已帶出, 是否已取回: data.是否已取回 || row.是否已取回, 更新時間: now() });
    return success('物品狀態已更新。', { 物品ID: row.物品ID });
  } catch (err) {
    logError('更新物品狀態', err);
    return fail('物品狀態更新失敗。');
  }
}

function 更新餐點狀態(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    if (!活動ID) return fail('請先選擇活動。');
    let row = readRows(SHEETS.餐點).find(r => String(r.活動ID) === String(活動ID));
    if (!row) {
      appendObject(SHEETS.餐點, { 餐點ID: generateId('餐點'), 活動ID: 活動ID, 便當店名稱: '', 便當店電話: '', 單價: '', 葷食數量: '', 素食數量: '', 總數量: '', 預計送達時間: '', 付款方式: '', 收據狀態: '未取得', 建立時間: now(), 更新時間: now() });
      row = readRows(SHEETS.餐點).find(r => String(r.活動ID) === String(活動ID));
    }
    const meat = Number(data.葷食數量 || 0);
    const veg = Number(data.素食數量 || 0);
    updateRow(SHEETS.餐點, row._row, { 便當店名稱: data.便當店名稱 || row.便當店名稱, 葷食數量: meat, 素食數量: veg, 總數量: meat + veg, 收據狀態: data.收據狀態 || row.收據狀態, 更新時間: now() });
    return success('餐點狀態已更新。', { 餐點ID: row.餐點ID, 總數量: meat + veg });
  } catch (err) {
    logError('更新餐點狀態', err);
    return fail('餐點狀態更新失敗。');
  }
}

function 生成簽到表(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    if (!活動ID) return fail('請先選擇活動。');
    const existed = readRows(SHEETS.簽到).filter(r => String(r.活動ID) === String(活動ID));
    if (existed.length) return success('簽到表已存在。', { 筆數: existed.length });
    const regs = readRows(SHEETS.報名).filter(r => String(r.活動ID) === String(活動ID) && ['已入選','已確認參加'].indexOf(String(r.報名狀態)) >= 0);
    regs.forEach(r => appendObject(SHEETS.簽到, { 簽到ID: generateId('簽到'), 活動ID: 活動ID, 報名ID: r.報名ID, 學員ID: r.學員ID, 姓名: r.姓名, 電話: r.電話, 簽到狀態: '未簽到', 簽名欄: '', 建立時間: now(), 更新時間: now() }));
    writeLog('生成簽到表', SHEETS.簽到, 活動ID, '產生簽到名單', '完成');
    return success('簽到表已生成。', { 筆數: regs.length });
  } catch (err) {
    logError('生成簽到表', err);
    return fail('簽到表生成失敗。');
  }
}

function 查詢簽到名單(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    let rows = readRows(SHEETS.簽到);
    if (活動ID) rows = rows.filter(r => String(r.活動ID) === String(活動ID));
    return success('簽到名單已取得。', { 資料: rows, 結果: rows });
  } catch (err) {
    logError('查詢簽到名單', err);
    return fail('簽到名單查詢失敗。');
  }
}

function AI缺件檢查(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    let rows = readRows(SHEETS.核銷).filter(r => ['','未完成','缺件'].indexOf(String(r.核銷狀態 || '')) >= 0);
    if (活動ID) rows = rows.filter(r => String(r.活動ID) === String(活動ID));
    return success('缺件清單已取得。', { 缺件: rows, 結果: rows });
  } catch (err) {
    logError('AI缺件檢查', err);
    return fail('缺件清單查詢失敗。');
  }
}

function 更新核銷狀態(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    const keyword = data.keyword || data.核銷項目 || '';
    const status = data.status || data.核銷狀態 || '已完成';
    if (!活動ID) return fail('請先選擇活動。');
    if (!keyword) return fail('請輸入核銷項目。');
    const row = readRows(SHEETS.核銷).find(r => String(r.活動ID) === String(活動ID) && String(r.核銷項目 || '').indexOf(keyword) >= 0);
    if (!row) return fail('找不到核銷項目，請重新確認。');
    updateRow(SHEETS.核銷, row._row, { 核銷狀態: status, 完成時間: status === '已完成' ? now() : '', 更新時間: now() });
    writeLog('更新核銷狀態', SHEETS.核銷, row.核銷ID, row.核銷項目 + '→' + status, '完成');
    return success('核銷狀態已更新。', { 核銷ID: row.核銷ID, 核銷狀態: status });
  } catch (err) {
    logError('更新核銷狀態', err);
    return fail('核銷狀態更新失敗。');
  }
}

function 查詢(data) {
  const q = String(data.query || data.text || '').trim();
  if (q.indexOf('今日任務') >= 0) return 查詢今日任務(data);
  if (q.indexOf('未完成') >= 0) return AI缺件檢查(data);
  if (q.indexOf('缺件') >= 0) return AI缺件檢查(data);
  if (q.indexOf('入選') >= 0) return queryRegistrationsByStatus('已入選', data);
  if (q.indexOf('候補') >= 0) return queryRegistrationsByStatus('候補', data);
  if (q.indexOf('活動') >= 0) return success('活動資料已取得。', { 結果: readRows(SHEETS.活動).slice(-20) });
  return success('查詢完成。', { 結果: [] });
}

function LINE測試(data) {
  const text = data.text || data.query || '';
  if (text.indexOf('完成') >= 0) {
    const keyword = text.replace('完成', '').trim();
    return 更新任務狀態({ 活動ID: data.活動ID || '', keyword: keyword, status: '已完成' });
  }
  return 查詢({ query: text, 活動ID: data.活動ID || '' });
}

function queryRegistrationsByStatus(status, data) {
  let rows = readRows(SHEETS.報名).filter(r => String(r.報名狀態) === String(status));
  if (data.活動ID) rows = rows.filter(r => String(r.活動ID) === String(data.活動ID));
  return success(status + '名單已取得。', { 結果: rows });
}
