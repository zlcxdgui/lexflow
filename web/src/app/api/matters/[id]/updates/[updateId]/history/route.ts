import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function extractMessage(text: string, fallback: string) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) {
      return String(parsed.message[0]);
    }
  } catch {}
  return text || fallback;
}

type RouteContext = {
  params:
    | Promise<{ id: string; updateId: string }>
    | { id: string; updateId: string };
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const apiUrl = getApiUrl();
    const cookieStore = await cookies();
    const token = cookieStore.get('lexflow_token')?.value;
    const { id, updateId } = await context.params;

    if (!id || !updateId) {
      return new NextResponse(String('Parâmetros ausentes'), { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if (!token) {
      return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    const upstream = await fetch(
      `${apiUrl}/matters/${id}/updates/${updateId}/history`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    );

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { message: extractMessage(text, 'Falha ao buscar histórico do andamento') },
        { status: upstream.status },
      );
    }

    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Erro no proxy de histórico do andamento';
    return NextResponse.json({ message }, { status: 500 });
  }
}
