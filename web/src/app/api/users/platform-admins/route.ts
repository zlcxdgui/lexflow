import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function parseMessage(text: string, fallback: string) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
  } catch {}
  return text || fallback;
}

async function token() {
  return (await cookies()).get('lexflow_token')?.value;
}

export async function GET() {
  const t = await token();
  if (!t) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const resp = await fetch(`${getApiUrl()}/users/platform-admins`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  const text = await resp.text();
  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok) {
    return new NextResponse(String(parseMessage(text, 'Erro ao carregar admins')), { status: resp.status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (contentType.includes('application/json')) return NextResponse.json(JSON.parse(text), { status: resp.status });
  return new NextResponse(text, { status: resp.status });
}

export async function POST(req: Request) {
  const t = await token();
  if (!t) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const body = await req.json().catch(() => ({}));
  const resp = await fetch(`${getApiUrl()}/users/platform-admins/promote`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: String(body?.email || '') }),
  });
  const text = await resp.text();
  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok) {
    return new NextResponse(String(parseMessage(text, 'Erro ao promover admin')), { status: resp.status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (contentType.includes('application/json')) return NextResponse.json(JSON.parse(text), { status: resp.status });
  return new NextResponse(text, { status: resp.status });
}
