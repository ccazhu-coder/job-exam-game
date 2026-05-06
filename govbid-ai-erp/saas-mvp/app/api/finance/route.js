import { NextResponse } from 'next/server';

const demoFinance = [
  { id: '1', project: '就服職能培訓計畫', type: '收入', category: '分期款', amount: 600000, status: '應收' },
  { id: '2', project: 'AI講座委託案', type: '支出', category: '講師費', amount: 36000, status: '待付款' },
  { id: '3', project: '投標準備', type: '押標金', category: '押標金', amount: 50000, status: '待退還' }
];

export async function GET() {
  return NextResponse.json({ ok: true, data: demoFinance });
}

export async function POST(request) {
  const body = await request.json();
  return NextResponse.json({ ok: true, message: 'Finance record created placeholder', data: body });
}
