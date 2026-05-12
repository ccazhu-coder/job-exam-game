/* GovOps OS｜Tender Closing Report PDF Export v1
 * 目的：將結案報告 Google Docs 匯出為 PDF 下載連結。
 */

function handleGovOpsTenderClosingReportPdfExportAction(action, data) {
  data = data || {};
  try {
    if (action === 'tender.closingReport.pdfExport' || action === '匯出結案報告PDF') return GovOpsTenderClosingReportPdf_export(data);
    if (action === 'tender.closingReport.pdfQuery' || action === '查詢結案報告PDF') return GovOpsTenderClosingReportPdf_query(data);
    return null;
  } catch (err) {
    GovOpsTenderClosingReportPdf_logError('handleGovOpsTenderClosingReportPdfExportAction', err, data);
    return GovOpsTenderClosingReportPdf_fail('結案報告 PDF 匯出暫時無法完成操作。');
  }
}

if (typeof handleAPIGatewayAction === 'function') {
  var GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_REPORT_PDF = handleAPIGatewayAction;
  handleAPIGatewayAction = function(action, data) {
    var handled = handleGovOpsTenderClosingReportPdfExportAction(action, data);
    if (handled) return handled;
    return GOVOPS_PREV_HANDLE_API_GATEWAY_FOR_CLOSING_REPORT_PDF(action, data);
  };
}

function GovOpsTenderClosingReportPdf_success(message, data) { return { success: true, message: message || '操作完成。', data: data || {} }; }
function GovOpsTenderClosingReportPdf_fail(message, data) { return { success: false, message: message || '操作失敗。', data: data || {} }; }
function GovOpsTenderClosingReportPdf_now() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss'); }
function GovOpsTenderClosingReportPdf_sheetName() { return '69_標案結案報告PDF匯出'; }

function GovOpsTenderClosingReportPdf_ensureSheet() {
  if (typeof GovOpsProduct_ensureSheet === 'function') {
    GovOpsProduct_ensureSheet(GovOpsTenderClosingReportPdf_sheetName(), ['匯出ID','tenantId','報告ID','標案ID','標案名稱','來源DocID','PDFFileID','GoogleDocURL','PDF下載URL','PDFDriveURL','匯出狀態','建立時間','更新時間','userId','備註']);
  }
}

function GovOpsTenderClosingReportPdf_export(data) {
  data = data || {};
  GovOpsTenderClosingReportPdf_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var word = GovOpsTenderClosingReportPdf_findWordExport(tenantId, data.報告ID || data.reportId || '', data.keyword || data.關鍵字 || data.標案ID || '');
  if (!word) {
    if (typeof GovOpsTenderClosingReportWord_export === 'function') {
      var w = GovOpsTenderClosingReportWord_export(data);
      if (!w || !w.success) return GovOpsTenderClosingReportPdf_fail('找不到 Word/Google Docs 匯出資料，且自動產生失敗。');
      word = w.data;
    } else {
      return GovOpsTenderClosingReportPdf_fail('找不到 Word/Google Docs 匯出資料。');
    }
  }
  var docId = word.DocID || data.DocID || '';
  if (!docId) return GovOpsTenderClosingReportPdf_fail('缺少 Google Docs DocID。');
  var docFile = DriveApp.getFileById(docId);
  var pdfBlob = docFile.getAs(MimeType.PDF).setName((word.標案名稱 || '標案') + '｜結案報告.pdf');
  var pdfFile;
  if (data.folderId) {
    pdfFile = DriveApp.getFolderById(data.folderId).createFile(pdfBlob);
  } else {
    pdfFile = DriveApp.createFile(pdfBlob);
  }
  var pdfDriveUrl = 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view';
  var pdfDownloadUrl = 'https://drive.google.com/uc?export=download&id=' + pdfFile.getId();
  var row = {
    匯出ID: 'TCPDF-' + Utilities.getUuid().slice(0, 8),
    tenantId: tenantId,
    報告ID: word.報告ID || data.報告ID || '',
    標案ID: word.標案ID || '',
    標案名稱: word.標案名稱 || '',
    來源DocID: docId,
    PDFFileID: pdfFile.getId(),
    GoogleDocURL: word.GoogleDocURL || ('https://docs.google.com/document/d/' + docId + '/edit'),
    PDF下載URL: pdfDownloadUrl,
    PDFDriveURL: pdfDriveUrl,
    匯出狀態: '已匯出',
    建立時間: GovOpsTenderClosingReportPdf_now(),
    更新時間: GovOpsTenderClosingReportPdf_now(),
    userId: data.userId || '',
    備註: 'PDF 由 Google Docs 轉出，送交前仍需人工確認格式與附件。'
  };
  if (typeof GovOpsProduct_append === 'function') GovOpsProduct_append(GovOpsTenderClosingReportPdf_sheetName(), row);
  return GovOpsTenderClosingReportPdf_success('結案報告 PDF 已匯出。', row);
}

function GovOpsTenderClosingReportPdf_query(data) {
  data = data || {};
  GovOpsTenderClosingReportPdf_ensureSheet();
  var tenantId = data.tenantId || 'TENANT-DEMO';
  var keyword = String(data.keyword || data.關鍵字 || data.標案ID || '').trim();
  var rows = typeof GovOpsProduct_readRows === 'function' ? GovOpsProduct_readRows(GovOpsTenderClosingReportPdf_sheetName()) : [];
  rows = rows.filter(function(row){
    if (String(row.tenantId || '') !== String(tenantId)) return false;
    if (!keyword) return true;
    return JSON.stringify(row).indexOf(keyword) >= 0;
  });
  return GovOpsTenderClosingReportPdf_success('結案報告 PDF 匯出查詢完成。', { total: rows.length, rows: rows.slice(0, 100) });
}

function GovOpsTenderClosingReportPdf_findWordExport(tenantId, reportId, keyword) {
  try {
    var rows = GovOpsProduct_readRows('68_標案結案報告Word匯出').filter(function(row){
      if (String(row.tenantId || '') !== String(tenantId)) return false;
      if (reportId && String(row.報告ID || '') === String(reportId)) return true;
      if (!keyword) return true;
      return JSON.stringify(row).indexOf(keyword) >= 0;
    });
    return rows[rows.length - 1] || null;
  } catch (err) { return null; }
}

function GovOpsTenderClosingReportPdf_logError(module, err, data) { try { if (typeof GovOpsProduct_logError === 'function') GovOpsProduct_logError(module, err, data || {}); } catch (e) {} }
function 測試_TenderClosingReportPdf_Export() { return GovOpsTenderClosingReportPdf_export({ tenantId: 'TENANT-DEMO', 標案名稱: '測試標案' }); }
