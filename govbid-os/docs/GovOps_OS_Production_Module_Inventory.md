# GovOps OS 正式上線模組盤點與整併計畫

## 一、目前盤點結論

目前以 GitHub repo 搜尋以下關鍵字：

```text
registration
enrollment
admission
roster
報名
招生
學員
錄取
審核
任務
派工
通知
```

在 `govbid-os` 範圍內，未搜尋到既有正式報名、招生、學員名冊、錄取審核、任務派工模組。

因此目前判斷：

```text
1. 相關內容可能曾在對話或試算表規格中討論過。
2. 但尚未正式落地到 GitHub repo。
3. 112_GovOps_RegistrationOperationsSuite.gs 先列為正式候選版。
4. 後續若找到舊版資料，需以整併方式處理，不直接覆蓋。
```

---

## 二、正式候選版模組

### 1. 報名營運套件

```text
govbid-os/apps-script/112_GovOps_RegistrationOperationsSuite.gs
```

涵蓋：

```text
招生設定
報名資料
錄取審核
學員名冊
報名通知
報名管理總覽
```

資料表：

```text
85_招生設定
86_報名資料
87_錄取審核紀錄
88_學員名冊
89_報名通知紀錄
```

目前狀態：

```text
正式候選版，待與舊資料/前端/Router/Sheet實測整併。
```

---

## 三、已完成的營運骨架模組

### 1. SaaS Operations Core

```text
govbid-os/apps-script/109_GovOps_SaaSOperationsCore.gs
```

包含：

```text
Tenant Isolation
RBAC
Audit Log
Workflow Runtime
```

### 2. File Center Core

```text
govbid-os/apps-script/110_GovOps_FileCenterCore.gs
```

包含：

```text
檔案登錄
Drive檔案關聯
標準檔名
資料夾規劃
是否納入結案/核銷
```

### 3. Queue Persistence Core

```text
govbid-os/apps-script/111_GovOps_QueuePersistenceCore.gs
```

包含：

```text
持久化佇列
Priority Queue
Lock
Retry
Dead Letter Queue
```

---

## 四、已完成的 ERP 主檔模組

```text
107_GovOps_ProductionResourceMasterData.gs
108_GovOps_ResourceTypeMasterEngine.gs
resource-master.html
```

包含：

```text
資源類型主檔
講師基本資料
工作人員基本資料
合作廠商基本資料
使用者自訂類型
```

---

## 五、已完成的履約中後段模組

```text
100_GovOps_TenderExecutionEventEngine.gs
101_GovOps_TenderExecutionAttendanceEngine.gs
102_GovOps_TenderExecutionSatisfactionEngine.gs
103_GovOps_GoogleFormsAutoConnector.gs
104_GovOps_TenderExecutionLookupEngine.gs
99_GovOps_TenderExecutionArtifactIntake.gs
tender-execution.html
```

包含：

```text
履約場次
應出席人數
實際出席人數
出席率
滿意度
Google表單自動連結
履約成果附件
履約選單帶入
```

---

## 六、已完成的結案模組

```text
Tender Closing Report Generator
Tender Closing Report Word Export
Tender Closing Report PDF Export
Tender Closing Package Engine
Tender Closing Package Workspace
```

包含：

```text
結案報告草稿
檢討建議
Word匯出
PDF匯出
交付包
缺件檢查
```

---

## 七、目前真正缺口

### P0：正式商品上線前必補

```text
1. 報名管理前端工作台 registration-management.html
2. 工作分配 / 任務派工 Engine
3. 工作分配 / 任務派工前端
4. Notification Hub 正式通知中心
5. Router 整合檢查
6. Sheet 欄位資料字典
7. Runtime Health 對 109-112 新模組檢查
```

### P1：商品穩定營運補強

```text
1. 報到/簽到管理
2. 簽到表產生器
3. QR Check-in
4. 場次核銷明細
5. Unified Search
6. Dashboard Runtime
7. Settings Center
```

---

## 八、整併原則

```text
1. 若舊版資料存在，以功能成熟度高者為主。
2. 不允許同一功能存在兩套正式 API。
3. 舊版若僅為規劃，併入新版。
4. 舊版若已有前端使用，需加相容 alias。
5. 所有正式模組必須通過 tenantId、Audit、Workflow、Queue治理。
```

---

## 九、下一步

立即補：

```text
1. registration-management.html
2. Tender Execution Task Assignment Engine
3. task-assignment.html
4. Notification Hub Core
5. Production Runtime Health Check
```
