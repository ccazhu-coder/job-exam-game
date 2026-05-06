import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

export default function SettingsPage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="系統設定" />
        <div className="main">
          <section className="card">
            <h2>平台設定</h2>
            <label>公司 / 品牌名稱<input defaultValue="GovBid AI ERP" /></label>
            <label>管理員 Email<input placeholder="admin@example.com" /></label>
            <label>目前方案<select defaultValue="Business"><option>Free</option><option>Pro</option><option>Business</option><option>Enterprise</option></select></label>
            <label>LINE 諮詢 QR Code<input defaultValue="https://qr-official.line.me/gs/M_262guhpb_GW.png?oat_content=qr" /></label>
            <button className="btn btn-blue">儲存設定</button>
          </section>
          <section className="card" style={{ marginTop: '22px' }}>
            <h2>LINE 諮詢</h2>
            <div className="line-box">
              <img src="https://qr-official.line.me/gs/M_262guhpb_GW.png?oat_content=qr" alt="LINE諮詢QR Code" />
              <div>
                <b>官方 LINE 諮詢入口</b>
                <p className="muted">放在登入頁、銷售頁與客戶支援區，導入諮詢與成交。</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
