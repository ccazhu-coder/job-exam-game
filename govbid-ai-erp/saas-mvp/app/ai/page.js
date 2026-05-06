import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

export default function AiPage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="AI 提案生成器" />
        <div className="main">
          <section className="card">
            <h2>標案需求輸入</h2>
            <p className="muted">輸入標案資訊後，系統將產出服務建議書架構、簡報答詢與報價策略。</p>
            <label>標案名稱<input placeholder="請輸入標案名稱" /></label>
            <label>機關名稱<input placeholder="請輸入機關名稱" /></label>
            <label>工作說明書重點<textarea rows="5" placeholder="貼上工作說明書、評審須知或需求摘要"></textarea></label>
            <button className="btn btn-blue">產生 AI 提案架構</button>
          </section>
          <section className="card" style={{ marginTop: '22px' }}>
            <h2>AI 產出預覽</h2>
            <table className="table">
              <tbody>
                <tr><th>服務建議書</th><td>計畫背景、需求分析、執行策略、KPI、創新加值、風險控管</td></tr>
                <tr><th>簡報答詢</th><td>評審可能問題、建議回答、追問風險、防守策略</td></tr>
                <tr><th>報價策略</th><td>成本項目、利潤率、壓價風險、最終報價建議</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
