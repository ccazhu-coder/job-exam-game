const items = [
  { href: '/govbid-ai-erp/saas-mvp/dashboard', label: 'Dashboard' },
  { href: '/govbid-ai-erp/saas-mvp/bids', label: '標案管理' },
  { href: '/govbid-ai-erp/saas-mvp/crm', label: 'CRM名單' },
  { href: '/govbid-ai-erp/saas-mvp/ai', label: 'AI提案' },
  { href: '/govbid-ai-erp/saas-mvp/finance', label: '財務管理' },
  { href: '/govbid-ai-erp/saas-mvp/settings', label: '系統設定' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">GovBid AI ERP</div>
      <p className="muted">AI SaaS Console</p>
      <nav>
        {items.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
      </nav>
    </aside>
  );
}
