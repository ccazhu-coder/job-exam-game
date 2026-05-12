# GovOps OS｜正式產品工程狀態

本文件用來固定目前正式產品工程主線，避免後續 GPT 重工、漏接或覆蓋既有功能。

## 既有正式入口

- `govbid-os/app/login.html`
- `govbid-os/app/index.html`
- `govbid-os/dashboard-v2/index.html`
- `govbid-os/app/frontend-qa.html`
- `govbid-os/app/runtime-health.html`
- `govbid-os/app/admin-console.html`
- `govbid-os/app/finance-secretary.html`

## 前端整合狀態

### 已整合

- `govbid-os/app/govops-api-client.js`
  - 統一 API client
  - tenant/session 自動注入
  - ProductCore helper
  - POST 支援
  - timeout 與錯誤中文化

- `govbid-os/app/frontend-qa.html`
  - Product Core 驗收
  - Schema Health
  - Tender QA
  - Runtime QA

- `govbid-os/dashboard-v2/index.html`
  - 已接 `../app/config.js`
  - 已接 `../app/saas-runtime.js`
  - 已接 `../app/govops-api-client.js`
  - 保留原有 dashboard-v2 操作介面
  - 新增 runtime info
  - Calendar 改接 `calendar.createEvent`
  - 新增 `admin.runtime.health`
  - 新增 `admin.runtime.overview`
  - 新增 `trigger.health`

### 已存在，避免重做

- `govbid-os/app/login.html`
- `govbid-os/app/login-auth-adapter.js`
- `govbid-os/app/index.html`
- `govbid-os/app/saas-runtime.js`
- `govbid-os/app/session-guard.js`

## Apps Script 新增模組

以下模組採外掛式接入，不重寫主 router。

| 檔案 | 功能 |
|---|---|
| `47_GovOps_ProductCoreIntegration.gs` | Product Core、Schema、Date、State、Form Sync FastPatch、Tender Pool |
| `48_GovOps_LineWebhookIntegration.gs` | LINE Webhook、Reply、Command Router |
| `49_GovOps_CalendarCore.gs` | Calendar Core |
| `50_GovOps_CalendarRouterPatch.gs` | Calendar Action Patch |
| `51_GovOps_TriggerCenter.gs` | Trigger Center、自動排程 |
| `52_GovOps_AuthSessionCore.gs` | Auth / Session Core |
| `53_GovOps_TenantFeatureGate.gs` | Tenant / Feature Gate |
| `54_GovOps_BillingCore.gs` | SaaS Billing Core |
| `55_GovOps_AdminRuntimeBridge.gs` | Admin Runtime Overview / Health |
| `56_GovOps_LoginActionAlias.gs` | login.html 舊 action 相容橋接 |

## Apps Script 部署注意

請將上述新模組加入目前 Apps Script 專案後重新部署 Web App。

目前策略：

1. 不刪舊檔
2. 不動主 router
3. 新功能透過 `handleAPIGatewayAction` 外掛鏈接入
4. 舊 action 透過 alias bridge 相容
5. 前端先保留原流程，再逐步接 Product Core

## 目前正式資料庫

正式核心資料庫：

`GovOps OS｜正式核心資料庫 v1`

Spreadsheet ID：

`1ffBZCA0XriHaMzFXTB-4_Rzh5vSq4_NQB9uPrW_eZEQ`

## 已建立正式主表

- `00_README`
- `01_系統設定`
- `02_系統ID中心`
- `03_同步紀錄`
- `04_標案池`
- `05_投標評估`
- `06_招生活動管理`
- `07_報名資料庫`
- `08_學員CRM`
- `09_候補名單`
- `10_當日工作任務表`
- `11_物品清單`
- `12_餐點管理`
- `13_簽到表紀錄`
- `14_核銷檢查中心`
- `15_文件歸檔紀錄`
- `16_應收帳款`
- `17_收款紀錄`
- `18_支出明細`
- `19_專案損益`
- `20_提醒中心`
- `21_秘書摘要`
- `22_狀態規則中心`
- `23_操作紀錄`
- `24_錯誤紀錄`
- `25_組織與使用者`
- `26_Session紀錄`

## 下一步優先順序

### P0

1. 將 `47` 至 `56` 新 Apps Script 模組貼入 Apps Script 專案並重新部署。
2. 用 `frontend-qa.html` 執行：
   - 建立本機測試 Session
   - 驗收 Product Core
   - 一鍵前端驗收
3. 用 `dashboard-v2` 測：
   - 系統健康檢查
   - Product Core 檢查
   - 新增活動
   - 建立 Calendar
   - 管理總覽
   - 排程檢查

### P1

1. `index.html` 逐步改接 `GovOpsAPI.request`。
2. `admin-console.html` 接 `admin.runtime.overview`。
3. `finance-secretary.html` 接 Billing / Feature Gate。

### P2

1. LINE Channel Token / Secret 設定引導。
2. Trigger 安裝 UI。
3. Dashboard-v2 加入 Form Sync Fast 操作區。
4. Dashboard-v2 加入 Tender Pool 操作區。

## 目前禁止事項

- 不再新增重複 Dashboard。
- 不再新增第二套 API Client。
- 不再重寫 login.html。
- 不再重寫 index.html。
- 不再修改正式主表名稱。
- 不再把舊表當主表使用。

## 目前產品主線

GovOps OS 正式定位：

政府專案 Lifecycle ERP SaaS

核心流程：

標案 → 活動 → 報名 → CRM → 任務 → 現場 → 核銷 → 文件 → 財務 → 提醒 → AI 摘要
