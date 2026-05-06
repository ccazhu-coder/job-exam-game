import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      leadsThisMonth: 12,
      activeBids: 8,
      estimatedRevenue: 198000,
      closedDeals: 3,
      followUps: [
        { type: 'CRM', item: 'A級客戶追蹤', status: '待聯繫', next: '安排系統導覽' },
        { type: '標案', item: '投標決策評估', status: '進行中', next: '補齊評分' },
        { type: '財務', item: '應收款確認', status: '提醒', next: '更新收款狀態' }
      ]
    }
  });
}
