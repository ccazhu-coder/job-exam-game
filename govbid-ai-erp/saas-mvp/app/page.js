const plans = [
  {
    name: '免費體驗版',
    price: 'NT$0',
    target: '新使用者、單場活動試用',
    limits: ['每月 3 場活動', 'CRM 最多 100 筆', '1 位使用者', '基本文件歸檔'],
  },
  {
    name: '專業版',
    price: 'NT$1,990 / 月',
    target: '一人公司、顧問工作室、小型訓練單位',
    limits: ['每月 20 場活動', 'CRM 最多 3,000 筆', '3 位使用者', 'AI 缺件提醒'],
  },
  {
    name: '團隊版',
    price: 'NT$4,990 / 月',
    target: '公會、協會、政府專案執行團隊',
    limits: ['每月 80 場活動', 'CRM 最多 20,000 筆', '10 位使用者', '角色權限與通知'],
  },
];

const modules = [
  { title: '組織層', text: '每個單位都有獨立組織 ID，未來可區分公會、協會、顧問工作室與企業客戶。' },
  { title: '使用者層', text: '支援負責人、管理者、財務、行政、講師等不同角色入口。' },
  { title: '方案層', text: '依方案控制活動數、CRM 筆數、AI 查詢、文件容量與通知功能。' },
  { title: '權限層', text: '進入任何功能前先檢查登入、組織、方案、用量與角色權限。' },
  { title: '用量層', text: '顯示本月已用量與上限，超量時以中文升級提示取代工程錯誤。' },
  { title: '轉換層', text: '從首頁、登入頁、財務頁都導向試用、升級與 LINE 諮詢。' },
];

export default function HomePage() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">GovOps OS</div>
        <nav className="nav">
          <a href="/govbid-ai-erp/saas-mvp/login">登入</a>
          <a href="/govbid-ai-erp/saas-mvp/dashboard">Dashboard</a>
          <a href="/govbid-ai-erp/saas-mvp/finance">財務秘書</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="badge">GovOps OS｜政府標案 SaaS 營運系統</div>
          <h1>把找案、備標、履約、招生、CRM、財務與成果歸檔，整合成一套可登入、可分權、可收費的 SaaS 平台</h1>
          <p>為講師、顧問、公會、協會與訓練單位打造的政府專案作業系統。從一人公司開始，也能逐步升級成團隊型營運平台。</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '26px' }}>
            <a className="btn btn-primary" href="/govbid-ai-erp/saas-mvp/login">開始登入平台</a>
            <a className="btn btn-outline" href="/govbid-ai-erp/saas-mvp/finance">查看財務秘書</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="badge" style={{ color: '#1f5eff', borderColor: '#dbe3ef', background: '#fff' }}>SaaS 使用者層整合</div>
        <h2 style={{ fontSize: '34px', marginBottom: '8px' }}>正式版核心架構</h2>
        <p className="muted">首頁不再只是展示頁，而是產品入口：清楚呈現組織、角色、方案、權限、用量與升級邏輯。</p>
        <div className="grid" style={{ marginTop: '22px' }}>
          {modules.map((item) => (
            <div className="card" key={item.title}>
              <h3>{item.title}</h3>
              <p className="muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <h2 style={{ fontSize: '34px', marginBottom: '8px' }}>方案設計</h2>
        <p className="muted">先完成前端方案層，後續可接後端訂閱資料表、付款狀態與到期停權規則。</p>
        <div className="grid" style={{ marginTop: '22px' }}>
          {plans.map((plan) => (
            <div className="card" key={plan.name}>
              <h3>{plan.name}</h3>
              <p style={{ fontSize: '28px', fontWeight: 900, color: '#1f5eff', margin: '8px 0' }}>{plan.price}</p>
              <p className="muted">{plan.target}</p>
              <ul style={{ paddingLeft: '18px', lineHeight: 1.9 }}>
                {plan.limits.map((limit) => <li key={limit}>{limit}</li>)}
              </ul>
              <a className="btn btn-blue" href="/govbid-ai-erp/saas-mvp/login">啟用此方案</a>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="card" style={{ display: 'grid', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>下一階段接後端</h2>
          <p className="muted" style={{ margin: 0 }}>將目前前端的組織、角色、方案與用量資料，接到 Supabase / Google Sheets / Apps Script 後，即可形成正式 SaaS 帳號系統。</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span className="badge" style={{ color: '#102033', background: '#f8fafc', borderColor: '#dbe3ef' }}>tenant_id</span>
            <span className="badge" style={{ color: '#102033', background: '#f8fafc', borderColor: '#dbe3ef' }}>user_role</span>
            <span className="badge" style={{ color: '#102033', background: '#f8fafc', borderColor: '#dbe3ef' }}>plan_code</span>
            <span className="badge" style={{ color: '#102033', background: '#f8fafc', borderColor: '#dbe3ef' }}>usage_limit</span>
            <span className="badge" style={{ color: '#102033', background: '#f8fafc', borderColor: '#dbe3ef' }}>feature_gate</span>
          </div>
        </div>
      </section>
    </div>
  );
}
