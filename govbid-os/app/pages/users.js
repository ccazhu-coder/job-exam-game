(function (window) {
  'use strict';
  window.GovOpsPageCore.register('users', {
    name: 'users',
    title: '使用者 / 權限管理',
    subtitle: '抽取第一版 users.html：租戶使用者列表、邀請使用者、角色調整、停用與變更密碼入口。',
    createLabel: '邀請使用者',
    idField: 'userId',
    api: { list: 'getTenantUsers', create: 'inviteUser', update: 'updateUserRole', archive: 'disableUser', changePassword: 'changePassword' },
    searchPlaceholder: '搜尋姓名、Email、角色、狀態',
    fields: [
      { key: 'displayName', label: '姓名', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'role', label: '角色', type: 'select', options: ['老闆','專案經理','行政人員','會計人員','檢視者'] },
      { key: 'password', label: '初始密碼', type: 'password' },
      { key: 'status', label: '狀態', type: 'select', options: ['啟用','停用'] }
    ],
    columns: [
      { key: 'userId', label: '使用者ID' }, { key: 'displayName', label: '姓名' }, { key: 'email', label: 'Email' },
      { key: 'role', label: '角色' }, { key: 'status', label: '狀態' }
    ]
  });
})(window);
