/**
 * GovOps AI OS｜政府專案 AI 營運作業系統
 * 單檔版 Google Apps Script 後端核心
 * 前端對應：govbid-os/app/govops-ai-os.html
 */

const GOVOPS = {
  TZ: 'Asia/Taipei',
  DEFAULT_TENANT: '預設租戶',
  DEFAULT_USER: '系統管理者',
  SHEETS: {
    系統設定: '00_系統設定總表',
    使用者權限: '01_組織與權限主檔',
    專案: '02_專案主檔',
    活動: '03_活動課程主檔',
    關係人: '04_關係人主檔',
    財務: '20_財務收支資料',
    任務: '21_任務管理',
    檢核: '22_檢核清單',
    文件: '23_文件索引與版本',
    報名: '24_報名資料',
    風險: '25_AI風險警示',
    戰情: '26_每日戰情紀錄',
    簽到: '27_簽到退簽資料',
    滿意度: '28_滿意度資料',
    請款: '29_請款撥款資料',
    用餐: '30_用餐統計資料',
    操作: '90_操作紀錄'
  }
};

function doGet(e) {
  return jsonOut({ 成功: true, 訊息: 'GovOps AI OS API 已啟動', 時間: nowText() });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = body.action || body.動作 || '';
    const data = body.data || body.資料 || {};
    const filters = body.filters || body.篩選 || {};
    const ctx = getCtx(body);
    const result = routeAction(action, data, filters, ctx);
    return jsonOut({ 成功: true, action, 結果: result });
  } catch (err) {
    return jsonOut({ 成功: false, 錯誤訊息: err.message, stack: err.stack });
  }
}

function routeAction(action, data, filters, ctx) {
  switch (action) {
    case '健康檢查': return healthCheck();
    case '初始化系統': return 初始化系統();
    case '安裝GovOps系統': return 安裝GovOps系統();
    case '系統自我檢查': return 系統自我檢查();
    case '建立測試專案與活動': return 建立測試專案與活動(ctx);
    case '取得Dashboard': return 取得Dashboard(ctx);
    case '產生今日戰情': return 產生今日戰情(ctx);
    case '每日AI風險檢查': return 每日AI風險檢查(ctx);
    case '新增專案': return 新增專案(data, ctx);
    case '查詢專案': return querySheet(GOVOPS.SHEETS.專案, filters, ctx);
    case '新增活動': return 新增活動(data, ctx);
    case '查詢活動': return querySheet(GOVOPS.SHEETS.活動, filters, ctx);
    case '查詢任務': return querySheet(GOVOPS.SHEETS.任務, filters, ctx);
    case '新增財務': return 新增財務(data, ctx);
    case '查詢財務': return querySheet(GOVOPS.SHEETS.財務, filters, ctx);
    case '新增文件': return 新增文件(data, ctx);
    case '查詢文件': return querySheet(GOVOPS.SHEETS.文件, filters, ctx);
    case '檢查專案核銷缺件': return 檢查專案核銷缺件(data.專案ID, ctx);
    case '判斷專案是否可請款': return 判斷專案是否可請款(data.專案ID, ctx);
    case '匯入Google表單報名資料': return 匯入Google表單報名資料(data, ctx);
    case '匯入Google表單滿意度資料': return 匯入Google表單滿意度資料(data, ctx);
    case '產生簽到表資料': return 產生簽到表資料(data.活動ID, ctx);
    case '建立簽到表Google文件': return 建立簽到表Google文件(data.活動ID, ctx);
    case '產生活動用餐統計': return 產生活動用餐統計(data.活動ID, ctx);
    case '建立結案報告Google文件': return 建立結案報告Google文件(data.專案ID, ctx);
    case '建立專案結案包': return 建立專案結案包(data.專案ID, ctx);
    case '建立活動日曆': return 建立活動日曆(data.活動ID, ctx);
    case 'LINE查詢': return LINE查詢(data.文字 || '', ctx);
    default: throw new Error('尚未支援的 action：' + action);
  }
}

