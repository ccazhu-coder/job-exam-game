import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

const users = [
  { name: '珍珠老師', email: 'admin@example.com', plan: 'Business', status: 'active', usage: '8 bids' },
  { name: '測試用戶', email: 'demo@example.com', plan: 'Free', status: 'trial', usage: '2 bids' },
];

export default function AdminPage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="管理員後台" />
        <div className="main">
          <section className="card">
            <h2>使用者與方案管理</h2>
            <p className="muted">管理用戶、方案、付費狀態與使用量。</p>
            <table className="table">
              <thead><tr><th>姓名</th><th>Email</th><th>方案</th><th>狀態</th><th>使用量</th></tr></thead>
              <tbody>{users.map((u) => <tr key={u.email}><td>{u.name}</td><td>{u.email}</td><td>{u.plan}</td><td>{u.status}</td><td>{u.usage}</td></tr>)}</tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
