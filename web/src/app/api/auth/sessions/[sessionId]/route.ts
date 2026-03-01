import { proxyAuthRequest } from '../../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return proxyAuthRequest('DELETE', `/auth/sessions/${sessionId}`);
}
