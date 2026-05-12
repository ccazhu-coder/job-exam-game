/* GovOps OS｜dashboard-v2 Tender Pipeline Addon */
(function () {
  function el(id) { return document.getElementById(id); }
  function val(id) { return el(id) ? el(id).value.trim() : ''; }
  function set(id, text) { if (el(id)) el(id).textContent = text; }
  function getKeyword() { return val('pipelineKeyword') || val('intelKeyword') || val('tenderKeyword'); }

  async function api(params, targetId) {
    if (typeof callApi === 'function') return callApi(params, targetId || 'pipelineResult');
    if (!window.GovOpsAPI || typeof GovOpsAPI.request !== 'function') throw new Error('GovOpsAPI 尚未載入');
    if (targetId) set(targetId, '處理中...');
    var res = await GovOpsAPI.request(params);
    if (targetId) set(targetId, JSON.stringify(res, null, 2));
    return res;
  }

  window.createTenderPipeline = async function () {
    var key = getKeyword();
    return api({
      action: 'tender.pipeline.create',
      標案ID: key,
      keyword: key,
      標案名稱: val('pipelineTenderName') || key,
      目前階段: val('pipelineStage') || '發現標案',
      下一步行動: val('pipelineNextAction') || '完成標案初步評估',
      下一步期限: val('pipelineNextDue'),
      負責人: val('pipelineOwner')
    }, 'pipelineResult');
  };

  window.queryTenderPipeline = async function () {
    var key = getKeyword();
    var res = await api({ action: 'tender.pipeline.query', keyword: key, 標案ID: key }, 'pipelineResult');
    renderTenderPipelineTable(res);
    return res;
  };

  window.updateTenderPipeline = async function () {
    var key = getKeyword();
    return api({
      action: 'tender.pipeline.update',
      標案ID: key,
      keyword: key,
      目前階段: val('pipelineStage'),
      下一步行動: val('pipelineNextAction'),
      下一步期限: val('pipelineNextDue'),
      負責人: val('pipelineOwner')
    }, 'pipelineResult');
  };

  window.nextTenderPipeline = async function () {
    var key = getKeyword();
    return api({ action: 'tender.pipeline.next', 標案ID: key, keyword: key }, 'pipelineResult');
  };

  window.renderTenderPipelineTable = function (resp) {
    var box = el('tableResult');
    if (!box || !resp || !resp.success || !resp.data || !Array.isArray(resp.data.rows)) return;
    var rows = resp.data.rows.slice(0, 30);
    if (!rows.length) {
      box.innerHTML = '<div class="hint">查無標案流程資料。</div>';
      return;
    }
    var keys = ['標案ID', '標案名稱', '目前階段', '流程狀態', '下一步行動', '下一步期限', '完成率'];
    box.innerHTML = '<table><thead><tr>' + keys.map(function (k) { return '<th>' + k + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + keys.map(function (k) { return '<td>' + (r[k] || '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  };
})();
