"use client";

import { useEffect, useState } from "react";
import type { Application, Status } from "@/lib/types";
import { deleteApplication, patchApplication, ApiError } from "./api";
import { formatRelative } from "./time";

const STATUS_OPTIONS: Status[] = [
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "ignored",
];

export default function DetailPanel({
  application,
  onClose,
  onUpdated,
  onDeleted,
}: {
  application: Application;
  onClose: () => void;
  onUpdated: (app: Application) => void;
  onDeleted: (id: number) => void;
}) {
  const [company, setCompany] = useState(application.company);
  const [role, setRole] = useState(application.role ?? "");
  const [status, setStatus] = useState<Status>(application.status);
  const [notes, setNotes] = useState(application.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(patch: Partial<{
    company: string;
    role: string;
    status: Status;
    notes: string;
  }>) {
    setSaving(true);
    setError(null);
    try {
      const updated = await patchApplication(application.id, patch);
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await save({ company, role, status, notes });
  }

  async function handleMarkIgnored() {
    setStatus("ignored");
    await save({ status: "ignored" });
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${application.company}" application? This cannot be undone.`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteApplication(application.id);
      onDeleted(application.id);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete");
      setSaving(false);
    }
  }

  const sortedEmails = [...application.emails].sort((a, b) => {
    const da = a.received_at ? new Date(a.received_at).getTime() : 0;
    const db = b.received_at ? new Date(b.received_at).getTime() : 0;
    return db - da;
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-neutral-800 bg-neutral-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-200">
            Application details
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-5 py-4">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Company
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Role
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
            />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-xs text-emerald-400">Saved</span>}
          </div>

          <div className="flex flex-col gap-2 border-t border-neutral-800 pt-4">
            <button
              onClick={handleMarkIgnored}
              disabled={saving}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-left text-sm text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-50"
            >
              Mark not job-related
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="rounded-md border border-red-900 px-3 py-1.5 text-left text-sm text-red-400 transition hover:bg-red-950 disabled:opacity-50"
            >
              Delete
            </button>
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Emails ({sortedEmails.length})
            </h3>
            <ul className="flex flex-col gap-3">
              {sortedEmails.map((email) => (
                <li
                  key={email.gmail_id}
                  className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm"
                >
                  <p className="font-medium text-neutral-200">
                    {email.subject || "(no subject)"}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {email.from_addr || "unknown sender"} ·{" "}
                    {formatRelative(email.received_at)}
                  </p>
                  {email.snippet && (
                    <p className="mt-1.5 text-xs text-neutral-400">
                      {email.snippet}
                    </p>
                  )}
                  {email.gmail_link && (
                    <a
                      href={email.gmail_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-xs text-sky-400 hover:underline"
                    >
                      Open in Gmail →
                    </a>
                  )}
                </li>
              ))}
              {sortedEmails.length === 0 && (
                <p className="text-xs text-neutral-500">No emails linked.</p>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
