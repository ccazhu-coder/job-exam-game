# GovBid AI ERP SaaS MVP

AI 標案決策、提案生成、履約管理與財務控管平台。

## Run locally

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Modules

- Landing / Home
- Login
- Dashboard
- CRM
- Bids
- AI Proposal
- Finance
- Settings
- API Routes
- Supabase Schema

## Deploy

Recommended: Vercel.

Root directory:

```text
govbid-ai-erp/saas-mvp
```

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```
