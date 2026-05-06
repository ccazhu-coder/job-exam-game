import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

const rows = [
  { project: '就服職能培訓計畫', type: '收入', category: '分期款', amount: '600,000', status: '應收' },
  { project: 'AI講座委託案', type: '支出', category: '講師費', amount: '36,000', status: '待付款' },
  { project: '地方產業行銷案', type: '支出', category: '印刷/交通', amount: '8,500', status: '已付款' },
  { project: '投標準備', type: '押標金', category: '押標金', amount: '50,000', status: '待退還' },
];

export default function FinancePage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="財務管理" />
        <div className="main">
          <div className="stats">
            <div className="stat"><span className="muted">本月收入</span><br /><b>600K</b></div>
            <div className="stat"><span className="muted">本月支出</span><br /><b>44.5K</b></div>
            <div className="stat"><span className="muted">應收款</span><br /><b>600K</b></div>
            <div className="stat"><span className="muted">押標金</span><br /><b>50K</b></div>
          </div>
          <section className="card" style={{ marginTop: '22px' }}>
            <h2>專案收支</h2>
            <table className="table">
              <thead><tr><th>專案</th><th>類型</th><th>分類</th><th>金額</th><th>狀態</th></tr></thead>
              <tbody>{rows.map((row, i) => <tr key={i}><td>{row.project}</td><td>{row.type}</td><td>{row.category}</td><td>{row.amount}</td><td>{row.status}</td></tr>)}</tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
