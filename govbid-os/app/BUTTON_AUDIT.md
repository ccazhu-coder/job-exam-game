# GovOps AI OS 按鈕對應表

本盤點聚焦目前 `govops-ai-os.html` 與 `runtime/*.js` 的實際事件接線狀態。完整原始掃描條件包含 `button`、`onclick`、`addEventListener`、`data-action`、`data-module`、`data-page`、`data-api-action`。

| 頁面 | 按鈕名稱 | 前端事件 | API action | 後端是否存在 | Sheet | 狀態 |
|---|---|---|---|---|---|---|
| 基本資料中心 / 講師資料 | 講師資料 Tab | `data-action=switchMasterTab data-module=teachers` | 無，前端狀態切換 | 不需後端 | 講師資料 | 已接上 |
| 基本資料中心 / 講師資料 | 重新整理 | `AppRuntime.handleAction('refresh')` | `listTeachers` | 已建立 | 講師資料 | 已接上 |
| 基本資料中心 / 講師資料 | ＋ 新增講師 | `AppRuntime.handleAction('create')` | `createTeacher` | 已建立 | 講師資料 | 已接上 |
| 基本資料中心 / 講師資料 | 儲存新增 | `RuntimeUI.openModal().onSave` | `createTeacher` | 已建立 | 講師資料 | 已接上 |
| 基本資料中心 / 講師資料 | 查看 | `AppRuntime.handleAction('view')` | 本機狀態讀取 | 不需後端 | 講師資料 | 已接上 |
| 基本資料中心 / 講師資料 | 修改 | `AppRuntime.handleAction('edit')` | `updateTeacher` | 已建立 | 講師資料 | 已接上 |
| 基本資料中心 / 講師資料 | 停用 | `AppRuntime.handleAction('disable')` | `disableTeacher` | 已建立 | 講師資料 | 已接上 |
| 基本資料中心 / 講師資料 | 啟用 | `AppRuntime.handleAction('enable')` | `enableTeacher` | 已建立 | 講師資料 | 已接上 |
| 基本資料中心 / 講師資料 | 封存 | `AppRuntime.handleAction('archive')` | `archiveTeacher` | 已建立 | 講師資料 | 已接上 |
| 基本資料中心 / 廠商 | 新增 / 修改 / 停用 / 封存 | `AppRuntime.handleAction(...)` | `createVendor/updateVendor/disableVendor/archiveVendor` | 已建立 | 廠商資料 | 已接上 |
| 基本資料中心 / 場地 | 新增 / 修改 / 停用 / 封存 | `AppRuntime.handleAction(...)` | `createVenue/updateVenue/disableVenue/archiveVenue` | 已建立 | 場地資料 | 已接上 |
| 基本資料中心 / 工作人員 | 新增 / 修改 / 停用 / 封存 | `AppRuntime.handleAction(...)` | `createStaff/updateStaff/disableStaff/archiveStaff` | 已建立 | 工作人員資料 | 已接上 |
| 基本資料中心 / 機關窗口 | 新增 / 修改 / 停用 / 封存 | `AppRuntime.handleAction(...)` | `createAgency/updateAgency/disableAgency/archiveAgency` | 已建立 | 機關窗口 | 已接上 |
| 基本資料中心 / 學員 | 新增 / 修改 / 停用 / 封存 | `AppRuntime.handleAction(...)` | `createStudent/updateStudent/disableStudent/archiveStudent` | 已建立 | 學員資料 | 已接上 |
| 基本資料中心 / 物資設備 | 新增 / 修改 / 停用 / 封存 | `AppRuntime.handleAction(...)` | `createEquipment/updateEquipment/disableEquipment/archiveEquipment` | 已建立 | 物資設備 | 已接上 |
| 基本資料中心 / 財務科目 | 新增 / 修改 / 停用 / 封存 | `AppRuntime.handleAction(...)` | `createFinanceItem/updateFinanceItem/disableFinanceItem/archiveFinanceItem` | 已建立 | 財務科目 | 已接上 |
| 基本資料中心 / 文件模板 | 新增 / 修改 / 停用 / 封存 | `AppRuntime.handleAction(...)` | `createTemplate/updateTemplate/disableTemplate/archiveTemplate` | 已建立 | 文件模板 | 已接上 |
| 左側選單 | 各頁切換 | Legacy `onclick=UI.page(...)` + Router patch | 無 | 不需後端 | 無 | 已接上 |
| 手機底部選單 | 指揮中心 / 戰情 / 專案 / 活動 / 風險 | Legacy `onclick=UI.page(...)` + Router patch | 無 | 不需後端 | 無 | 已接上 |
| AI 指揮中心 | 更新 / 風險掃描 / 戰情等 | Legacy `Action.run(...)` | `runAIOSRiskScan/generateWarRoomMode/...` | 已有 runtime skeleton | 多表 | 已接上 |
| 專案中心 | 新增 / 查看 / 修改 / 封存 | Legacy Drawer + `GovOpsAPI` | `createRecord/updateRecord/archiveRecord/queryRecords` | 已建立 generic | 專案主檔 | 已接上 |
| 活動履約 | 新增 / Calendar / SLA | Legacy Drawer + `Action.run(...)` | `createRecord/syncGoogleCalendar/runSLAControlScan` | 已有 runtime skeleton | 活動課程主檔 | 已接上 |
| 文件中心 | 新增文件 / 缺件 / 版本掃描 | Legacy Drawer + `Action.run(...)` | `createRecord/checkProjectMissingDocuments/runDocumentVersionRiskScan` | 已有 runtime skeleton | 文件索引與版本 | 已接上 |
| 財務核銷 | 新增收入 / 支出 / 風險掃描 | Legacy Drawer + `Action.run(...)` | `createRecord/getClaimDashboardStatus/runFinanceRiskScan` | 已有 runtime skeleton | 財務交易資料 | 已接上 |
| 系統設定 | 測試 API | `App.testConnection()` | `health` | 已建立 | 無 | 已接上 |
| 全系統 | 尚未轉成 `data-action` 的 legacy inline 按鈕 | `onclick` | 視按鈕而定 | 多數有 skeleton | 多表 | 需逐步統一 |

## 本次已修正的接線原則

- 新增 `moduleConfig.js`，所有模組集中對應 label、sheet、collection、idField、API actions。
- 新增全域 `document.addEventListener('click', ...)` 事件委派。
- 新增 `AppRuntime.handleAction(action, context)`，集中處理 navigate、refresh、create、edit、view、save、update、disable、enable、archive、export、import、syncCalendar、sendLine、generateDocument、generateReport、openModal、closeModal。
- 新增 `callApi(action, data)`，Runtime API 不再各處直接 `fetch`。
- 新增 Debug Panel，記錄最近 20 筆 click、API request、response、error。
- GAS 已新增基礎資料閉環：講師、廠商、場地、工作人員、機關窗口、學員、物資設備、財務科目、文件模板的 list/get/create/update/disable/enable/archive actions。
