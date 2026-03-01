import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function POST() {
  const apiUrl = getApiUrl();
  const auth = await authHeader();
  if (!auth) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const upstream = await fetch(`${apiUrl}/dashboard/notifications/read-all`, {
    method: 'POST',
    headers: { ...auth },
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    } catch {}
  }
  return new NextResponse(text, { status: upstream.status });
}
