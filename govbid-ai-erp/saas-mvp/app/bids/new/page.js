import Sidebar from '../../../components/Sidebar';
import Topbar from '../../../components/Topbar';

export default function NewBidPage() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Topbar title="新增標案" />
        <div className="main">
          <section className="card">
            <h2>建立標案資料</h2>
            <label>標案名稱<input placeholder="請輸入標案名稱" /></label>
            <label>機關名稱<input placeholder="請輸入機關名稱" /></label>
            <label>預算金額<input type="number" placeholder="請輸入預算" /></label>
            <label>截止日期<input type="date" /></label>
            <label>投標狀態<select><option>評估中</option><option>備標中</option><option>已投標</option><option>已得標</option><option>未得標</option><option>放棄</option></select></label>
            <label>決策結果<select><option>必投</option><option>可投</option><option>觀察</option><option>放棄</option></select></label>
            <button className="btn btn-blue">儲存標案</button>
          </section>
        </div>
      </main>
    </div>
  );
}
