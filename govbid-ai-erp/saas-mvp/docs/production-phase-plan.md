# GovBid AI ERP｜正式 SaaS 產品化階段

## 產品化目標

將 GovBid AI ERP 從 MVP 骨架推進到可部署、可登入、可測試、可內測的 SaaS 產品。

---

## Phase 1｜Build 驗證

### 任務

- npm install
- npm run build
- npm run dev
- 修正所有 build error
- 檢查所有頁面路由
- 檢查所有 API route

### 驗收標準

- build 成功
- dev server 可開啟
- 所有頁面不報錯
- 所有 API 回傳 JSON

---

## Phase 2｜Supabase 正式環境

### 任務

- 建立 Supabase Project
- 匯入 supabase/schema.sql
- 建立測試帳號
- 設定 RLS
- 測試資料隔離

### 驗收標準

- 可註冊
- 可登入
- 每個 user 只能看自己的 bids / tasks / finances
- profiles 正常建立

---

## Phase 3｜真實 CRUD

### 任務

- bids CRUD
- crm/leads CRUD
- finance CRUD
- tasks CRUD
- bid_analysis CRUD

### 驗收標準

- 使用者可新增資料
- 使用者可編輯資料
- 使用者可刪除資料
- Dashboard 可讀取真實資料

---

## Phase 4｜AI 提案正式串接

### 任務

- /api/ai 呼叫 OpenAI
- 結果回傳前端
- 儲存到 bid_analysis
- 顯示歷史 AI 分析

### 驗收標準

- 可輸入標案資料
- 可產出服務建議書架構
- 可產出簡報答詢
- 可產出風險控管
- 可儲存分析結果

---

## Phase 5｜方案權限

### 任務

- Free 限制 3 個標案
- Pro 開放 AI 提案
- Business 開放財務與完整 CRM
- Enterprise 開放團隊權限

### 驗收標準

- 未升級不能使用鎖定功能
- 權限提示正常
- plan 欄位可控制功能

---

## Phase 6｜內測上線

### 任務

- Vercel 部署
- 設定正式環境變數
- 建立 Demo 帳號
- 建立內測回饋表
- 測試手機版

### 驗收標準

- 正式網址可開啟
- 內測者可登入
- 內測者可完成一個標案流程
- 可收集回饋

---

## Phase 7｜收費準備

### 任務

- 人工付款流程
- 付款後手動升級 plan
- 顧問導入流程
- 使用教學文件
- 成交紀錄

### 驗收標準

- 可收第一筆款
- 可開通使用者
- 可交付教學
- 可記錄成交資料

---

## 不再新增大功能原則

產品化階段不新增大型模組，優先順序為：

1. 跑得動
2. 登得進
3. 存得到
4. AI 可產出
5. 權限可控
6. 可部署
7. 可內測
