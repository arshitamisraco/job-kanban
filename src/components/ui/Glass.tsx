import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type GlassStrength = "soft" | "base" | "strong";
type GlassAs = "div" | "section" | "header" | "aside";

const STRENGTH_CLASS: Record<GlassStrength, string> = {
  soft: "glass glass-soft",
  base: "glass",
  strong: "glass glass-strong",
};

type GlassPanelOwnProps = {
  as?: GlassAs;
  strength?: GlassStrength;
  className?: string;
  children?: ReactNode;
};

export type GlassPanelProps = GlassPanelOwnProps &
  Omit<ComponentPropsWithoutRef<GlassAs>, keyof GlassPanelOwnProps>;

export function GlassPanel({
  as = "div",
  strength = "base",
  className = "",
  children,
  ...rest
}: GlassPanelProps) {
  const Tag = as as ElementType;
  return (
    <Tag
      className={`${STRENGTH_CLASS[strength]} rounded-lg ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
