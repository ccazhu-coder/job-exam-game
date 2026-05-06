# GovBid AI ERP SaaS MVP｜Build / Run 檢查清單

## 本機檢查

```bash
cd govbid-ai-erp/saas-mvp
npm install
npm run build
npm run dev
```

## 必測頁面

- /
- /register
- /login
- /dashboard
- /crm
- /bids
- /finance
- /ai
- /settings

## 必測 API

- /api/auth
- /api/dashboard
- /api/bids
- /api/crm
- /api/finance
- /api/ai
- /api/settings

## 必測功能

- 首頁可開啟
- 註冊頁可開啟
- 登入頁可開啟
- Dashboard 可開啟
- CRM 頁可開啟
- 標案頁可開啟
- 財務頁可開啟
- AI 頁可開啟
- Settings 頁可開啟
- LINE QR 可顯示
- CSS 樣式正常
- API 回傳 JSON

## 部署前不得寫入程式碼的資料

- OPENAI_API_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY 實際值
- 任何付款金流密鑰

## 正式部署前待完成

- Supabase Project 建立
- schema.sql 匯入
- Vercel Environment Variables 設定
- OpenAI Key 放入 Vercel Environment Variables
- 真實 Auth 測試
- 真實 CRUD 測試
- AI API 測試
