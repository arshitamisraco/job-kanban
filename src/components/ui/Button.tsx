import type { ComponentPropsWithoutRef } from "react";
import { motion } from "motion/react";
import { spring } from "./motion";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:brightness-110",
  secondary: "glass glass-strong text-ink hover:shadow-glass-hover",
  ghost: "bg-transparent text-ink hover:bg-ink/5",
  danger: "border border-status-red/50 text-status-red-fg hover:bg-status-red-bg",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-sm",
  md: "h-9.5 px-4 text-sm rounded-md",
};

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
};

export type ButtonProps = ButtonOwnProps &
  Omit<
    ComponentPropsWithoutRef<"button">,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | keyof ButtonOwnProps
  >;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={isDisabled ? undefined : { y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={spring}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 select-none font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        VARIANT_CLASS[variant]
      } ${SIZE_CLASS[size]} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : null}
      {children}
    </motion.button>
  );
}
