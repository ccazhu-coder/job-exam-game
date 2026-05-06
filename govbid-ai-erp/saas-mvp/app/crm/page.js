import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

const leads = [
  { name: '某某協會', level: 'A級｜熱客戶', plan: '顧問導入版', amount: '39,800+', next: '明天', status: '待導覽' },
  { name: '個人講師', level: 'B級｜溫客戶', plan: '完整商用版', amount: '19,800', next: '3天後', status: '追蹤中' },
  { name: '教育訓練單位', level: 'C級｜培養名單', plan: '先了解', amount: '-', next: '7天後', status: '培養' },
];

export default function CrmPage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="CRM 名單管理" />
        <div className="main">
          <section className="card">
            <h2>客戶名單</h2>
            <p className="muted">管理網站表單、LINE諮詢、方案需求與成交追蹤。</p>
            <table className="table">
              <thead><tr><th>姓名/單位</th><th>分級</th><th>方案</th><th>預估金額</th><th>追蹤日</th><th>狀態</th></tr></thead>
              <tbody>{leads.map((lead) => <tr key={lead.name}><td>{lead.name}</td><td>{lead.level}</td><td>{lead.plan}</td><td>{lead.amount}</td><td>{lead.next}</td><td>{lead.status}</td></tr>)}</tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
