import { NextRequest } from 'next/server';
import { forwardFinance } from '../../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await Promise.resolve(params);
  return forwardFinance(req, `/finance/cost-centers/${resolved.id}`, 'PATCH');
}


