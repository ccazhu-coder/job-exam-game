# GovOps OS｜ERP 正式上線前驗收清單

## 目前階段

GovOps OS 目前進入：正式上線前驗收期。

本階段不再新增大型功能，重點是：

- 確認後端 Apps Script 可執行
- 確認前端六大頁面可操作
- 確認 Google Sheets 欄位完全對齊
- 確認每個模組都有新增、修改、查詢
- 確認核心流程可以跑完

---

## 一、正式資料來源

Google Sheets：GovBid AI ERP｜政府標案全流程營運系統

Spreadsheet ID：

```text
1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY
```

---

## 二、Apps Script 必須貼入檔案

正式部署前，Apps Script 至少需包含：

```text
erp_commercial_core.gs
erp_workflow_engine.gs
erp_drive_document_core.gs
erp_dashboard_core.gs
erp_production_router_patch.gs
GOVOPS_APPS_SCRIPT_VENDOR_UPDATE_FINAL.gs
```

---

## 三、主 Router 必接

主 doGet / doPost 中，action switch 前面必須先接：

```javascript
var vendorResult = govopsVendorOfficialRoute(params);
if (vendorResult) return jsonOutput(vendorResult);

var productionResult = govopsProductionRoute(params);
if (productionResult) return jsonOutput(productionResult);
```

---

## 四、後端初始化驗收

### 1. 正式平台初始化

API：

```text
?action=正式平台初始化
```

通過標準：

- 回傳 success=true
- Google Sheets 有建立必要分頁
- 無語法錯誤

---

### 2. 正式平台健康檢查

API：

```text
?action=正式平台健康檢查
```

通過標準：

- erpRoute=true
- erpWorkflowRoute=true
- erpDriveRoute=true
- erpDashboardRoute=true

---

### 3. 合作廠商主檔初始化

API：

```text
?action=初始化合作廠商主檔
```

通過標準：

- 建立 23_合作廠商主檔
- 欄位包含：廠商編號、名稱、類型、聯絡人、電話、Email、支付方式、銀行、帳號、戶名、統編/身分證、是否開發票、是否扣繳、扣繳類型、預設單價、評價、常用、備註、建立時間、更新時間

---

## 五、前端正式頁面

正式上線前，以下六頁都必須能開啟：

```text
dashboard.html
projects.html
activities.html
vendors.html
crm.html
archive.html
```

每頁通過標準：

- 頁面可開啟
- 不出現 JS console 重大錯誤
- 可呼叫最新 Web App URL
- 有新增區
- 有修改區
- 有查詢區
- 查詢結果可表格化顯示

---

## 六、模組驗收標準

### 1. 專案管理

頁面：

```text
projects.html
```

必測：

- 新增專案
- 查詢專案
- 修改專案

通過標準：

- 新增後可查到
- 修改後資料有更新
- 修改需能留下變更原因

---

### 2. 活動管理

頁面：

```text
activities.html
```

必測：

- 新增活動
- 查詢活動
- 修改活動
- 活動完成
- 活動取消
- 建立作業包
- 建立活動資料夾與歸檔清單

通過標準：

- 活動一定要歸屬專案
- 活動完成後可建立後續請款任務
- 活動取消後未完成任務應同步取消

---

### 3. 廠商管理

頁面：

```text
vendors.html
```

必測：

- 新增合作廠商
- 查詢合作廠商
- 修改合作廠商
- 常用篩選
- 類型篩選

通過標準：

- 23_合作廠商主檔資料正確寫入
- 匯款資訊欄位有同步寫入
- 發票與扣繳欄位有同步寫入

---

### 4. CRM 學員管理

頁面：

```text
crm.html
```

必測：

- 新增報名
- 同步 CRM
- 查詢學員
- 修改學員

通過標準：

- 同電話或 Email 不應重複建立 CRM
- 可查姓名、電話、服務單位、來源

---

### 5. 核銷歸檔

頁面：

```text
archive.html
```

必測：

- 新增成果文件
- 修改成果文件
- 查詢成果文件
- 查詢核銷缺件
- 建立活動資料夾

通過標準：

- 可追蹤簽到表、成果照片、成果報告、核銷單據
- 缺件可查詢

---

### 6. Dashboard

頁面：

```text
dashboard.html
```

必測：

- 查詢營運儀表板
- 查詢專案總覽
- 查詢風險報告

通過標準：

- 顯示專案數、活動數、今日待辦、應收、未收款、收入、支出、損益、核銷缺件

---

## 七、正式流程驗收

### 流程 A：專案到收款

```text
新增專案
→ 新增活動
→ 建立作業包
→ 活動完成
→ 建立應收
→ 登錄收款
→ Dashboard 查詢收入與損益
```

---

### 流程 B：活動改期

```text
新增活動
→ 修改活動日期
→ 寫入變更原因
→ 查詢變更紀錄
→ 任務重檢
```

---

### 流程 C：活動取消

```text
新增活動
→ 建立作業包
→ 取消活動
→ 查詢任務
→ 確認未完成任務已取消
```

---

### 流程 D：廠商付款資料

```text
新增合作廠商
→ 填入銀行、帳號、戶名、統編/身分證
→ 查詢合作廠商
→ 修改付款資料
→ 再查詢確認更新
```

---

### 流程 E：核銷歸檔

```text
建立活動資料夾
→ 登錄成果文件
→ 查詢核銷缺件
→ 補件
→ 查詢確認缺件減少
```

---

## 八、正式上線 Gate

全部通過後才可宣告正式上線：

- Apps Script 無語法錯誤
- Web App 已重新部署
- config.js 已更新最新 Web App URL
- 六大頁面可開啟
- 六大頁面新增／修改／查詢可執行
- 核心流程 A～E 可跑完
- Dashboard 可正確反映資料

---

## 九、目前狀態

目前狀態：正式上線前驗收期。

不可再任意新增大型功能。

下一步：依本清單逐項驗收，修正錯誤後進入正式上線。
