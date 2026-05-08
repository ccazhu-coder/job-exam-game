import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

const rows = [
  { project: '就服職能培訓計畫', type: '收入', category: '分期款', amount: '600,000', status: '應收' },
  { project: 'AI講座委託案', type: '支出', category: '講師費', amount: '36,000', status: '待付款' },
  { project: '地方產業行銷案', type: '支出', category: '印刷/交通', amount: '8,500', status: '已付款' },
  { project: '投標準備', type: '押標金', category: '押標金', amount: '50,000', status: '待退還' },
];

const usage = [
  { label: '本月活動數', used: '18 / 20', alert: true },
  { label: 'AI 查詢次數', used: '842 / 1000', alert: false },
  { label: 'LINE 通知', used: '1,280 / 2,000', alert: false },
  { label: 'CRM 筆數', used: '2,842 / 3,000', alert: true },
];

export default function FinancePage() {
  return (
    <div className="dashboard">
      <Sidebar />

      <main>
        <Topbar title="GovOps 財務秘書" />

        <div className="main">
          <div className="stats">
            <div className="stat"><span className="muted">本月收入</span><br /><b>600K</b></div>
            <div className="stat"><span className="muted">本月支出</span><br /><b>44.5K</b></div>
            <div className="stat"><span className="muted">應收款</span><br /><b>600K</b></div>
            <div className="stat"><span className="muted">押標金</span><br /><b>50K</b></div>
          </div>

          <section className="card" style={{ marginTop: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <h2>方案用量監控</h2>
                <p className="muted">進入財務模組時，同步檢查方案狀態、到期日與用量限制。</p>
              </div>
              <div className="badge" style={{ color: '#1f5eff', borderColor: '#dbe3ef', background: '#fff' }}>
                專業版｜剩餘 22 天
              </div>
            </div>

            <div className="grid" style={{ marginTop: '20px' }}>
              {usage.map((item) => (
                <div key={item.label} className="card" style={{ border: item.alert ? '1px solid #f59e0b' : '1px solid #e5eaf2' }}>
                  <div className="muted">{item.label}</div>
                  <div style={{ fontSize: '30px', fontWeight: 900, color: item.alert ? '#f59e0b' : '#1f5eff', marginTop: '8px' }}>
                    {item.used}
                  </div>
                  {item.alert && (
                    <p style={{ color: '#b45309', marginBottom: 0 }}>
                      即將達到方案上限，系統將引導升級。
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ marginTop: '22px' }}>
            <h2>專案收支</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>專案</th>
                  <th>類型</th>
                  <th>分類</th>
                  <th>金額</th>
                  <th>狀態</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.project}</td>
                    <td>{row.type}</td>
                    <td>{row.category}</td>
                    <td>{row.amount}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card" style={{ marginTop: '22px', border: '1px solid #fecaca', background: '#fff7f7' }}>
            <h2 style={{ color: '#b91c1c' }}>SaaS 權限攔截示意</h2>
            <p>
              當組織方案到期、AI 次數超量或 CRM 超出限制時，系統不會出現工程錯誤。
            </p>
            <div style={{ padding: '16px', background: '#fff', borderRadius: '16px', border: '1px solid #fecaca' }}>
              本月活動數已達目前方案上限，請升級方案後繼續建立活動。
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
