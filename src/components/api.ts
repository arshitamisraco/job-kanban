import type { Application, Status } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export function getApplications(): Promise<{ applications: Application[] }> {
  return fetch("/api/applications").then((res) => handle(res));
}

export function patchApplication(
  id: number,
  body: { company?: string; role?: string; status?: Status; notes?: string }
): Promise<Application> {
  return fetch(`/api/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => handle(res));
}

export function deleteApplication(id: number): Promise<void> {
  return fetch(`/api/applications/${id}`, { method: "DELETE" }).then((res) =>
    handle(res)
  );
}

export interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
  lastSyncAt: string;
  error?: string;
}

export function runSync(): Promise<SyncResult> {
  return fetch("/api/sync", { method: "POST" }).then((res) => handle(res));
}

export function getSyncState(): Promise<{
  lastSyncAt: string | null;
  lastError: string | null;
}> {
  return fetch("/api/sync").then((res) => handle(res));
}
