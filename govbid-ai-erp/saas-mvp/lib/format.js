export function formatCurrency(value = 0) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-TW').format(new Date(value));
}

export function getStatusBadge(status = '') {
  if (String(status).includes('必投') || String(status).includes('成交') || String(status).includes('已付款')) return 'success';
  if (String(status).includes('可投') || String(status).includes('追蹤') || String(status).includes('應收')) return 'warning';
  if (String(status).includes('放棄') || String(status).includes('逾期')) return 'danger';
  return 'default';
}
