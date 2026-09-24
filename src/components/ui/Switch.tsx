import type { ComponentPropsWithoutRef } from "react";

type SwitchOwnProps = {
  checked: boolean;
  onChange: ComponentPropsWithoutRef<"input">["onChange"];
  label: string;
};

export type SwitchProps = SwitchOwnProps &
  Omit<ComponentPropsWithoutRef<"input">, "type" | "checked" | "onChange" | keyof SwitchOwnProps>;

export function Switch({ checked, onChange, label, className = "", ...rest }: SwitchProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-ink-2 cursor-pointer select-none">
      <input
        type="checkbox"
        className={`sr-only peer ${className}`.trim()}
        checked={checked}
        onChange={onChange}
        {...rest}
      />
      <span className="relative h-5 w-9 rounded-pill bg-ink/15 transition-colors duration-(--dur-base) peer-checked:bg-ink/70 peer-focus-visible:shadow-focus peer-checked:[&>span]:translate-x-4">
        <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-pill bg-white shadow-sm transition-transform duration-(--dur-base) ease-(--ease-out)" />
      </span>
      <span>{label}</span>
    </label>
  );
}
