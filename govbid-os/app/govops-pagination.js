/**
 * GovOps OS — 共用分頁元件 v1.0
 * 用法：
 *   var pg = GovOpsPager.init({ containerId, pageSize, onPage });
 *   pg.setTotal(total);          // 設定總筆數
 *   pg.currentOffset()           // 取得目前 offset 供 API 使用
 *   pg.currentLimit()            // 取得 limit
 */
var GovOpsPager = (function () {
  var instances = {};

  function create(opts) {
    var containerId = opts.containerId;
    var pageSize    = opts.pageSize || 50;
    var onPage      = opts.onPage;   // callback(offset, limit)
    var total       = 0;
    var offset      = 0;

    function totalPages() { return Math.max(1, Math.ceil(total / pageSize)); }
    function currentPage() { return Math.floor(offset / pageSize) + 1; }

    function render() {
      var el = document.getElementById(containerId);
      if (!el) return;
      var pages = totalPages();
      var cp    = currentPage();
      var html  = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0;font-size:13px;color:var(--text-muted,#aaa)">';
      html += '<span style="color:var(--gold,#b8963e);font-weight:600">共 ' + total + ' 筆</span>';
      html += '<span>第 ' + cp + ' / ' + pages + ' 頁</span>';
      html += '<button onclick="GovOpsPager._prev(\'' + containerId + '\')" style="' + btnStyle(cp <= 1) + '">&lsaquo; 上頁</button>';

      var startPage = Math.max(1, cp - 2);
      var endPage   = Math.min(pages, startPage + 4);
      for (var i = startPage; i <= endPage; i++) {
        var active = i === cp;
        html += '<button onclick="GovOpsPager._go(\'' + containerId + '\',' + (i - 1) + ')" style="' + btnStyle(false, active) + '">' + i + '</button>';
      }
      html += '<button onclick="GovOpsPager._next(\'' + containerId + '\')" style="' + btnStyle(cp >= pages) + '">下頁 &rsaquo;</button>';
      html += '<select onchange="GovOpsPager._size(\'' + containerId + '\',this.value)" style="background:var(--bg-card,#0e1e31);color:var(--gold,#b8963e);border:1px solid var(--gold,#b8963e);border-radius:4px;padding:2px 6px;font-size:12px">';
      [25, 50, 100, 200].forEach(function (n) {
        html += '<option value="' + n + '"' + (n === pageSize ? ' selected' : '') + '>' + n + ' 筆/頁</option>';
      });
      html += '</select>';
      html += '</div>';
      el.innerHTML = html;
    }

    function btnStyle(disabled, active) {
      var base = 'border-radius:4px;padding:3px 9px;font-size:12px;cursor:pointer;border:1px solid ';
      if (disabled) return base + 'var(--border,#2a4060);background:transparent;color:var(--text-muted,#555);cursor:default;';
      if (active)   return base + 'var(--gold,#b8963e);background:var(--gold,#b8963e);color:#000;font-weight:600;';
      return base + 'var(--gold,#b8963e);background:transparent;color:var(--gold,#b8963e);';
    }

    var inst = {
      setTotal: function (t) {
        total = t || 0;
        render();
      },
      currentOffset: function () { return offset; },
      currentLimit:  function () { return pageSize; },
      _prev: function () {
        if (offset <= 0) return;
        offset = Math.max(0, offset - pageSize);
        render();
        if (onPage) onPage(offset, pageSize);
      },
      _next: function () {
        if (currentPage() >= totalPages()) return;
        offset += pageSize;
        render();
        if (onPage) onPage(offset, pageSize);
      },
      _go: function (page) {
        offset = page * pageSize;
        render();
        if (onPage) onPage(offset, pageSize);
      },
      _size: function (n) {
        pageSize = parseInt(n, 10) || 50;
        offset   = 0;
        render();
        if (onPage) onPage(offset, pageSize);
      },
      reset: function () { offset = 0; total = 0; render(); }
    };

    instances[containerId] = inst;
    return inst;
  }

  return {
    init:  create,
    _prev: function (id)    { if (instances[id]) instances[id]._prev(); },
    _next: function (id)    { if (instances[id]) instances[id]._next(); },
    _go:   function (id, p) { if (instances[id]) instances[id]._go(p); },
    _size: function (id, n) { if (instances[id]) instances[id]._size(n); }
  };
})();
