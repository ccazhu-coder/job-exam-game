export function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function validateBid(payload = {}) {
  const errors = {};
  if (!required(payload.bid_name)) errors.bid_name = '請輸入標案名稱';
  if (!required(payload.agency)) errors.agency = '請輸入機關名稱';
  if (payload.budget && Number(payload.budget) < 0) errors.budget = '預算不可為負數';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateLead(payload = {}) {
  const errors = {};
  if (!required(payload.name)) errors.name = '請輸入姓名或單位';
  if (!required(payload.line) && !required(payload.email)) errors.contact = '請至少留下 LINE 或 Email';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateFinance(payload = {}) {
  const errors = {};
  if (!required(payload.type)) errors.type = '請選擇收支類型';
  if (!required(payload.category)) errors.category = '請輸入分類';
  if (!required(payload.amount)) errors.amount = '請輸入金額';
  if (payload.amount && Number(payload.amount) < 0) errors.amount = '金額不可為負數';
  return { valid: Object.keys(errors).length === 0, errors };
}
