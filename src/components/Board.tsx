"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { Application, Status } from "@/lib/types";
import { ApiError, getApplications, patchApplication, runSync } from "./api";
import { formatRelative } from "./time";
import DetailPanel from "./DetailPanel";
import {
  Button,
  Column,
  GlassPanel,
  Pill,
  Switch,
  Toast,
  fadeUp,
  listStagger,
  springSoft,
} from "@/components/ui";

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
  const [dragOverKey, setDragOverKey] = useState<Status | null>(null);
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
        <GlassPanel strength="strong" className="w-full max-w-sm rounded-xl p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold tracking-tight text-ink">
            Session expired
          </h1>
          <p className="mb-6 text-sm text-ink-2">
            Please sign in again to continue.
          </p>
          <Button fullWidth onClick={() => signIn("google")}>
            Sign in with Google
          </Button>
        </GlassPanel>
      </div>
    );
  }

  const all = applications ?? [];
  const selected = all.find((a) => a.id === selectedId) ?? null;
  const ignoredCount = all.filter((a) => a.status === "ignored").length;
  const columns = showIgnored ? [...COLUMNS, IGNORED_COLUMN] : COLUMNS;

  return (
    <div className="flex flex-1 flex-col">
      <GlassPanel
        as="header"
        strength="strong"
        className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-6 py-4"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Job Kanban</h1>
          <span className="text-sm text-ink-3">{userEmail}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Toast message={syncToast} />
          <span className="text-xs text-ink-3 tabular-nums">
            Synced {formatRelative(lastSyncedAt)}
          </span>
          <Switch
            checked={showIgnored}
            onChange={(e) => setShowIgnored(e.target.checked)}
            label={`Show ignored${ignoredCount ? ` (${ignoredCount})` : ""}`}
          />
          <Button variant="secondary" size="sm" loading={syncing} onClick={doSync}>
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </GlassPanel>

      <main className="flex-1 overflow-x-auto px-6 py-6">
        {loading ? (
          <div
            className={`grid gap-4 ${
              showIgnored ? "min-w-[1120px] grid-cols-5" : "min-w-[900px] grid-cols-4"
            }`}
          >
            {(showIgnored ? [...COLUMNS, IGNORED_COLUMN] : COLUMNS).map((col) => (
              <Column key={col.key} title={col.label} count={0} status={col.key}>
                <div className="glass rounded-md h-20 animate-pulse" />
                <div className="glass rounded-md h-20 animate-pulse" />
              </Column>
            ))}
          </div>
        ) : loadError ? (
          <p className="text-sm text-status-red-fg">{loadError}</p>
        ) : all.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <GlassPanel strength="strong" className="max-w-sm rounded-xl p-8 text-center">
              <h2 className="mb-2 text-lg font-semibold tracking-tight text-ink">
                No applications yet
              </h2>
              <p className="mb-6 text-sm text-ink-2">
                Sync your Gmail to detect job application emails automatically.
              </p>
              <Button loading={syncing} onClick={doSync}>
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            </GlassPanel>
          </div>
        ) : (
          <LayoutGroup>
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
                  <Column
                    key={col.key}
                    title={col.label}
                    count={cards.length}
                    status={col.key}
                    isOver={dragOverKey === col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverKey(col.key);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragOverKey(col.key);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverKey((cur) => (cur === col.key ? null : cur));
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverKey(null);
                      if (draggingId != null) handleDrop(draggingId, col.key);
                    }}
                  >
                    <motion.div
                      className="flex flex-col gap-2.5"
                      initial="hidden"
                      animate="show"
                      variants={listStagger}
                    >
                      <AnimatePresence initial={false}>
                        {cards.map((app) => (
                          <Card
                            key={app.id}
                            app={app}
                            dragging={draggingId === app.id}
                            onClick={() => setSelectedId(app.id)}
                            onDragStart={() => setDraggingId(app.id)}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverKey(null);
                            }}
                          />
                        ))}
                      </AnimatePresence>
                      {cards.length === 0 && (
                        <p className="px-1 py-2 text-xs text-ink-4">No applications</p>
                      )}
                    </motion.div>
                  </Column>
                );
              })}
            </div>
          </LayoutGroup>
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
  dragging,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  app: Application;
  dragging: boolean;
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
      className={app.status === "ignored" ? "opacity-60" : undefined}
    >
      <motion.div
        layout
        layoutId={`app-${app.id}`}
        transition={springSoft}
        initial="hidden"
        animate="show"
        exit={{ opacity: 0, scale: 0.98 }}
        variants={fadeUp}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={`glass rounded-md p-4 cursor-grab active:cursor-grabbing hover:shadow-glass-hover transition-shadow duration-(--dur-base) ${
          dragging ? "opacity-50" : ""
        }`.trim()}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink tracking-tight">{app.company}</p>
          {app.user_edited === 1 && (
            <Pill tone="neutral" size="xs" className="shrink-0">
              edited
            </Pill>
          )}
        </div>
        {app.role && <p className="mt-0.5 text-sm text-ink-2">{app.role}</p>}
        <div className="mt-3 flex items-center justify-between text-xs text-ink-3">
          <span>{latest ? formatRelative(new Date(latest).toISOString()) : "no emails"}</span>
          <Pill tone="neutral" size="xs">
            {app.emails.length} {app.emails.length === 1 ? "email" : "emails"}
          </Pill>
        </div>
      </motion.div>
    </div>
  );
}
