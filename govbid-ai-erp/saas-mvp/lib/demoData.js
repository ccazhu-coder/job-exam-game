export const demoDashboard = {
  leadsThisMonth: 12,
  activeBids: 8,
  estimatedRevenue: 198000,
  closedDeals: 3,
};

export const demoBids = [
  { id: '1', bid_name: '就業服務專業人員職能培訓計畫', agency: '地方政府', budget: 1200000, deadline: '2026-06-15', decision_score: 86, decision_result: '必投', win_status: '評估中' },
  { id: '2', bid_name: 'AI應用推廣與講座委託案', agency: '公部門', budget: 680000, deadline: '2026-06-22', decision_score: 74, decision_result: '可投', win_status: '備標中' },
];

export const demoLeads = [
  { id: '1', name: '某某協會', level: 'A級｜熱客戶', plan: '顧問導入版', deal_amount: 39800, next_follow_up_date: '2026-05-07', deal_status: '待導覽' },
  { id: '2', name: '個人講師', level: 'B級｜溫客戶', plan: '完整商用版', deal_amount: 19800, next_follow_up_date: '2026-05-09', deal_status: '追蹤中' },
];

export const demoFinance = [
  { id: '1', project: '就服職能培訓計畫', type: '收入', category: '分期款', amount: 600000, status: '應收' },
  { id: '2', project: 'AI講座委託案', type: '支出', category: '講師費', amount: 36000, status: '待付款' },
  { id: '3', project: '投標準備', type: '押標金', category: '押標金', amount: 50000, status: '待退還' },
];
