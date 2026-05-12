/* GovOps OS｜Unified Search + Dashboard Runtime + Health Center v1
 * 正式上線商品版：全域搜尋、儀表板 Runtime、Runtime Health Center。
 */

function handleGovOpsUnifiedRuntimeAction(action, data) {
  data = data || {};
  try {
    if (action === 'search.unified.query' || action === '全域搜尋') return GovOpsUnifiedSearch_query(data);
    if (action === 'dashboard.runtime.summary' || action === '營運儀表板總覽') return GovOpsDashboardRuntime_summary(data);
    if (action === 'runtime.health.full' || action === '全模組健康檢查') return GovOpsRuntimeHealth_full(data);
    if (action === 'runtime.health.module' || action === '單一模組健康檢查') return GovOpsRuntimeHealth_module(data);
    return null;
  } catch (err) {
    if (typeof GovOpsSaaS_Audit_write === 'function') GovOpsSaaS_Audit_write('UNIFIED_RUNTIME_ERROR', action, data, 'fail', String(err));
    return { success: false, message: '中控 Runtime 暫時無法完成操作。', data: { error: String(err) } };
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_UNIFIED_RUNTIME = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsUnifiedRuntimeAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_UNIFIED_RUNTIME(action, data);
  };
}

function GovOpsUnifiedSearch_query(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.q || '').trim();
  if (!keyword) return { success: false, message: '請輸入搜尋關鍵字。', data: {} };
  var sources = [
    { name:'標案/活動場次', sheet:'74_履約活動場次', keys:['場次ID','標案ID','標案名稱','活動名稱','活動日期','地點'] },
    { name:'招生設定', sheet:'85_招生設定', keys:['招生ID','標案ID','場次ID','活動名稱','招生對象','招生狀態'] },
    { name:'報名資料', sheet:'86_報名資料', keys:['報名ID','姓名','電話','Email','錄取狀態','通知狀態'] },
    { name:'學員名冊', sheet:'88_學員名冊', keys:['名冊ID','姓名','電話','Email','活動名稱','出席狀態'] },
    { name:'學員資料庫', sheet:'96_學員資料庫', keys:['學員ID','姓名','電話','Email','累計報名次數','CRM狀態'] },
    { name:'履約任務', sheet:'90_履約工作任務', keys:['任務ID','任務名稱','任務階段','負責人姓名','任務狀態'] },
    { name:'檔案中心', sheet:'96_檔案中心', keys:['檔案ID','檔案類別','標準檔名','DriveURL','是否納入結案'] },
    { name:'Email通知', sheet:'103_Email通知佇列', keys:['Email通知ID','姓名','Email','通知類型','通知狀態'] }
  ];
  var results = [];
  sources.forEach(function(src){
    try {
      var rows = GovOpsProduct_readRows(src.sheet).filter(function(r){
        if (r.tenantId && String(r.tenantId) !== String(tenantId)) return false;
        return JSON.stringify(r).indexOf(keyword) >= 0;
      }).slice(0, 50).map(function(r){
        var item = { source: src.name, sheet: src.sheet };
        src.keys.forEach(function(k){ item[k] = r[k] || ''; });
        item.raw = r;
        return item;
      });
      results = results.concat(rows);
    } catch(e) {}
  });
  return { success:true, message:'全域搜尋完成。', data:{ keyword:keyword,total:results.length,results:results.slice(0,200) } };
}

function GovOpsDashboardRuntime_summary(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  function count(sheet, filter) { try { return GovOpsProduct_readRows(sheet).filter(function(r){ if(r.tenantId && String(r.tenantId)!==String(tenantId)) return false; return filter ? filter(r) : true; }).length; } catch(e){ return 0; } }
  var out = {
    tenders: count('04_標案池'),
    events: count('74_履約活動場次'),
    registrationSettings: count('85_招生設定'),
    registrations: count('86_報名資料'),
    pendingReview: count('86_報名資料', function(r){ return String(r.錄取狀態||'').indexOf('待')>=0; }),
    accepted: count('86_報名資料', function(r){ return String(r.錄取狀態||'')==='已錄取'; }),
    roster: count('88_學員名冊'),
    participants: count('96_學員資料庫'),
    tasks: count('90_履約工作任務'),
    openTasks: count('90_履約工作任務', function(r){ return ['待指派','待處理','執行中','逾期'].indexOf(String(r.任務狀態||''))>=0; }),
    files: count('96_檔案中心'),
    emailQueued: count('103_Email通知佇列', function(r){ return String(r.通知狀態||'')==='queued'; }),
    emailSent: count('103_Email通知佇列', function(r){ return String(r.通知狀態||'')==='已發送'; })
  };
  return { success:true, message:'營運儀表板總覽完成。', data:out };
}

function GovOpsRuntimeHealth_full(data) {
  data = data || {};
  var modules = [
    ['SaaS Operations','90_SaaS租戶主檔'],['File Center','96_檔案中心'],['Queue Persistence','98_持久化佇列'],['Resource Type','84_資源類型主檔'],['Resource Master','81_正式講師基本資料'],['Registration','86_報名資料'],['Online Registration','94_線上報名連結'],['Participant Master','96_學員資料庫'],['Task Assignment','90_履約工作任務'],['Notification Hub','100_通知中心佇列'],['Email Dispatcher','103_Email通知佇列'],['Class Reminder','105_課前提醒紀錄']
  ];
  var checks = modules.map(function(m){ return GovOpsRuntimeHealth_checkSheet(m[0], m[1]); });
  var ok = checks.filter(function(x){return x.status==='OK'}).length;
  var warn = checks.filter(function(x){return x.status!=='OK'}).length;
  return { success:true, message:'全模組健康檢查完成。', data:{ ok:ok,warn:warn,total:checks.length,checks:checks } };
}

function GovOpsRuntimeHealth_module(data) {
  return GovOpsRuntimeHealth_checkSheet(data.moduleName || data.模組名稱 || '指定模組', data.sheetName || data.資料表名稱 || '');
}

function GovOpsRuntimeHealth_checkSheet(name, sheet) {
  try {
    var rows = GovOpsProduct_readRows(sheet);
    return { module:name, sheet:sheet, status:'OK', rows:rows.length, message:'資料表可讀取' };
  } catch(e) {
    return { module:name, sheet:sheet, status:'WARN', rows:0, message:'資料表尚未建立或不可讀取：'+String(e).slice(0,120) };
  }
}
