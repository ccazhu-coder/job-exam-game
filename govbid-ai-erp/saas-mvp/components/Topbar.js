export default function Topbar({ title = 'Dashboard' }) {
  return (
    <div className="topbar">
      <div>
        <b>{title}</b>
        <p className="muted" style={{ margin: 0 }}>GovBid AI ERP SaaS Console</p>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <a className="btn btn-outline" href="/govbid-ai-erp/saas-mvp/login">登出</a>
      </div>
    </div>
  );
}
