import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

export default function DashboardPage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="Dashboard" />
        <div className="main">
          <div className="stats">
            <div className="stat"><span className="muted">本月新名單</span><br /><b>12</b></div>
            <div className="stat"><span className="muted">追蹤中案件</span><br /><b>8</b></div>
            <div className="stat"><span className="muted">預估成交額</span><br /><b>198K</b></div>
            <div className="stat"><span className="muted">本月成交</span><br /><b>3</b></div>
          </div>

          <section className="card" style={{ marginTop: '22px' }}>
            <h2>今日待辦</h2>
            <table className="table">
              <thead><tr><th>類型</th><th>項目</th><th>狀態</th><th>下一步</th></tr></thead>
              <tbody>
                <tr><td>CRM</td><td>A級客戶追蹤</td><td>待聯繫</td><td>安排系統導覽</td></tr>
                <tr><td>標案</td><td>投標決策評估</td><td>進行中</td><td>補齊評分</td></tr>
                <tr><td>財務</td><td>應收款確認</td><td>提醒</td><td>更新收款狀態</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
