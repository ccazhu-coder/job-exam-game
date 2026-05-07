const 狀態文字 = document.getElementById('statusText');
const 後端網址欄位 = document.getElementById('apiUrl');
const 儲存後端網址按鈕 = document.getElementById('saveApiUrl');
const 更新儀表板按鈕 = document.getElementById('refreshOverview');
const 查詢結果 = document.getElementById('queryResult');

const 本機資料鍵 = '政府標案營運作業系統_暫存資料';
const 後端網址鍵 = '政府標案營運作業系統_後端網址';

const 本機資料 = 讀取本機資料();

初始化頁籤();
初始化表單();
初始化查詢中心();
初始化系統設定();
更新營運首頁();

function 初始化頁籤() {
  document.querySelectorAll('.tab').forEach((按鈕) => {
    按鈕.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
      按鈕.classList.add('active');
      document.getElementById(按鈕.dataset.tab).classList.add('active');
    });
  });
}

function 初始化表單() {
  document.querySelectorAll('form[data-action]').forEach((表單) => {
    表單.addEventListener('submit', async (event) => {
      event.preventDefault();
      const 動作 = 表單.dataset.action;
      const 資料 = 表單轉資料(表單);
      資料.動作 = 動作;
      資料.建立時間 = new Date().toISOString();

      try {
        顯示狀態('正在送出資料...');
        const 結果 = await 呼叫後端(動作, 資料);
        if (結果 && 結果.ok) {
          顯示狀態('已成功寫入後端。');
          表單.reset();
        } else {
          儲存暫存資料(動作, 資料);
          顯示狀態('後端尚未串接或送出失敗，已先暫存在前端。', true);
        }
      } catch (錯誤) {
        儲存暫存資料(動作, 資料);
        顯示狀態('後端尚未串接，資料已先暫存在前端。', true);
      }

      更新營運首頁();
    });
  });
}

function 初始化查詢中心() {
  document.querySelectorAll('[data-query]').forEach((按鈕) => {
    按鈕.addEventListener('click', async () => {
      const 指令 = 按鈕.dataset.query;
      查詢結果.textContent = '查詢中...';
      try {
        const 結果 = await 呼叫後端('查詢', { 指令 });
        if (結果 && 結果.ok && 結果.message) {
          查詢結果.textContent = 結果.message;
          return;
        }
      } catch (錯誤) {}
      查詢結果.textContent = 本機查詢(指令);
    });
  });
}

function 初始化系統設定() {
  const 已存網址 = localStorage.getItem(後端網址鍵) || '';
  後端網址欄位.value = 已存網址;

  儲存後端網址按鈕.addEventListener('click', () => {
    const 網址 = 後端網址欄位.value.trim();
    localStorage.setItem(後端網址鍵, 網址);
    顯示狀態(網址 ? '後端網址已儲存。' : '後端網址已清空。');
  });

  更新儀表板按鈕.addEventListener('click', 更新營運首頁);
}

async function 呼叫後端(動作, 資料) {
  const 後端網址 = localStorage.getItem(後端網址鍵) || '';
  if (!後端網址) throw new Error('尚未設定後端網址');

  const 回應 = await fetch(後端網址, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ 動作, 資料 }),
  });

  return await 回應.json();
}

function 表單轉資料(表單) {
  const formData = new FormData(表單);
  const 資料 = {};
  formData.forEach((value, key) => {
    資料[key] = String(value || '').trim();
  });
  return 資料;
}

function 儲存暫存資料(分類, 資料) {
  if (!本機資料[分類]) 本機資料[分類] = [];
  本機資料[分類].push({ ...資料, 暫存時間: new Date().toISOString() });
  localStorage.setItem(本機資料鍵, JSON.stringify(本機資料));
}

function 讀取本機資料() {
  try {
    return JSON.parse(localStorage.getItem(本機資料鍵) || '{}');
  } catch (錯誤) {
    return {};
  }
}

