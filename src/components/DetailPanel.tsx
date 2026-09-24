"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Application, Status } from "@/lib/types";
import { deleteApplication, patchApplication, ApiError } from "./api";
import { formatRelative } from "./time";
import {
  Button,
  Field,
  Input,
  Select,
  Sheet,
  StatusPill,
  Textarea,
  STATUS_LABEL,
  fadeUp,
  listStagger,
  spring,
} from "@/components/ui";

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
    <Sheet open onClose={onClose} title="Application details">
      <div className="flex flex-1 flex-col gap-5 px-6 py-6">
        <Field label="Company">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>

        <Field label="Role">
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </Field>

        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="-mt-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={status}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={spring}
              className="inline-flex"
            >
              <StatusPill status={status} />
            </motion.div>
          </AnimatePresence>
        </div>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </Field>

        {error && <p className="text-xs text-status-red-fg">{error}</p>}

        <div className="flex items-center gap-3">
          <Button variant="primary" loading={saving} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="text-xs text-status-green-fg"
              >
                Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 border-t border-line pt-5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkIgnored}
            disabled={saving}
          >
            Mark not job-related
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={saving}
          >
            Delete
          </Button>
        </div>

        <div className="border-t border-line pt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Emails ({sortedEmails.length})
            </h3>
          </div>
          {sortedEmails.length === 0 ? (
            <p className="text-xs text-ink-3">No emails linked.</p>
          ) : (
            <motion.ul
              variants={listStagger}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-3"
            >
              {sortedEmails.map((email) => (
                <motion.li
                  key={email.gmail_id}
                  variants={fadeUp}
                  className="glass glass-soft rounded-md p-3"
                >
                  <p className="text-sm font-medium text-ink">
                    {email.subject || "(no subject)"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3 min-w-0">
                    <span className="truncate min-w-0">
                      {email.from_addr || "unknown sender"}
                    </span>
                    <span className="shrink-0">
                      · {formatRelative(email.received_at)}
                    </span>
                    {email.detected_status && (
                      <StatusPill
                        status={email.detected_status}
                        size="xs"
                        className="shrink-0"
                      />
                    )}
                  </p>
                  {email.snippet && (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
                      {email.snippet}
                    </p>
                  )}
                  {email.gmail_link && (
                    <a
                      href={email.gmail_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-xs font-medium text-ink underline-offset-2 hover:underline"
                    >
                      Open in Gmail →
                    </a>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}
