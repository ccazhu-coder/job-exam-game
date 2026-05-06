export default function RegisterPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">GovBid AI ERP</div>
        <h1>建立帳號</h1>
        <p className="muted">註冊後可開始建立標案池、CRM、AI提案與財務資料。</p>
        <label>姓名 / 單位名稱
          <input type="text" placeholder="請輸入姓名或單位" />
        </label>
        <label>Email
          <input type="email" placeholder="you@example.com" />
        </label>
        <label>密碼
          <input type="password" placeholder="請設定密碼" />
        </label>
        <label>方案
          <select defaultValue="free">
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <a className="btn btn-blue" href="/govbid-ai-erp/saas-mvp/dashboard">建立帳號並進入平台</a>
        <p className="muted">已有帳號？ <a href="/govbid-ai-erp/saas-mvp/login">登入</a></p>
      </div>
    </div>
  );
}
