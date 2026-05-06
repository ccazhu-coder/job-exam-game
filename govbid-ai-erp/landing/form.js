const WEB_APP_URL = '';

const form = document.getElementById('leadForm');
const statusEl = document.getElementById('formStatus');

function showStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  data.source = 'GovBid AI ERP Landing Page';
  data.createdAt = new Date().toISOString();

  if (!data.name || !data.line || !data.plan || !data.status) {
    showStatus('請先填寫姓名、LINE、方案與目前狀況。', 'error');
    return;
  }

  if (!WEB_APP_URL) {
    const saved = JSON.parse(localStorage.getItem('govbid_leads') || '[]');
    saved.push(data);
    localStorage.setItem('govbid_leads', JSON.stringify(saved));
    form.reset();
    showStatus('已收到你的資料。後端部署前，資料已先暫存在此裝置；正式串接後會自動送進後台。', 'success');
    return;
  }

  try {
    showStatus('送出中，請稍候...', 'info');
    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
    });
    form.reset();
    showStatus('已送出成功，我們會盡快與你聯繫。', 'success');
  } catch (error) {
    console.error(error);
    showStatus('送出失敗，請稍後再試，或改用 LINE / Email 聯繫。', 'error');
  }
});
