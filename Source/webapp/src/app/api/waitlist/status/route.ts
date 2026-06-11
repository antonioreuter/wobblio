import { NextResponse } from 'next/server';
import { getFreeUserCount } from '@/lib/db';

const FREE_CAP = parseInt(process.env.MAX_FREE_USERS ?? '5', 10);

export async function GET() {
  const count = await getFreeUserCount();
  return NextResponse.json(
    { waitlistActive: count >= FREE_CAP },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
  );
}