function 更新營運首頁() {
  const 標案數 = (本機資料['新增標案'] || []).length;
  const 專案數 = (本機資料['建立投標專案'] || []).length;
  const 場次數 = (本機資料['建立任務場次'] || []).length;
  const 財務數 = (本機資料['建立財務收支'] || []).length;

  const cards = document.querySelectorAll('#overviewCards .card strong');
  if (cards[0]) cards[0].textContent = 標案數;
  if (cards[1]) cards[1].textContent = 專案數;
  if (cards[2]) cards[2].textContent = 場次數;
  if (cards[3]) cards[3].textContent = 財務數;
}

function 本機查詢(指令) {
  if (指令 === '今日任務') return 查今日任務();
  if (指令 === '本週標案') return 查本週標案();
  if (指令 === '未收款') return 查未收款();
  if (指令 === '投標截止') return 查投標截止();
  if (指令 === '履約待辦') return 查履約待辦();
  return '目前查無資料。';
}

function 查今日任務() {
  const 今天 = 今天字串();
  const 任務 = (本機資料['建立任務場次'] || []).filter((x) => x.執行日期 === 今天 || x.任務狀態 !== '已完成');
  if (!任務.length) return '今日目前沒有待辦任務。';
  return '今日任務：\n' + 任務.map((x, i) => `${i + 1}. ${x.任務名稱 || '未命名任務'}｜${x.所屬標案 || '未填標案'}｜${x.任務狀態 || '未填狀態'}`).join('\n');
}

function 查本週標案() {
  const 標案 = (本機資料['新增標案'] || []).filter((x) => 是否七天內(x.投標截止日));
  if (!標案.length) return '本週目前沒有即將截止的標案。';
  return '本週標案：\n' + 標案.map((x, i) => `${i + 1}. ${x.標案名稱 || '未命名標案'}｜截止日：${x.投標截止日 || '未填'}｜${x.案件狀態 || '未填狀態'}`).join('\n');
}

function 查未收款() {
  const 款項 = (本機資料['建立財務收支'] || []).filter((x) => x.收支類型 === '應收款' || x.狀態 === '未收');
  if (!款項.length) return '目前沒有未收款暫存紀錄。';
  const 總額 = 款項.reduce((sum, x) => sum + Number(x.金額 || 0), 0);
  return `未收款合計：NT$${總額}\n` + 款項.map((x, i) => `${i + 1}. ${x.款項名稱 || '未命名款項'}｜${x.所屬標案 || '未填標案'}｜NT$${x.金額 || 0}`).join('\n');
}

function 查投標截止() {
  const 標案 = (本機資料['新增標案'] || []).filter((x) => x.投標截止日).sort((a, b) => String(a.投標截止日).localeCompare(String(b.投標截止日)));
  if (!標案.length) return '目前沒有投標截止資料。';
  return '投標截止：\n' + 標案.slice(0, 10).map((x, i) => `${i + 1}. ${x.標案名稱 || '未命名標案'}｜${x.投標截止日}`).join('\n');
}

function 查履約待辦() {
  const 任務 = (本機資料['建立任務場次'] || []).filter((x) => x.任務狀態 !== '已完成');
  if (!任務.length) return '目前沒有履約待辦暫存紀錄。';
  return '履約待辦：\n' + 任務.map((x, i) => `${i + 1}. ${x.任務名稱 || '未命名任務'}｜${x.任務類型 || '未填類型'}｜${x.任務狀態 || '未填狀態'}`).join('\n');
}

function 今天字串() {
  return new Date().toISOString().slice(0, 10);
}

function 是否七天內(dateString) {
  if (!dateString) return false;
  const today = new Date(今天字串());
  const target = new Date(dateString);
  const diff = (target - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

function 顯示狀態(文字, 是錯誤 = false) {
  狀態文字.textContent = 文字;
  狀態文字.classList.toggle('error', 是錯誤);
}
