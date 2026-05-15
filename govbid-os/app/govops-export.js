/**
 * GovOps OS — 共用 CSV 匯出模組 v1.0
 * 用法：
 *   GovOpsExport.csv(rows, '案件清單');
 *   GovOpsExport.addBtn(containerId, fetchFn, fileName);
 *     fetchFn: async function() → rows[]
 */
var GovOpsExport = (function () {

  function toCSV(rows) {
    if (!rows || !rows.length) return '';
    // 取所有欄位（排除 _row）
    var keys = Object.keys(rows[0]).filter(function (k) { return k !== '_row'; });
    var lines = [keys.map(quoteCell).join(',')];
    rows.forEach(function (r) {
      lines.push(keys.map(function (k) { return quoteCell(r[k]); }).join(','));
    });
    return '﻿' + lines.join('\r\n'); // BOM for Excel UTF-8
  }

  function quoteCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function download(csv, fileName) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName + '_' + new Date().toISOString().substring(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  }

  function csv(rows, fileName) {
    if (!rows || !rows.length) { alert('無資料可匯出'); return; }
    download(toCSV(rows), fileName);
  }

  // 在指定容器插入「下載 CSV」按鈕
  function addBtn(containerId, fetchFn, fileName) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var btn = document.createElement('button');
    btn.className = 'secondary';
    btn.textContent = '⬇ 匯出 CSV';
    btn.title = '下載全部符合條件的資料（忽略分頁）';
    btn.style.cssText = 'font-size:.8rem;padding:5px 12px';
    btn.onclick = async function () {
      btn.textContent = '匯出中…'; btn.disabled = true;
      try {
        var rows = await fetchFn();
        csv(rows, fileName);
      } catch (e) {
        alert('匯出失敗：' + e.message);
      }
      btn.textContent = '⬇ 匯出 CSV'; btn.disabled = false;
    };
    container.appendChild(btn);
  }

  return { csv: csv, toCSV: toCSV, download: download, addBtn: addBtn };
})();
