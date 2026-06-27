import * as React from "react";
import { cn } from "@/lib/utils";

/** A consistent surface for grouping form fields with a title and optional hint. */
export function CCFormSection({
  title,
  hint,
  children,
  actions,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] p-[var(--cc-space-5)] space-y-4">
      {(title || actions) && (
        <header className="flex items-baseline justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-tight text-[color:var(--cc-ink-900)]">{title}</h3>}
            {hint && <p className="text-xs text-[color:var(--cc-ink-500)]">{hint}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/** Responsive 2-column grid for form fields. */
export function CCFormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const map = { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" } as const;
  return <div className={cn("grid gap-4 grid-cols-1", map[cols])}>{children}</div>;
}

export const CCTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[88px] w-full rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-0)] px-3 py-2 text-sm text-[color:var(--cc-ink-900)] placeholder:text-[color:var(--cc-ink-500)] cc-focus-ring",
        className,
      )}
      {...rest}
    />
  ),
);
CCTextarea.displayName = "CCTextarea";

/** Inline button-style radio group used for outcomes / priorities. */
export function CCChoiceGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T | null | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string; tone?: "positive" | "neutral" | "negative" }[];
  ariaLabel?: string;
}) {
  const toneClass = (t: string | undefined, active: boolean) => {
    if (!active) return "bg-[color:var(--cc-ink-0)] text-[color:var(--cc-ink-700)] border-[color:var(--cc-ink-200)] hover:border-[color:var(--cc-ink-300)]";
    if (t === "positive") return "bg-[var(--cc-success-soft)] text-[color:var(--cc-success)] border-[color:var(--cc-success)]";
    if (t === "negative") return "bg-[var(--cc-danger-soft)] text-[color:var(--cc-danger)] border-[color:var(--cc-danger)]";
    return "bg-[var(--cc-info-soft)] text-[color:var(--cc-info)] border-[color:var(--cc-info)]";
  };
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cc-focus-ring",
              toneClass(o.tone, active),
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function CCCheckbox({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-[color:var(--cc-ink-300)] text-[color:var(--cc-brand)] cc-focus-ring"
      />
      <span className="text-sm text-[color:var(--cc-ink-900)]">
        {label}
        {hint && <span className="block text-xs text-[color:var(--cc-ink-500)]">{hint}</span>}
      </span>
    </label>
  );
}