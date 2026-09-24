import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { Status } from "@/lib/types";
import { Pill, STATUS_TONE } from "./Pill";

const TONE_DOT_CLASS = {
  neutral: "bg-status-neutral",
  yellow: "bg-status-yellow",
  green: "bg-status-green",
  red: "bg-status-red",
} as const;

const TONE_RING_CLASS = {
  neutral: "ring-status-neutral/40",
  yellow: "ring-status-yellow/40",
  green: "ring-status-green/40",
  red: "ring-status-red/40",
} as const;

type ColumnOwnProps = {
  title: string;
  count: number;
  status: Status;
  isOver?: boolean;
  className?: string;
  children?: ReactNode;
};

export type ColumnProps = ColumnOwnProps &
  Omit<ComponentPropsWithoutRef<"div">, keyof ColumnOwnProps>;

export function Column({
  title,
  count,
  status,
  isOver = false,
  className = "",
  children,
  ...rest
}: ColumnProps) {
  const tone = STATUS_TONE[status];

  return (
    <div
      className={`glass ${isOver ? "" : "glass-soft"} rounded-lg p-3 flex flex-col gap-3 min-h-[240px] transition-[background-color,box-shadow] duration-(--dur-base) ${
        isOver ? `ring-2 ring-inset ${TONE_RING_CLASS[tone]}` : ""
      } ${className}`.trim()}
      {...rest}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-pill ${TONE_DOT_CLASS[tone]}`}
          />
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        <Pill tone="neutral" size="xs">
          <span className="tabular-nums">{count}</span>
        </Pill>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}
