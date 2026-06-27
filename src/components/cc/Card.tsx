import * as React from "react";
import { cn } from "@/lib/utils";

export function CCCard({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] p-[var(--cc-space-5)]",
        className,
      )}
      {...rest}
    />
  );
}

export function CCCardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mb-[var(--cc-space-3)] flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-semibold tracking-tight text-[color:var(--cc-ink-900)]">{title}</h3>
      {hint && <span className="text-xs text-[color:var(--cc-ink-500)]">{hint}</span>}
    </header>
  );
}

export function CCStat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <CCCard>
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--cc-ink-500)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--cc-ink-900)]">
        {value}
      </p>
      {delta && (
        <p className="mt-1 text-xs text-[color:var(--cc-success)]">{delta}</p>
      )}
    </CCCard>
  );
}