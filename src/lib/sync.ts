import {
  createApplication,
  emailExists,
  findApplicationByCompany,
  getSyncState,
  setSyncState,
  updateApplication,
  upsertEmail,
} from './db';
import { classifyEmail, extractCompany } from './classify';
import { getMessage, listMessageIds } from './gmail';
import type { Status } from './types';
import type { RequireSessionResult } from './auth';

const MAX_MESSAGES_PER_SYNC = 150;
const BATCH_SIZE = 5;

const STATUS_RANK: Record<string, number> = { applied: 1, interviewing: 2, offer: 3 };

export interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
  lastSyncAt: string;
  error?: string;
}

interface FetchedAndClassified {
  msg: Awaited<ReturnType<typeof getMessage>>;
  classification: Awaited<ReturnType<typeof classifyEmail>>;
}

// Network + LLM calls only (safe to run concurrently). No DB access here, so
// concurrent calls can never race on the find-or-create-application step below.
async function fetchAndClassify(
  accessToken: string,
  id: string
): Promise<FetchedAndClassified | null> {
  const msg = await getMessage(accessToken, id);
  if (!msg) return null;

  const classification = await classifyEmail({
    subject: msg.subject,
    from_addr: msg.from_addr,
    received_at: msg.received_at,
    snippet: msg.snippet,
    bodyText: msg.bodyText,
  });

  return { msg, classification };
}

// Pure synchronous DB work. Must be called sequentially (never concurrently)
// so that find-or-create-by-company can't race across emails for the same company.
function persistOne(item: FetchedAndClassified): 'created' | 'updated' | null {
  const { msg, classification } = item;
  if (!msg) return null;

  if (!classification.is_job_related) {
    upsertEmail({
      gmail_id: msg.gmail_id,
      thread_id: msg.thread_id,
      application_id: null,
      subject: msg.subject,
      from_addr: msg.from_addr,
      received_at: msg.received_at,
      snippet: msg.snippet,
      detected_status: null,
      is_job_related: 0,
      gmail_link: msg.gmail_link,
    });
    return null;
  }

  const companyName =
    classification.company ?? extractCompany(msg.subject, msg.from_addr) ?? 'Unknown Company';

  let application = findApplicationByCompany(companyName);
  let result: 'created' | 'updated' | null = null;

  if (!application) {
    application = createApplication({
      company: companyName,
      role: classification.role,
      status: classification.status ?? 'applied',
    });
    result = 'created';
  }

  upsertEmail({
    gmail_id: msg.gmail_id,
    thread_id: msg.thread_id,
    application_id: application.id,
    subject: msg.subject,
    from_addr: msg.from_addr,
    received_at: msg.received_at,
    snippet: msg.snippet,
    detected_status: classification.status,
    is_job_related: 1,
    gmail_link: msg.gmail_link,
  });

  if (result !== 'created' && application.user_edited === 0) {
    const patch: Partial<{ status: Status; role: string | null }> = {};

    if (classification.status) {
      if (classification.status === 'rejected') {
        if (application.status !== 'rejected') patch.status = 'rejected';
      } else if (application.status !== 'rejected') {
        const curRank = STATUS_RANK[application.status] ?? 0;
        const newRank = STATUS_RANK[classification.status] ?? 0;
        if (newRank > curRank) patch.status = classification.status;
      }
    }

    if (!application.role && classification.role) {
      patch.role = classification.role;
    }

    if (Object.keys(patch).length > 0) {
      updateApplication(application.id, patch);
    }
    result = 'updated';
  }

  return result;
}

export async function runSync(session: RequireSessionResult): Promise<SyncResult> {
  const syncStartMs = Date.now();
  let fetched = 0;
  let created = 0;
  let updated = 0;
  let errorMsg: string | undefined;

  try {
    const lookbackDays = Number(process.env.INITIAL_LOOKBACK_DAYS) || 90;
    const lastEpoch = getSyncState('last_sync_epoch');
    const recencyClause = lastEpoch ? `after:${lastEpoch}` : `newer_than:${lookbackDays}d`;
    const prefilter =
      '(application OR applying OR interview OR offer OR recruiter OR position OR candidate OR "talent" OR "hiring")';
    const query = `${recencyClause} ${prefilter} -category:promotions`;

    const ids = await listMessageIds(session.accessToken, query, 200);
    const newIds = ids.filter((id) => !emailExists(id)).slice(0, MAX_MESSAGES_PER_SYNC);
    fetched = newIds.length;

    for (let i = 0; i < newIds.length; i += BATCH_SIZE) {
      const batch = newIds.slice(i, i + BATCH_SIZE);
      // Fetch + classify concurrently (I/O-bound)...
      const fetchedBatch = await Promise.all(
        batch.map((id) => fetchAndClassify(session.accessToken, id))
      );
      // ...then persist sequentially (DB-bound) to avoid find-or-create races.
      for (const item of fetchedBatch) {
        if (!item) continue;
        const result = persistOne(item);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
      }
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    console.error('runSync failed', err);
  }

  const epochForNextSync = Math.floor(syncStartMs / 1000) - 300; // 5 min overlap, dedupe handles repeats
  const lastSyncAtIso = new Date(syncStartMs).toISOString();
  setSyncState('last_sync_epoch', String(epochForNextSync));
  setSyncState('last_sync_at', lastSyncAtIso);
  setSyncState('last_error', errorMsg ?? '');

  return {
    fetched,
    created,
    updated,
    lastSyncAt: lastSyncAtIso,
    ...(errorMsg ? { error: errorMsg } : {}),
  };
}
