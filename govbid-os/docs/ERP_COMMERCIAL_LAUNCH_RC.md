# GovOps OS｜正式商用上線 Release Candidate

## 版本狀態

GovOps OS 已進入：正式商用上線 Release Candidate。

本文件作為正式上線前的封版紀錄。

---

## 一、正式商用上線範圍

本次正式商用上線範圍包含：

1. 營運儀表板
2. 專案管理
3. 活動管理
4. 招生報名
5. 報名資料庫
6. 學員 CRM
7. 簽到表自動產出
8. 課程執行現場管理
9. 廠商管理
10. 核銷歸檔
11. 財務秘書
12. 上線驗收工具

---

## 二、正式前端頁面

正式上線頁面：

```text
/app/dashboard.html
/app/projects.html
/app/activities.html
/app/enrollment.html
/app/course-ops.html
/app/vendors.html
/app/crm.html
/app/archive.html
/app/finance-secretary.html
/app/pre-launch-qa.html
```

共用核心：

```text
/app/erp-aligned-core.js
/app/erp-ui-core.js
/app/erp-page-style.css
/app/govops-api-client.js
/app/config.js
```

---

## 三、正式後端檔案

Apps Script 正式上線至少需貼入：

```text
backend/erp_commercial_core.gs
backend/erp_workflow_engine.gs
backend/erp_drive_document_core.gs
backend/erp_dashboard_core.gs
backend/erp_production_router_patch.gs
backend/GOVOPS_APPS_SCRIPT_VENDOR_UPDATE_FINAL.gs
backend/GOVOPS_ENROLLMENT_ATTENDANCE_FINAL.gs
backend/GOVOPS_COURSE_EXECUTION_FINAL.gs
```

---

## 四、主 Router 必接

Apps Script doGet / doPost router 前段必須接：

```javascript
var vendorResult = govopsVendorOfficialRoute(params);
if (vendorResult) return jsonOutput(vendorResult);

var enrollmentResult = govopsEnrollmentRoute(params);
if (enrollmentResult) return jsonOutput(enrollmentResult);

var courseOpsResult = govopsCourseExecutionRoute(params);
if (courseOpsResult) return jsonOutput(courseOpsResult);

var productionResult = govopsProductionRoute(params);
if (productionResult) return jsonOutput(productionResult);
```

---

## 五、正式資料來源

Google Sheets：

```text
GovBid AI ERP｜政府標案全流程營運系統
```

Spreadsheet ID：

```text
1nNibsAkem2luiVe3iR64Q8GSSUQUQFwvaoiMPU-ZaeY
```

---

## 六、正式模組對齊

### 1. 專案與活動

- 01_專案主檔
- 02_場次活動
- 活動主表

### 2. 招生報名

- 招生活動管理
- 報名資料庫
- 候補名單
- 開課通知紀錄
- LINE通知紀錄

### 3. 學員 CRM

- 學員CRM
- CRM資料
- 學員互動紀錄
- 學員標籤字典
- 行銷名單查詢
- 課後追蹤
- 招生數據分析

### 4. 簽到與出席

- 簽到表
- 簽到表紀錄
- 06_出席紀錄

### 5. 課程執行現場管理

- 課程執行紀錄
- 場地設備確認
- 教材與物資準備
- 領據管理
- 核銷文件管理
- 當日工作任務表
- 當日注意事項
- 報到處任務
- 餐點管理
- 物品清單
- 現場聯絡人
- 現場照片紀錄
- 課後回收檢核

### 6. 廠商與付款

- 23_合作廠商主檔

正式欄位：

```text
廠商編號
名稱
類型
聯絡人
電話
Email
支付方式
銀行
帳號
戶名
統編/身分證
是否開發票
是否扣繳
扣繳類型
預設單價
評價
常用
備註
建立時間
更新時間
```

### 7. 核銷與文件

- 核銷檢查中心
- 09_成果附件
- 30_結案交付
- Drive歸檔
- 檔案歸檔中心
- 文件搜尋索引

---

## 七、正式驗收 Gate

請先開啟：

```text
/app/pre-launch-qa.html
```

一鍵執行正式上線前驗收。

全部通過後，再進行人工流程測試。

---

## 八、人工流程驗收

### 流程 A：專案到活動

```text
新增專案
→ 查詢專案
→ 修改專案
→ 新增活動
→ 查詢活動
→ 修改活動
```

### 流程 B：招生報名

```text
新增招生活動
→ 手動新增報名
→ 查詢報名資料庫
→ 錄取審核
→ 產出簽到表
→ 查詢簽到表
```

### 流程 C：學員 CRM

```text
新增報名
→ 同步 CRM
→ 查詢學員CRM
→ 行銷名單
→ 回流學員分析
→ 參與歷程
```

### 流程 D：課程執行

```text
建立當日快速執行包
→ 查詢課程執行資料
→ 新增現場任務
→ 查詢現場任務
```

### 流程 E：廠商與付款

```text
新增合作廠商
→ 查詢合作廠商
→ 修改匯款資料
→ 查詢確認更新
```

### 流程 F：核銷歸檔

```text
新增成果文件
→ 查詢成果文件
→ 查詢核銷缺件
→ 建立活動資料夾
```

---

## 九、尚需人工完成事項

以下事項無法由 GitHub 自動完成，需在 Apps Script 後台人工完成：

1. 將正式後端 .gs 檔案貼入 Apps Script。
2. 確認主 Router 已接入 vendor / enrollment / courseOps / production routes。
3. 重新部署 Web App。
4. 確認 config.js 使用最新 Web App URL。
5. 開啟 pre-launch-qa.html 執行驗收。

---

## 十、正式判斷

目前狀態：

```text
Release Candidate
```

正式上線條件：

```text
pre-launch-qa.html 全部通過
人工流程 A～F 全部通過
Apps Script 已部署正式版
config.js 已指向最新 Web App URL
```

達成後，可宣告：

```text
GovOps OS 正式商用上線
```
