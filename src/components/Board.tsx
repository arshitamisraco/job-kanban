"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import type { Application, Status } from "@/lib/types";
import { ApiError, getApplications, patchApplication, runSync } from "./api";
import { formatRelative } from "./time";
import DetailPanel from "./DetailPanel";

const SYNC_INTERVAL_MS = 120_000;

const COLUMNS: { key: Status; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
];

const IGNORED_COLUMN: { key: Status; label: string } = {
  key: "ignored",
  label: "Ignored",
};

function latestEmailTime(app: Application): number {
  let max = 0;
  for (const email of app.emails) {
    if (!email.received_at) continue;
    const t = new Date(email.received_at).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

export default function Board({ userEmail }: { userEmail: string }) {
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadApplications = useCallback(async () => {
    try {
      const { applications } = await getApplications();
      setApplications(applications);
      setLoadError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUnauthorized(true);
      } else {
        setLoadError(e instanceof Error ? e.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await runSync();
      setLastSyncedAt(result.lastSyncAt);
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} new`);
      if (result.updated) parts.push(`${result.updated} updated`);
      const message = result.error
        ? `Sync error: ${result.error}`
        : parts.length
        ? parts.join(", ")
        : "Up to date";
      setSyncToast(message);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setSyncToast(null), 5000);
      await loadApplications();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUnauthorized(true);
      } else {
        setSyncToast(e instanceof Error ? e.message : "Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }, [loadApplications]);

  useEffect(() => {
    // Fetch-on-mount + poll: setState inside loadApplications/doSync happens
    // after their internal await, so this is not a synchronous render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadApplications();
    doSync();
    const interval = setInterval(doSync, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render periodically so relative times ("2m ago") stay fresh.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function handleDrop(id: number, status: Status) {
    if (!applications) return;
    const prev = applications;
    const current = applications.find((a) => a.id === id);
    if (!current || current.status === status) return;
    setApplications(
      applications.map((a) => (a.id === id ? { ...a, status } : a))
    );
    try {
      const updated = await patchApplication(id, { status });
      setApplications((cur) =>
        (cur ?? prev).map((a) => (a.id === id ? updated : a))
      );
    } catch (e) {
      setApplications(prev);
      if (e instanceof ApiError && e.status === 401) {
        setUnauthorized(true);
      } else {
        setSyncToast(e instanceof Error ? e.message : "Failed to update status");
      }
    }
  }

  function handleUpdated(updated: Application) {
    setApplications((cur) =>
      (cur ?? []).map((a) => (a.id === updated.id ? updated : a))
    );
  }

  function handleDeleted(id: number) {
    setApplications((cur) => (cur ?? []).filter((a) => a.id !== id));
  }

  if (unauthorized) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-lg">
          <h1 className="mb-2 text-xl font-semibold text-neutral-100">
            Session expired
          </h1>
          <p className="mb-6 text-sm text-neutral-400">
            Please sign in again to continue.
          </p>
          <button
            onClick={() => signIn("google")}
            className="w-full rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const all = applications ?? [];
  const selected = all.find((a) => a.id === selectedId) ?? null;
  const ignoredCount = all.filter((a) => a.status === "ignored").length;
  const columns = showIgnored ? [...COLUMNS, IGNORED_COLUMN] : COLUMNS;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-neutral-100">Job Kanban</h1>
          <span className="text-sm text-neutral-500">{userEmail}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {syncToast && (
            <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
              {syncToast}
            </span>
          )}
          <span className="text-xs text-neutral-500">
            Synced {formatRelative(lastSyncedAt)}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={showIgnored}
              onChange={(e) => setShowIgnored(e.target.checked)}
              className="accent-neutral-400"
            />
            Show ignored{ignoredCount ? ` (${ignoredCount})` : ""}
          </label>
          <button
            onClick={doSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {syncing && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-500 border-t-neutral-100" />
            )}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            onClick={() => signOut()}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto px-6 py-6">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading applications…</p>
        ) : loadError ? (
          <p className="text-sm text-red-400">{loadError}</p>
        ) : all.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-neutral-300">No applications yet.</p>
            <p className="max-w-sm text-sm text-neutral-500">
              Sync your Gmail to detect job application emails automatically.
            </p>
            <button
              onClick={doSync}
              disabled={syncing}
              className="mt-2 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-60"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        ) : (
          <div
            className={`grid gap-4 ${
              showIgnored ? "min-w-[1120px] grid-cols-5" : "min-w-[900px] grid-cols-4"
            }`}
          >
            {columns.map((col) => {
              const cards = all
                .filter((a) => a.status === col.key)
                .sort((a, b) => latestEmailTime(b) - latestEmailTime(a));
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingId != null) handleDrop(draggingId, col.key);
                  }}
                  className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-neutral-200">
                      {col.label}
                    </h2>
                    <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                      {cards.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {cards.map((app) => (
                      <Card
                        key={app.id}
                        app={app}
                        onClick={() => setSelectedId(app.id)}
                        onDragStart={() => setDraggingId(app.id)}
                        onDragEnd={() => setDraggingId(null)}
                      />
                    ))}
                    {cards.length === 0 && (
                      <p className="px-1 py-2 text-xs text-neutral-600">
                        No applications
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {selected && (
        <DetailPanel
          key={selected.id}
          application={selected}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function Card({
  app,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  app: Application;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const latest = latestEmailTime(app);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="cursor-grab rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm shadow-sm transition hover:border-neutral-600 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-neutral-100">{app.company}</p>
        {app.user_edited === 1 && (
          <span className="shrink-0 rounded-full bg-sky-950 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
            edited
          </span>
        )}
      </div>
      {app.role && <p className="mt-0.5 text-neutral-400">{app.role}</p>}
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{latest ? formatRelative(new Date(latest).toISOString()) : "no emails"}</span>
        <span className="rounded-full bg-neutral-800 px-1.5 py-0.5">
          {app.emails.length} {app.emails.length === 1 ? "email" : "emails"}
        </span>
      </div>
    </div>
  );
}
