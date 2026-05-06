import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

const bids = [
  { name: '就業服務專業人員職能培訓計畫', agency: '地方政府', budget: '1,200,000', deadline: '2026-06-15', score: '86', result: '必投' },
  { name: 'AI應用推廣與講座委託案', agency: '公部門', budget: '680,000', deadline: '2026-06-22', score: '74', result: '可投' },
  { name: '地方產業行銷服務案', agency: '公協會', budget: '350,000', deadline: '2026-07-01', score: '49', result: '觀察' },
];

export default function BidsPage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="標案管理" />
        <div className="main">
          <section className="card">
            <h2>標案池與投標決策</h2>
            <p className="muted">管理標案名稱、機關、預算、截止日、投標分數與決策結果。</p>
            <table className="table">
              <thead><tr><th>標案名稱</th><th>機關</th><th>預算</th><th>截止日</th><th>分數</th><th>決策</th></tr></thead>
              <tbody>{bids.map((bid) => <tr key={bid.name}><td>{bid.name}</td><td>{bid.agency}</td><td>{bid.budget}</td><td>{bid.deadline}</td><td>{bid.score}</td><td>{bid.result}</td></tr>)}</tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
