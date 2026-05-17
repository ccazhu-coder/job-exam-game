(function (window) {
  'use strict';

  const cfg = {
    dashboard: { label: 'AI 指揮中心', sheet: '', page: 'command', api: { list: 'generateAIOSCommandCenterSnapshot' } },
    businessCases: { label: '標案案件', sheet: '標案案件', page: 'projects', api: { list: 'queryRecords', create: 'createRecord', update: 'updateRecord', archive: 'archiveRecord' } },
    requirements: { label: '需求規格', sheet: '需求規格', page: 'wizard', api: { list: 'getProjectSpecDashboardStatus' } },
    venueManagement: { label: '場地管理', sheet: '場地資料', collection: 'venues', idField: '場地ID', api: { list: 'listVenues', get: 'getVenue', create: 'createVenue', update: 'updateVenue', disable: 'disableVenue', enable: 'enableVenue', archive: 'archiveVenue' } },
    changeLogs: { label: '異動紀錄', sheet: '異動同步紀錄', page: 'activities', api: { list: 'queryRecords' } },
    registrations: { label: '報名資料', sheet: '報名資料', page: 'registrations', api: { list: 'queryRecords', import: 'importRegistrationFromSource' } },
    eligibilityReview: { label: '資格審核', sheet: '報名審核紀錄', page: 'registrations', api: { list: 'queryRecords' } },
    admissionList: { label: '錄取名單', sheet: '報名資料', page: 'registrations', api: { list: 'queryRecords', generateDocument: 'generateSigninSheet' } },
    staffRecruitment: { label: '工作人員招募', sheet: '工作人員資料', collection: 'staff', idField: '人員ID', api: { list: 'listStaff', create: 'createStaff', update: 'updateStaff' } },
    staffScheduling: { label: '工作人員排班', sheet: '工作人員排班', page: 'tasks', api: { list: 'queryRecords' } },
    dataImport: { label: '資料匯入', sheet: '匯入紀錄', page: 'batch', api: { import: 'runBatchOperation' } },
    adminDocuments: { label: '行政文件', sheet: '文件索引與版本', page: 'documents', api: { list: 'queryRecords', create: 'createRecord', update: 'updateRecord' } },
    calendar: { label: 'Google Calendar', sheet: 'Google日曆同步紀錄', page: 'activities', api: { syncCalendar: 'syncGoogleCalendar' } },
    tasks: { label: '任務', sheet: '任務管理', collection: 'tasks', idField: '任務ID', api: { list: 'listTasks', create: 'createTask', update: 'updateTask', archive: 'archiveRecord' } },
    finance: { label: '財務', sheet: '財務交易資料', collection: 'finance', idField: '財務ID', api: { list: 'listFinance', create: 'createFinance', update: 'updateRecord', archive: 'archiveRecord' } },
    officialDocuments: { label: '公文資料', sheet: '公文資料', page: 'documents', api: { list: 'queryRecords' } },
    fileManagement: { label: '文件管理', sheet: '文件索引與版本', collection: 'documents', idField: '文件ID', api: { list: 'listDocuments', create: 'createDocument', update: 'updateRecord', archive: 'archiveRecord' } },
    closing: { label: '結案', sheet: '結案資料', page: 'closeout', api: { list: 'getCloseoutDashboardStatus', generateReport: 'generateCloseoutPackage' } },
    finalReport: { label: '結案報告', sheet: '結案報告', page: 'closeout', api: { generateReport: 'generateAICloseoutReport' } },
    teachers: { label: '講師資料', sheet: '講師資料', collection: 'instructors', idField: '講師ID', api: { list: 'listTeachers', get: 'getTeacher', create: 'createTeacher', update: 'updateTeacher', disable: 'disableTeacher', enable: 'enableTeacher', archive: 'archiveTeacher' } },
    vendors: { label: '廠商資料', sheet: '廠商資料', collection: 'vendors', idField: '廠商ID', api: { list: 'listVendors', get: 'getVendor', create: 'createVendor', update: 'updateVendor', disable: 'disableVendor', enable: 'enableVendor', archive: 'archiveVendor' } },
    venues: { label: '場地資料', sheet: '場地資料', collection: 'venues', idField: '場地ID', api: { list: 'listVenues', get: 'getVenue', create: 'createVenue', update: 'updateVenue', disable: 'disableVenue', enable: 'enableVenue', archive: 'archiveVenue' } },
    staff: { label: '工作人員資料', sheet: '工作人員資料', collection: 'staff', idField: '人員ID', api: { list: 'listStaff', get: 'getStaff', create: 'createStaff', update: 'updateStaff', disable: 'disableStaff', enable: 'enableStaff', archive: 'archiveStaff' } },
    agencies: { label: '機關窗口', sheet: '機關窗口', collection: 'agencies', idField: '機關ID', api: { list: 'listAgencies', get: 'getAgency', create: 'createAgency', update: 'updateAgency', disable: 'disableAgency', enable: 'enableAgency', archive: 'archiveAgency' } },
    students: { label: '學員資料', sheet: '學員資料', collection: 'students', idField: '學員ID', api: { list: 'listStudents', get: 'getStudent', create: 'createStudent', update: 'updateStudent', disable: 'disableStudent', enable: 'enableStudent', archive: 'archiveStudent' } },
    equipment: { label: '物資設備', sheet: '物資設備', collection: 'resources', idField: '物資ID', api: { list: 'listEquipment', get: 'getEquipment', create: 'createEquipment', update: 'updateEquipment', disable: 'disableEquipment', enable: 'enableEquipment', archive: 'archiveEquipment' } },
    financeItems: { label: '財務科目', sheet: '財務科目', collection: 'accounts', idField: '科目ID', api: { list: 'listFinanceItems', get: 'getFinanceItem', create: 'createFinanceItem', update: 'updateFinanceItem', disable: 'disableFinanceItem', enable: 'enableFinanceItem', archive: 'archiveFinanceItem' } },
    templates: { label: '文件模板', sheet: '文件模板', collection: 'templates', idField: '模板ID', api: { list: 'listTemplates', get: 'getTemplate', create: 'createTemplate', update: 'updateTemplate', disable: 'disableTemplate', enable: 'enableTemplate', archive: 'archiveTemplate' } },
    systemSettings: { label: '系統設定', sheet: '系統設定總表', page: 'settings', api: { list: 'health', update: 'updateRecord' } }
  };

  window.moduleConfig = cfg;
  window.getModuleConfig = function (module) {
    return cfg[module] || null;
  };
  window.collectionToModule = function (collection) {
    return Object.keys(cfg).find((key) => cfg[key].collection === collection) || collection;
  };
})(window);
