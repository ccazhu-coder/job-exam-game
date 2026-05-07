const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxtozd2ZoYNhn8VHERI2yIjy8Ib4MBPt24_XKXpLrF4-QddzywwwF70ndrbABzrpmY2/exec';

const form = document.getElementById('leadForm');
const statusEl = document.getElementById('formStatus');

function showStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  data.action = 'createLead';
  data.source = 'GovBid AI ERP Landing Page';
  data.createdAt = new Date().toISOString();

  if (!data.name || !data.line || !data.plan || !data.status) {
    showStatus('請先填寫姓名、LINE、方案與目前狀況。', 'error');
    return;
  }

  try {
    showStatus('送出中，請稍候...', 'info');
    await fetch(WEB_APP_URL, {
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
