import { backendErrorResponse, extractApiMessage } from '@/lib/proxyResponse';
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

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext
) {
  const apiUrl = getApiUrl();

  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;

  const params = await ctx.params;
  const id = params.id as string;

  if (!token) {
    return new NextResponse('Não autorizado', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const upstream = await fetch(`${apiUrl}/documents/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';

  if (!upstream.ok) {
    return backendErrorResponse(text, upstream.status, 'Erro ao excluir documento');
  }

  // API provavelmente responde {ok:true}
  if (contentType.includes('application/json')) {
    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    } catch {}
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': contentType || 'text/plain' },
  });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const apiUrl = getApiUrl();
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  const params = await ctx.params;
  const id = params.id as string;

  if (!token) {
    return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const body = await req.text();
  const upstream = await fetch(`${apiUrl}/documents/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';

  if (!upstream.ok) {
    return new NextResponse(extractApiMessage(text) || 'Erro ao renomear documento', {
      status: upstream.status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (contentType.includes('application/json')) {
    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    } catch {}
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': contentType || 'text/plain' },
  });
}
