/*
GovOps OS｜第41檔：財務、應收、請款、收支正式模組
版本：MVP v1.0.0
依賴：37_core.gs、38_activity_workflow.gs
用途：活動完成後建立應收、收款沖帳、支出登錄、專案損益查詢。
*/

function 初始化財務資料表() {
  ensureSheet('應收帳款', ['應收ID','活動ID','對象名稱','應收項目','應收金額','應收狀態','預計收款日','實際收款日','收款方式','備註','建立時間','更新時間']);
  ensureSheet('收款紀錄', ['收款ID','應收ID','活動ID','收款日期','收款金額','收款方式','付款人','備註','建立時間','更新時間']);
  ensureSheet('支出明細', ['支出ID','活動ID','支出日期','支出類型','支出項目','支出金額','付款方式','收據狀態','備註','建立時間','更新時間']);
  ensureSheet('專案損益', ['損益ID','活動ID','收入合計','支出合計','損益金額','更新時間']);
}

function 建立應收帳款(data) {
  try {
    初始化系統();
    初始化財務資料表();
    const 活動ID = data.活動ID || '';
    if (!活動ID) return fail('請先選擇活動。');
    const activity = getActivityById(活動ID);
    if (!activity) return fail('找不到活動資料，請重新選擇。');

    const existing = readRows('應收帳款').find(r => String(r.活動ID) === String(活動ID) && String(r.應收項目) === String(data.應收項目 || '活動費用'));
    if (existing) return success('此活動已建立過相同應收項目。', { 應收ID: existing.應收ID });

    const 應收ID = generateFinanceId('AR');
    appendObjectByName('應收帳款', {
      應收ID: 應收ID,
      活動ID: 活動ID,
      對象名稱: data.對象名稱 || activity.主辦單位 || '',
      應收項目: data.應收項目 || '活動費用',
      應收金額: Number(data.應收金額 || 0),
      應收狀態: '未收款',
      預計收款日: data.預計收款日 || '',
      實際收款日: '',
      收款方式: '',
      備註: data.備註 || '',
      建立時間: now(),
      更新時間: now()
    });
    writeLog('建立應收帳款', '應收帳款', 應收ID, 活動ID, '完成');
    return success('應收帳款已建立。', { 應收ID: 應收ID });
  } catch (err) {
    logError('建立應收帳款', err);
    return fail('應收帳款建立失敗。');
  }
}

function 登錄收款(data) {
  try {
    初始化系統();
    初始化財務資料表();
    const 應收ID = data.應收ID || '';
    const 活動ID = data.活動ID || '';
    const 金額 = Number(data.收款金額 || data.金額 || 0);
    if (!應收ID && !活動ID) return fail('請提供應收ID或活動ID。');
    if (!金額) return fail('請輸入收款金額。');

    let ar = null;
    const arRows = readRows('應收帳款');
    if (應收ID) ar = arRows.find(r => String(r.應收ID) === String(應收ID));
    if (!ar && 活動ID) ar = arRows.find(r => String(r.活動ID) === String(活動ID) && String(r.應收狀態) !== '已收款');
    if (!ar) return fail('找不到可沖帳的應收帳款。');

    const 收款ID = generateFinanceId('PAY');
    appendObjectByName('收款紀錄', {
      收款ID: 收款ID,
      應收ID: ar.應收ID,
      活動ID: ar.活動ID,
      收款日期: data.收款日期 || today(),
      收款金額: 金額,
      收款方式: data.收款方式 || '',
      付款人: data.付款人 || ar.對象名稱 || '',
      備註: data.備註 || '',
      建立時間: now(),
      更新時間: now()
    });

    const row = readRows('應收帳款').find(r => String(r.應收ID) === String(ar.應收ID));
    updateRow('應收帳款', row._row, { 應收狀態: '已收款', 實際收款日: data.收款日期 || today(), 收款方式: data.收款方式 || '', 更新時間: now() });
    更新專案損益(ar.活動ID);
    return success('收款已登錄，應收帳款已沖帳。', { 收款ID: 收款ID, 應收ID: ar.應收ID });
  } catch (err) {
    logError('登錄收款', err);
    return fail('收款登錄失敗。');
  }
}

function 登錄支出(data) {
  try {
    初始化系統();
    初始化財務資料表();
    const 活動ID = data.活動ID || '';
    const 金額 = Number(data.支出金額 || data.金額 || 0);
    if (!活動ID) return fail('請先選擇活動。');
    if (!金額) return fail('請輸入支出金額。');
    const 支出ID = generateFinanceId('EXP');
    appendObjectByName('支出明細', {
      支出ID: 支出ID,
      活動ID: 活動ID,
      支出日期: data.支出日期 || today(),
      支出類型: data.支出類型 || '',
      支出項目: data.支出項目 || '',
      支出金額: 金額,
      付款方式: data.付款方式 || '',
      收據狀態: data.收據狀態 || '未取得',
      備註: data.備註 || '',
      建立時間: now(),
      更新時間: now()
    });
    更新專案損益(活動ID);
    return success('支出已登錄。', { 支出ID: 支出ID });
  } catch (err) {
    logError('登錄支出', err);
    return fail('支出登錄失敗。');
  }
}

function 查詢未收款(data) {
  try {
    初始化財務資料表();
    let rows = readRows('應收帳款').filter(r => String(r.應收狀態) !== '已收款');
    if (data.keyword) rows = rows.filter(r => JSON.stringify(r).indexOf(String(data.keyword)) >= 0);
    return success('未收款清單已取得。', { 結果: rows, 資料: rows });
  } catch (err) {
    logError('查詢未收款', err);
    return fail('未收款查詢失敗。');
  }
}

function 更新專案損益(活動ID) {
  const income = readRows('收款紀錄').filter(r => String(r.活動ID) === String(活動ID)).reduce((sum, r) => sum + Number(r.收款金額 || 0), 0);
  const expense = readRows('支出明細').filter(r => String(r.活動ID) === String(活動ID)).reduce((sum, r) => sum + Number(r.支出金額 || 0), 0);
  const rows = readRows('專案損益');
  const existing = rows.find(r => String(r.活動ID) === String(活動ID));
  if (existing) updateRow('專案損益', existing._row, { 收入合計: income, 支出合計: expense, 損益金額: income - expense, 更新時間: now() });
  else appendObjectByName('專案損益', { 損益ID: generateFinanceId('PL'), 活動ID: 活動ID, 收入合計: income, 支出合計: expense, 損益金額: income - expense, 更新時間: now() });
}

function 查詢專案損益(data) {
  try {
    初始化財務資料表();
    let rows = readRows('專案損益');
    if (data.活動ID) rows = rows.filter(r => String(r.活動ID) === String(data.活動ID));
    return success('專案損益已取得。', { 結果: rows, 資料: rows });
  } catch (err) {
    logError('查詢專案損益', err);
    return fail('專案損益查詢失敗。');
  }
}

function appendObjectByName(sheetName, obj) {
  const headers = headersOf(sheetName);
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  getSheet(sheetName).appendRow(row);
  return obj;
}

function generateFinanceId(prefix) {
  const y = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy');
  const roc = String(Number(y) - 1911);
  const key = prefix + '-' + roc + '-';
  let max = 0;
  ['應收帳款','收款紀錄','支出明細','專案損益'].forEach(name => {
    readRows(name).forEach(row => Object.keys(row).forEach(k => {
      const v = String(row[k] || '');
      if (v.indexOf(key) === 0) {
        const n = Number(v.replace(key, ''));
        if (!isNaN(n) && n > max) max = n;
      }
    }));
  });
  return key + String(max + 1).padStart(4, '0');
}
