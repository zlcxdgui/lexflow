import { backendErrorResponse } from '@/lib/proxyResponse';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: { id?: string } | Promise<{ id?: string }> };

function getApiUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:3000';

  return raw.replace(/\/$/, '');
}

async function getRouteId(context: RouteContext) {
  const paramsObj = await context.params;
  return paramsObj?.id;
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Erro no proxy';
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const apiUrl = getApiUrl();
    const cookieStore = await cookies();
    const token = cookieStore.get('lexflow_token')?.value;
    const id = await getRouteId(context);

    if (!id) {
      return new NextResponse('Requisição inválida', {
        status: 400,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    if (!token) {
      return new NextResponse('Não autorizado', {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    const upstream = await fetch(`${apiUrl}/matters/${id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
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
      headers: { 'content-type': contentType || 'text/plain' },
    });
  } catch (err: unknown) {
    return new NextResponse(getErrorMessage(err), {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const apiUrl = getApiUrl();
    const cookieStore = await cookies();
    const token = cookieStore.get('lexflow_token')?.value;
    const id = await getRouteId(context);

    if (!id) {
      return new NextResponse('Requisição inválida', {
        status: 400,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    if (!token) {
      return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    const body = await req.text();
    const upstream = await fetch(`${apiUrl}/matters/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
      headers: { 'content-type': contentType || 'text/plain' },
    });
  } catch (err: unknown) {
    return new NextResponse(getErrorMessage(err), {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
