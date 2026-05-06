import { NextResponse } from 'next/server';

const demoLeads = [
  { id: '1', name: '某某協會', line: '@demo', email: 'demo@example.com', plan: '顧問導入版', level: 'A級｜熱客戶', deal_amount: 39800, next_follow_up_date: '2026-05-07', deal_status: '待導覽' },
  { id: '2', name: '個人講師', line: '@teacher', email: 'teacher@example.com', plan: '完整商用版', level: 'B級｜溫客戶', deal_amount: 19800, next_follow_up_date: '2026-05-09', deal_status: '追蹤中' }
];

export async function GET() {
  return NextResponse.json({ ok: true, data: demoLeads });
}

export async function POST(request) {
  const body = await request.json();
  return NextResponse.json({ ok: true, message: 'Lead created placeholder', data: body });
}
