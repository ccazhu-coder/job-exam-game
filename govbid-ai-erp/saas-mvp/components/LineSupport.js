import { LINE_QR_URL } from '../lib/constants';

export default function LineSupport() {
  return (
    <div className="line-box">
      <img src={LINE_QR_URL} alt="LINE 諮詢 QR Code" />
      <div>
        <b>LINE 諮詢</b>
        <p className="muted">掃描 QR Code 進行方案諮詢、導入評估與客服支援。</p>
      </div>
    </div>
  );
}
