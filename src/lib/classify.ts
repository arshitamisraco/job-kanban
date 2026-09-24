import Anthropic from '@anthropic-ai/sdk';
import type { Classification, Status } from './types';

export interface ClassifyInput {
  subject: string | null;
  from_addr: string | null;
  received_at: string | null;
  snippet: string | null;
  bodyText: string | null;
}

const MODEL = 'claude-haiku-4-5-20251001';

const ATS_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'hire.lever.co',
  'myworkday.com',
  'workday.com',
  'ashbyhq.com',
  'smartrecruiters.com',
  'icims.com',
  'jobvite.com',
];

const STATUSES: Status[] = ['applied', 'interviewing', 'offer', 'rejected', 'ignored'];

const SYSTEM_PROMPT = `You help a job seeker triage their Gmail inbox. Given the subject, sender, snippet, and
body text of a single email, decide whether it is about the user's OWN job application (not a newsletter,
receipt, marketing email, or general recruiter cold-outreach that isn't tied to an application already made).

If it is job-application-related, extract:
- company: the actual HIRING company the user applied to. This is often NOT the sender's domain — many
  emails are sent via an applicant tracking system (ATS) such as Greenhouse, Lever, Workday, Ashby,
  SmartRecruiters, iCIMS, or Jobvite. Use the company named in the email body/subject, not the ATS vendor.
- role: the job title/role applied for, if mentioned.
- status: one of applied | interviewing | offer | rejected, based on what this specific email indicates:
  - applied: confirms an application was submitted/received.
  - interviewing: invites to schedule or confirms an interview, phone screen, or call.
  - offer: extends a job offer.
  - rejected: says the candidate was not selected / the company is moving forward with other candidates.
- confidence: your confidence in this classification, 0 to 1.

Always call the record_classification tool with your answer.`;

const TOOL = {
  name: 'record_classification',
  description: 'Record the classification of a single email from a job seeker\'s inbox.',
  input_schema: {
    type: 'object' as const,
    properties: {
      is_job_related: {
        type: 'boolean',
        description: 'True if this email concerns the user\'s own job application.',
      },
      company: {
        type: ['string', 'null'],
        description: 'The hiring company name, or null if unknown/not job related.',
      },
      role: {
        type: ['string', 'null'],
        description: 'The job title/role, or null if unknown/not job related.',
      },
      status: {
        type: ['string', 'null'],
        enum: ['applied', 'interviewing', 'offer', 'rejected', null],
        description: 'The application status this email indicates, or null.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence from 0 to 1.',
      },
    },
    required: ['is_job_related', 'company', 'role', 'status', 'confidence'],
  },
};

function clampConfidence(n: unknown): number {
  const num = typeof n === 'number' && Number.isFinite(n) ? n : 0.5;
  return Math.max(0, Math.min(1, num));
}

function isValidStatus(s: unknown): s is Status {
  return typeof s === 'string' && (STATUSES as string[]).includes(s) && s !== 'ignored';
}

export async function classifyEmail(input: ClassifyInput): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return heuristicClassify(input);

  try {
    const client = new Anthropic({ apiKey });
    const userContent = [
      `Subject: ${input.subject ?? '(none)'}`,
      `From: ${input.from_addr ?? '(none)'}`,
      `Date: ${input.received_at ?? '(none)'}`,
      `Snippet: ${input.snippet ?? '(none)'}`,
      `Body:\n${(input.bodyText ?? '(none)').slice(0, 2000)}`,
    ].join('\n');

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'record_classification' },
      messages: [{ role: 'user', content: userContent }],
    });

    const toolUse = res.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    if (!toolUse) throw new Error('no tool_use block in response');

    const raw = toolUse.input as Record<string, unknown>;
    const is_job_related = Boolean(raw.is_job_related);
    const company = typeof raw.company === 'string' && raw.company.trim() ? raw.company.trim() : null;
    const role = typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : null;
    const status = isValidStatus(raw.status) ? raw.status : null;
    const confidence = clampConfidence(raw.confidence);

    return {
      is_job_related,
      company: is_job_related ? company : null,
      role: is_job_related ? role : null,
      status: is_job_related ? status : null,
      confidence,
    };
  } catch (err) {
    console.error('classifyEmail: Claude call failed, falling back to heuristic', err);
    return heuristicClassify(input);
  }
}

// ---------- heuristic fallback ----------

