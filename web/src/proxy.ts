import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const token = req.cookies.get('lexflow_token')?.value;
  const pathname = req.nextUrl.pathname;

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/matters') ||
    pathname.startsWith('/clients') ||
    pathname.startsWith('/agenda') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/team');

  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/matters/:path*', '/clients/:path*', '/agenda/:path*', '/reports/:path*', '/team/:path*', '/login'],
};
