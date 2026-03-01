import { NextRequest } from 'next/server';
import { forwardFinance } from '../../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await Promise.resolve(params);
  return forwardFinance(null, `/finance/entries/${resolved.id}`, 'GET');
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const resolved = await Promise.resolve(params);
  return forwardFinance(req, `/finance/entries/${resolved.id}`, 'PATCH');
}


