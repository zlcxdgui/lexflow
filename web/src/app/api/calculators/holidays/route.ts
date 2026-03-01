import { backendErrorResponse } from '@/lib/proxyResponse';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:3000';
  return raw.replace(/\/$/, '');
}

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function GET(request: NextRequest) {
  const apiUrl = getApiUrl();
  const auth = await authHeader();
  if (!auth) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const year = request.nextUrl.searchParams.get('year') || '';
  const uf = request.nextUrl.searchParams.get('uf') || '';
  const city = request.nextUrl.searchParams.get('city') || '';
  const qs = new URLSearchParams();
  if (year) qs.set('year', year);
  if (uf) qs.set('uf', uf);
  if (city) qs.set('city', city);

  try {
    const upstream = await fetch(`${apiUrl}/calculators/holidays?${qs.toString()}`, {
      method: 'GET',
      headers: { ...auth, Accept: 'application/json' },
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
  } catch {
    return new NextResponse(String('API indisponível no momento'), { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

