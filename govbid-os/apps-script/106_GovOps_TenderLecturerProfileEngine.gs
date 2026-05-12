/* GovOps OS｜Tender Lecturer Profile Engine v1
 * 目的：補強講師基本資料，支援專業類型、課程領域、證照、可授課主題與講師媒合。
 */

function handleGovOpsTenderLecturerProfileAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.lecturer.create' || action === '建立講師資料') return GovOpsTenderLecturer_create(data);
    if (action === 'tender.lecturer.query' || action === '查詢講師資料') return GovOpsTenderLecturer_query(data);
    if (action === 'tender.lecturer.update' || action === '更新講師資料') return GovOpsTenderLecturer_update(data);
    if (action === 'tender.lecturer.match' || action === '媒合講師') return GovOpsTenderLecturer_match(data);
    if (action === 'tender.lecturer.options' || action === '查詢講師選單') return GovOpsTenderLecturer_options(data);
    return null;
  } catch (err) {
    GovOpsTenderLecturer_logError('handleGovOpsTenderLecturerProfileAction', err, data);
    return GovOpsTenderLecturer_fail('講師資料功能暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_LECTURER = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderLecturerProfileAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_TENDER_LECTURER(action, data);
  };
}

function GovOpsTenderLecturer_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderLecturer_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderLecturer_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderLecturer_sheetName() { return '80_講師專業資料庫'; }

function GovOpsTenderLecturer_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderLecturer_sheetName(), ['講師ID','tenantId','姓名','專業類型','課程領域','可授課主題','服務對象專長','證照資格','學經歷摘要','授課地區','授課方式','鐘點費/報價','聯絡電話','Email','資源ID','狀態','評價','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderLecturer_create(data) {
  data = data || {};
  GovOpsTenderLecturer_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var name = data.姓名 || data.name || data.講師姓名 || '';
  if (!name) return GovOpsTenderLecturer_fail('請提供講師姓名。');
  var existing = GovOpsTenderLecturer_findExisting(tenantId, name, data.Email || data.email || '', data.聯絡電話 || data.phone || '');
  var row = {
    講師ID: existing && existing.講師ID || 'TL-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    姓名: name,
    專業類型: data.專業類型 || data.professionalType || GovOpsTenderLecturer_guessType(data),
    課程領域: data.課程領域 || data.courseField || '',
    可授課主題: data.可授課主題 || data.topics || '',
    服務對象專長: data.服務對象專長 || data.audience || '',
    證照資格: data.證照資格 || data.certificates || '',
    學經歷摘要: data.學經歷摘要 || data.bio || '',
    授課地區: data.授課地區 || data.area || '',
    授課方式: data.授課方式 || data.teachingMode || '實體/線上皆可',
    '鐘點費/報價': data['鐘點費/報價'] || data.fee || '',
    聯絡電話: data.聯絡電話 || data.phone || '',
    Email: data.Email || data.email || '',
    資源ID: data.資源ID || data.resourceId || '',
    狀態: data.狀態 || '可邀課',
    評價: data.評價 || '',
    建立時間: existing && existing.建立時間 || GovOpsTenderLecturer_now(),
    更新時間: GovOpsTenderLecturer_now(),
    userId: data.userId || '',
    備註: data.備註 || ''
  };
  if (existing && typeof GovOpsProduct_update === 'function') {
    GovOpsProduct_update(GovOpsTenderLecturer_sheetName(), existing._row, row);
  } else if (typeof GovOpsProduct_append === 'function') {
    GovOpsProduct_append(GovOpsTenderLecturer_sheetName(), row);
  }
  GovOpsTenderLecturer_syncResource(row);
  return GovOpsTenderLecturer_success(existing ? '講師資料已更新。' : '講師資料已建立。', row);
}

function GovOpsTenderLecturer_query(data) {
  data = data || {};
  GovOpsTenderLecturer_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || '').trim();
  var type = String(data.專業類型 || data.professionalType || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderLecturer_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (type && String(row.專業類型 || '') !== type) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderLecturer_success('講師資料查詢完成。', { total: rows.length, rows: rows.slice(0, 500), grouped: GovOpsTenderLecturer_group(rows) });
}

