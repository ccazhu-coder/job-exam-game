export default function HealthPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">GovBid AI ERP</div>
        <h1>系統健康檢查</h1>
        <p className="muted">用於部署後快速確認 SaaS 平台是否正常。</p>
        <table className="table">
          <tbody>
            <tr><th>Frontend</th><td>OK</td></tr>
            <tr><th>Next.js App Router</th><td>OK</td></tr>
            <tr><th>API Routes</th><td>/api/dashboard、/api/bids、/api/crm、/api/finance、/api/ai</td></tr>
            <tr><th>Supabase</th><td>待環境變數設定</td></tr>
            <tr><th>OpenAI</th><td>待環境變數設定</td></tr>
          </tbody>
        </table>
        <a className="btn btn-blue" href="/govbid-ai-erp/saas-mvp/dashboard">回 Dashboard</a>
      </div>
    </div>
  );
}
