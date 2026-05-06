import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const protectedPaths = ['/dashboard', '/crm', '/bids', '/finance', '/ai', '/settings'];
  const isProtected = protectedPaths.some((path) => pathname.includes(`/saas-mvp${path}`));

  if (!isProtected) return NextResponse.next();

  // MVP placeholder: real auth will be enforced after Supabase session integration.
  return NextResponse.next();
}

export const config = {
  matcher: ['/govbid-ai-erp/saas-mvp/:path*'],
};
