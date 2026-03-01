import { backendErrorResponse } from '@/lib/proxyResponse';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('lexflow_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const auth = await authHeader();
  if (!auth) {
    return new NextResponse('Não autorizado', {
      status: 401,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const resolved = await Promise.resolve(params);
  const qs = req.nextUrl.search || '';
  const upstream = await fetch(
    `${getApiUrl()}/finance/matters/${resolved.id}/export.pdf${qs}`,
    {
      method: 'GET',
      headers: {
        ...auth,
        Accept: 'application/pdf',
      },
      cache: 'no-store',
    },
  );

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
        'attachment; filename="financeiro-caso.pdf"',
    },
  });
}
