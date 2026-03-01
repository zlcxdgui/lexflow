import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { passthroughJsonOrText } from '@/lib/proxyResponse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await authHeader();
  if (!auth) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { tenantId } = await params;
  const upstream = await fetch(`${getApiUrl()}/billing/admin/tenants/${tenantId}/requests`, {
    method: 'GET',
    headers: { ...auth, Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await upstream.text();
  return passthroughJsonOrText(upstream, text);
}
