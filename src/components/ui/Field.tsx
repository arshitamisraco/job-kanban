import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

export const fieldClass =
  "w-full rounded-sm border border-glass-edge bg-field px-3 py-2 text-sm text-ink placeholder:text-ink-4 transition-[box-shadow,border-color,background-color] duration-(--dur-fast) hover:border-ink/15 focus-visible:bg-field-focus focus-visible:shadow-focus";

function mergeClass(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
};

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-2">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-ink-3">{hint}</span> : null}
    </label>
  );
}

export type InputProps = ComponentPropsWithoutRef<"input">;

export function Input({ className, ...rest }: InputProps) {
  return <input className={mergeClass(fieldClass, className)} {...rest} />;
}

export type SelectProps = ComponentPropsWithoutRef<"select">;

export function Select({ className, ...rest }: SelectProps) {
  return <select className={mergeClass(fieldClass, className)} {...rest} />;
}

export type TextareaProps = ComponentPropsWithoutRef<"textarea">;

export function Textarea({ className, ...rest }: TextareaProps) {
  return <textarea className={mergeClass(fieldClass, className)} {...rest} />;
}
