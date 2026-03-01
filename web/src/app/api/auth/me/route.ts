import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function getApiUrl() {
  const raw =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:3000';
  return raw.replace(/\/$/, '');
}

export async function GET() {
  const apiUrl = getApiUrl();
  if (!apiUrl) return new NextResponse(String('NEXT_PUBLIC_API_URL não configurado'), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;

  if (!token) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  try {
    const resp = await fetch(`${apiUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      { message: 'API indisponível no momento' },
      { status: 503 },
    );
  }
}
