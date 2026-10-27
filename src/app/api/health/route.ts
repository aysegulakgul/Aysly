import { NextResponse } from 'next/server';

/** Canlılık kontrolü (ARCHITECTURE §11). Kimlik doğrulamasızdır ve iç ayrıntı içermez. */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