const APPLIED_KEYWORDS = [
  'thank you for applying',
  'thanks for applying',
  'application received',
  'we received your application',
  'your application has been submitted',
  'received your application',
  'application has been received',
];

const INTERVIEWING_KEYWORDS = [
  'interview',
  'schedule a call',
  'schedule an interview',
  'phone screen',
  'schedule a time',
];

const OFFER_KEYWORDS = ['offer letter', 'pleased to offer', 'pleased to extend', 'excited to offer'];

const REJECTED_KEYWORDS = [
  'unfortunately',
  'not moving forward',
  'other candidates',
  'regret',
  'not selected',
  'will not be moving forward',
  'decided not to move forward',
];

function extractDomain(from: string | null): string | null {
  if (!from) return null;
  const match = from.match(/@([\w.-]+)/);
  return match ? match[1].toLowerCase() : null;
}

function extractDisplayName(from: string | null): string | null {
  if (!from) return null;
  const match = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  if (match) return match[1].trim();
  if (!from.includes('@')) return from.trim();
  return null;
}

function isAtsDomain(domain: string | null): boolean {
  if (!domain) return false;
  return ATS_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function cleanDisplayNameCompany(name: string): string {
  return name
    .replace(/\bvia\s+(lever|greenhouse|ashby|workday)\b.*$/i, '')
    .replace(/\b(recruiting|careers|talent team|talent acquisition|hiring team|hr|human resources)\b.*$/i, '')
    .replace(/[|,-]+$/, '')
    .trim();
}

const SUBJECT_COMPANY_PATTERNS: RegExp[] = [
  /applying to ([^!.,\n]+)/i,
  /application (?:to|for)\s+(?:the\s+)?.*?\bat\s+([^!.,\n]+)/i,
  /application (?:to|for) ([^!.,\n]+)/i,
  /interview(?:ing)? (?:at|with) ([^!.,\n]+)/i,
  /offer (?:from|at) ([^!.,\n]+)/i,
  /update on your application to ([^!.,\n]+)/i,
  /\bat ([^!.,\n]+)$/i,
  /\bto ([^!.,\n]+)$/i,
  /\bwith ([^!.,\n]+)$/i,
  /[-–—]\s*([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,4})\s*$/,
];

export function extractCompany(subject: string | null, from: string | null): string | null {
  if (subject) {
    for (const re of SUBJECT_COMPANY_PATTERNS) {
      const match = subject.match(re);
      if (match && match[1] && match[1].trim().length > 1) {
        return match[1].trim();
      }
    }
  }

  const domain = extractDomain(from);
  if (domain && !isAtsDomain(domain)) {
    const label = domain.split('.')[0];
    if (label && label !== 'no-reply' && label !== 'noreply') {
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }

  const displayName = extractDisplayName(from);
  if (displayName) {
    const cleaned = cleanDisplayNameCompany(displayName);
    if (cleaned) return cleaned;
  }

  return null;
}

const ROLE_PATTERNS: RegExp[] = [
  /for the (.+?)\s+(?:position|role)\b/i,
  /application for (?:the )?(.+?)(?:\s+position\b|\s+role\b|[.,!]|$)/i,
  /position:\s*(.+)/i,
];

function extractRole(text: string): string | null {
  for (const re of ROLE_PATTERNS) {
    const match = text.match(re);
    if (match && match[1] && match[1].trim().length > 1 && match[1].trim().length < 100) {
      return match[1].trim();
    }
  }
  return null;
}

export function heuristicClassify(input: ClassifyInput): Classification {
  const haystack = [input.subject, input.snippet, input.bodyText]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  let status: Status | null = null;
  if (REJECTED_KEYWORDS.some((k) => haystack.includes(k))) {
    status = 'rejected';
  } else if (OFFER_KEYWORDS.some((k) => haystack.includes(k))) {
    status = 'offer';
  } else if (INTERVIEWING_KEYWORDS.some((k) => haystack.includes(k))) {
    status = 'interviewing';
  } else if (APPLIED_KEYWORDS.some((k) => haystack.includes(k))) {
    status = 'applied';
  }

  if (!status) {
    return { is_job_related: false, company: null, role: null, status: null, confidence: 0.3 };
  }

  const company = extractCompany(input.subject, input.from_addr);
  const role = extractRole(`${input.subject ?? ''}\n${input.snippet ?? ''}\n${input.bodyText ?? ''}`);

  return {
    is_job_related: true,
    company,
    role,
    status,
    confidence: company ? 0.65 : 0.5,
  };
}
