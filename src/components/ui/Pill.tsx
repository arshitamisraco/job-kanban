import type { ReactNode } from "react";
import type { Status } from "@/lib/types";

export type Tone = "neutral" | "yellow" | "green" | "red";
export type PillSize = "xs" | "sm";

const SIZE_CLASS: Record<PillSize, string> = {
  xs: "h-5 px-2 text-xs",
  sm: "h-6 px-2.5 text-xs",
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-status-neutral-bg text-status-neutral-fg",
  yellow: "bg-status-yellow-bg text-status-yellow-fg",
  green: "bg-status-green-bg text-status-green-fg",
  red: "bg-status-red-bg text-status-red-fg",
};

const TONE_DOT_CLASS: Record<Tone, string> = {
  neutral: "bg-status-neutral",
  yellow: "bg-status-yellow",
  green: "bg-status-green",
  red: "bg-status-red",
};

export const STATUS_TONE: Record<Status, Tone> = {
  applied: "neutral",
  interviewing: "yellow",
  offer: "green",
  rejected: "red",
  ignored: "neutral",
};

export const STATUS_LABEL: Record<Status, string> = {
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  ignored: "Ignored",
};

export type PillProps = {
  tone?: Tone;
  dot?: boolean;
  size?: PillSize;
  className?: string;
  children?: ReactNode;
};

export function Pill({
  tone = "neutral",
  dot = false,
  size = "sm",
  className = "",
  children,
}: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill font-medium whitespace-nowrap ${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-pill ${TONE_DOT_CLASS[tone]}`}
        />
      ) : null}
      {children}
    </span>
  );
}

export type StatusPillProps = {
  status: Status;
  size?: PillSize;
  className?: string;
};

export function StatusPill({ status, size = "sm", className = "" }: StatusPillProps) {
  return (
    <Pill
      tone={STATUS_TONE[status]}
      dot
      size={size}
      className={`${status === "ignored" ? "opacity-70" : ""} ${className}`.trim()}
    >
      {STATUS_LABEL[status]}
    </Pill>
  );
}
