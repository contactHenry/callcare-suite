/**
 * Shared state primitives — empty, loading, error, permission-denied.
 *
 * Phase 9 design-consistency pass: every screen built in phases 1–8 should
 * surface these four states identically. Keeps spacing, typography, and
 * color tokens aligned with the rest of the `cc/*` design system.
 */
import type { ReactNode } from "react";
import { Inbox, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "danger" | "warning";

function Shell({
  icon, title, body, action, tone = "neutral", className,
}: {
  icon: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const ring =
    tone === "danger" ? "text-[color:var(--cc-danger)] bg-[color:var(--cc-danger-soft)]"
    : tone === "warning" ? "text-[color:var(--cc-warning)] bg-[color:var(--cc-warning-soft)]"
    : "text-muted-foreground bg-muted";
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-14 px-6", className)}>
      <div className={cn("size-12 rounded-full flex items-center justify-center mb-4", ring)}>{icon}</div>
      <div className="text-sm font-semibold tracking-tight text-foreground">{title}</div>
      {body && <div className="mt-1.5 text-sm text-muted-foreground max-w-sm">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function CCEmpty({ title = "Nothing here yet", body, action, icon }: { title?: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return <Shell icon={icon ?? <Inbox className="size-5" />} title={title} body={body} action={action} />;
}

export function CCLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden /> <span>{label}</span>
    </div>
  );
}

export function CCErrorState({ title = "Something went wrong", body, action }: { title?: string; body?: ReactNode; action?: ReactNode }) {
  return <Shell tone="danger" icon={<AlertTriangle className="size-5" />} title={title} body={body} action={action} />;
}

export function CCPermissionDenied({ title = "You don't have access to this", body = "Ask a supervisor or operations admin if you need this surface." }: { title?: string; body?: ReactNode }) {
  return <Shell tone="warning" icon={<ShieldAlert className="size-5" />} title={title} body={body} />;
}
