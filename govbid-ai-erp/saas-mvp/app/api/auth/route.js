import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json();
  return NextResponse.json({ ok: true, message: 'Auth endpoint placeholder', email: body.email || null });
}
