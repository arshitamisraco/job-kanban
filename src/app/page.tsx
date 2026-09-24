"use client";

import { signIn, useSession } from "next-auth/react";
import { motion } from "motion/react";
import Board from "@/components/Board";
import { Button, GlassPanel, Spinner, fadeUp } from "@/components/ui";

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

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <GlassPanel
            strength="strong"
            className="w-full max-w-sm p-8 text-center rounded-xl"
          >
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Job Kanban
            </h1>
            <p className="mb-6 mt-2 text-sm text-ink-2">
              Sign in to track job applications detected from your Gmail inbox.
            </p>
            <Button fullWidth onClick={() => signIn("google")}>
              Sign in with Google
            </Button>
          </GlassPanel>
        </motion.div>
      </div>
    );
  }

  return <Board userEmail={session.user?.email ?? "unknown"} />;
}
