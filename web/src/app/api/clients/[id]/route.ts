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

type RouteContext = { params: { id?: string } | Promise<{ id?: string }> };

async function getRouteId(context: RouteContext) {
  const paramsObj = await context.params;
  return paramsObj?.id;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const apiUrl = getApiUrl();
  const auth = await authHeader();
  if (!auth) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const id = await getRouteId(context);
  if (!id) return new NextResponse('Requisição inválida', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const body = await req.text();
  const upstream = await fetch(`${apiUrl}/clients/${id}`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.ok) {
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(text) as { message?: string };
        return new NextResponse(parsed?.message || text || 'Erro no backend', {
          status: upstream.status,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      } catch {}
    }
    return new NextResponse(text || 'Erro no backend', {
      status: upstream.status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (contentType.includes('application/json')) {
    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  }
  return new NextResponse(text, { status: upstream.status, headers: { 'content-type': contentType || 'text/plain' } });
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const apiUrl = getApiUrl();
  const auth = await authHeader();
  if (!auth) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const id = await getRouteId(context);
  if (!id) return new NextResponse('Requisição inválida', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const upstream = await fetch(`${apiUrl}/clients/${id}`, {
    method: 'GET',
    headers: { ...auth, Accept: 'application/json' },
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.ok) {
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(text) as { message?: string };
        return new NextResponse(parsed?.message || text || 'Erro no backend', {
          status: upstream.status,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      } catch {}
    }
    return new NextResponse(text || 'Erro no backend', {
      status: upstream.status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (contentType.includes('application/json')) {
    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  }
  return new NextResponse(text, { status: upstream.status, headers: { 'content-type': contentType || 'text/plain' } });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const apiUrl = getApiUrl();
  const auth = await authHeader();
  if (!auth) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const id = await getRouteId(context);
  if (!id) return new NextResponse('Requisição inválida', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const upstream = await fetch(`${apiUrl}/clients/${id}`, {
    method: 'DELETE',
    headers: { ...auth },
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.ok) {
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(text) as { message?: string };
        return new NextResponse(parsed?.message || text || 'Erro no backend', {
          status: upstream.status,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      } catch {}
    }
    return new NextResponse(text || 'Erro no backend', {
      status: upstream.status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (contentType.includes('application/json')) {
    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  }
  return new NextResponse(text, { status: upstream.status, headers: { 'content-type': contentType || 'text/plain' } });
}
