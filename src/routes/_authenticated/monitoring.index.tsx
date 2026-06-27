import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Ear, MessageCircle, Megaphone, ArrowRightLeft, Clock, Activity } from "lucide-react";
import { listLiveCalls, listQueue, startMonitorSession, stopMonitorSession } from "@/lib/calls.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/monitoring/")({
  component: LiveMonitoring,
});

function elapsed(iso?: string | null) {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

function LiveMonitoring() {
  const { atLeast } = useAuth();
  const canBarge = atLeast("supervisor");
  const canTakeover = atLeast("supervisor");

  const live = useQuery({
    queryKey: ["live-calls"],
    queryFn: () => listLiveCalls(),
    refetchInterval: 5000,
  });
  const queue = useQuery({
    queryKey: ["queue"],
    queryFn: () => listQueue(),
    refetchInterval: 5000,
  });

  // tick for the elapsed columns
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);

  const [monitoring, setMonitoring] = useState<{ call: any; kind: string; sessionId?: string; transcript: string[] } | null>(null);

  async function start(call: any, kind: "listen"|"whisper"|"barge"|"takeover") {
    try {
      const r = await startMonitorSession({ data: { callId: call.id, kind } });
      setMonitoring({ call, kind, sessionId: r.sessionId, transcript: [] });
    } catch (e: any) { toast.error(e?.message ?? "Cannot start monitoring"); }
  }
  async function stop() {
    if (monitoring?.sessionId) {
      await stopMonitorSession({ data: { sessionId: monitoring.sessionId } }).catch(() => {});
    }
    setMonitoring(null);
  }

  // Live transcript stub (replace with provider websocket when wired)
  useEffect(() => {
    if (!monitoring) return;
    const t = setInterval(() => {
      setMonitoring((m) => m ? { ...m, transcript: [...m.transcript, `[${new Date().toLocaleTimeString()}] (transcription provider not configured — stub line)`] } : m);
    }, 4000);
    return () => clearInterval(t);
  }, [monitoring?.sessionId]);

  return (
    <div>
      <PageHeader
        title="Live monitoring"
        description="Listen / Whisper / Barge / Takeover. Every action is logged for compliance."
      />
      <div className="p-6 grid lg:grid-cols-3 gap-6">
        {/* live calls */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="size-4 text-emerald-600 animate-pulse" />
            <span className="font-medium">Active calls</span>
            <span className="text-muted-foreground">({live.data?.length ?? 0})</span>
          </div>
          <div className="border-b">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Monitor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(live.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground">No active calls right now.</TableCell></TableRow>
                )}
                {(live.data ?? []).map((c: any) => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell><Badge variant="outline">{c.direction}</Badge></TableCell>
                    <TableCell className="text-sm">{c.contacts?.name ?? "Unknown"}</TableCell>
                    <TableCell className="font-mono text-xs">{c.direction === "outbound" ? c.to_number : c.from_number}</TableCell>
                    <TableCell><Badge>{c.status}</Badge></TableCell>
                    <TableCell className="font-mono tabular-nums text-sm">{elapsed(c.answered_at ?? c.started_at)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => start(c, "listen")}><Ear className="size-3 mr-1" /> Listen</Button>
                      <Button size="sm" variant="outline" onClick={() => start(c, "whisper")}><MessageCircle className="size-3 mr-1" /> Whisper</Button>
                      {canBarge && <Button size="sm" variant="outline" onClick={() => start(c, "barge")}><Megaphone className="size-3 mr-1" /> Barge</Button>}
                      {canTakeover && <Button size="sm" variant="outline" onClick={() => start(c, "takeover")}><ArrowRightLeft className="size-3 mr-1" /> Takeover</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* queue */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-amber-600" />
            <span className="font-medium">Inbound queue</span>
            <span className="text-muted-foreground">({queue.data?.length ?? 0})</span>
          </div>
          <div className="border rounded-lg divide-y bg-card">
            {(queue.data ?? []).length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">Queue is empty.</div>
            )}
            {(queue.data ?? []).map((q: any) => (
              <div key={q.id} className="p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{q.contacts?.name ?? "Unknown"}</div>
                  <div className="font-mono text-xs text-muted-foreground">{q.from_number}</div>
                </div>
                <div className="text-right">
                  <Badge variant="outline">P{q.priority}</Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    ~{q.estimated_wait_seconds ?? "?"}s · waiting {elapsed(q.queued_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={!!monitoring} onOpenChange={(o) => { if (!o) stop(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize">{monitoring?.kind} session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              Call with <span className="font-medium">{monitoring?.call?.contacts?.name ?? "Unknown"}</span> ·{" "}
              <span className="font-mono text-xs">{monitoring?.call?.direction === "outbound" ? monitoring?.call?.to_number : monitoring?.call?.from_number}</span>
            </div>
            <div className="rounded-md border bg-muted/30 h-64 overflow-y-auto p-3 text-xs font-mono whitespace-pre-wrap">
              {(monitoring?.transcript ?? []).join("\n") || "Awaiting transcript…"}
            </div>
            <p className="text-xs text-muted-foreground">
              Live transcript is a stub until a transcription provider is configured.
              Data contract: <code className="bg-muted px-1">{`{ callId, startedAt, segments: [{ts, speaker, text}] }`}</code>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={stop}>End session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}