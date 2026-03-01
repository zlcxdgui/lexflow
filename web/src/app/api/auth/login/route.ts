import { NextResponse } from 'next/server';
import { backendErrorResponse } from '@/lib/proxyResponse';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

type LoginResponse = {
  accessToken?: string;
};

export async function POST(req: Request) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new NextResponse(String('NEXT_PUBLIC_API_URL não configurado'), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return new NextResponse(String('Email e senha são obrigatórios'), { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const cookieStore = await cookies();
  let deviceId = cookieStore.get('lexflow_device_id')?.value || '';
  if (!deviceId) deviceId = randomUUID();

  const forwardedFor =
    req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  const userAgent = req.headers.get('user-agent') || '';

  // chama o backend e pega o accessToken (JSON)
  const resp = await fetch(`${apiUrl.replace(/\/+$/, '')}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      ...(userAgent ? { 'user-agent': userAgent } : {}),
      ...(deviceId ? { 'x-device-id': deviceId } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text().catch(() => '');
  if (!resp.ok) {
    return backendErrorResponse(text, resp.status, `Erro ${resp.status}`);
  }

  let data: LoginResponse | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  const token = data?.accessToken;
  if (!token) {
    return new NextResponse(String('Backend não retornou accessToken'), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // seta cookie HttpOnly NO FRONTEND (3001)
  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: 'lexflow_token',
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // localhost
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });

  res.cookies.set({
    name: 'lexflow_device_id',
    value: deviceId,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
