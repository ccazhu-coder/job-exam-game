/*
GovOps OS｜第43檔：提醒中心核心模組
版本：MVP v1.0.0
用途：建立提醒資料表、活動提醒、今日提醒、提醒檢查。
*/

function 初始化提醒中心() {
  ensureSheet('提醒中心', ['提醒ID','提醒類型','活動ID','關聯ID','提醒對象','提醒內容','提醒狀態','預計提醒時間','實際提醒時間','建立時間','更新時間']);
  ensureSheet('秘書摘要', ['摘要ID','摘要日期','摘要類型','摘要內容','風險數','未完成任務數','缺件數','未收款數','建立時間']);
}

function 建立活動提醒(data) {
  try {
    初始化系統();
    初始化提醒中心();
    const 活動ID = data.活動ID || '';
    if (!活動ID) return fail('請先選擇活動。');

    const activity = getActivityById(活動ID);
    if (!activity) return fail('找不到活動資料，請重新選擇。');

    const baseDate = parseGovOpsDate(activity.活動日期);
    if (!baseDate) return fail('活動日期格式無法辨識。');

    const rules = [
      ['活動前7天', -7, '請確認講師、場地、報名狀態與簽到資料。'],
      ['活動前1天', -1, '請確認物品、餐點、交通、簽到表與領據。'],
      ['活動當日', 0, '請確認報到、現場任務、拍照與餐點。'],
      ['活動後1天', 1, '請回收簽到表、滿意度、領據與收據。'],
      ['活動後7天', 7, '請完成核銷缺件檢查與文件歸檔。']
    ];

    let count = 0;
    rules.forEach(r => {
      const remindDate = addGovOpsDays(baseDate, r[1]);
      appendObjectByName('提醒中心', {
        提醒ID: generateReminderId('REM'),
        提醒類型: r[0],
        活動ID: 活動ID,
        關聯ID: 活動ID,
        提醒對象: activity.聯絡人 || '',
        提醒內容: activity.活動名稱 + '｜' + r[2],
        提醒狀態: '待提醒',
        預計提醒時間: formatGovOpsDate(remindDate) + ' 09:00:00',
        實際提醒時間: '',
        建立時間: now(),
        更新時間: now()
      });
      count++;
    });

    return success('活動提醒已建立。', { 活動ID: 活動ID, 提醒數: count });
  } catch (err) {
    logError('建立活動提醒', err);
    return fail('活動提醒建立失敗。');
  }
}

function 查詢今日提醒(data) {
  try {
    初始化提醒中心();
    const 今日 = today();
    const rows = readRows('提醒中心').filter(r => String(r.提醒狀態) === '待提醒' && String(r.預計提醒時間 || '').indexOf(今日) === 0);
    return success('今日提醒已取得。', { 結果: rows, 提醒: rows });
  } catch (err) {
    logError('查詢今日提醒', err);
    return fail('今日提醒查詢失敗。');
  }
}

function 執行提醒檢查(data) {
  try {
    初始化提醒中心();
    const nowText = now();
    const rows = readRows('提醒中心').filter(r => String(r.提醒狀態) === '待提醒' && String(r.預計提醒時間 || '') <= nowText);
    rows.forEach(r => updateRow('提醒中心', r._row, { 提醒狀態: '已提醒', 實際提醒時間: now(), 更新時間: now() }));
    return success('提醒檢查已完成。', { 本次提醒數: rows.length, 結果: rows });
  } catch (err) {
    logError('執行提醒檢查', err);
    return fail('提醒檢查失敗。');
  }
}

function generateReminderId(prefix) {
  const y = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy');
  const roc = String(Number(y) - 1911);
  const key = prefix + '-' + roc + '-';
  let max = 0;
  ['提醒中心','秘書摘要'].forEach(name => {
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

function parseGovOpsDate(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  const d = new Date(String(v).replace(/-/g, '/'));
  return isNaN(d.getTime()) ? null : d;
}

function addGovOpsDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function formatGovOpsDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy/MM/dd');
}
