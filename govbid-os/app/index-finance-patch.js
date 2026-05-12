/* GovOps OS｜index.html 財務會計補丁
 * 用法：在 index.html </body> 前引入：
 * <script src="./index-finance-patch.js"></script>
 */
(function(){
  function $(id){return document.getElementById(id)}
  function safe(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})}
  function sectionHtml(){return `
<section id="finance" class="card span12">
  <h2>財務會計中心</h2>
  <div class="hint">不需要懂會計。輸入收入、支出、未收款或未付款，系統會自動判斷專案、會計科目、憑證與報稅分類。</div>
  <div class="row">
    <div><label>系統活動編號 / 專案ID</label><input id="finActivityId" placeholder="可填活動ID或專案ID，空白時系統會依描述判斷"></div>
    <div><label>交易類型</label><select id="finType"><option>收入</option><option>支出</option><option>應收</option><option>應付</option><option>待判斷</option></select></div>
  </div>
  <div class="row">
    <div><label>金額</label><input id="finAmount" type="number" min="0"></div>
    <div><label>交易日期</label><input id="finDate" type="date"></div>
  </div>
  <div class="row">
    <div><label>付款 / 收款方式</label><select id="finMethod"><option>銀行存款</option><option>現金</option><option>LINE Pay</option><option>其他</option></select></div>
    <div><label>對象</label><input id="finTarget" placeholder="機關、學員、講師、廠商"></div>
  </div>
  <label>人話描述</label><textarea id="finDescription" placeholder="例：收到彰化縣政府款項120000元；支付講師費6000元；便當店餐費4500元還沒付"></textarea>
  <label>憑證 / 收據 / 發票 URL</label><input id="finVoucherUrl" placeholder="貼上 Drive 檔案或憑證連結">
  <div class="btns">
    <button onclick="financeAutoDetectProject()">自動找活動/專案</button>
    <button onclick="financeAutoClassify()">自動判斷會計</button>
    <button class="green" onclick="financeAutoPost()">自動入帳</button>
    <button class="secondary" onclick="financeProjectPL()">專案損益</button>
    <button class="secondary" onclick="financeSummary()">財務摘要</button>
  </div>
  <h2 style="margin-top:18px">月報 / 季報 / 年報 / 所得稅</h2>
  <div class="row">
    <div><label>月份</label><input id="finMonth" type="month"></div>
    <div><label>年度</label><input id="finYear" type="number"></div>
  </div>
  <label>季度</label><select id="finQuarter"><option>1</option><option>2</option><option>3</option><option>4</option></select>
  <div class="btns">
    <button onclick="financeMonthlyReport()">產生月報</button>
    <button onclick="financeQuarterlyReport()">產生季報</button>
    <button onclick="financeYearlyReport()">產生年報</button>
    <button class="green" onclick="financeIncomeTax()">所得稅申報資料</button>
    <button class="secondary" onclick="financeVoucherList()">缺憑證檢查</button>
  </div>
  <h2 style="margin-top:18px">專案對應</h2>
  <div class="btns">
    <button onclick="financeLinkSummary()">財務對應摘要</button>
    <button onclick="financeUnmatchedList()">待對應清單</button>
    <button class="secondary" onclick="financeRepairLinks()">重新比對待對應</button>
  </div>
  <div id="financeMsg" class="msg">尚未操作。</div>
  <div id="financeTable"></div>
</section>`}
  function init(){
    var grid=document.querySelector('main .grid');
    if(grid && !$('finance')) grid.insertAdjacentHTML('beforeend', sectionHtml());
    var topnav=document.querySelector('.topnav');
    if(topnav && !document.querySelector('.topnav a[href="#finance"]')) topnav.insertAdjacentHTML('beforeend','<a href="#finance">財務</a>');
    var footer=document.querySelector('.footerbar');
    if(footer && !document.querySelector('.footerbar a[href="#finance"]')) footer.insertAdjacentHTML('beforeend','<a href="#finance">財務</a>');
    if($('finYear')) $('finYear').value=new Date().getFullYear();
    if($('finMonth')) $('finMonth').value=new Date().toISOString().slice(0,7);
  }
  function params(extra){
    var p={
      activityId: $('finActivityId')?$('finActivityId').value:'',
      活動ID: $('finActivityId')?$('finActivityId').value:'',
      專案ID: $('finActivityId')?$('finActivityId').value:'',
      projectId: $('finActivityId')?$('finActivityId').value:'',
      交易類型: $('finType')?$('finType').value:'',
      transactionType: $('finType')?$('finType').value:'',
      金額: $('finAmount')?$('finAmount').value:'',
      amount: $('finAmount')?$('finAmount').value:'',
      日期: $('finDate')?$('finDate').value:'',
      date: $('finDate')?$('finDate').value:'',
      付款方式: $('finMethod')?$('finMethod').value:'',
      收款方式: $('finMethod')?$('finMethod').value:'',
      對象: $('finTarget')?$('finTarget').value:'',
      description: $('finDescription')?$('finDescription').value:'',
      描述: $('finDescription')?$('finDescription').value:'',
      項目: $('finDescription')?$('finDescription').value:'',
      keyword: $('finDescription')?$('finDescription').value:'',
      憑證URL: $('finVoucherUrl')?$('finVoucherUrl').value:'',
      receiptUrl: $('finVoucherUrl')?$('finVoucherUrl').value:''
    };
    return Object.assign(p, extra||{});
  }
  async function call(action, extra){
    if(typeof api!=='function'){ $('financeMsg').textContent='找不到後端 API 函式，請確認 index.html 原始程式已載入。'; return {success:false}; }
    return await api(Object.assign({action:action}, params(extra)), 'financeMsg');
  }
  function table(rows){
    rows=rows||[];
    if(!rows.length) return '<div class="msg">無資料</div>';
    var keys=Object.keys(rows[0]).filter(function(k){return k!=='_row' && k!=='raw'}).slice(0,8);
    return '<table><thead><tr>'+keys.map(function(k){return '<th>'+safe(k)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.slice(0,80).map(function(r){return '<tr>'+keys.map(function(k){var v=r[k]; if(typeof v==='object') v=JSON.stringify(v); return '<td>'+safe(v)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>';
  }
  window.financeAutoDetectProject=async function(){
    var r=await call('project.finance.link.detectProject');
    if(r&&r.success&&r.data&&r.data.matched&&r.data.project&&r.data.project.專案ID){ $('finActivityId').value=r.data.project.專案ID; }
  };
  window.financeAutoClassify=function(){return call('project.accounting.autoClassify')};
  window.financeAutoPost=async function(){
    await window.financeAutoDetectProject();
    var t=$('finType').value;
    var action=t==='支出'?'project.accounting.autoPostExpense':t==='應收'?'project.accounting.autoPostReceivable':t==='應付'?'project.accounting.autoPostPayable':'project.accounting.autoPostIncome';
    return call(action);
  };
  window.financeProjectPL=function(){return call('project.accounting.projectPL')};
  window.financeSummary=function(){return call('project.finance.summary')};
  window.financeMonthlyReport=function(){return call('project.report.monthly',{month:$('finMonth').value})};
  window.financeQuarterlyReport=function(){return call('project.report.quarterly',{year:$('finYear').value,quarter:$('finQuarter').value})};
  window.financeYearlyReport=function(){return call('project.report.yearly',{year:$('finYear').value})};
  window.financeIncomeTax=function(){return call('project.report.incomeTax',{year:$('finYear').value})};
  window.financeVoucherList=async function(){
    var r=await call('project.report.voucherList',{year:$('finYear').value});
    if(r&&r.success&&r.data){ $('financeTable').innerHTML='<h3>缺憑證</h3>'+table(r.data.缺憑證||[])+'<h3>已有憑證</h3>'+table(r.data.憑證||[]); }
  };
  window.financeLinkSummary=function(){return call('project.finance.link.summary')};
  window.financeUnmatchedList=async function(){
    var r=await call('project.finance.link.unmatchedList');
    if(r&&r.success&&r.data) $('financeTable').innerHTML=table(r.data.rows||[]);
  };
  window.financeRepairLinks=async function(){ await call('project.finance.link.repair'); return window.financeUnmatchedList(); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
