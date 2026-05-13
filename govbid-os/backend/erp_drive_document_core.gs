/**
 * GovOps OS ERP Drive Document Core
 * 文件與歸檔 ERP：專案資料夾、活動資料夾、成果文件、核銷文件、Drive 連結追蹤。
 * 請與 erp_commercial_core.gs、erp_workflow_engine.gs 一起貼入 Apps Script。
 */

function erpEnsureDriveTables_(){
  ERP_TABLES.project_folders = ERP_TABLES.project_folders || ['folderId','tenantId','projectId','folderName','driveFolderId','driveUrl','status','createdAt','updatedAt'];
  ERP_TABLES.activity_folders = ERP_TABLES.activity_folders || ['folderId','tenantId','projectId','activityId','folderName','driveFolderId','driveUrl','status','createdAt','updatedAt'];
  ERP_TABLES.documents = ERP_TABLES.documents || ['documentId','tenantId','projectId','activityId','documentType','documentName','driveFileId','driveUrl','status','note','createdAt','updatedAt'];
  ERP_TABLES.archive_checklist = ERP_TABLES.archive_checklist || ['checkId','tenantId','projectId','activityId','itemName','itemType','required','status','documentId','note','createdAt','updatedAt'];
  erpEnsureSheet_('project_folders', ERP_TABLES.project_folders);
  erpEnsureSheet_('activity_folders', ERP_TABLES.activity_folders);
  erpEnsureSheet_('documents', ERP_TABLES.documents);
  erpEnsureSheet_('archive_checklist', ERP_TABLES.archive_checklist);
}

