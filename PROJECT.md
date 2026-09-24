# Job Kanban — Project Doc (shared by all sessions)

Read this before working. Update the Status section when you finish a task.

## Goal
Single-user web app. Sign in with Google, read Gmail, detect job-application emails
(applied / interview / offer / rejected), extract company + role + status, show a kanban
board that refreshes as new mail arrives. User can correct anything. Never store full email bodies.
Take-home project: speed over thoroughness. No over-engineering.

## Stack (decided)
- Next.js 16 (App Router, TypeScript, Tailwind v4) — one repo, frontend + API routes. Already scaffolded in `/`.
- Auth: `next-auth` v5 (Auth.js) beta, Google provider, scope `openid email profile https://www.googleapis.com/auth/gmail.readonly`,
  `access_type=offline prompt=consent` so we get a refresh token. JWT session strategy (no DB adapter).
  Store `access_token`, `refresh_token`, `expires_at` in the JWT; refresh on expiry.
  Only allow `process.env.ALLOWED_EMAIL` to sign in (single user).
- DB: SQLite via `better-sqlite3`, file at `./data/app.db` (gitignored). Schema created at startup in `src/lib/db.ts`. No ORM.
- Gmail: `googleapis` package, `gmail.users.messages.list` + `messages.get` (format=metadata + snippet; fetch body only transiently for classification).
- Classifier: Claude API (`@anthropic-ai/sdk`, model `claude-haiku-4-5-20251001`) with a JSON-schema tool call. Falls back to a
  regex/keyword heuristic when `ANTHROPIC_API_KEY` is missing. Input: subject, from, date, snippet, body text truncated to 2000 chars.
  Body is NEVER written to the DB.
- Sync: `POST /api/sync` — pull new messages since last sync (Gmail `q` = `after:<lastSyncEpoch>` or `newer_than:90d` on first run,
  plus a keyword prefilter), classify, upsert. Client calls it on load, on a "Sync now" button, and every 2 minutes (setInterval).
  Board re-fetches `/api/applications` after each sync. No websockets / no cron. Good enough.
- Mock mode: `MOCK_MODE=1` → skips Google auth (fake session for ALLOWED_EMAIL) and reads from `src/mock/emails.json`
  instead of Gmail, uses heuristic classifier. This lets the app run end-to-end without any credentials.

## Data model (SQLite) — CONTRACT, do not change without updating this doc
```sql
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  role TEXT,
  status TEXT NOT NULL CHECK (status IN ('applied','interviewing','offer','rejected','ignored')),
  notes TEXT,
  user_edited INTEGER NOT NULL DEFAULT 0,   -- 1 = user corrected company/role/status; sync must not overwrite those fields
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS emails (
  gmail_id TEXT PRIMARY KEY,
  thread_id TEXT,
  application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
  subject TEXT,
  from_addr TEXT,
  received_at TEXT,            -- ISO string
  snippet TEXT,                -- Gmail snippet, max 200 chars. NO BODY.
  detected_status TEXT,        -- classifier output for this email
  is_job_related INTEGER NOT NULL DEFAULT 1,
  gmail_link TEXT              -- https://mail.google.com/mail/u/0/#all/<gmail_id>
);
CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY, value TEXT
);  -- keys: last_sync_epoch, last_sync_at, last_error
```
Matching rule: new email → find existing application by (normalized company name, case-insensitive) — if found attach to it and,
unless `user_edited=1`, advance status per ordering applied < interviewing < offer, and rejected overrides all. Otherwise create new application.

## API — CONTRACT
- `GET  /api/applications` → `{ applications: Application[] }` where Application includes `emails: EmailSummary[]` (subject, from_addr, received_at, snippet, gmail_link, detected_status).
- `PATCH /api/applications/:id` body `{ company?, role?, status?, notes? }` → sets `user_edited=1`, returns updated Application.
- `DELETE /api/applications/:id` → deletes application (emails keep rows with application_id NULL, is_job_related=0 so they are not re-created).
- `POST /api/sync` → `{ fetched: number, created: number, updated: number, lastSyncAt: string, error?: string }`.
- `GET  /api/sync` → `{ lastSyncAt, lastError }`.
All routes require a session (or MOCK_MODE). Return 401 otherwise.

## Types — `src/lib/types.ts` (CONTRACT)
```ts
export type Status = 'applied' | 'interviewing' | 'offer' | 'rejected' | 'ignored';
export interface EmailSummary { gmail_id: string; subject: string|null; from_addr: string|null; received_at: string|null; snippet: string|null; gmail_link: string|null; detected_status: Status|null; }
export interface Application { id: number; company: string; role: string|null; status: Status; notes: string|null; user_edited: 0|1; created_at: string; updated_at: string; emails: EmailSummary[]; }
export interface Classification { is_job_related: boolean; company: string|null; role: string|null; status: Status|null; confidence: number; }
```

## File ownership (parallel work)
- Task A (backend): `src/lib/db.ts`, `src/lib/types.ts`, `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`,
  `src/lib/gmail.ts`, `src/lib/classify.ts`, `src/lib/sync.ts`, `src/app/api/sync/route.ts`, `src/app/api/applications/**`,
  `src/mock/emails.json`, `.env.example`, `middleware`-free (check session in each route via helper `requireSession()` in `src/lib/auth.ts`).
- Task B (frontend): `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/**`, `src/app/globals.css`. Consumes the API contract above only.
  Uses `fetch` to the API; no direct DB/auth imports except `signIn/signOut` client helpers from `next-auth/react` and the `SessionProvider`.
- Board columns: Applied | Interviewing | Offer | Rejected. `ignored` hidden (toggle to show). Cards: company, role, last email date, email count.
  Click card → side panel: edit company/role/status/notes, list of emails (subject, from, date, snippet, "Open in Gmail" link),
  "Mark not job-related" (status=ignored), Delete. Drag-and-drop between columns via native HTML5 DnD → PATCH status.
  Header: user email, "Sync now" button with last-synced time + spinner, sign out. Polling: sync every 2 min, refetch after sync.

## Decisions / trade-offs (for README)
- Polling instead of Gmail push (Pub/Sub) — push needs a public HTTPS endpoint + GCP topic; not worth it for a take-home.
- SQLite + no ORM — single user, zero infra.
- JWT sessions holding Google tokens — no user table needed.
- Haiku for classification — cheap/fast; heuristic fallback so the app never hard-depends on the key.
- Bodies fetched transiently for classification only; only 200-char snippet + subject stored.

## Needs Arshita
1. Google Cloud project: enable Gmail API, create OAuth 2.0 Web client, redirect URI `http://localhost:3000/api/auth/callback/google`,
   add her Gmail as a test user (app in "Testing" mode). Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.local`.
2. `ANTHROPIC_API_KEY` (optional — heuristic fallback works without it).
3. `AUTH_SECRET` (`npx auth secret` or `openssl rand -base64 32`), `ALLOWED_EMAIL=arshitamisraco@gmail.com`.
4. Decision: keep 90-day initial lookback? (default 90d, env `INITIAL_LOOKBACK_DAYS`).

## Status
- [x] Scaffold Next.js (lead)
- [x] Task A backend (Sonnet)
- [x] Task B frontend (Sonnet)
- [x] Integration + end-to-end check in MOCK_MODE (Sonnet)
- [ ] Security review (Opus, short)
- [x] README
