import { NextRequest } from 'next/server';
import { forwardFinance } from '../../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return forwardFinance(req, '/finance/recurrence/generate-range', 'POST');
}


