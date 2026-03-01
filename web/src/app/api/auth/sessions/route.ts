import { proxyAuthRequest } from '../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return proxyAuthRequest('GET', '/auth/sessions');
}

export async function DELETE() {
  return proxyAuthRequest('DELETE', '/auth/sessions');
}
