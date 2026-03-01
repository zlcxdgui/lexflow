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
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
  } catch {}
  return text || fallback;
}

export async function GET(req: NextRequest) {
  try {
    const apiUrl = getApiUrl();
    const cookieStore = await cookies();
    const token = cookieStore.get('lexflow_token')?.value;

    if (!token) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

    const upstream = await fetch(`${apiUrl}/appointments${req.nextUrl.search}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok) {
      return NextResponse.json(
        { message: extractMessage(text, 'Falha ao carregar atendimentos') },
        { status: upstream.status },
      );
    }

    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': contentType || 'text/plain' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro no proxy de atendimentos';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiUrl = getApiUrl();
    const cookieStore = await cookies();
    const token = cookieStore.get('lexflow_token')?.value;

    if (!token) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

    const body = await req.text();
    const upstream = await fetch(`${apiUrl}/appointments`, {
      method: 'POST',
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
      return NextResponse.json(
        { message: extractMessage(text, 'Falha ao criar atendimento') },
        { status: upstream.status },
      );
    }

    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': contentType || 'text/plain' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro no proxy de atendimentos';
    return NextResponse.json({ message }, { status: 500 });
  }
}

