import { NextResponse } from 'next/server';
import { backendErrorResponse } from '@/lib/proxyResponse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export async function GET(
  _req: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const apiUrl = getApiUrl();
  const params = await Promise.resolve(context.params);
  const token = params?.token;
  if (!token) return new NextResponse(String('Token inválido'), { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const upstream = await fetch(`${apiUrl}/invites/${token}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.ok) {
    if (contentType.includes('application/json')) {
      try {
        return NextResponse.json(JSON.parse(text), { status: upstream.status });
      } catch {}
    }
    return backendErrorResponse(text, upstream.status);
  }

  if (contentType.includes('application/json')) {
    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  }
  return new NextResponse(text, { status: upstream.status, headers: { 'content-type': contentType || 'text/plain' } });
}
