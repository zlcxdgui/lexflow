import { proxyAuthRequest } from '../../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return proxyAuthRequest('GET', '/auth/2fa/status');
}
