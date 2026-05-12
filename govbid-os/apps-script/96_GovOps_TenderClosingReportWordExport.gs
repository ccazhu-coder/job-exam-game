/* GovOps OS｜Tender Closing Report Word Export v1
 * 目的：將 AI 結案報告草稿轉成 Google Docs，並提供 Word .docx 下載連結。
 * 注意：Apps Script 可建立 Google Docs，透過 export?format=docx 產生 Word 下載。
 */

function handleGovOpsTenderClosingReportWordExportAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.closingReport.wordExport' || action === '匯出結案報告Word') return GovOpsTenderClosingReportWord_export(data);
    if (action === 'tender.closingReport.wordQuery' || action === '查詢結案報告Word') return GovOpsTenderClosingReportWord_query(data);
    return null;
  } catch (err) {
    GovOpsTenderClosingReportWord_logError('handleGovOpsTenderClosingReportWordExportAction', err, data);
    return GovOpsTenderClosingReportWord_fail('結案報告 Word 匯出暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_REPORT_WORD = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderClosingReportWordExportAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_REPORT_WORD(action, data);
  };
}

function GovOpsTenderClosingReportWord_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderClosingReportWord_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderClosingReportWord_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderClosingReportWord_sheetName() { return '68_標案結案報告Word匯出'; }

function GovOpsTenderClosingReportWord_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderClosingReportWord_sheetName(), ['匯出ID','tenantId','報告ID','標案ID','標案名稱','DocID','GoogleDocURL','Word下載URL','匯出狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderClosingReportWord_export(data) {
  data = data || {};
  GovOpsTenderClosingReportWord_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var report = GovOpsTenderClosingReportWord_findReport(tenantId, data.報告ID || data.reportId || '', data.keyword || data.關鍵字 || data.標案ID || '');
  if (!report) {
    if (typeof GovOpsTenderClosingReport_generate === 'function') {
      var gen = GovOpsTenderClosingReport_generate(data);
      if (!gen || !gen.success) return GovOpsTenderClosingReportWord_fail('找不到結案報告草稿，且自動產生失敗。');
      report = gen.data;
    } else {
      return GovOpsTenderClosingReportWord_fail('找不到結案報告草稿。');
    }
  }
  var title = (report.標案名稱 || '標案') + '｜結案報告';
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  body.clear();
  GovOpsTenderClosingReportWord_buildDoc(body, report);
  doc.saveAndClose();
  var file = DriveApp.getFileById(doc.getId());
  if (data.folderId) {
    try {
      var folder = DriveApp.getFolderById(data.folderId);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch (e) {}
  }
  var docUrl = 'https://docs.google.com/document/d/' + doc.getId() + '/edit';
  var wordUrl = 'https://docs.google.com/document/d/' + doc.getId() + '/export?format=docx';
  var row = {
    匯出ID: 'TCW-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    報告ID: report.報告ID || '',
    標案ID: report.標案ID || '',
    標案名稱: report.標案名稱 || '',
    DocID: doc.getId(),
    GoogleDocURL: docUrl,
    Word下載URL: wordUrl,
    匯出狀態: '已匯出',
    建立時間: GovOpsTenderClosingReportWord_now(),
    更新時間: GovOpsTenderClosingReportWord_now(),
    userId: data.userId || '',
    備註: 'Google Docs 可線上編輯；Word下載URL可下載 .docx。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderClosingReportWord_sheetName(), row);
  return GovOpsTenderClosingReportWord_success('結案報告 Word 已匯出。', row);
}

function GovOpsTenderClosingReportWord_query(data) {
  data = data || {};
  GovOpsTenderClosingReportWord_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderClosingReportWord_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderClosingReportWord_success('結案報告 Word 匯出查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderClosingReportWord_buildDoc(body, report) {
  var title = report.標案名稱 || '標案結案報告';
  var h = body.appendParagraph(title + ' 結案報告');
  h.setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('產出時間：' + GovOpsTenderClosingReportWord_now()).setItalic(true);
  body.appendParagraph('報告狀態：' + (report.報告狀態 || '草稿'));
  if (report.缺件提醒) {
    body.appendParagraph('缺件提醒').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(report.缺件提醒);
  }
  body.appendParagraph('正式結案報告內容').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var content = String(report.報告內容 || '').split('\n');
  content.forEach(function(line){
    line = String(line || '').trim();
    if (!line) { body.appendParagraph(''); return; }
    if (/^[一二三四五六七八九十]+、/.test(line)) body.appendParagraph(line).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    else if (/^\d+\./.test(line)) body.appendParagraph(line).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    else if (/^- /.test(line)) body.appendListItem(line.replace(/^- /, '')).setGlyphType(DocumentApp.GlyphType.BULLET);
    else body.appendParagraph(line);
  });
  body.appendParagraph('資料來源摘要').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(report.資料來源摘要 || '無');
  body.appendParagraph('備註').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('本文件由 GovOps OS 依系統資料自動生成，送交機關前請依契約、驗收規定與機關格式進行人工確認。');
}

function GovOpsTenderClosingReportWord_findReport(tenantId, reportId, keyword) {
  try {
    var rows = GovOpsProduct_readRows('67_標案結案報告草稿').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (reportId && String(row.報告ID || '') === String(reportId)) return true;
      if (!keyword) return true;
      return JSON.stringify(row).indexOf(keyword) >= 0;
    });
    return rows[rows.length - 1] || null;
  } catch (err) { return null; }
}

function GovOpsTenderClosingReportWord_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderClosingReportWord_Export() { return GovOpsTenderClosingReportWord_export({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案' }); }
