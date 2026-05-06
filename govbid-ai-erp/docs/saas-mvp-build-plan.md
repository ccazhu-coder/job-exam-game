# GovBid AI ERP｜AI SaaS MVP 建立計畫

## 產品目標

把 GovBid AI ERP 從「可營運 Landing Page + Google Sheet CRM」升級為真正 SaaS MVP。

核心目標：

- 使用者可以登入
- 使用者可以管理自己的標案專案
- 使用者可以新增標案、任務與財務資料
- 使用者可以使用 AI 提案提示詞
- 管理者可以查看客戶名單、方案、成交狀態
- 未來可以接月費訂閱

---

## MVP 技術路線

### 前端

- Next.js / React
- Tailwind CSS
- Dashboard UI

### 後端

- Supabase Auth
- Supabase PostgreSQL
- Row Level Security

### AI

- OpenAI API
- Prompt Template
- Proposal Generator

### 付款

- 第一階段：人工收款
- 第二階段：綠界 / 藍新 / Stripe

---

## MVP 模組

### 1. 使用者系統

- 註冊
- 登入
- 忘記密碼
- 使用者角色
- 方案權限

### 2. 標案管理

- 標案池
- 投標專案
- 決策評分
- 得標狀態
- 機關與截止日

### 3. AI 提案

- 標案需求拆解
- 心智圖分析
- 服務建議書架構
- 簡報答詢問題
- 報價策略

### 4. 履約管理

- 任務場次
- 講師
- 工作人員
- 合作廠商
- 照片與憑證
- 滿意度

### 5. 財務管理

- 收入
- 支出
- 應收款
- 應付款
- 押標金
- 講師費
- 工作人員費
- 場地費
- 報稅分類

### 6. CRM 管理

- 客戶名單
- 客戶分級
- 方案
- 預估成交金額
- 下次追蹤日期
- 成交狀態

---

## 資料表設計

### users

- id
- email
- name
- role
- plan
- plan_status
- created_at

### bids

- id
- user_id
- bid_name
- agency
- budget
- deadline
- status
- decision_score
- decision_result
- win_status
- created_at

### bid_analysis

- id
- bid_id
- policy_goal
- target_audience
- pain_points
- kpi
- reviewer_focus
- risk_points
- strategy
- innovation

### tasks

- id
- bid_id
- task_type
- task_name
- due_date
- owner
- status
- reminder_status

### finances

- id
- bid_id
- type
- category
- amount
- target
- payment_method
- due_date
- paid_date
- tax_note
- status

### leads

- id
- name
- line
- email
- plan
- status
- message
- level
- deal_amount
- next_follow_up_date
- deal_status
- created_at

---

## 90 天 SaaS 建立路線

### 第 1–14 天

- 完成 Landing Page 正式串接
- 完成 Google Sheet CRM
- 取得第一批名單
- 成交 1–3 位內測用戶

### 第 15–30 天

- 建立 Supabase 專案
- 建立資料表
- 建立登入系統
- 建立 Dashboard 雛形

### 第 31–60 天

- 建立標案管理模組
- 建立任務與財務模組
- 導入第一批用戶使用
- 收集真實回饋

### 第 61–90 天

- 串接 AI 提案產生器
- 建立方案權限
- 建立訂閱制前置架構
- 準備正式發布

---

## 先不做的功能

為了避免 MVP 過大，第一版先不做：

- 完整自動抓政府採購網
- 複雜多人權限
- 完整會計報稅申報
- 自動金流串接
- 自動產生 Word/PPT 檔

這些放在第二階段。

---

## 第一版成功指標

- 10 位試用者
- 3 位付費用戶
- 1 位顧問導入客戶
- 每月至少 NT$30,000 營收
- 完成 1 個真實標案案例

---

## 創辦人工作重點

每週固定做：

1. 發內容吸引名單
2. 回覆私訊
3. 系統導覽
4. 收集使用者痛點
5. 優化產品
6. 整理案例

GovBid AI ERP 的第一階段不是追求完美功能，而是證明市場願意付費。