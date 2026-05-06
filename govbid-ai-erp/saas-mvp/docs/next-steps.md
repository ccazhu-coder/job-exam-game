# GovBid AI ERP SaaS MVP｜接下來執行順序

## 目前狀態

SaaS MVP 主體架構已完成，包含前端頁面、API Routes、Supabase Schema、OpenAI Helper、權限架構、部署文件與 Vercel 設定。

---

## 下一步一：可運行檢查

執行：

```bash
cd govbid-ai-erp/saas-mvp
npm install
npm run build
npm run dev
```

目的：

- 確認 Next.js 專案可安裝
- 確認 build 可以通過
- 確認所有路由可開啟
- 確認 import path 沒錯
- 確認 UI 不會爆版

---

## 下一步二：Supabase 正式建立

1. 建立 Supabase Project
2. 開啟 SQL Editor
3. 匯入 `supabase/schema.sql`
4. 複製 Project URL
5. 複製 anon key
6. 設定到 Vercel Environment Variables

---

## 下一步三：Vercel 正式部署

Vercel 設定：

- Repository：ccazhu-coder/job-exam-game
- Root Directory：govbid-ai-erp/saas-mvp
- Build Command：npm run build
- Install Command：npm install

Environment Variables：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=
```

---

## 下一步四：真實功能串接

必須完成：

- Register 真實註冊
- Login 真實登入
- Dashboard Session 保護
- Bids 真實新增/讀取/修改/刪除
- CRM 真實新增/讀取/修改/刪除
- Finance 真實新增/讀取/修改/刪除
- AI Proposal 真實呼叫 OpenAI
- PlanGuard 權限真實套用

---

## 下一步五：內測前檢查

內測前必須通過：

- 可以建立帳號
- 可以登入
- 可以新增標案
- 可以新增客戶名單
- 可以新增財務紀錄
- 可以產生 AI 提案
- 可以登出
- 不同帳號看不到彼此資料
- 手機版可正常操作
- LINE 諮詢入口正常顯示

---

## 下一步六：封閉測試

測試對象：

- 自己
- 1 位熟悉標案的人
- 1 位小白使用者

測試目標：

- 找出卡住的地方
- 找出最常用功能
- 找出願意付費的功能
- 決定第一版正式方案價格

---

## 下一步七：正式內測

內測目標：

- 10 位試用者
- 3 位付費用戶
- 1 位顧問導入客戶
- 完成 1 個真實標案案例

---

## 現階段最重要任務

不要再新增大功能。

現在應該先做：

1. Build 測試
2. 修錯
3. Supabase 建立
4. Vercel 部署
5. 真實登入與 CRUD
6. AI 真實串接
