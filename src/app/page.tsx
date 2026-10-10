"use client";

import { useSession } from "next-auth/react";
import Board from "@/components/Board";
import { Spinner } from "@/components/ui";

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
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={20} className="text-ink-3" />
          <p className="text-sm text-ink-3">Loading…</p>
        </div>
      </div>
    );
  }

  // Signed-out visitors see the read-only demo board instead of a sign-in wall.
  if (!session) {
    return <Board userEmail="demo" demo />;
  }

  return <Board userEmail={session.user?.email ?? "unknown"} />;
}
