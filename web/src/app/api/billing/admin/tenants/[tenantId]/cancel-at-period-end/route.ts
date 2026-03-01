import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await authHeader();
  if (!auth) {
    return new NextResponse('Não autorizado', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  const { tenantId } = await params;
  const body = await req.text();
  const upstream = await fetch(`${getApiUrl()}/billing/admin/tenants/${tenantId}/cancel-at-period-end`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  });
  const text = await upstream.text();
  return passthroughJsonOrText(upstream, text);
}
