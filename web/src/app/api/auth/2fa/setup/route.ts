import { proxyAuthRequest } from '../../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  return proxyAuthRequest('POST', '/auth/2fa/setup');
}