function erpDriveGetRootFolder_(){
  const props = PropertiesService.getScriptProperties();
  const rootId = props.getProperty('GOVOPS_ERP_ROOT_FOLDER_ID');
  if (rootId) return DriveApp.getFolderById(rootId);
  const folder = DriveApp.createFolder('GovOps OS ERP Files');
  props.setProperty('GOVOPS_ERP_ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function erpDriveSafeName_(name){
  return String(name || '未命名').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
}

function erpDriveFindOrCreateFolder_(parent, name){
  const safeName = erpDriveSafeName_(name);
  const iter = parent.getFoldersByName(safeName);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(safeName);
}

function erpDriveCreateProjectFolder(params){
  erpEnsureDriveTables_();
  const tenantId = erpTenantId_(params);
  const projectId = params.projectId || params['專案ID'];
  if (!projectId) return erpFail_('請提供專案ID');
  const project = erpReadRows_('projects').find(p => p.tenantId === tenantId && p.projectId === projectId);
  if (!project) return erpFail_('找不到專案');
  const exists = erpReadRows_('project_folders').find(f => f.tenantId === tenantId && f.projectId === projectId && String(f.status) !== 'cancelled');
  if (exists) return erpOk_('專案資料夾已存在', { folderId: exists.folderId, driveUrl: exists.driveUrl, 連結: exists.driveUrl });
  const root = erpDriveGetRootFolder_();
  const folder = erpDriveFindOrCreateFolder_(root, project.projectName + '｜' + project.projectId);
  const obj = erpAppend_('project_folders', {
    folderId: erpUuid_('PF'), tenantId: tenantId, projectId: projectId,
    folderName: folder.getName(), driveFolderId: folder.getId(), driveUrl: folder.getUrl(),
    status: 'active', createdAt: erpNow_(), updatedAt: erpNow_()
  });
  erpAudit_(params, '建立專案資料夾', 'project_folders', obj.folderId, 'success', '');
  return erpOk_('專案資料夾已建立', { folderId: obj.folderId, driveFolderId: folder.getId(), driveUrl: folder.getUrl(), 連結: folder.getUrl() });
}

function erpDriveCreateActivityFolder(params){
  erpEnsureDriveTables_();
  const tenantId = erpTenantId_(params);
  const activityId = params.activityId || params['活動ID'];
  if (!activityId) return erpFail_('請提供活動ID');
  const act = erpReadRows_('activities').find(a => a.tenantId === tenantId && a.activityId === activityId);
  if (!act) return erpFail_('找不到活動');
  const exists = erpReadRows_('activity_folders').find(f => f.tenantId === tenantId && f.activityId === activityId && String(f.status) !== 'cancelled');
  if (exists) return erpOk_('活動資料夾已存在', { folderId: exists.folderId, driveUrl: exists.driveUrl, 連結: exists.driveUrl });
  const projectFolderResult = erpDriveCreateProjectFolder(Object.assign({}, params, { projectId: act.projectId }));
  if (!projectFolderResult.success) return projectFolderResult;
  const pf = erpReadRows_('project_folders').find(f => f.tenantId === tenantId && f.projectId === act.projectId && String(f.status) !== 'cancelled');
  const parent = DriveApp.getFolderById(pf.driveFolderId);
  const folder = erpDriveFindOrCreateFolder_(parent, act.activityDate + '｜' + act.activityName + '｜' + act.activityId);
  ['01_講義','02_報名與簽到','03_照片與紀錄','04_成果報告','05_核銷資料','06_合約與往來'].forEach(n => erpDriveFindOrCreateFolder_(folder, n));
  const obj = erpAppend_('activity_folders', {
    folderId: erpUuid_('AF'), tenantId: tenantId, projectId: act.projectId, activityId: activityId,
    folderName: folder.getName(), driveFolderId: folder.getId(), driveUrl: folder.getUrl(),
    status: 'active', createdAt: erpNow_(), updatedAt: erpNow_()
  });
  erpDriveSeedArchiveChecklist_(params, act);
  erpAudit_(params, '建立活動資料夾', 'activity_folders', obj.folderId, 'success', '');
  return erpOk_('活動資料夾已建立，並已產生歸檔檢查清單', { folderId: obj.folderId, driveFolderId: folder.getId(), driveUrl: folder.getUrl(), 連結: folder.getUrl() });
}

function erpDriveSeedArchiveChecklist_(params, act){
  const tenantId = erpTenantId_(params);
  const existing = erpReadRows_('archive_checklist').filter(x => x.tenantId === tenantId && x.activityId === act.activityId);
  const items = [['講義檔案','講義','yes'],['報名名冊','報名','yes'],['簽到表','核銷','yes'],['活動照片','成果','yes'],['成果報告','成果','yes'],['講師領據','核銷','no'],['餐費發票或收據','核銷','no'],['交通或場地單據','核銷','no']];
  items.forEach(i => {
    if (existing.some(e => e.itemName === i[0])) return;
    erpAppend_('archive_checklist', {
      checkId: erpUuid_('AC'), tenantId: tenantId, projectId: act.projectId, activityId: act.activityId,
      itemName: i[0], itemType: i[1], required: i[2], status: 'pending', documentId: '', note: '',
      createdAt: erpNow_(), updatedAt: erpNow_()
    });
  });
}

function erpDriveRegisterDocument(params){
  erpEnsureDriveTables_();
  const tenantId = erpTenantId_(params);
  const projectId = params.projectId || params['專案ID'] || '';
  const activityId = params.activityId || params['活動ID'] || '';
  const documentName = params.documentName || params['文件名稱'];
  const driveUrl = params.driveUrl || params['文件連結'] || params.url || '';
  if (!documentName) return erpFail_('請提供文件名稱');
  if (!driveUrl) return erpFail_('請提供文件連結');
  const obj = erpAppend_('documents', {
    documentId: erpUuid_('DOC'), tenantId: tenantId, projectId: projectId, activityId: activityId,
    documentType: params.documentType || params['文件類型'] || '一般文件', documentName: documentName,
    driveFileId: params.driveFileId || '', driveUrl: driveUrl, status: 'active',
    note: params.note || params['備註'] || '', createdAt: erpNow_(), updatedAt: erpNow_()
  });
  if (activityId) {
    erpReadRows_('archive_checklist')
      .filter(x => x.tenantId === tenantId && x.activityId === activityId && x.itemName === documentName)
      .forEach(x => erpUpdateRow_('archive_checklist', x._row, { status: 'done', documentId: obj.documentId, updatedAt: erpNow_() }));
  }
  erpAudit_(params, '登錄歸檔文件', 'documents', obj.documentId, 'success', '');
  return erpOk_('文件已登錄', { documentId: obj.documentId, 文件ID: obj.documentId });
}

function erpDriveQueryArchiveChecklist(params){
  erpEnsureDriveTables_();
  const tenantId = erpTenantId_(params);
  const activityId = params.activityId || params['活動ID'];
  const projectId = params.projectId || params['專案ID'];
  let rows = erpReadRows_('archive_checklist').filter(x => x.tenantId === tenantId);
  if (activityId) rows = rows.filter(x => x.activityId === activityId);
  if (projectId) rows = rows.filter(x => x.projectId === projectId);
  return erpOk_('歸檔清單查詢完成', { 歸檔清單: rows, rows: rows });
}

function erpDriveQueryDocuments(params){
  erpEnsureDriveTables_();
  const tenantId = erpTenantId_(params);
  const keyword = String(params.keyword || params.q || '').trim();
  let rows = erpReadRows_('documents').filter(x => x.tenantId === tenantId && String(x.status) !== 'deleted');
  if (keyword) rows = rows.filter(x => JSON.stringify(x).indexOf(keyword) >= 0);
  return erpOk_('文件查詢完成', { 文件: rows, rows: rows });
}

function erpDriveRoute(params){
  const action = String((params && params.action) || '');
  try {
    if (action === '建立專案資料夾') return erpDriveCreateProjectFolder(params);
    if (action === '建立活動資料夾' || action === '建立活動資料夾與歸檔清單') return erpDriveCreateActivityFolder(params);
    if (action === '登錄歸檔文件') return erpDriveRegisterDocument(params);
    if (action === '查詢歸檔清單' || action === '查詢核銷缺件') return erpDriveQueryArchiveChecklist(params);
    if (action === '查詢文件') return erpDriveQueryDocuments(params);
    return null;
  } catch (err) {
    erpAudit_(params, action, 'drive_document', '', 'fail', err.message);
    return erpFail_('ERP 文件歸檔處理失敗：' + err.message);
  }
}

/**
 * 主 router 接法：
 * const driveResult = erpDriveRoute(params);
 * if (driveResult) return jsonOutput(driveResult);
 */
