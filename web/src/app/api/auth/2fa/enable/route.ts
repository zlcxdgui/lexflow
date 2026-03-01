import { proxyAuthRequest } from '../../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text();
  return proxyAuthRequest('POST', '/auth/2fa/enable', body);
}
