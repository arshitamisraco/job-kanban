import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getSyncState } from '@/lib/db';
import { runSync } from '@/lib/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const lastSyncAt = getSyncState('last_sync_at');
  const lastError = getSyncState('last_error');
  return NextResponse.json({ lastSyncAt, lastError });
}

export async function POST() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await runSync(session);
  return NextResponse.json(result);
}
