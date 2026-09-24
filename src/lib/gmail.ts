import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

export interface FetchedEmail {
  gmail_id: string;
  thread_id: string | null;
  subject: string | null;
  from_addr: string | null;
  received_at: string | null; // ISO
  snippet: string | null;
  bodyText: string | null;
  gmail_link: string;
}

function gmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

let mockCache: FetchedEmail[] | null = null;

function loadMock(): FetchedEmail[] {
  if (mockCache) return mockCache;
  const filePath = path.join(process.cwd(), 'src', 'mock', 'emails.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as FetchedEmail[];
  mockCache = parsed.map((m) => ({
    ...m,
    gmail_link: m.gmail_link ?? `https://mail.google.com/mail/u/0/#all/${m.gmail_id}`,
  }));
  return mockCache;
}

export async function listMessageIds(
  accessToken: string,
  query: string,
  maxResults = 200
): Promise<string[]> {
  if (process.env.MOCK_MODE === '1') {
    return loadMock()
      .map((m) => m.gmail_id)
      .slice(0, maxResults);
  }

  const gmail = gmailClient(accessToken);
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(100, maxResults - ids.length),
      pageToken,
    });
    for (const m of res.data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < maxResults);

  return ids.slice(0, maxResults);
}

function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data, 'base64url').toString('utf-8');
  } catch {
    return '';
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

interface GmailPart {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
}

function extractBodyText(payload: GmailPart | null | undefined): string {
  if (!payload) return '';
  let plain: string | null = null;
  let html: string | null = null;

  function walk(part: GmailPart | null | undefined) {
    if (!part) return;
    if (part.body?.data) {
      if (part.mimeType === 'text/plain' && !plain) {
        plain = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && !html) {
        html = decodeBase64Url(part.body.data);
      }
    }
    if (part.parts) {
      for (const p of part.parts) walk(p);
    }
  }
  walk(payload);

  if (plain) return plain;
  if (html) return stripHtml(html);
  return '';
}

export async function getMessage(accessToken: string, id: string): Promise<FetchedEmail | null> {
  if (process.env.MOCK_MODE === '1') {
    return loadMock().find((m) => m.gmail_id === id) ?? null;
  }

  const gmail = gmailClient(accessToken);
  const res = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

  const subject = getHeader('subject');
  const from = getHeader('from');
  const dateHeader = getHeader('date');
  let receivedAt: string | null = null;
  if (msg.internalDate) {
    receivedAt = new Date(Number(msg.internalDate)).toISOString();
  } else if (dateHeader) {
    const d = new Date(dateHeader);
    receivedAt = Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const snippet = (msg.snippet ?? '').slice(0, 200);
  const bodyText = extractBodyText(msg.payload as GmailPart | undefined).slice(0, 2000);

  return {
    gmail_id: id,
    thread_id: msg.threadId ?? null,
    subject,
    from_addr: from,
    received_at: receivedAt,
    snippet,
    bodyText,
    gmail_link: `https://mail.google.com/mail/u/0/#all/${id}`,
  };
}
