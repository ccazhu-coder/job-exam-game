import Sidebar from '../../../components/Sidebar';
import Topbar from '../../../components/Topbar';

export default function NewCrmPage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="新增 CRM 名單" />
        <div className="main">
          <section className="card">
            <h2>建立客戶名單</h2>
            <label>姓名 / 單位<input placeholder="請輸入姓名或單位名稱" /></label>
            <label>LINE<input placeholder="請輸入 LINE ID 或官方帳號" /></label>
            <label>Email<input type="email" placeholder="you@example.com" /></label>
            <label>方案<select><option>首批內測版</option><option>完整商用版</option><option>顧問導入版</option><option>先了解</option></select></label>
            <label>客戶分級<select><option>A級｜熱客戶</option><option>B級｜溫客戶</option><option>C級｜培養名單</option></select></label>
            <label>需求內容<textarea rows="5" placeholder="請輸入客戶需求、痛點與備註"></textarea></label>
            <button className="btn btn-blue">儲存名單</button>
          </section>
        </div>
      </main>
    </div>
  );
}
