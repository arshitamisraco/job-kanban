import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Application, EmailSummary, Status } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

function createDb(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      role TEXT,
      status TEXT NOT NULL CHECK (status IN ('applied','interviewing','offer','rejected','ignored')),
      notes TEXT,
      user_edited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS emails (
      gmail_id TEXT PRIMARY KEY,
      thread_id TEXT,
      application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      subject TEXT,
      from_addr TEXT,
      received_at TEXT,
      snippet TEXT,
      detected_status TEXT,
      is_job_related INTEGER NOT NULL DEFAULT 1,
      gmail_link TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY, value TEXT
    );
  `);

  return database;
}

declare global {
  var __appDb: Database.Database | undefined;
}

export const db: Database.Database = globalThis.__appDb ?? createDb();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__appDb = db;
}

// ---------- helpers ----------

const COMPANY_SUFFIXES = ['inc', 'llc', 'ltd', 'corp', 'corporation', 'co', 'company', 'plc', 'gmbh'];
// Longer, low-ambiguity suffixes only (skip short ones like "co"/"inc"/"ltd" here — too many real
// company names end in those substrings, e.g. "Cisco", "Vinci"). Used as a fallback for names that
// arrived pre-glued with no word boundary (e.g. a domain label like "acmecorp").
const GLUED_SUFFIXES = ['corporation', 'corp', 'limited', 'gmbh'];

export function normalizeCompany(name: string): string {
  let s = name.toLowerCase();
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  const words = s.split(/\s+/).filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.includes(words[words.length - 1])) {
    words.pop();
  }
  let joined = words.join('');
  for (const suffix of GLUED_SUFFIXES) {
    if (joined.length > suffix.length + 2 && joined.endsWith(suffix)) {
      joined = joined.slice(0, joined.length - suffix.length);
      break;
    }
  }
  return joined;
}

interface ApplicationRow {
  id: number;
  company: string;
  role: string | null;
  status: Status;
  notes: string | null;
  user_edited: 0 | 1;
  created_at: string;
  updated_at: string;
}

interface EmailRow {
  gmail_id: string;
  thread_id: string | null;
  application_id: number | null;
  subject: string | null;
  from_addr: string | null;
  received_at: string | null;
  snippet: string | null;
  detected_status: string | null;
  is_job_related: 0 | 1;
  gmail_link: string | null;
}

function toEmailSummary(row: EmailRow): EmailSummary {
  return {
    gmail_id: row.gmail_id,
    subject: row.subject,
    from_addr: row.from_addr,
    received_at: row.received_at,
    snippet: row.snippet,
    gmail_link: row.gmail_link,
    detected_status: (row.detected_status as Status | null) ?? null,
  };
}

const emailsForAppStmt = db.prepare<[number]>(
  `SELECT * FROM emails WHERE application_id = ? ORDER BY received_at DESC, gmail_id DESC`
);

function attachEmails(row: ApplicationRow): Application {
  const emails = (emailsForAppStmt.all(row.id) as EmailRow[]).map(toEmailSummary);
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    notes: row.notes,
    user_edited: row.user_edited,
    created_at: row.created_at,
    updated_at: row.updated_at,
    emails,
  };
}

export function listApplications(): Application[] {
  const rows = db
    .prepare(`SELECT * FROM applications ORDER BY updated_at DESC, id DESC`)
    .all() as ApplicationRow[];
  return rows.map(attachEmails);
}

export function getApplication(id: number): Application | null {
  const row = db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id) as
    | ApplicationRow
    | undefined;
  if (!row) return null;
  return attachEmails(row);
}

export function createApplication(input: {
  company: string;
  role?: string | null;
  status: Status;
  notes?: string | null;
}): Application {
  const info = db
    .prepare(
      `INSERT INTO applications (company, role, status, notes) VALUES (?, ?, ?, ?)`
    )
    .run(input.company, input.role ?? null, input.status, input.notes ?? null);
  const app = getApplication(Number(info.lastInsertRowid));
  if (!app) throw new Error('failed to create application');
  return app;
}

export function updateApplication(
  id: number,
  patch: Partial<{
    company: string;
    role: string | null;
    status: Status;
    notes: string | null;
    user_edited: 0 | 1;
  }>
): Application | null {
  const existing = db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id) as
    | ApplicationRow
    | undefined;
  if (!existing) return null;

  const next = {
    company: patch.company ?? existing.company,
    role: patch.role !== undefined ? patch.role : existing.role,
    status: patch.status ?? existing.status,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    user_edited: patch.user_edited !== undefined ? patch.user_edited : existing.user_edited,
  };

  db.prepare(
    `UPDATE applications SET company = ?, role = ?, status = ?, notes = ?, user_edited = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(next.company, next.role, next.status, next.notes, next.user_edited, id);

  return getApplication(id);
}

export function deleteApplication(id: number): void {
  db.prepare(
    `UPDATE emails SET application_id = NULL, is_job_related = 0 WHERE application_id = ?`
  ).run(id);
  db.prepare(`DELETE FROM applications WHERE id = ?`).run(id);
}

export function upsertEmail(input: {
  gmail_id: string;
  thread_id?: string | null;
  application_id?: number | null;
  subject?: string | null;
  from_addr?: string | null;
  received_at?: string | null;
  snippet?: string | null;
  detected_status?: Status | null;
  is_job_related: 0 | 1;
  gmail_link?: string | null;
}): void {
  db.prepare(
    `INSERT INTO emails (gmail_id, thread_id, application_id, subject, from_addr, received_at, snippet, detected_status, is_job_related, gmail_link)
     VALUES (@gmail_id, @thread_id, @application_id, @subject, @from_addr, @received_at, @snippet, @detected_status, @is_job_related, @gmail_link)
     ON CONFLICT(gmail_id) DO UPDATE SET
       thread_id = excluded.thread_id,
       application_id = excluded.application_id,
       subject = excluded.subject,
       from_addr = excluded.from_addr,
       received_at = excluded.received_at,
       snippet = excluded.snippet,
       detected_status = excluded.detected_status,
       is_job_related = excluded.is_job_related,
       gmail_link = excluded.gmail_link`
  ).run({
    gmail_id: input.gmail_id,
    thread_id: input.thread_id ?? null,
    application_id: input.application_id ?? null,
    subject: input.subject ?? null,
    from_addr: input.from_addr ?? null,
    received_at: input.received_at ?? null,
    snippet: input.snippet ?? null,
    detected_status: input.detected_status ?? null,
    is_job_related: input.is_job_related,
    gmail_link: input.gmail_link ?? null,
  });
}

export function emailExists(gmail_id: string): boolean {
  const row = db.prepare(`SELECT 1 FROM emails WHERE gmail_id = ?`).get(gmail_id);
  return !!row;
}

export function findApplicationByCompany(company: string): Application | null {
  const target = normalizeCompany(company);
  if (!target) return null;
  const rows = db.prepare(`SELECT * FROM applications`).all() as ApplicationRow[];
  const match = rows.find((r) => normalizeCompany(r.company) === target);
  return match ? attachEmails(match) : null;
}

export function getSyncState(key: string): string | null {
  const row = db.prepare(`SELECT value FROM sync_state WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function setSyncState(key: string, value: string): void {
  db.prepare(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}
