# GovBid AI ERP SaaS｜Supabase 建立小白操作版

## 目標

建立正式資料庫，讓 SaaS 可以進入真實登入與真實 CRUD。

## 1. 建立 Supabase Project

1. 打開 https://supabase.com
2. 登入
3. 點 New Project
4. Project name：GovBid AI ERP
5. Database password：自行設定並保存
6. Region：Singapore 或 Northeast Asia
7. 點 Create new project

## 2. 匯入資料庫 Schema

1. 進入 Supabase Project
2. 左側點 SQL Editor
3. 點 New query
4. 回到 GitHub 開啟：
   `govbid-ai-erp/saas-mvp/supabase/schema.sql`
5. 複製全部內容
6. 貼到 Supabase SQL Editor
7. 點 Run

## 3. 複製 API 資料

1. 左側點 Project Settings
2. 點 API
3. 複製 Project URL
4. 複製 anon public key

## 4. Vercel 要填的環境變數

```text
NEXT_PUBLIC_SUPABASE_URL=貼上 Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=貼上 anon public key
OPENAI_API_KEY=放新的 OpenAI API Key
NEXT_PUBLIC_APP_URL=貼上 Vercel 正式網址
```

## 5. 測試

部署後打開：

```text
/health
/api/health
```

確認 Supabase Env 與 OpenAI Env 狀態。

## 安全提醒

- 不要把 API Key 貼進 GitHub
- 不要把 OpenAI API Key 貼到聊天紀錄
- 不要使用已曝光的 Key
- 所有正式 Key 只放 Vercel Environment Variables
