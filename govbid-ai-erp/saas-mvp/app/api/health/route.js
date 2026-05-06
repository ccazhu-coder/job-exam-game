import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'GovBid AI ERP SaaS MVP',
    version: '0.1.0',
    checks: {
      app: 'ok',
      api: 'ok',
      supabaseEnv: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      openaiEnv: Boolean(process.env.OPENAI_API_KEY),
    },
    timestamp: new Date().toISOString(),
  });
}
