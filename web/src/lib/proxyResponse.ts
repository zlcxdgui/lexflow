import { NextResponse } from 'next/server';

export function extractApiMessage(text: string): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      const message = (parsed as { message?: unknown }).message;
      if (Array.isArray(message)) return message.map((m) => String(m)).join(', ');
      if (typeof message === 'string') return message;
    }
  } catch {
    // ignore parse errors and fallback to raw text
  }
  return text;
}

export function backendErrorResponse(
  text: string,
  status: number,
  fallback = 'Erro no backend',
) {
  const message = extractApiMessage(text).trim();
  return new NextResponse(message || fallback, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export function passthroughJsonOrText(upstream: Response, text: string) {
  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    } catch {
      // fallback to text below
    }
  }

  const fallback = upstream.ok ? 'OK' : 'Erro no backend';
  const message = extractApiMessage(text).trim();
  return new NextResponse(message || fallback, {
    status: upstream.status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
