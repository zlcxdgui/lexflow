import { NextResponse } from 'next/server';
import { passthroughJsonOrText } from '@/lib/proxyResponse';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

async function forwardJson(method: 'GET' | 'POST', body?: unknown) {
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  if (!token) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const upstream = await fetch(`${getApiUrl()}/tenants`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    } catch {
      // fallback below
    }
  }
  return passthroughJsonOrText(upstream, text);
}

export async function GET() {
  return forwardJson('GET');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return forwardJson('POST', { name: String(body?.name || '') });
}
