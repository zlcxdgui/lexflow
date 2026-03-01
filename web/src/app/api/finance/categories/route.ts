import { NextRequest } from 'next/server';
import { forwardFinance } from '../_shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return forwardFinance(null, '/finance/categories', 'GET');
}

export async function POST(req: NextRequest) {
  return forwardFinance(req, '/finance/categories', 'POST');
}


