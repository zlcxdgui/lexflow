import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { backendErrorResponse, passthroughJsonOrText } from '@/lib/proxyResponse';

export function getApiUrl() {
  const raw =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:3000';
  return raw.replace(/\/$/, '');
}

export async function getAuthHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export async function proxyAuthRequest(
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  path: string,
  body?: string,
) {
  const apiUrl = getApiUrl();
  const auth = await getAuthHeader();
  if (!auth) {
    return new NextResponse('Não autorizado', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const upstream = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        ...auth,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body } : {}),
      cache: 'no-store',
    });

    const text = await upstream.text();
    if (!upstream.ok) return backendErrorResponse(text, upstream.status);
    return passthroughJsonOrText(upstream, text);
  } catch {
    return new NextResponse('API indisponível no momento', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
