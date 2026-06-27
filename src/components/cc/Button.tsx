import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Hand-rolled call-centre button. Uses the cc token layer only — no shadcn.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap " +
  "transition-[background,color,box-shadow] duration-[var(--cc-dur-fast)] " +
  "ease-[var(--cc-ease)] cc-focus-ring disabled:opacity-50 disabled:cursor-not-allowed " +
  "rounded-[var(--cc-radius-md)]";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--cc-brand-600)] text-white hover:bg-[var(--cc-brand-700)] shadow-[var(--cc-shadow-sm)]",
  secondary:
    "bg-[var(--cc-ink-100)] text-[var(--cc-ink-900)] hover:bg-[var(--cc-ink-200)] border border-[var(--cc-ink-200)]",
  ghost:
    "bg-transparent text-[var(--cc-ink-700)] hover:bg-[var(--cc-ink-100)]",
  danger:
    "bg-[var(--cc-danger)] text-white hover:brightness-95 shadow-[var(--cc-shadow-sm)]",
  success:
    "bg-[var(--cc-success)] text-white hover:brightness-95 shadow-[var(--cc-shadow-sm)]",
};

export interface CCButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const CCButton = React.forwardRef<HTMLButtonElement, CCButtonProps>(
  ({ variant = "primary", size = "md", className, ...rest }, ref) => (
    <button ref={ref} className={cn(base, sizes[size], variants[variant], className)} {...rest} />
  ),
);
CCButton.displayName = "CCButton";