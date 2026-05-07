/* GovOps OS｜第19A檔：SaaS資料表初始化
請在 Apps Script 新增檔案：19A_SaaS資料表初始化
用途：建立 SaaS 必備資料表，讓組織、使用者、常用選項、訂閱方案有正式資料庫。
*/

function 初始化SaaS資料表() {
  const required = {};

  required['組織帳號管理'] = [
    '組織ID','組織名稱','組織類型','統一編號','聯絡人','聯絡電話','Email',
    '預設主辦單位','預設協辦單位','狀態','建立時間','更新時間'
  ];

  required['使用者帳號管理'] = [
    '使用者ID','組織ID','姓名','Email','LINE UID','角色','帳號狀態',
    '最近登入時間','建立時間','更新時間'
  ];

  required['使用者常用選項'] = [
    '選項ID','組織ID','使用者ID','選項類型','選項名稱','使用次數',
    '最後使用時間','是否預設','狀態','建立時間','更新時間'
  ];

  required['訂閱方案管理'] = [
    '方案ID','組織ID','方案名稱','方案等級','每月費用','活動數上限','使用者數上限',
    '儲存空間上限','啟用功能','狀態','開始日期','到期日期','建立時間','更新時間'
  ];

  const ss = 取得試算表();

  Object.keys(required).forEach(function(sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);

    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      sheet.appendRow(required[sheetName]);
      return;
    }

    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const missing = required[sheetName].filter(function(header) {
      return current.indexOf(header) < 0;
    });

    if (missing.length > 0) {
      sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
    }
  });

  寫操作('初始化SaaS資料表', 'SaaS系統', '', '', '完成');

  return 回應(true, 'SaaS資料表初始化完成', {
    分頁數: Object.keys(required).length
  });
}
