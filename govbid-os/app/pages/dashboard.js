(function (window) {
  'use strict';

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const num = (value) => Number(value || 0).toLocaleString('zh-TW');

  function kpi(label, value, tone) {
    return `<div class="ckpi ${tone || ''}"><div class="num">${esc(num(value))}</div><div class="label">${esc(label)}</div></div>`;
  }

  function list(title, rows, render) {
    return `<div class="panel">
      <div class="runtime-table-head"><h2 style="margin:0">${esc(title)}</h2></div>
      ${rows && rows.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${rows.map(render).join('')}</tbody></table></div>` : `<div class="empty"><div class="e"></div><div>目前沒有資料。</div></div>`}
    </div>`;
  }

  window.GovOpsPages.dashboard = {
    state: { snapshot: null, error: '' },
    async render(target) {
      target.innerHTML = this.layout();
      this.bindEvents(target);
      await this.loadData(target);
    },
    layout() {
      const s = this.state.snapshot || {};
      const summary = s.summary || {};
      const topFive = s.topFive || [];
      const risks = s.risks || [];
      const missing = s.missingItems || [];
      const activities = s.todayActivities || [];
      const overdue = s.overdueTasks || [];
      return `<div class="panel">
        <div class="runtime-table-head">
          <div>
            <h1 class="gradient" style="margin:0 0 8px">GovOps OS Core v0.1</h1>
            <div class="sub">政府標案全流程營運系統｜SaaS 商業版 MVP</div>
            <div class="sub">從標案、課程、活動、報名、人力、文件、財務、公文到結案報告，一套系統統一管理。</div>
          </div>
          <div class="btns">
            <button data-dashboard-action="refresh">更新 Dashboard</button>
            <button class="secondary" data-dashboard-action="risk">執行 AI 風險掃描</button>
            <button class="secondary" data-dashboard-action="priorities">產生今日優先</button>
          </div>
        </div>
        ${this.state.error ? `<div class="item" style="margin-top:14px;color:#fecaca">資料暫時無法載入：${esc(this.state.error)}</div>` : ''}
        <div class="case-kpis" style="margin-top:14px">
          ${kpi('全部案件', summary.caseCount || summary.projectCount)}
          ${kpi('今日行程', summary.todayActivityCount)}
          ${kpi('逾期事項', summary.overdueTaskCount, 'warn')}
          ${kpi('待審查報名', summary.pendingReviewCount, 'warn')}
          ${kpi('已錄取', summary.admittedCount)}
          ${kpi('人力資料', summary.manpowerCount)}
          ${kpi('行政文件/檔案', summary.documentCount)}
          ${kpi('財務紀錄', summary.financeCount)}
          ${kpi('公文資料', summary.officialDocCount)}
          ${kpi('問卷統計', summary.questionnaireCount)}
          ${kpi('紙本歸檔', summary.paperArchiveCount)}
          ${kpi('待掃描/上傳紙本', summary.paperPendingCount, 'warn')}
          ${kpi('日曆需更新', summary.calendarNeedUpdateCount, 'warn')}
          ${kpi('結案待處理', summary.closingMissingCount, 'warn')}
          ${kpi('缺件文件', summary.missingDocumentCount, 'warn')}
          ${kpi('未完成請款', summary.unpaidClaimCount, 'warn')}
          ${kpi('高風險', summary.highRiskCount, 'warn')}
        </div>
      </div>
      <div class="grid2">
        ${list('今日最重要 5 件事', topFive, (row) => `<tr><td>${esc(row.title || row['事項'] || row.type || JSON.stringify(row))}</td><td>${esc(row.riskLevel || row['風險等級'] || '')}</td></tr>`)}
        ${list('今日活動', activities, (row) => `<tr><td>${esc(row['場次名稱'] || row['活動名稱'] || '')}</td><td>${esc(row['場次日期'] || row['活動日期'] || '')}</td></tr>`)}
        ${list('逾期任務', overdue, (row) => `<tr><td>${esc(row['任務名稱'] || row.title || '')}</td><td>${esc(row['預計完成日'] || '')}</td></tr>`)}
        ${list('高風險案件', risks, (row) => `<tr><td>${esc(row.title || row['風險標題'] || row.projectName || '')}</td><td>${esc(row.level || row['風險等級'] || '')}</td></tr>`)}
        ${list('核銷/結案缺件', missing, (row) => `<tr><td>${esc(row.name || row['結案項目'] || row || '')}</td><td>${esc(row.status || row['狀態'] || '待補')}</td></tr>`)}
        ${list('AI 建議', s.aiAdvice || [], (row) => `<tr><td>${esc(row)}</td></tr>`)}
      </div>`;
    },
    bindEvents(target) {
      target.querySelectorAll('[data-dashboard-action]').forEach((button) => {
        button.addEventListener('click', async () => {
          const action = button.dataset.dashboardAction;
          if (action === 'refresh') return this.loadData(target);
          if (action === 'risk') {
            await window.callApi('runAIOSRiskScan', {});
            window.RuntimeUI.toast('AI 風險掃描已完成', 'success');
            return this.loadData(target);
          }
          if (action === 'priorities') {
            await window.callApi('generateOperationPriorities', {});
            window.RuntimeUI.toast('今日優先已更新', 'success');
            return this.loadData(target);
          }
        });
      });
    },
    async loadData(target) {
      try {
        window.RuntimeUI.loading(true);
        this.state.error = '';
        this.state.snapshot = await window.callApi('generateAIOSCommandCenterSnapshot', {});
      } catch (error) {
        this.state.error = error.message || '資料暫時無法載入';
        this.state.snapshot = { summary: {}, topFive: [], aiAdvice: [] };
      } finally {
        window.RuntimeUI.loading(false);
        if (target) target.innerHTML = this.layout();
        if (target) this.bindEvents(target);
      }
      return this.state.snapshot;
    },
    submitForm() {},
    refreshTable() {},
    search() { return this.loadData(document.getElementById('s-dashboard')); },
    validate() { return true; },
    callApi(action, data) { return window.callApi(action, data || {}); }
  };
})(window);
