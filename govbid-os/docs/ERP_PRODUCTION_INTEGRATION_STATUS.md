# GovOps OS｜ERP 正式上線整合狀態

## 目前階段

GovOps OS 已進入「ERP 正式上線整合階段」。

本階段目標不是繼續擴充新功能，而是讓既有平台能正式使用：

- 前端頁面可操作
- 後端 Apps Script 可執行
- Google Sheets 欄位對齊
- 每個模組具備新增、修改、查詢
- 主要流程可以驗收

---

## 已確認正式資料來源

正式資料基礎：

- GovBid AI ERP｜政府標案全流程營運系統
- Google Sheets ID：1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY

---

## 已完成前端核心

### 共用前端

- govbid-os/app/erp-ui-core.js
- govbid-os/app/erp-aligned-core.js
- govbid-os/app/erp-page-style.css

### 已完成頁面

- govbid-os/app/dashboard.html
- govbid-os/app/projects.html
- govbid-os/app/activities.html
- govbid-os/app/vendors.html

### 尚需完成頁面

- govbid-os/app/crm.html
- govbid-os/app/archive.html

---

## 每個模組正式上線標準

每個模組必須具備：

1. 新增
2. 修改
3. 查詢
4. 列表
5. 狀態管理
6. 必要時串接流程按鈕

---

## 已完成後端模組

### ERP Core

- govbid-os/backend/erp_commercial_core.gs
- govbid-os/backend/erp_workflow_engine.gs
- govbid-os/backend/erp_drive_document_core.gs
- govbid-os/backend/erp_dashboard_core.gs
- govbid-os/backend/erp_production_router_patch.gs

### 合作廠商正式後端

- govbid-os/backend/GOVOPS_APPS_SCRIPT_VENDOR_UPDATE_FINAL.gs
- govbid-os/backend/23_vendor_master_official.gs
- govbid-os/backend/erp_vendor_schema_patch.gs

---

## 23_合作廠商主檔正式欄位

- 廠商編號
- 名稱
- 類型
- 聯絡人
- 電話
- Email
- 支付方式
- 銀行
- 帳號
- 戶名
- 統編/身分證
- 是否開發票
- 是否扣繳
- 扣繳類型
- 預設單價
- 評價
- 常用
- 備註
- 建立時間
- 更新時間

---

## Apps Script 必貼檔案

正式部署前，Apps Script 至少需貼入：

1. erp_commercial_core.gs
2. erp_workflow_engine.gs
3. erp_drive_document_core.gs
4. erp_dashboard_core.gs
5. erp_production_router_patch.gs
6. GOVOPS_APPS_SCRIPT_VENDOR_UPDATE_FINAL.gs

---

## 主 Router 必接

```javascript
var vendorResult = govopsVendorOfficialRoute(params);
if (vendorResult) return jsonOutput(vendorResult);

var productionResult = govopsProductionRoute(params);
if (productionResult) return jsonOutput(productionResult);
```

---

## 正式驗收順序

### 1. 後端初始化

- action=正式平台初始化
- action=正式平台健康檢查
- action=初始化合作廠商主檔

### 2. 專案流程

- 新增專案
- 查詢專案
- 修改專案

### 3. 活動流程

- 新增活動
- 查詢活動
- 修改活動
- 生成活動作業包
- ERP流程_活動完成
- ERP流程_活動取消
- 建立活動資料夾與歸檔清單

### 4. 廠商流程

- 新增合作廠商
- 查詢合作廠商
- 修改合作廠商

### 5. Dashboard

- 取得ERP儀表板
- ERP專案總覽
- ERP風險報告

---

## 目前尚未完成事項

1. vendors.html 前端欄位需同步更新為正式 23_合作廠商主檔欄位。
2. crm.html 需建立。
3. archive.html 需建立。
4. Apps Script 需實際貼入並重新部署。
5. 前端 config.js 需確認為最新 Web App URL。
6. 六大頁面需逐頁驗收。

---

## 上線判斷

目前狀態：

- 後端架構：已完成核心
- 合作廠商後端：已完成正式 Apps Script 程式
- 前端核心：已完成
- 前端頁面：部分完成
- 實際部署：待使用者貼入 Apps Script 並重新部署

結論：尚未完全正式上線，但已進入正式上線整合收尾階段。
