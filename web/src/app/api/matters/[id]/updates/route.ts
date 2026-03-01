import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function extractMessage(text: string, fallback: string) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length)
      return String(parsed.message[0]);
  } catch {}
  return text || fallback;
}

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const apiUrl = getApiUrl();
    const cookieStore = await cookies();
    const token = cookieStore.get('lexflow_token')?.value;
    const { id } = await context.params;

    if (!id)
      return NextResponse.json(
        { message: 'Parâmetro id ausente' },
        { status: 400 },
      );
    if (!token)
      return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

    const upstream = await fetch(
      `${apiUrl}/matters/${id}/updates${req.nextUrl.search}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    );

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { message: extractMessage(text, 'Falha ao carregar andamentos') },
        { status: upstream.status },
      );
    }

    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Erro no proxy de andamentos';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const apiUrl = getApiUrl();
    const cookieStore = await cookies();
    const token = cookieStore.get('lexflow_token')?.value;
    const { id } = await context.params;

    if (!id)
      return NextResponse.json(
        { message: 'Parâmetro id ausente' },
        { status: 400 },
      );
    if (!token)
      return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

    const body = await req.text();
    const upstream = await fetch(`${apiUrl}/matters/${id}/updates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
      cache: 'no-store',
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { message: extractMessage(text, 'Falha ao criar andamento') },
        { status: upstream.status },
      );
    }

    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Erro no proxy de andamentos';
    return NextResponse.json({ message }, { status: 500 });
  }
}
