# GovBid AI ERP SaaS MVP｜Vercel 部署設定

## Root Directory

govbid-ai-erp/saas-mvp

## Build Command

npm run build

## Install Command

npm install

## Output

Next.js default / standalone

## Environment Variables

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=

## Supabase Setup

1. 建立 Supabase Project
2. 開啟 SQL Editor
3. 貼上 supabase/schema.sql
4. 執行 SQL
5. 到 Project Settings > API 複製 URL 與 anon key
6. 貼入 Vercel Environment Variables

## Deploy Steps

1. Vercel New Project
2. Import GitHub repo：ccazhu-coder/job-exam-game
3. Root Directory：govbid-ai-erp/saas-mvp
4. 設定環境變數
5. Deploy

## Test URLs

/
/login
/dashboard
/crm
/bids
/finance
/ai
/settings
/api/dashboard
/api/bids
/api/crm
/api/finance
/api/ai
/api/settings