function 初始化系統() {
  const schemas = getSchemas();
  Object.keys(schemas).forEach(name => ensureSheet(name, schemas[name]));
  seedSystemSettings();
  return { 訊息: 'GovOps AI OS 資料庫初始化完成', 建立資料表數: Object.keys(schemas).length };
}

function getSchemas() {
  return {
    [GOVOPS.SHEETS.系統設定]: ['系統ID','系統名稱','LINE存取權杖','LINE頻道ID','LINE頻道密鑰','Google日曆ID','Google雲端硬碟根資料夾ID','建立時間','更新時間','租戶ID','狀態'],
    [GOVOPS.SHEETS.使用者權限]: ['使用者ID','姓名','Email','角色名稱','LINE使用者ID','租戶ID','狀態','建立時間','更新時間'],
    [GOVOPS.SHEETS.專案]: ['專案ID','專案名稱','專案類型','機關名稱','機關窗口ID','契約編號','契約金額','履約起日','履約迄日','請款方式','專案負責人ID','專案狀態','健康分數','風險等級','資料夾連結','建立時間','更新時間','租戶ID','建立人','狀態'],
    [GOVOPS.SHEETS.活動]: ['活動ID','專案ID','活動名稱','活動類型','活動日期','開始時間','結束時間','活動地點','場地ID','講師ID','預計人數','實際人數','是否招生','是否用餐','是否簽到','是否問卷','是否核銷','GoogleCalendar事件ID','活動狀態','活動資料夾連結','建立時間','更新時間','租戶ID','建立人','狀態'],
    [GOVOPS.SHEETS.關係人]: ['關係人ID','姓名或單位','類型','電話','Email','地址','銀行名稱','銀行代號','帳號','身分證字號或統編','租戶ID','狀態','建立時間','更新時間'],
    [GOVOPS.SHEETS.財務]: ['財務ID','專案ID','活動ID','關係人ID','類型','金額','核銷科目ID','會計科目ID','付款狀態','交易日期','說明','文件ID','租戶ID','建立人','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.任務]: ['任務ID','專案ID','活動ID','任務類型','任務階段','任務名稱','任務說明','負責人ID','預計完成日','實際完成日','任務狀態','是否啟用','逾期提醒','租戶ID','建立人','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.檢核]: ['檢核ID','專案ID','活動ID','檢核階段','檢核項目','是否啟用','是否完成','缺件說明','完成日期','備註','租戶ID','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.文件]: ['文件ID','專案ID','活動ID','文件類型','文件名稱','版本','檔案連結','檔案ID','是否最新版','文件狀態','租戶ID','建立人','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.報名]: ['報名ID','專案ID','活動ID','學員ID','報名來源','姓名','電話','Email','LINE_ID','身分證後四碼','用餐習慣','特殊需求','報名時間','去重狀態','審核狀態','通知狀態','租戶ID','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.風險]: ['風險ID','專案ID','活動ID','風險類型','風險等級','風險標題','風險說明','影響範圍','建議處理方式','處理狀態','租戶ID','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.戰情]: ['戰情ID','日期','今日最重要5件事','今日活動','今日逾期','今日缺件','今日請款','今日核銷','今日AI建議','LINE文字','租戶ID','建立時間'],
    [GOVOPS.SHEETS.簽到]: ['簽到ID','專案ID','活動ID','報名ID','學員ID','姓名','電話後三碼','用餐習慣','簽到狀態','退簽狀態','備註','租戶ID','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.滿意度]: ['問卷ID','專案ID','活動ID','學員ID','課程內容滿意度','講師滿意度','行政服務滿意度','場地設備滿意度','整體滿意度','是否推薦','開放意見','填寫時間','去重狀態','租戶ID','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.請款]: ['請款ID','專案ID','請款階段','請款比例','請款金額','請款條件','請款日期','請款狀態','撥款日期','對帳狀態','租戶ID','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.用餐]: ['用餐ID','專案ID','活動ID','錄取人數','葷食人數','素食人數','奶蛋素人數','全素人數','不用餐人數','講師餐數','工作人員餐數','備用餐數','總訂餐數','租戶ID','建立時間','更新時間','狀態'],
    [GOVOPS.SHEETS.操作]: ['紀錄ID','動作','資料表','資料ID','操作人','租戶ID','操作時間','內容']
  };
}

function ensureSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const current = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn() || 1)).getValues()[0].filter(String);
  if (current.length === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  else {
    const missing = headers.filter(h => current.indexOf(h) < 0);
    if (missing.length) sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function seedSystemSettings() {
  const rows = getRows(GOVOPS.SHEETS.系統設定, {}, { tenantId: GOVOPS.DEFAULT_TENANT });
  if (rows.length) return;
  appendRow(GOVOPS.SHEETS.系統設定, { 系統ID: 'SYS001', 系統名稱: 'GovOps AI OS', 租戶ID: GOVOPS.DEFAULT_TENANT, 狀態: '啟用' }, { tenantId: GOVOPS.DEFAULT_TENANT, userId: GOVOPS.DEFAULT_USER });
}

function 新增專案(data, ctx) {
  const id = makeId('PRJ');
  const row = Object.assign({}, data, { 專案ID: id, 健康分數: 100, 風險等級: '正常', 專案狀態: data.專案狀態 || '履約準備中' });
  appendRow(GOVOPS.SHEETS.專案, row, ctx);
  createProjectTasks(id, ctx);
  return { 訊息: '專案已新增，並已自動展開專案任務', 專案ID: id };
}

function 新增活動(data, ctx) {
  if (!data.專案ID) throw new Error('新增活動必須選擇專案ID');
  const id = makeId('ACT');
  const row = Object.assign({}, data, { 活動ID: id, 活動狀態: data.活動狀態 || '籌備中' });
  appendRow(GOVOPS.SHEETS.活動, row, ctx);
  createActivityTasks(data.專案ID, id, ctx);
  createActivityChecks(data.專案ID, id, ctx);
  return { 訊息: '活動已新增，並已自動展開任務與檢核', 活動ID: id };
}

function 新增財務(data, ctx) { const id = makeId('FIN'); appendRow(GOVOPS.SHEETS.財務, Object.assign({}, data, { 財務ID: id }), ctx); return { 訊息: '財務資料已新增', 財務ID: id }; }
function 新增文件(data, ctx) { const id = makeId('DOC'); appendRow(GOVOPS.SHEETS.文件, Object.assign({}, data, { 文件ID: id }), ctx); return { 訊息: '文件索引已新增', 文件ID: id }; }

function createProjectTasks(projectId, ctx) {
  ['契約資料建檔','履約規格確認','請款規則確認','結案資料清單確認'].forEach((name, i) => appendRow(GOVOPS.SHEETS.任務, { 任務ID: makeId('TSK'), 專案ID: projectId, 任務類型: '專案任務', 任務階段: '履約準備', 任務名稱: name, 預計完成日: addDays(today(), i + 3), 任務狀態: '未開始', 是否啟用: true, 逾期提醒: true }, ctx));
}
function createActivityTasks(projectId, activityId, ctx) {
  ['確認場地與時間','確認講師與工作人員','建立報名與通知','準備簽到表','確認餐點與物資','活動後上傳成果照片','整理核銷資料'].forEach((name, i) => appendRow(GOVOPS.SHEETS.任務, { 任務ID: makeId('TSK'), 專案ID: projectId, 活動ID: activityId, 任務類型: '活動任務', 任務階段: i < 5 ? '活動前' : '活動後', 任務名稱: name, 預計完成日: addDays(today(), i + 1), 任務狀態: '未開始', 是否啟用: true, 逾期提醒: true }, ctx));
}
function createActivityChecks(projectId, activityId, ctx) {
  ['簽到表','滿意度問卷','成果照片','講師領據','餐費發票','活動成果摘要'].forEach(name => appendRow(GOVOPS.SHEETS.檢核, { 檢核ID: makeId('CHK'), 專案ID: projectId, 活動ID: activityId, 檢核階段: '核銷結案', 檢核項目: name, 是否啟用: true, 是否完成: false, 狀態: '啟用' }, ctx));
}

function 取得Dashboard(ctx) {
  const projects = getRows(GOVOPS.SHEETS.專案, {}, ctx);
  const activities = getRows(GOVOPS.SHEETS.活動, {}, ctx);
  const tasks = getRows(GOVOPS.SHEETS.任務, {}, ctx);
  const risks = getRows(GOVOPS.SHEETS.風險, {}, ctx);
  const finances = getRows(GOVOPS.SHEETS.財務, {}, ctx);
  const docs = getRows(GOVOPS.SHEETS.文件, {}, ctx);
  const t = today();
  const overdue = tasks.filter(x => x.預計完成日 && String(x.預計完成日) < t && x.任務狀態 !== '已完成');
  const todayActs = activities.filter(x => String(x.活動日期) === t);
  const highRisk = risks.filter(x => ['高風險','即將失控'].indexOf(x.風險等級) >= 0 && x.處理狀態 !== '已處理');
  const unpay = finances.filter(x => ['未請款','未撥款','應收款'].indexOf(x.類型) >= 0 || ['未撥款','待請款'].indexOf(x.付款狀態) >= 0);
  const tips = [];
  if (overdue.length) tips.push('目前有 ' + overdue.length + ' 件逾期任務，請優先處理。');
  if (highRisk.length) tips.push('目前有 ' + highRisk.length + ' 件高風險警示，請進入風險清單確認。');
  if (unpay.length) tips.push('目前有 ' + unpay.length + ' 筆請款／撥款相關資料待追蹤。');
  if (!tips.length) tips.push('目前狀態穩定，建議持續維護文件索引與核銷附件。');
  return { 摘要: { 專案數: projects.length, 活動數: activities.length, 今日活動數: todayActs.length, 逾期任務數: overdue.length, 高風險案件數: highRisk.length, 核銷缺件數: getRows(GOVOPS.SHEETS.檢核, {}, ctx).filter(x => String(x.是否完成) !== 'true' && String(x.是否完成) !== 'TRUE').length, 未完成請款數: unpay.length, 風險警示數: risks.length, 文件數: docs.length }, AI建議: tips, 今日活動: todayActs, 逾期任務: overdue, 高風險案件: highRisk };
}

function 每日AI風險檢查(ctx) {
  const t = today(); let count = 0;
  getRows(GOVOPS.SHEETS.任務, {}, ctx).forEach(task => { if (task.預計完成日 && String(task.預計完成日) < t && task.任務狀態 !== '已完成') { appendRow(GOVOPS.SHEETS.風險, { 風險ID: makeId('RSK'), 專案ID: task.專案ID, 活動ID: task.活動ID, 風險類型: '任務逾期', 風險等級: '高風險', 風險標題: '任務已逾期：' + task.任務名稱, 風險說明: '任務期限 ' + task.預計完成日 + '，目前未完成。', 影響範圍: '履約、核銷、結案', 建議處理方式: '立即確認負責人並補齊資料。', 處理狀態: '待處理' }, ctx); count++; } });
  return { 訊息: 'AI 風險檢查完成', 新增風險數: count };
}

function 產生今日戰情(ctx) {
  const d = 取得Dashboard(ctx);
  const lines = ['【今日 GovOps 戰情】', '今日活動：' + d.摘要.今日活動數, '逾期任務：' + d.摘要.逾期任務數, '高風險案件：' + d.摘要.高風險案件數, '核銷缺件：' + d.摘要.核銷缺件數, '', 'AI建議：'].concat(d.AI建議.map((x,i)=>(i+1)+'. '+x));
  const text = lines.join('\n');
  appendRow(GOVOPS.SHEETS.戰情, { 戰情ID: makeId('DAY'), 日期: today(), 今日最重要5件事: d.AI建議.join('\n'), 今日活動: d.摘要.今日活動數, 今日逾期: d.摘要.逾期任務數, 今日缺件: d.摘要.核銷缺件數, 今日請款: d.摘要.未完成請款數, 今日AI建議: d.AI建議.join('\n'), LINE文字: text }, ctx);
  return { LINE文字: text, Dashboard: d };
}

function 檢查專案核銷缺件(projectId, ctx) {
  if (!projectId) throw new Error('請選擇專案ID');
  const checks = getRows(GOVOPS.SHEETS.檢核, { 專案ID: projectId }, ctx);
  const missing = checks.filter(x => String(x.是否完成) !== 'true' && String(x.是否完成) !== 'TRUE' && String(x.是否完成) !== '已完成').map(x => x.檢核項目);
  return { 專案ID: projectId, 缺件數: missing.length, 缺件: missing, 是否完整: missing.length === 0 };
}
function 判斷專案是否可請款(projectId, ctx) { const m = 檢查專案核銷缺件(projectId, ctx); return { 專案ID: projectId, 可請款: m.缺件數 === 0, 判斷: m.缺件數 === 0 ? '可請款' : '不可請款，仍有缺件', 缺件: m.缺件 }; }

function 匯入Google表單報名資料(data, ctx) {
  const ss = SpreadsheetApp.openById(data.來源試算表ID); const sh = data.來源工作表名稱 ? ss.getSheetByName(data.來源工作表名稱) : ss.getSheets()[0];
  const values = sh.getDataRange().getValues(); if (values.length < 2) return { 訊息: '沒有可匯入資料', 匯入筆數: 0 };
  const headers = values[0].map(String); let n = 0;
  values.slice(1).forEach(r => { const obj = {}; headers.forEach((h,i)=>obj[h]=r[i]); appendRow(GOVOPS.SHEETS.報名, { 報名ID: makeId('REG'), 專案ID: data.專案ID, 活動ID: data.活動ID, 報名來源: 'Google表單', 姓名: pick(obj,['姓名','名字','學員姓名']), 電話: pick(obj,['電話','手機','聯絡電話']), Email: pick(obj,['Email','電子郵件','信箱']), 用餐習慣: pick(obj,['用餐','用餐習慣','餐食']), 報名時間: pick(obj,['時間戳記','Timestamp']) || nowText(), 去重狀態: '正常', 審核狀態: '待審核', 通知狀態: '待通知' }, ctx); n++; });
  return { 訊息: '報名資料匯入完成', 匯入筆數: n };
}
function 匯入Google表單滿意度資料(data, ctx) { return { 訊息: '滿意度匯入入口已建立；請依問卷欄位匯入', 匯入筆數: 0, 提醒: '後續可依實際問卷欄位擴充。' }; }
function 產生簽到表資料(activityId, ctx) { const regs = getRows(GOVOPS.SHEETS.報名, { 活動ID: activityId }, ctx).filter(x => ['錄取','待審核'].indexOf(x.審核狀態) >= 0); regs.forEach(r => appendRow(GOVOPS.SHEETS.簽到, { 簽到ID: makeId('SIN'), 專案ID: r.專案ID, 活動ID: r.活動ID, 報名ID: r.報名ID, 學員ID: r.學員ID, 姓名: r.姓名, 電話後三碼: String(r.電話 || '').slice(-3), 用餐習慣: r.用餐習慣, 簽到狀態: '待簽到', 退簽狀態: '待退簽' }, ctx)); return { 訊息: '簽到表資料已產生', 筆數: regs.length }; }
function 建立簽到表Google文件(activityId, ctx) { const a = one(GOVOPS.SHEETS.活動, '活動ID', activityId, ctx); const rows = getRows(GOVOPS.SHEETS.簽到, { 活動ID: activityId }, ctx); const doc = DocumentApp.create('簽到表_' + (a.活動名稱 || activityId)); const body = doc.getBody(); body.appendParagraph('活動簽到表').setHeading(DocumentApp.ParagraphHeading.HEADING1); body.appendParagraph('活動名稱：' + (a.活動名稱 || '')); body.appendParagraph('日期：' + (a.活動日期 || '')); body.appendTable([['序號','姓名','電話後三碼','用餐','簽到','退簽','備註']].concat(rows.map((r,i)=>[String(i+1),r.姓名||'',r.電話後三碼||'',r.用餐習慣||'','','','']))); doc.saveAndClose(); appendRow(GOVOPS.SHEETS.文件, { 文件ID: makeId('DOC'), 專案ID: a.專案ID, 活動ID: activityId, 文件類型: '簽到表', 文件名稱: '簽到表_' + a.活動名稱, 版本: 'v1', 檔案連結: doc.getUrl(), 檔案ID: doc.getId(), 是否最新版: true, 文件狀態: '最新版' }, ctx); return { 訊息: '簽到表文件已建立', 文件連結: doc.getUrl() }; }
function 產生活動用餐統計(activityId, ctx) { const rows = getRows(GOVOPS.SHEETS.簽到, { 活動ID: activityId }, ctx); const meat = rows.filter(x => !x.用餐習慣 || String(x.用餐習慣).indexOf('葷') >= 0).length; const veg = rows.filter(x => String(x.用餐習慣).indexOf('素') >= 0).length; const total = rows.length + 2; appendRow(GOVOPS.SHEETS.用餐, { 用餐ID: makeId('MEAL'), 活動ID: activityId, 錄取人數: rows.length, 葷食人數: meat, 素食人數: veg, 講師餐數: 1, 工作人員餐數: 1, 備用餐數: 0, 總訂餐數: total }, ctx); return { 訊息: '用餐統計已產生', 錄取人數: rows.length, 總訂餐數: total }; }
function 建立結案報告Google文件(projectId, ctx) { const p = one(GOVOPS.SHEETS.專案, '專案ID', projectId, ctx); const doc = DocumentApp.create('結案報告_' + (p.專案名稱 || projectId)); const body = doc.getBody(); ['前言','計畫摘要','實施內容','活動流程','參加名冊','滿意度分析','成果照片','執行成果','實施效益與分析','檢討與建議'].forEach(h => { body.appendParagraph(h).setHeading(DocumentApp.ParagraphHeading.HEADING1); body.appendParagraph('【待補】'); }); doc.saveAndClose(); appendRow(GOVOPS.SHEETS.文件, { 文件ID: makeId('DOC'), 專案ID: projectId, 文件類型: '結案報告', 文件名稱: '結案報告_' + p.專案名稱, 版本: 'v1', 檔案連結: doc.getUrl(), 檔案ID: doc.getId(), 是否最新版: true, 文件狀態: '草稿版' }, ctx); return { 訊息: '結案報告 Google 文件已建立', 文件連結: doc.getUrl() }; }
function 建立專案結案包(projectId, ctx) { const p = one(GOVOPS.SHEETS.專案, '專案ID', projectId, ctx); const folder = DriveApp.createFolder('結案包_' + (p.專案名稱 || projectId) + '_' + today()); appendRow(GOVOPS.SHEETS.文件, { 文件ID: makeId('DOC'), 專案ID: projectId, 文件類型: '結案包', 文件名稱: folder.getName(), 版本: 'v1', 檔案連結: folder.getUrl(), 檔案ID: folder.getId(), 是否最新版: true, 文件狀態: '最新版' }, ctx); return { 訊息: '結案包資料夾已建立', 結案包連結: folder.getUrl() }; }
function 建立活動日曆(activityId, ctx) { const a = one(GOVOPS.SHEETS.活動, '活動ID', activityId, ctx); const cal = CalendarApp.getDefaultCalendar(); const start = new Date(a.活動日期 + 'T' + (a.開始時間 || '09:00') + ':00'); const end = new Date(a.活動日期 + 'T' + (a.結束時間 || '12:00') + ':00'); const ev = cal.createEvent('【GovOps】' + a.活動名稱, start, end, { location: a.活動地點 || '', description: '專案ID：' + a.專案ID + '\n活動ID：' + activityId }); return { 訊息: 'Google Calendar 活動已建立', 事件ID: ev.getId() }; }
function LINE查詢(text, ctx) { if (String(text).indexOf('今日') >= 0 || String(text).indexOf('戰情') >= 0) return 產生今日戰情(ctx).LINE文字; if (String(text).indexOf('未請款') >= 0) return '未請款資料：' + 取得Dashboard(ctx).摘要.未完成請款數 + ' 筆'; if (String(text).indexOf('核銷') >= 0) return '核銷缺件：' + 取得Dashboard(ctx).摘要.核銷缺件數 + ' 項'; return '可查詢：今日戰情、今日待辦、本週活動、高風險、未請款、核銷缺件、結案倒數'; }

function 安裝GovOps系統() { 初始化系統(); return { 訊息: '系統安裝完成。提醒：正式 LINE 推播觸發器可在 Apps Script 依需求手動啟用。' }; }
function 系統自我檢查() { const schemas = getSchemas(); const missing = []; Object.keys(schemas).forEach(n => { if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n)) missing.push(n); }); return { 系統狀態: missing.length ? '需要修正' : '正常', 缺少資料表: missing }; }
function 建立測試專案與活動(ctx) { const p = 新增專案({ 專案名稱: '測試專案｜GovOps AI OS', 專案類型: '政府勞務採購', 機關名稱: '測試機關', 契約金額: 100000, 履約起日: today(), 履約迄日: addDays(today(), 60), 請款方式: '一次結案付款', 專案狀態: '執行中' }, ctx); const a = 新增活動({ 專案ID: p.專案ID, 活動名稱: '測試活動第一場', 活動類型: '課程', 活動日期: today(), 開始時間: '09:00', 結束時間: '12:00', 活動地點: '測試場地', 預計人數: 30, 活動狀態: '籌備中' }, ctx); return { 訊息: '測試專案與活動已建立', 專案: p, 活動: a }; }

