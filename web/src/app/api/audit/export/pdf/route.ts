import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { backendErrorResponse } from '@/lib/proxyResponse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function GET(req: NextRequest) {
  const apiUrl = getApiUrl();
  const auth = await authHeader();
  if (!auth) {
    return new NextResponse('Não autorizado', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const upstream = await fetch(`${apiUrl}/audit/export.pdf${req.nextUrl.search || ''}`, {
    method: 'GET',
    headers: { ...auth, Accept: 'application/pdf' },
    cache: 'no-store',
  });

  const buffer = await upstream.arrayBuffer();
  if (!upstream.ok) {
    const text = Buffer.from(buffer).toString('utf-8');
    return backendErrorResponse(text, upstream.status);
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/pdf',
      'content-disposition':
        upstream.headers.get('content-disposition') ||
        'attachment; filename="auditoria.pdf"',
    },
  });
}
