const currentPlan = {
  name: '專業版',
  expire: '2026-06-30',
  users: '1 / 3',
  crm: '428 / 3000',
  ai: '182 / 1000',
};

export default function LoginPage() {
  return (
    <div className="login-wrap" style={{ background: '#eef3ff' }}>
      <div className="login-card" style={{ width: 'min(1100px,100%)', display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: '26px' }}>
        <div>
          <div className="brand">GovOps OS</div>
          <h1>登入 GovOps SaaS 平台</h1>
          <p className="muted">進入後依據組織、角色與方案權限，顯示對應模組與功能。</p>

          <label>組織帳號
            <input type="email" placeholder="company@example.com" />
          </label>

          <label>密碼
            <input type="password" placeholder="請輸入密碼" />
          </label>

          <label>登入角色
            <select>
              <option>系統管理者</option>
              <option>專案經理</option>
              <option>行政人員</option>
              <option>財務人員</option>
              <option>講師</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a className="btn btn-blue" href="/govbid-ai-erp/saas-mvp/dashboard">登入平台</a>
            <a className="btn btn-outline" href="/govbid-ai-erp/saas-mvp/finance">查看財務模組</a>
          </div>

          <div className="line-box" style={{ marginTop: '22px' }}>
            <img src="https://qr-official.line.me/gs/M_262guhpb_GW.png?oat_content=qr" alt="LINE諮詢QR Code" />
            <div>
              <b>LINE SaaS 導入顧問</b>
              <p className="muted">導入 GovOps OS、AI營運秘書、標案流程系統與 CRM 整合。</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: '#102033', color: '#fff', border: 0 }}>
          <div className="badge">目前登入中的方案模擬</div>
          <h2 style={{ fontSize: '34px', marginBottom: '6px' }}>{currentPlan.name}</h2>
          <p style={{ color: 'rgba(255,255,255,.72)' }}>到期日：{currentPlan.expire}</p>

          <div style={{ display: 'grid', gap: '14px', marginTop: '24px' }}>
            <div style={{ padding: '18px', background: 'rgba(255,255,255,.06)', borderRadius: '18px' }}>
              <b>使用者帳號</b>
              <div style={{ marginTop: '6px', color: '#93c5fd' }}>{currentPlan.users}</div>
            </div>

            <div style={{ padding: '18px', background: 'rgba(255,255,255,.06)', borderRadius: '18px' }}>
              <b>CRM 用量</b>
              <div style={{ marginTop: '6px', color: '#93c5fd' }}>{currentPlan.crm}</div>
            </div>

            <div style={{ padding: '18px', background: 'rgba(255,255,255,.06)', borderRadius: '18px' }}>
              <b>AI 查詢次數</b>
              <div style={{ marginTop: '6px', color: '#93c5fd' }}>{currentPlan.ai}</div>
            </div>
          </div>

          <div style={{ marginTop: '24px', padding: '18px', borderRadius: '18px', background: 'rgba(239,68,68,.16)', border: '1px solid rgba(239,68,68,.28)' }}>
            <b>升級提醒</b>
            <p style={{ marginBottom: 0, color: 'rgba(255,255,255,.78)' }}>當 CRM、活動數或 AI 次數超量時，系統將自動阻擋功能並導向升級頁。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
