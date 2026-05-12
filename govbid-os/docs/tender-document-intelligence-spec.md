# GovOps OS｜Tender Document Intelligence 正式規格

## 一、重要修正

目前 `Tender Auto Proposal Assistant` 只能依系統既有資料產生「通用型服務建議書骨架」。

這不能視為正式投標企劃分析，因為每一個政府標案的招標文件、評選標準、資格條件、工作項目、契約條款、經費編列、驗收方式都不同。

正式產品必須先支援：

# 領標資料上傳與解析

AI 才能進行真正標案分析。

---

## 二、正式資料流程

```text
使用者上傳領標資料
↓
Tender Document Intake
↓
文件分類
↓
文件解析
↓
欄位抽取
↓
資格條件分析
↓
評選標準分析
↓
工作項目分析
↓
契約與請款條件分析
↓
風險與合規檢查
↓
投標策略／服務建議書生成
```

---

## 三、上傳資料類型

使用者需上傳或登錄以下資料：

1. 招標公告
2. 投標須知
3. 評選須知
4. 工作說明書
5. 需求規格書
6. 契約草案
7. 標價清單
8. 經費明細表
9. 資格文件清單
10. 附件表單
11. 補充公告
12. 答疑紀錄
13. 領標壓縮檔
14. PDF、Word、Excel、圖片、掃描檔

---

## 四、需新增資料表

### `48_標案領標文件`

欄位：

- 文件ID
- tenantId
- 標案ID
- 標案名稱
- 文件類型
- 檔案名稱
- DriveFileID
- DriveURL
- MIMEType
- 上傳日期
- 文件狀態
- 解析狀態
- OCR狀態
- 建立時間
- 更新時間
- userId
- 備註

---

### `49_標案文件解析結果`

欄位：

- 解析ID
- tenantId
- 文件ID
- 標案ID
- 文件類型
- 原文摘要
- 關鍵條款
- 資格條件
- 評選標準
- 工作項目
- 交付成果
- 驗收方式
- 請款條件
- 罰則條款
- 風險提醒
- 建立時間
- 更新時間
- userId
- 備註

---

### `50_標案評選分析`

欄位：

- 評選ID
- tenantId
- 標案ID
- 評選項目
- 配分
- 評審重點
- 回應策略
- 佐證資料
- 加分建議
- 風險提醒
- 建立時間
- 更新時間
- userId
- 備註

---

## 五、需新增 API

### 文件上傳／登錄

- `tender.document.register`
- `tender.document.query`
- `tender.document.updateStatus`

### 文件解析

- `tender.document.parse`
- `tender.document.extract`
- `tender.document.summary`

### 評選分析

- `tender.evaluation.analyze`
- `tender.evaluation.query`

### 企劃生成修正

`tender.proposal.generate` 不應直接依通用資料產生正式企劃。

正式規則：

1. 如果沒有文件解析結果，只能產生「通用企劃骨架」。
2. 如果已有文件解析結果，才能產生「依本案招標文件客製化企劃」。
3. 產出時需明確標示資料來源。

---

## 六、企劃助理需改成兩層

### 第一層：通用骨架

適用情境：尚未上傳領標文件。

產出：

- 通用章節架構
- 初步投標主軸
- 初步風險提醒
- 建議需補資料

### 第二層：本案客製化企劃

適用情境：已上傳並解析領標文件。

產出：

- 依工作說明書設計服務內容
- 依評選配分設計回應策略
- 依資格條件產生合規檢查
- 依契約條款產生履約風險
- 依請款條件產生財務風險
- 依驗收方式產生 KPI

---

## 七、正式產品原則

AI 不可在未讀取領標文件時，假裝知道本案需求。

系統必須明確區分：

```text
通用建議
本案文件依據分析
人工待補資料
```

---

## 八、下一步開發

優先新增：

1. `80_GovOps_TenderDocumentIntake.gs`
2. `81_GovOps_TenderDocumentParser.gs`
3. `82_GovOps_TenderEvaluationAnalyzer.gs`
4. 修改 `79_GovOps_TenderAutoProposalAssistant.gs`

開發順序：

```text
文件登錄 → 文件解析 → 評選分析 → 企劃生成升級
```