function appendRow(sheetName, data, ctx) { const sh = ensureSheet(sheetName, getSchemas()[sheetName]); const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; const row = headers.map(h => data[h] !== undefined ? data[h] : defaultValue(h, ctx)); sh.appendRow(row); return data; }
function querySheet(sheetName, filters, ctx) { return { 資料: getRows(sheetName, filters || {}, ctx) }; }
function getRows(sheetName, filters, ctx) { const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName); if (!sh || sh.getLastRow() < 2) return []; const values = sh.getDataRange().getValues(); const headers = values.shift(); return values.map(r => { const o={}; headers.forEach((h,i)=>o[h]=r[i]); return o; }).filter(o => !o.租戶ID || o.租戶ID === ctx.tenantId).filter(o => Object.keys(filters||{}).every(k => !filters[k] || String(o[k]) === String(filters[k]))); }
function one(sheet, key, value, ctx) { const r = getRows(sheet, { [key]: value }, ctx)[0]; if (!r) throw new Error('找不到資料：' + key + '=' + value); return r; }
function getCtx(body) { return { tenantId: body.tenantId || body.租戶ID || GOVOPS.DEFAULT_TENANT, userId: body.userId || body.使用者ID || GOVOPS.DEFAULT_USER }; }
function defaultValue(h, ctx) { if (h === '租戶ID') return ctx.tenantId; if (h === '建立人' || h === '操作人') return ctx.userId; if (h === '建立時間' || h === '更新時間' || h === '操作時間') return nowText(); if (h === '狀態') return '啟用'; return ''; }
function makeId(prefix) { return prefix + Utilities.formatDate(new Date(), GOVOPS.TZ, 'yyyyMMddHHmmss') + Math.floor(Math.random()*900+100); }
function today() { return Utilities.formatDate(new Date(), GOVOPS.TZ, 'yyyy-MM-dd'); }
function nowText() { return Utilities.formatDate(new Date(), GOVOPS.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function addDays(dateText, days) { const d = new Date(dateText); d.setDate(d.getDate()+days); return Utilities.formatDate(d, GOVOPS.TZ, 'yyyy-MM-dd'); }
function jsonOut(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function healthCheck() { return { 訊息: 'GovOps AI OS API 正常', 時間: nowText() }; }
function pick(obj, keys) { for (let i=0;i<keys.length;i++) if (obj[keys[i]]) return obj[keys[i]]; return ''; }
