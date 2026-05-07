/*
GovOps OS｜第42檔：財務模組路由補丁
版本：MVP v1.0.0
用途：將第41檔財務、應收、收款、支出、損益功能補進 API 路由。

使用方式：
1. 若 Apps Script 只能有一個 router(action, data)，請把下方 case 內容補進 37_core.gs 的 router。
2. 若不想改原 router，可改用 routerV2(action, data)，並在 handleRequest 內將 router 改成 routerV2。
*/

function routerV2(action, data) {
  switch (action) {
    case '初始化財務資料表': return 初始化財務資料表(), success('財務資料表初始化完成。');
    case '建立應收帳款': return 建立應收帳款(data);
    case '登錄收款': return 登錄收款(data);
    case '登錄支出': return 登錄支出(data);
    case '查詢未收款': return 查詢未收款(data);
    case '查詢專案損益': return 查詢專案損益(data);
    default: return router(action, data);
  }
}

/*
請補進 37_core.gs router 的 case：

case '初始化財務資料表': 初始化財務資料表(); return success('財務資料表初始化完成。');
case '建立應收帳款': return 建立應收帳款(data);
case '登錄收款': return 登錄收款(data);
case '登錄支出': return 登錄支出(data);
case '查詢未收款': return 查詢未收款(data);
case '查詢專案損益': return 查詢專案損益(data);

*/
