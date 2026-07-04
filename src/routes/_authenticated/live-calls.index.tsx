/**
 * Live Calls — glanceable view designed for Team Leaders to read from
 * across the room. Big numbers, color thresholds for SLA breaches,
 * auto-refreshing every 5 seconds.
 *
 * SLA bands (wait time):
 *   < 30s  → green   (within SLA)
 *   30-60s → amber   (approaching breach)
 *   > 60s  → red     (breached — escalate)
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listLiveCalls, listQueue, acceptQueuedCall } from "@/lib/calls.functions";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCStatusPill } from "@/components/cc";
import { Phone, PhoneIncoming, PhoneOff, Radio, Timer, Users as UsersIcon, Mic, MicOff, Pause, Play, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { setActiveCall } from "@/lib/call-session";
import { DUMMY_LIVE_CALLS, DUMMY_QUEUE } from "@/lib/dummy-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/live-calls/")({ component: LiveCalls });

function secsSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}
function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}
function waitTone(s: number): "ok" | "warn" | "breach" {
  if (s > 60) return "breach";
  if (s > 30) return "warn";
  return "ok";
}
const TONE_BG: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-900 border-emerald-200",
  warn: "bg-amber-50 text-amber-900 border-amber-200",
  breach: "bg-rose-50 text-rose-900 border-rose-200 animate-pulse",
};
const TONE_DOT: Record<string, string> = {
  ok: "bg-emerald-500", warn: "bg-amber-500", breach: "bg-rose-500",
};

function LiveCalls() {
  const liveFn = useServerFn(listLiveCalls);
  const queueFn = useServerFn(listQueue);
  const acceptFn = useServerFn(acceptQueuedCall);
  const [activeQueued, setActiveQueued] = useState<any | null>(null);

  const live = useQuery({
    queryKey: ["live-calls"], queryFn: () => liveFn(),
    refetchInterval: 5000, refetchIntervalInBackground: false,
  });
  const queue = useQuery({
    queryKey: ["call-queue"], queryFn: () => queueFn(),
    refetchInterval: 5000,
  });

  // Re-render the clocks every second without re-fetching
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const liveRows: any[] = live.data ?? [];
  const queueRows: any[] = queue.data ?? [];
  // Fall back to sample data per-list so an empty queue still shows a
  // populated wallboard even when there are real live calls (and vice-versa).
  const activeCalls: any[] = liveRows.length ? liveRows : DUMMY_LIVE_CALLS;
  const waiting: any[] = queueRows.length ? queueRows : DUMMY_QUEUE;
  const isSample = liveRows.length === 0 || queueRows.length === 0;
  const longestWait = waiting.reduce((m, q) => Math.max(m, secsSince(q.queued_at)), 0);
  const breaches = waiting.filter((q) => secsSince(q.queued_at) > 60).length;

  async function accept(q: any) {
    // Sample/dummy rows are not real DB records — open the in-call UI directly.
    if (typeof q.id === "string" && q.id.startsWith("dummy-")) {
      setActiveQueued({ ...q, _answeredAt: Date.now() });
      toast.success(`Connected to ${q.contacts?.name ?? q.from_number ?? "caller"}`);
      return;
    }
    try {
      const r: any = await acceptFn({ data: { queueId: q.id } });
      setActiveCall({
        callId: r.callId,
        fromNumber: q.from_number,
        toNumber: q.to_number,
        contactName: q.contacts?.name ?? null,
        startedAt: new Date().toISOString(),
        direction: "inbound",
        recording: true,
      });
      setActiveQueued({ ...q, _answeredAt: Date.now(), callId: r.callId });
      toast.success("Call accepted");
    } catch (e: any) { toast.error(e?.message ?? "Could not accept"); }
  }

  return (
    <>
      <PageHeader
        title="Live Calls"
        description="Real-time view of every call in progress and waiting to be answered."
        actions={<Link to="/monitoring"><CCButton variant="ghost"><Radio className="size-4 mr-1" />Detailed monitoring</CCButton></Link>}
      />
      {isSample && (
        <div className="px-6 -mb-2 text-xs text-muted-foreground">
          Showing sample wallboard data for preview. Live calls appear here as they happen.
        </div>
      )}

      {/* Wallboard tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
        <Tile
          label="In progress"
          value={activeCalls.length}
          tone="ok"
          icon={<Phone className="size-6" />}
        />
        <Tile
          label="Waiting in queue"
          value={waiting.length}
          tone={waiting.length > 5 ? "warn" : "ok"}
          icon={<UsersIcon className="size-6" />}
        />
        <Tile
          label="Longest wait"
          value={fmt(longestWait)}
          tone={waitTone(longestWait)}
          icon={<Timer className="size-6" />}
          sub={breaches > 0 ? `${breaches} SLA breach${breaches === 1 ? "" : "es"}` : "Within SLA"}
        />
      </div>

      <div className={`px-6 pb-10 grid gap-6 ${activeQueued ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
        {/* ACTIVE CALLS */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Active calls ({activeCalls.length})
          </h2>
          <div className="grid gap-2">
            {activeCalls.length === 0 && (
              <EmptyCard text="No calls in progress." />
            )}
            {activeCalls.map((c) => {
              const dur = secsSince(c.answered_at ?? c.started_at);
              const tone = c.status === "on_hold" ? "warn" : "ok";
              return (
                <div key={c.id} className={`rounded-xl border p-4 flex items-center gap-4 ${TONE_BG[tone]}`}>
                  <span className={`size-2.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate text-base">
                      {c.contacts?.name ?? (c.direction === "outbound" ? c.to_number : c.from_number)}
                    </div>
                    <div className="text-xs opacity-80 capitalize">
                      {c.direction} · {c.status.replace("_"," ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl tabular-nums leading-none">{fmt(dur)}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-70 mt-1">duration</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* QUEUE */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Inbound queue ({waiting.length})
          </h2>
          <div className="grid gap-2">
            {waiting.length === 0 && (
              <EmptyCard text="Queue is empty." />
            )}
            {waiting.map((q) => {
              const wait = secsSince(q.queued_at);
              const tone = waitTone(wait);
              return (
                <div key={q.id} className={`rounded-xl border p-4 flex items-center gap-4 ${TONE_BG[tone]}`}>
                  <PhoneIncoming className="size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate text-base">
                      {q.contacts?.name ?? q.from_number ?? "Unknown caller"}
                    </div>
                    <div className="text-xs opacity-80 font-mono">{q.from_number ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-3xl font-bold tabular-nums leading-none">{fmt(wait)}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-70 mt-1">waiting</div>
                  </div>
                  <CCButton size="sm" onClick={() => accept(q)}>
                    <Phone className="size-4 mr-1" />Answer
                  </CCButton>
                </div>
              );
            })}
          </div>
        </section>

        {activeQueued && (
          <ActiveCallPanel
            call={activeQueued}
            onClose={() => setActiveQueued(null)}
          />
        )}
      </div>
    </>
  );
}

function Tile({ label, value, tone, icon, sub }: {
  label: string; value: string | number; tone: "ok"|"warn"|"breach"; icon: React.ReactNode; sub?: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${TONE_BG[tone]}`}>
      <div className="flex items-center justify-between mb-2 opacity-80">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="font-mono text-5xl font-bold tabular-nums leading-none">{value}</div>
      {sub && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span className={`size-2 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
          {sub}
        </div>
      )}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ActiveCallPanel({ call, onClose }: { call: any; onClose: () => void }) {
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<"warm" | "cold">("warm");
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferNote, setTransferNote] = useState("");
  const [transferQuery, setTransferQuery] = useState("");

  useEffect(() => {
    if (!call) return;
    setMuted(false); setHeld(false); setElapsed(0);
    const start = call._answeredAt ?? Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call]);

  const name = call.contacts?.name ?? call.from_number ?? "Unknown caller";
  const number = call.from_number ?? "—";

  function endCall() {
    toast.success(`Call with ${name} ended (${fmt(elapsed)})`);
    onClose();
  }

  const TRANSFER_TARGETS = [
    { id: "agent-1", kind: "Agent",  name: "Amara Okafor",    detail: "Tier 2 Support · Available",   tone: "ok" as const },
    { id: "agent-2", kind: "Agent",  name: "Diego Hernández", detail: "Billing · Available",          tone: "ok" as const },
    { id: "agent-3", kind: "Agent",  name: "Priya Shah",      detail: "Retention · On a call",        tone: "warn" as const },
    { id: "team-1",  kind: "Team",   name: "Billing queue",   detail: "3 agents available · ~24s wait", tone: "ok" as const },
    { id: "team-2",  kind: "Team",   name: "Tier 2 Support",  detail: "1 agent available · ~1m 12s",  tone: "warn" as const },
    { id: "ext-1",   kind: "Ext.",   name: "Supervisor desk", detail: "ext 4501",                     tone: "ok" as const },
    { id: "ext-2",   kind: "Ext.",   name: "Voicemail",       detail: "ext 9000",                     tone: "ok" as const },
  ];
  const filtered = TRANSFER_TARGETS.filter((t) =>
    !transferQuery || `${t.name} ${t.detail} ${t.kind}`.toLowerCase().includes(transferQuery.toLowerCase()),
  );
  const selected = TRANSFER_TARGETS.find((t) => t.id === transferTarget) ?? null;

  function confirmTransfer() {
    if (!selected) return;
    toast.success(
      transferMode === "warm"
        ? `Warm transfer started to ${selected.name}`
        : `Call transferred to ${selected.name}`,
    );
    setTransferOpen(false);
    setTransferTarget(null); setTransferNote(""); setTransferQuery("");
    if (transferMode === "cold") onClose();
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
        <span>In call</span>
        <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
          {held ? "On hold" : "Connected · recording"}
        </span>
      </h2>
      <div className="rounded-xl border bg-card p-5 flex flex-col">
        <div className="flex flex-col items-center text-center py-2">
          <div className="size-20 rounded-full bg-[color:var(--cc-brand)]/10 text-[color:var(--cc-brand)] flex items-center justify-center mb-3">
            <Phone className="size-8" />
          </div>
          <div className="text-lg font-semibold">{name}</div>
          <div className="text-sm text-muted-foreground font-mono">{number}</div>
          <div className="mt-4 font-mono text-3xl tabular-nums">{fmt(elapsed)}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span className={`size-2 rounded-full ${held ? "bg-amber-500" : "bg-emerald-500 animate-pulse"}`} />
            {held ? "Holding" : "Live"}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <CCButton variant="ghost" onClick={() => setMuted((m) => !m)}>
            {muted ? <MicOff className="size-4 mr-1" /> : <Mic className="size-4 mr-1" />}
            {muted ? "Unmute" : "Mute"}
          </CCButton>
          <CCButton variant="ghost" onClick={() => setHeld((h) => !h)}>
            {held ? <Play className="size-4 mr-1" /> : <Pause className="size-4 mr-1" />}
            {held ? "Resume" : "Hold"}
          </CCButton>
          <CCButton variant="ghost" onClick={() => setTransferOpen(true)}>
            <UserPlus className="size-4 mr-1" />Transfer
          </CCButton>
        </div>

        <button
          type="button"
          onClick={endCall}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 text-sm font-semibold"
        >
          <PhoneOff className="size-4" /> End call
        </button>
      </div>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm gap-3 p-4">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="text-base">Transfer call</DialogTitle>
            <DialogDescription className="text-xs">
              Send {name} ({number}) onward.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTransferMode("warm")}
              className={`rounded-md border px-2 py-1.5 text-left text-xs ${transferMode === "warm" ? "border-[color:var(--cc-brand)] bg-[color:var(--cc-brand)]/5" : "hover:bg-muted/40"}`}
            >
              <div className="font-medium">Warm</div>
              <div className="text-[11px] text-muted-foreground">Speak first</div>
            </button>
            <button
              type="button"
              onClick={() => setTransferMode("cold")}
              className={`rounded-md border px-2 py-1.5 text-left text-xs ${transferMode === "cold" ? "border-[color:var(--cc-brand)] bg-[color:var(--cc-brand)]/5" : "hover:bg-muted/40"}`}
            >
              <div className="font-medium">Cold</div>
              <div className="text-[11px] text-muted-foreground">Hand off now</div>
            </button>
          </div>

          <input
            value={transferQuery}
            onChange={(e) => setTransferQuery(e.target.value)}
            placeholder="Search agents, teams, extensions…"
            className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[color:var(--cc-brand)]/30"
          />

          <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matches.</div>
            )}
            {filtered.map((t) => {
              const active = transferTarget === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTransferTarget(t.id)}
                  className={`w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-xs ${active ? "bg-[color:var(--cc-brand)]/5" : "hover:bg-muted/40"}`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${TONE_DOT[t.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{t.detail}</div>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground border rounded px-1 py-0.5">
                    {t.kind}
                  </span>
                </button>
              );
            })}
          </div>

          <textarea
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            placeholder="Note for receiver (optional)…"
            rows={2}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[color:var(--cc-brand)]/30"
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <CCButton variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</CCButton>
            <CCButton disabled={!selected} onClick={confirmTransfer}>
              {transferMode === "warm" ? "Start warm" : "Transfer"}
            </CCButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// Silence the unused-import linter for CCStatusPill (kept for future filter chips).
void CCStatusPill;