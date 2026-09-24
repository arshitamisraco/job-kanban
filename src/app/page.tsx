"use client";

import { signIn, useSession } from "next-auth/react";
import Board from "@/components/Board";

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "1";

export default function Home() {
  if (MOCK_MODE) {
    return <Board userEmail="mock user" />;
  }
  return <AuthGate />;
}

function AuthGate() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-lg">
          <h1 className="mb-2 text-xl font-semibold text-neutral-100">
            Job Kanban
          </h1>
          <p className="mb-6 text-sm text-neutral-400">
            Sign in to track job applications detected from your Gmail inbox.
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

  return <Board userEmail={session.user?.email ?? "unknown"} />;
}
