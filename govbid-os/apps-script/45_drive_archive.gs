/*
GovOps OS｜第45檔：Drive歸檔正式模組
版本：MVP v1.0.0
依賴：37_core.gs、38_activity_workflow.gs
用途：建立活動資料夾、建立基本子資料夾、寫回活動表與文件歸檔紀錄。
*/

function 建立Drive資料夾(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    if (!活動ID) return fail('請先選擇活動。');

    const activity = getActivityById(活動ID);
    if (!activity) return fail('找不到活動資料，請重新選擇。');

    const existed = readRows(SHEETS.文件).find(r => String(r.活動ID) === String(活動ID) && String(r.文件類型) === '活動資料夾');
    if (existed && existed.Drive連結) return success('活動資料夾已存在。', { 活動ID: 活動ID, 連結: existed.Drive連結 });

    const root = getDriveRootFolder();
    const folderName = buildActivityFolderName(activity);
    const activityFolder = root.createFolder(folderName);

    ['01_行政資料','02_報名與簽到','03_講義與教材','04_照片與成果','05_核銷與領據','06_報告與結案'].forEach(name => activityFolder.createFolder(name));

    const url = activityFolder.getUrl();
    appendObject(SHEETS.文件, {
      文件ID: generateId('文件'),
      活動ID: 活動ID,
      文件類型: '活動資料夾',
      文件名稱: folderName,
      Drive連結: url,
      歸檔狀態: '已建立',
      建立時間: now(),
      更新時間: now()
    });

    const row = readRows(SHEETS.活動).find(r => String(r.活動ID) === String(活動ID));
    if (row) updateRow(SHEETS.活動, row._row, { Drive資料夾連結: url, 更新時間: now() });

    writeLog('建立Drive資料夾', SHEETS.文件, 活動ID, folderName, '完成');
    return success('活動資料夾已建立完成。', { 活動ID: 活動ID, 連結: url });
  } catch (err) {
    logError('建立Drive資料夾', err);
    return fail('活動資料夾建立失敗，請確認Google Drive權限。');
  }
}

function 查詢文件歸檔(data) {
  try {
    初始化系統();
    const 活動ID = data.活動ID || '';
    if (!活動ID) return fail('請先選擇活動。');
    const rows = readRows(SHEETS.文件).filter(r => String(r.活動ID) === String(活動ID));
    if (!rows.length) return success('目前尚未建立活動資料夾。', { 結果: [] });
    return success('資料夾連結已取得。', { 結果: rows, 連結: rows[0].Drive連結 });
  } catch (err) {
    logError('查詢文件歸檔', err);
    return fail('文件歸檔查詢失敗。');
  }
}

function getDriveRootFolder() {
  const setting = readSetting('DRIVE_ROOT_FOLDER_ID');
  if (setting) return DriveApp.getFolderById(setting);

  const folders = DriveApp.getFoldersByName('GovOps OS 活動歸檔');
  if (folders.hasNext()) return folders.next();

  const folder = DriveApp.createFolder('GovOps OS 活動歸檔');
  writeSetting('DRIVE_ROOT_FOLDER_ID', folder.getId(), 'GovOps OS 活動歸檔根目錄');
  return folder;
}

function buildActivityFolderName(activity) {
  const date = normalizeDate(activity.活動日期 || '').replace(/\//g, '');
  const name = sanitizeFileName(activity.活動名稱 || '未命名活動');
  return [date, activity.活動ID, name].filter(Boolean).join('_');
}

function sanitizeFileName(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
}

function readSetting(key) {
  const row = readRows(SHEETS.設定).find(r => String(r.設定鍵) === String(key));
  return row ? row.設定值 : '';
}

function writeSetting(key, value, note) {
  const row = readRows(SHEETS.設定).find(r => String(r.設定鍵) === String(key));
  if (row) updateRow(SHEETS.設定, row._row, { 設定值: value, 說明: note || row.說明, 更新時間: now() });
  else appendObject(SHEETS.設定, { 設定鍵: key, 設定值: value, 說明: note || '', 更新時間: now() });
}
