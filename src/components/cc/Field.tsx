import * as React from "react";
import { cn } from "@/lib/utils";

/** Bespoke text input — matches the cc token layer (no shadcn). */
export const CCInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-0)] px-3 text-sm text-[color:var(--cc-ink-900)] placeholder:text-[color:var(--cc-ink-500)] cc-focus-ring transition-colors hover:border-[color:var(--cc-ink-300)] disabled:opacity-60",
        className,
      )}
      {...rest}
    />
  ),
);
CCInput.displayName = "CCInput";

export const CCSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-0)] px-3 text-sm text-[color:var(--cc-ink-900)] cc-focus-ring",
        className,
      )}
      {...rest}
    />
  ),
);
CCSelect.displayName = "CCSelect";

export function CCField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--cc-ink-500)]">{label}</span>
      {children}
      {error
        ? <span className="block text-xs text-[color:var(--cc-danger)]">{error}</span>
        : hint
          ? <span className="block text-xs text-[color:var(--cc-ink-500)]">{hint}</span>
          : null}
    </label>
  );
}

/** Bottom-line table style, no border-radius, no card chrome — matches existing app pattern. */
export function CCTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <table className={cn("w-full text-sm", className)}>
      {children}
    </table>
  );
}
export function CCThead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="text-left text-xs font-medium uppercase tracking-wide text-[color:var(--cc-ink-500)] border-b border-[color:var(--cc-ink-200)]">
      {children}
    </thead>
  );
}
export function CCTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}
export function CCTd({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}
export function CCTr({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-[color:var(--cc-ink-100)] last:border-b-0",
        onClick && "cursor-pointer hover:bg-[color:var(--cc-ink-50)]",
        className,
      )}
    >
      {children}
    </tr>
  );
}