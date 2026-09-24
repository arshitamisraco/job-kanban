import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { listApplications } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const applications = listApplications();
  return NextResponse.json({ applications });
}
