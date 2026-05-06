export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">GovBid AI ERP</div>
        <h1>登入 AI 標案平台</h1>
        <p className="muted">管理標案、CRM、AI提案、履約與財務。</p>
        <label>Email
          <input type="email" placeholder="you@example.com" />
        </label>
        <label>密碼
          <input type="password" placeholder="請輸入密碼" />
        </label>
        <a className="btn btn-blue" href="/govbid-ai-erp/saas-mvp/dashboard">登入平台</a>
        <div className="line-box" style={{marginTop:'22px'}}>
          <img src="https://qr-official.line.me/gs/M_262guhpb_GW.png?oat_content=qr" alt="LINE諮詢QR Code" />
          <div>
            <b>LINE 諮詢</b>
            <p className="muted">掃描 QR Code 了解方案與導入服務。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
