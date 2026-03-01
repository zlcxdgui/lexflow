import { backendErrorResponse } from '@/lib/proxyResponse';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

async function authHeaders(extra?: Record<string, string>) {
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

export async function forwardFinance(
  req: NextRequest | null,
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
) {
  const headers = await authHeaders(
    method === 'GET' ? { Accept: 'application/json' } : { 'Content-Type': 'application/json' },
  );
  if (!headers) {
    return new NextResponse('Não autorizado', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const url = `${getApiUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const body = req && method !== 'GET' ? await req.text() : undefined;
  const upstream = await fetch(url, {
    method,
    headers,
    body,
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
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': contentType || 'text/plain; charset=utf-8' },
  });
}