function GovOpsTenderLecturer_update(data) {
  data = data || {};
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var id = data.講師ID || data.lecturerId || '';
  var rows = GovOpsProduct_readRows(GovOpsTenderLecturer_sheetName());
  var found = rows.find(function(r){ return String(r.tenantId || '') === String(tenantId) && String(r.講師ID || '') === String(id); });
  if (!found) return GovOpsTenderLecturer_fail('找不到講師資料。');
  var patch = { 更新時間: GovOpsTenderLecturer_now() };
  ['姓名','專業類型','課程領域','可授課主題','服務對象專長','證照資格','學經歷摘要','授課地區','授課方式','鐘點費/報價','聯絡電話','Email','狀態','評價','備註'].forEach(function(k){ if (data[k] !== undefined) patch[k] = data[k]; });
  GovOpsProduct_update(GovOpsTenderLecturer_sheetName(), found._row, patch);
  return GovOpsTenderLecturer_success('講師資料已更新。', Object.assign({}, found, patch));
}

function GovOpsTenderLecturer_match(data) {
  data = data || {};
  var keyword = [data.課程主題, data.活動名稱, data.keyword, data.關鍵字, data.專業類型].filter(Boolean).join(' ');
  var rows = GovOpsTenderLecturer_query(Object.assign({}, data, { keyword: '' })).data.rows || [];
  var scored = rows.map(function(r){
    var text = JSON.stringify(r);
    var score = 0;
    keyword.split(/\s+|、|，|,|\/|-/).filter(Boolean).forEach(function(k){ if (text.indexOf(k) >= 0) score += 10; });
    if (data.專業類型 && String(r.專業類型 || '') === String(data.專業類型)) score += 30;
    if (String(r.狀態 || '') === '可邀課') score += 5;
    return { score: score, lecturer: r };
  }).filter(function(x){ return x.score > 0; }).sort(function(a,b){ return b.score - a.score; });
  return GovOpsTenderLecturer_success('講師媒合完成。', { total: scored.length, matches: scored.slice(0, 20) });
}

function GovOpsTenderLecturer_options(data) {
  var rows = GovOpsTenderLecturer_query(data).data.rows || [];
  var options = rows.map(function(r){ return { value: r.講師ID, label: (r.姓名 || '') + '｜' + (r.專業類型 || '') + '｜' + (r.可授課主題 || ''), lecturerId: r.講師ID, name: r.姓名, professionalType: r.專業類型, raw: r }; });
  return GovOpsTenderLecturer_success('講師選單查詢完成。', { total: options.length, options: options });
}

function GovOpsTenderLecturer_syncResource(row) {
  try {
    if (typeof GovOpsTenderResource_create !== 'function') return;
    GovOpsTenderResource_create({
      tenantId: row.tenantId,
      userId: row.userId,
      資源類別: '講師',
      資源類型: row.專業類型 || '講師',
      名稱: row.姓名,
      聯絡人: row.姓名,
      電話: row.聯絡電話,
      Email: row.Email,
      '專長/服務項目': [row.課程領域, row.可授課主題, row.服務對象專長].filter(Boolean).join('｜'),
      '單價/費率': row['鐘點費/報價'],
      可服務地區: row.授課地區,
      狀態: row.狀態,
      評價: row.評價,
      備註: '由講師專業資料庫同步。'
    });
  } catch (err) {}
}

function GovOpsTenderLecturer_guessType(data) {
  var text = JSON.stringify(data || '');
  if (/職涯|就業|履歷|面試|職場/.test(text)) return '職涯就業類';
  if (/AI|人工智慧|ChatGPT|生成式/.test(text)) return 'AI數位應用類';
  if (/稅務|會計|財務|核銷/.test(text)) return '財務稅務類';
  if (/食品|衛生|餐飲|農糧|米/.test(text)) return '食品農糧類';
  if (/心理|溝通|同理|助人|團督/.test(text)) return '助人專業類';
  if (/創業|行銷|品牌|社群/.test(text)) return '創業行銷類';
  return '其他專業類';
}

function GovOpsTenderLecturer_group(rows) {
  var g = {};
  rows.forEach(function(r){ var k = r.專業類型 || '未分類'; if (!g[k]) g[k] = []; g[k].push(r); });
  return g;
}

function GovOpsTenderLecturer_findExisting(tenantId, name, email, phone) {
  try {
    var rows = GovOpsProduct_readRows(GovOpsTenderLecturer_sheetName());
    return rows.find(function(r){
      if (String(r.tenantId || '') !== String(tenantId)) return false;
      if (email && String(r.Email || '') === String(email)) return true;
      if (phone && String(r.聯絡電話 || '') === String(phone)) return true;
      return String(r.姓名 || '') === String(name);
    }) || null;
  } catch (err) { return null; }
}

function GovOpsTenderLecturer_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderLecturer_Create() { return GovOpsTenderLecturer_create({ tenantId: 'TENANT-DEMO', 姓名: '測試講師', 專業類型: 'AI數位應用類', 可授課主題: 'ChatGPT應用' }); }
