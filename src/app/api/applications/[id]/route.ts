import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { deleteApplication, getApplication, updateApplication } from '@/lib/db';
import type { Status } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES: Status[] = ['applied', 'interviewing', 'offer', 'rejected', 'ignored'];
const MAX_LEN = 200;
const MAX_NOTES_LEN = 2000;

function trimmedString(value: unknown, maxLen = MAX_LEN): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, maxLen);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const existing = getApplication(id);
  if (!existing) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }
  if (!isPlainObject(parsedBody)) {
    return NextResponse.json({ error: 'body must be a JSON object' }, { status: 400 });
  }
  const body = parsedBody;

  const patch: Partial<{
    company: string;
    role: string | null;
    status: Status;
    notes: string | null;
    user_edited: 0 | 1;
  }> = { user_edited: 1 };

  if ('company' in body) {
    const company = trimmedString(body.company);
    if (typeof company !== 'string' || company.length === 0) {
      return NextResponse.json({ error: 'company must be a non-empty string' }, { status: 400 });
    }
    patch.company = company;
  }

  if ('role' in body) {
    const role = trimmedString(body.role);
    if (role === undefined) {
      return NextResponse.json({ error: 'role must be a string or null' }, { status: 400 });
    }
    patch.role = role;
  }

  if ('status' in body) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as Status)) {
      return NextResponse.json(
        { error: `status must be one of ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    patch.status = body.status as Status;
  }

  if ('notes' in body) {
    const notes = trimmedString(body.notes, MAX_NOTES_LEN);
    if (notes === undefined) {
      return NextResponse.json({ error: 'notes must be a string or null' }, { status: 400 });
    }
    patch.notes = notes;
  }

  const updated = updateApplication(id, patch);
  if (!updated) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const existing = getApplication(id);
  if (!existing) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  deleteApplication(id);
  return NextResponse.json({ ok: true });
}
