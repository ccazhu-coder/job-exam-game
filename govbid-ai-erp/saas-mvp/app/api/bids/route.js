import { NextResponse } from 'next/server';

const demoBids = [
  { id: '1', bid_name: '就業服務專業人員職能培訓計畫', agency: '地方政府', budget: 1200000, deadline: '2026-06-15', decision_score: 86, decision_result: '必投' },
  { id: '2', bid_name: 'AI應用推廣與講座委託案', agency: '公部門', budget: 680000, deadline: '2026-06-22', decision_score: 74, decision_result: '可投' }
];

export async function GET() {
  return NextResponse.json({ ok: true, data: demoBids });
}

export async function POST(request) {
  const body = await request.json();
  return NextResponse.json({ ok: true, message: 'Bid created placeholder', data: body });
}
