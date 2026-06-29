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
import { ClipboardList, Clock, AlertCircle, BookOpenText, PhoneCall, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getActiveCampaignScript, acknowledgeScript } from "@/lib/scripts.functions";
import { LiveScript, type ScriptTree } from "@/components/LiveScript";

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
  // Default to "script" tab when a call has a campaign attached, otherwise controls.
  const [tab, setTab] = useState<"controls" | "script">("controls");
  const [collapsed, setCollapsed] = useState(false);

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
        <div className={cn(
          "fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-4",
          collapsed ? "w-[280px]" : "w-[420px]",
        )}>
          <div className="rounded-xl border bg-card shadow-lg overflow-hidden">
            {/* Tab strip — script and controls coexist; one tap to switch */}
            <div className="flex items-center border-b text-xs">
              <button
                type="button"
                onClick={() => setTab("controls")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 font-medium",
                  tab === "controls" ? "bg-background text-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                )}
              >
                <PhoneCall className="size-3.5" /> Controls
              </button>
              <button
                type="button"
                onClick={() => setTab("script")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 font-medium",
                  tab === "script" ? "bg-background text-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                )}
              >
                <BookOpenText className="size-3.5" /> Script
              </button>
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="px-2 py-2 text-muted-foreground hover:text-foreground"
                title={collapsed ? "Expand" : "Collapse"}
              >
                <Minimize2 className="size-3.5" />
              </button>
            </div>
            {!collapsed && tab === "script" && (
              <div className="h-[360px] flex flex-col">
                <LiveScriptPanel campaignId={session.campaignId ?? null} />
              </div>
            )}
            {!collapsed && tab === "controls" && (
              <CallControlBar
                session={session}
                className="border-0 shadow-none rounded-none"
                onEnded={() => {
                  queueWrapUp({
                    callId: session.callId,
                    contactName: session.contactName ?? null,
                    partyNumber: session.direction === "outbound" ? session.toNumber : session.fromNumber,
                    campaignId: session.campaignId ?? null,
                    endedAt: new Date().toISOString(),
                  });
                  setActiveCall(null);
                }}
              />
            )}
            {collapsed && (
              <div className="px-3 py-2 text-xs flex items-center justify-between">
                <span className="font-medium truncate">{session.contactName ?? "Active call"}</span>
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="underline text-muted-foreground"
                >
                  Open
                </button>
              </div>
            )}
          </div>
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

/** Loads the active approved script for the campaign and renders it for the agent. */
function LiveScriptPanel({ campaignId }: { campaignId: string | null }) {
  const q = useQuery({
    queryKey: ["live-script", campaignId ?? "none"],
    queryFn: () => getActiveCampaignScript({ data: { campaignId } }),
    staleTime: 60_000,
  });
  const ack = useMutation({
    mutationFn: (versionId: string) => acknowledgeScript({ data: { versionId } }),
    onSuccess: () => q.refetch(),
  });

  if (q.isLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading script…</div>;
  }
  if (!q.data) {
    return (
      <div className="p-4 text-xs text-muted-foreground space-y-1">
        <div className="font-medium text-foreground">No approved script</div>
        <p>This campaign has no published script. Agents can proceed using their training.</p>
      </div>
    );
  }
  const tree = (q.data.version.tree as ScriptTree | null) ?? { rootId: null, nodes: [] };
  return (
    <>
      <div className="px-3 py-1.5 text-[11px] flex items-center justify-between border-b bg-muted/30">
        <span className="font-medium truncate">{q.data.name} · v{q.data.version.version}</span>
        {!q.data.acknowledged && (
          <button
            type="button"
            onClick={() => ack.mutate(q.data!.version.id)}
            className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-medium"
          >
            Acknowledge update
          </button>
        )}
      </div>
      <LiveScript tree={tree} compact />
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