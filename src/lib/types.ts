export type Status = 'applied' | 'interviewing' | 'offer' | 'rejected' | 'ignored';
export interface EmailSummary { gmail_id: string; subject: string|null; from_addr: string|null; received_at: string|null; snippet: string|null; gmail_link: string|null; detected_status: Status|null; }
export interface Application { id: number; company: string; role: string|null; status: Status; notes: string|null; user_edited: 0|1; created_at: string; updated_at: string; emails: EmailSummary[]; }
export interface Classification { is_job_related: boolean; company: string|null; role: string|null; status: Status|null; confidence: number; }
