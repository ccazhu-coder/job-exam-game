export default function HomePage() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">GovBid AI ERP</div>
        <nav className="nav">
          <a href="/govbid-ai-erp/saas-mvp/login">登入</a>
          <a href="/govbid-ai-erp/saas-mvp/dashboard">Dashboard</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="badge">AI SaaS｜政府標案營運平台</div>
          <h1>從找案、寫標、履約到收款，建立一套可登入的 AI 標案平台</h1>
          <p>GovBid AI ERP 協助講師、顧問、協會與訓練單位，把政府標案流程系統化、資料化、產品化。</p>
          <a className="btn btn-primary" href="/govbid-ai-erp/saas-mvp/login">進入平台</a>
        </div>
      </section>

      <section className="section">
        <div className="grid">
          <div className="card"><h3>標案管理</h3><p className="muted">建立標案池、投標評分、得標狀態與截止日管理。</p></div>
          <div className="card"><h3>AI 提案</h3><p className="muted">輸入需求後產出服務建議書架構、簡報答詢與報價策略。</p></div>
          <div className="card"><h3>履約財務</h3><p className="muted">管理任務、講師、廠商、應收應付、押標金與報稅分類。</p></div>
        </div>
      </section>
    </div>
  );
}
