import { NextResponse } from 'next/server';
import { db } from '@/shared/db/client';
import { isDatabaseReachable } from '@/shared/db/health';

export const dynamic = 'force-dynamic';

/** Hazırlık kontrolü: veritabanına erişilebiliyor mu? (ARCHITECTURE §11, ERROR_HANDLING E38) */
export async function GET() {
  const database = await isDatabaseReachable(db());
  return NextResponse.json(
    { status: database ? 'ready' : 'unavailable', database },
    { status: database ? 200 : 503 },
  );
}
