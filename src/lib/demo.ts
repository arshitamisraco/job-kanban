// Read-only demo board for visitors who are not signed in. Built in memory from
// the mock emails with the heuristic classifier, so it never touches the real
// SQLite DB and never calls Gmail or the LLM.
import emails from '@/mock/emails.json';
import { extractCompany, heuristicClassify } from './classify';
import type { Application, EmailSummary, Status } from './types';

const STATUS_RANK: Record<string, number> = { applied: 1, interviewing: 2, offer: 3 };

let cache: Application[] | null = null;

export function getDemoApplications(): Application[] {
  if (cache) return cache;

  const groups = new Map<string, Application>();

  for (const email of emails) {
    const classification = heuristicClassify(email);
    if (!classification.is_job_related) continue;

    const company =
      classification.company ?? extractCompany(email.subject, email.from_addr) ?? 'Unknown Company';
    const key = company.toLowerCase().replace(/[^a-z0-9]/g, '');

    const summary: EmailSummary = {
      gmail_id: email.gmail_id,
      subject: email.subject,
      from_addr: email.from_addr,
      received_at: email.received_at,
      snippet: email.snippet,
      gmail_link: email.gmail_link ?? null,
      detected_status: classification.status,
    };

    let app = groups.get(key);
    if (!app) {
      app = {
        id: groups.size + 1,
        company,
        role: classification.role,
        status: classification.status ?? 'applied',
        notes: null,
        user_edited: 0,
        created_at: email.received_at ?? new Date(0).toISOString(),
        updated_at: email.received_at ?? new Date(0).toISOString(),
        emails: [],
      };
      groups.set(key, app);
    } else {
      // Same rules as the real sync: rejected wins, otherwise the furthest-along status.
      const next = classification.status;
      if (next === 'rejected') {
        app.status = 'rejected';
      } else if (next && app.status !== 'rejected') {
        if ((STATUS_RANK[next] ?? 0) > (STATUS_RANK[app.status] ?? 0)) app.status = next as Status;
      }
      if (!app.role && classification.role) app.role = classification.role;
    }
    app.emails.push(summary);
  }

  cache = Array.from(groups.values()).map((app) => ({
    ...app,
    emails: app.emails.sort((a, b) => (b.received_at ?? '').localeCompare(a.received_at ?? '')),
  }));
  return cache;
}
