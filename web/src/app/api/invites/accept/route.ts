import { NextResponse } from 'next/server';
import { backendErrorResponse } from '@/lib/proxyResponse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AcceptInviteResponse = {
  accessToken?: string;
};

function getApiUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export async function POST(req: Request) {
  const apiUrl = getApiUrl();
  const body = await req.text();

  const upstream = await fetch(`${apiUrl}/invites/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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

  let data: AcceptInviteResponse | null = null;
  if (contentType.includes('application/json')) {
    data = JSON.parse(text);
  }

  const token = data?.accessToken;
  const res = NextResponse.json(data || { ok: true }, { status: upstream.status });
  if (token) {
    res.cookies.set({
      name: 'lexflow_token',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return res;
}
