import { NextResponse } from 'next/server';

const demoSettings = {
  brandName: 'GovBid AI ERP',
  adminEmail: '',
  plan: 'Business',
  lineQr: 'https://qr-official.line.me/gs/M_262guhpb_GW.png?oat_content=qr',
};

export async function GET() {
  return NextResponse.json({ ok: true, data: demoSettings });
}

export async function POST(request) {
  const body = await request.json();
  return NextResponse.json({ ok: true, message: 'Settings saved placeholder', data: body });
}
