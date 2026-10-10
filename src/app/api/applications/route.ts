import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { listApplications } from '@/lib/db';
import { getDemoApplications } from '@/lib/demo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Signed-out visitors get the read-only demo board instead of a 401, so the
// real DB (owner's data) is never exposed to them.
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ applications: getDemoApplications(), demo: true });
  }
  const applications = listApplications();
  return NextResponse.json({ applications });
}
