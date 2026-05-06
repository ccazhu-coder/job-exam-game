# GovBid AI ERP SaaS MVP｜Production TODO

## P0｜一定要先完成

- [ ] npm install
- [ ] npm run build
- [ ] 修正 build error
- [ ] Vercel 部署成功
- [ ] Supabase Project 建立
- [ ] schema.sql 匯入成功
- [ ] Environment Variables 設定完成
- [ ] Register / Login 真實串接
- [ ] Dashboard route protection 生效
- [ ] OpenAI API 透過環境變數呼叫

## P1｜內測前完成

- [ ] Bids CRUD 串 Supabase
- [ ] CRM CRUD 串 Supabase
- [ ] Finance CRUD 串 Supabase
- [ ] AI Proposal 結果可儲存
- [ ] PlanGuard 真實套用方案權限
- [ ] 不同使用者資料隔離測試
- [ ] 手機版測試
- [ ] LINE QR 顯示測試

## P2｜正式販售前完成

- [ ] 付款流程
- [ ] 方案升級流程
- [ ] 管理員後台
- [ ] 使用量統計
- [ ] Email / LINE 通知
- [ ] 匯出報表
- [ ] Demo 帳號

## 安全提醒

- 不得把 OPENAI_API_KEY 寫進程式碼
- 不得把 Supabase service role key 放到前端
- 所有正式密鑰只放在 Vercel Environment Variables
