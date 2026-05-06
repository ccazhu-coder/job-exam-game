export function buildLeadNotification(lead = {}) {
  return [
    'GovBid AI ERP 新名單',
    `姓名/單位：${lead.name || '-'}`,
    `方案：${lead.plan || '-'}`,
    `分級：${lead.level || '-'}`,
    `預估金額：${lead.deal_amount || '-'}`,
    `下次追蹤：${lead.next_follow_up_date || '-'}`,
  ].join('\n');
}

export function buildBidNotification(bid = {}) {
  return [
    'GovBid AI ERP 標案提醒',
    `標案名稱：${bid.bid_name || '-'}`,
    `機關：${bid.agency || '-'}`,
    `截止日：${bid.deadline || '-'}`,
    `決策：${bid.decision_result || '-'}`,
  ].join('\n');
}

export function buildFinanceNotification(item = {}) {
  return [
    'GovBid AI ERP 財務提醒',
    `專案：${item.project || '-'}`,
    `類型：${item.type || '-'}`,
    `分類：${item.category || '-'}`,
    `金額：${item.amount || '-'}`,
    `狀態：${item.status || '-'}`,
  ].join('\n');
}
