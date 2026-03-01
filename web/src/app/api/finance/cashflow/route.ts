import { NextRequest } from 'next/server';
import { forwardFinance } from '../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search || '';
  return forwardFinance(null, `/finance/cashflow${qs}`, 'GET');
}


