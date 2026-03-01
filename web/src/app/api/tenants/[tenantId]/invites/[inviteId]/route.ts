import { backendErrorResponse } from '@/lib/proxyResponse';
import { NextRequest, NextResponse } from 'next/server';
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

export async function DELETE(
  _req: NextRequest,
  context: { params: { tenantId: string; inviteId: string } | Promise<{ tenantId: string; inviteId: string }> }
) {
  const apiUrl = getApiUrl();
  const auth = await authHeader();
  if (!auth) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const params = await Promise.resolve(context.params);
  const tenantId = params?.tenantId;
  const inviteId = params?.inviteId;
  if (!tenantId || !inviteId) return new NextResponse(String('Parâmetros inválidos'), { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const upstream = await fetch(`${apiUrl}/tenants/${tenantId}/invites/${inviteId}`, {
    method: 'DELETE',
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
}

