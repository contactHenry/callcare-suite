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
import { Phone, PhoneIncoming, Radio, Timer, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { setActiveCall } from "@/lib/call-session";
import { DUMMY_LIVE_CALLS, DUMMY_QUEUE } from "@/lib/dummy-data";

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
  const isSample = liveRows.length === 0 && queueRows.length === 0;
  const activeCalls: any[] = liveRows.length ? liveRows : (isSample ? DUMMY_LIVE_CALLS : []);
  const waiting: any[] = queueRows.length ? queueRows : (isSample ? DUMMY_QUEUE : []);
  const longestWait = waiting.reduce((m, q) => Math.max(m, secsSince(q.queued_at)), 0);
  const breaches = waiting.filter((q) => secsSince(q.queued_at) > 60).length;

  async function accept(q: any) {
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

      <div className="px-6 pb-10 grid gap-6 xl:grid-cols-2">
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

// Silence the unused-import linter for CCStatusPill (kept for future filter chips).
void CCStatusPill;