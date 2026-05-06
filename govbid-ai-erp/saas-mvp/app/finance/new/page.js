import Sidebar from '../../../components/Sidebar';
import Topbar from '../../../components/Topbar';

export default function NewFinancePage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="新增財務紀錄" />
        <div className="main">
          <section className="card">
            <h2>建立收支資料</h2>
            <label>專案名稱<input placeholder="請輸入專案或標案名稱" /></label>
            <label>類型<select><option>收入</option><option>支出</option><option>應收款</option><option>應付款</option><option>押標金</option></select></label>
            <label>分類<input placeholder="例如：講師費、場地費、分期款、交通費" /></label>
            <label>金額<input type="number" placeholder="請輸入金額" /></label>
            <label>支付方式<select><option>匯款</option><option>現金</option><option>LINE Pay</option><option>信用卡</option><option>其他</option></select></label>
            <label>狀態<select><option>未處理</option><option>應收</option><option>待付款</option><option>已收款</option><option>已付款</option><option>待退還</option></select></label>
            <button className="btn btn-blue">儲存財務紀錄</button>
          </section>
        </div>
      </main>
    </div>
  );
}
