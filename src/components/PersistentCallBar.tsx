/**
 * Persistent in-call panel. Rendered once in `AppShell` and reads from the
 * module-level call-session store so it stays mounted (and the timer keeps
 * ticking) regardless of which screen the agent navigates to mid-call.
 */
import { useEffect, useState } from "react";
import { CallControlBar } from "@/components/CallControlBar";
import {
  useActiveCall, setActiveCall, queueWrapUp, usePendingWrapUps,
  clearWrapUp, snoozeWrapUp,
} from "@/lib/call-session";
import { AfterCallForm } from "@/components/AfterCallForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardList, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders three persistent UI layers, in priority order:
 *  1. The active in-call control bar (one call at a time)
 *  2. The after-call wrap-up modal that auto-opens when a call ends
 *  3. A floating "pending wrap-up" chip if the agent dismissed (1) without saving
 */
export function PersistentCallBar() {
  const session = useActiveCall();
  const pending = usePendingWrapUps();
  const [openCallId, setOpenCallId] = useState<string | null>(null);

  // Auto-open the wrap-up modal when a new pending item appears.
  useEffect(() => {
    if (openCallId) return;
    const newest = pending[pending.length - 1];
    if (newest) setOpenCallId(newest.callId);
  }, [pending, openCallId]);

  const openItem = pending.find((p) => p.callId === openCallId) ?? null;

  return (
    <>
      {session && (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-4">
          <CallControlBar
            session={session}
            onEnded={() => {
              queueWrapUp({
                callId: session.callId,
                contactName: session.contactName ?? null,
                partyNumber: session.direction === "outbound" ? session.toNumber : session.fromNumber,
                endedAt: new Date().toISOString(),
              });
              setActiveCall(null);
            }}
          />
        </div>
      )}

      {!session && pending.length > 0 && (
        <PendingChip
          items={pending}
          onOpen={(id) => setOpenCallId(id)}
        />
      )}

      <WrapUpDialog
        item={openItem}
        onClose={() => setOpenCallId(null)}
      />
    </>
  );
}

function PendingChip({
  items, onOpen,
}: { items: ReturnType<typeof usePendingWrapUps>; onOpen: (id: string) => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  // Show the most pressing item (smallest remaining time)
  const sorted = [...items].sort(
    (a, b) => new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime(),
  );
  const head = sorted[0];
  const remaining = Math.floor((new Date(head.deadlineAt).getTime() - Date.now()) / 1000);
  const overdue = remaining < 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
      <button
        type="button"
        onClick={() => onOpen(head.callId)}
        className={cn(
          "flex items-center gap-3 rounded-full pl-3 pr-4 py-2 shadow-lg border text-sm font-medium",
          overdue
            ? "bg-rose-600 text-white border-rose-700 animate-pulse"
            : "bg-amber-50 text-amber-900 border-amber-300",
        )}
      >
        {overdue ? <AlertCircle className="size-4" /> : <Clock className="size-4" />}
        <span>
          Wrap-up pending
          {items.length > 1 && ` (${items.length})`}
        </span>
        <span className="font-mono tabular-nums">
          {overdue ? `+${fmtSeconds(-remaining)} overdue` : fmtSeconds(remaining)}
        </span>
      </button>
    </div>
  );
}

function WrapUpDialog({
  item, onClose,
}: { item: ReturnType<typeof usePendingWrapUps>[number] | null; onClose: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!item) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [item]);

  if (!item) return null;
  const remaining = Math.floor((new Date(item.deadlineAt).getTime() - Date.now()) / 1000);
  const overdue = remaining < 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" />
            After-call wrap-up
            <span className="ml-auto flex items-center gap-2 text-sm font-normal">
              <span className="text-muted-foreground">{item.contactName ?? item.partyNumber ?? "Call"}</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-mono tabular-nums",
                overdue ? "bg-rose-100 text-rose-800" : remaining < 30 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800",
              )}>
                {overdue ? `+${fmtSeconds(-remaining)} overdue` : fmtSeconds(remaining)}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <AfterCallForm
          callId={item.callId}
          campaignId={item.campaignId ?? null}
          onSaved={() => { clearWrapUp(item.callId); onClose(); }}
        />

        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <span>
            You can complete this within {fmtSeconds(Math.max(remaining, 0))}.
            Snooze if you need to take the next call first.
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { snoozeWrapUp(item.callId, 120); onClose(); }}
            >
              Snooze 2 min
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}