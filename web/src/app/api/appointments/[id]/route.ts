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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = (await cookies()).get('lexflow_token')?.value;
  if (!token) {
    return new NextResponse('Não autorizado', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const apiUrl = getApiUrl();
  const body = await req.text();
  const resp = await fetch(`${apiUrl}/appointments/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  });

  const text = await resp.text();
  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok) {
    return new NextResponse(String(extractMessage(text, 'Não foi possível atualizar atendimento')), {
      status: resp.status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (contentType.includes('application/json')) {
    return NextResponse.json(JSON.parse(text), { status: resp.status });
  }
  return new NextResponse(text, { status: resp.status, headers: { 'content-type': contentType || 'text/plain' } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = (await cookies()).get('lexflow_token')?.value;
  if (!token) {
    return new NextResponse('Não autorizado', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const apiUrl = getApiUrl();
  const resp = await fetch(`${apiUrl}/appointments/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const text = await resp.text();
  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok) {
    return new NextResponse(String(extractMessage(text, 'Não foi possível excluir atendimento')), {
      status: resp.status,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (contentType.includes('application/json')) {
    return NextResponse.json(JSON.parse(text), { status: resp.status });
  }
  return new NextResponse(text, { status: resp.status, headers: { 'content-type': contentType || 'text/plain' } });
}

