import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<Tone, string> = {
  success: "bg-[var(--cc-success-soft)] text-[color:var(--cc-success)]",
  warning: "bg-[var(--cc-warning-soft)] text-[color:oklch(0.45_0.15_70)]",
  danger:  "bg-[var(--cc-danger-soft)]  text-[color:var(--cc-danger)]",
  info:    "bg-[var(--cc-info-soft)]    text-[color:var(--cc-info)]",
  neutral: "bg-[var(--cc-ink-100)]      text-[color:var(--cc-ink-700)]",
};

export function CCStatusPill({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      )}
      {children}
    </span>
  );
}

type Presence = "available" | "busy" | "acw" | "offline";
const presenceVar: Record<Presence, string> = {
  available: "var(--cc-presence-available)",
  busy: "var(--cc-presence-busy)",
  acw: "var(--cc-presence-acw)",
  offline: "var(--cc-presence-offline)",
};
const presenceLabel: Record<Presence, string> = {
  available: "Available",
  busy: "On call",
  acw: "Wrap-up",
  offline: "Offline",
};

/** Live agent presence indicator with subtle pulse on active states. */
export function CCPresence({ status }: { status: Presence }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[color:var(--cc-ink-700)]">
      <span className="relative inline-flex">
        <span
          className="size-2 rounded-full"
          style={{ background: presenceVar[status] }}
          aria-hidden
        />
        {(status === "available" || status === "busy") && (
          <span
            className="absolute inset-0 size-2 rounded-full animate-ping opacity-60"
            style={{ background: presenceVar[status] }}
            aria-hidden
          />
        )}
      </span>
      <span>{presenceLabel[status]}</span>
    </span>
  );
}