import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCWidget, CCTable, CCThead, CCTh, CCTd, CCTr,
  CCFormSection, CCField, CCTextarea, CCFormGrid,
} from "@/components/cc";
import { DUMMY_PUNCHES, DUMMY_SHIFTS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/attendance/")({
  component: AttendancePage,
});

const KIND_LABEL: Record<string, string> = {
  clock_in: "Clocked in",
  clock_out: "Clocked out",
  break_start: "Break start",
  break_end: "Break end",
};

function AttendancePage() {
  const { user, atLeast } = useAuth();
  const qc = useQueryClient();
  const isLeader = atLeast("team_leader");
  const [swapFor, setSwapFor] = useState<any | null>(null);

  const punches = useQuery({
    queryKey: ["punches", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_punches" as any)
        .select("*").eq("user_id", user!.id)
        .order("at", { ascending: false }).limit(50);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const shifts = useQuery({
    queryKey: ["shifts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_shifts" as any)
        .select("*").eq("user_id", user!.id)
        .gte("ends_at", new Date(Date.now() - 7 * 86400_000).toISOString())
        .order("starts_at", { ascending: true }).limit(20);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const punch = useMutation({
    mutationFn: async (kind: string) => {
      await supabase.from("attendance_punches" as any).insert({ user_id: user!.id, kind });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["punches"] }),
  });

  const punchRows: any[] = (punches.data && punches.data.length > 0) ? (punches.data as any[]) : DUMMY_PUNCHES;
  const shiftRows: any[] = (shifts.data && shifts.data.length > 0) ? (shifts.data as any[]) : DUMMY_SHIFTS;
  const last = punchRows[0];
  const onShift = last?.kind === "clock_in" || last?.kind === "break_end";
  const onBreak = last?.kind === "break_start";

  // Productive vs non-productive time (today)
  const summary = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todays = punchRows
      .filter((p) => new Date(p.at) >= today)
      .sort((a, b) => +new Date(a.at) - +new Date(b.at));
    let productive = 0, breakMs = 0;
    let lastIn: number | null = null, lastBreak: number | null = null;
    for (const p of todays) {
      const t = +new Date(p.at);
      if (p.kind === "clock_in") lastIn = t;
      if (p.kind === "break_start" && lastIn != null) { productive += t - lastIn; lastBreak = t; lastIn = null; }
      if (p.kind === "break_end" && lastBreak != null) { breakMs += t - lastBreak; lastIn = t; lastBreak = null; }
      if (p.kind === "clock_out" && lastIn != null) { productive += t - lastIn; lastIn = null; }
    }
    const now = Date.now();
    if (lastIn != null) productive += now - lastIn;
    if (lastBreak != null) breakMs += now - lastBreak;
    const fmt = (ms: number) => `${Math.floor(ms / 3.6e6)}h ${Math.floor((ms % 3.6e6) / 6e4)}m`;
    // overtime beyond 8h
    const overtime = Math.max(0, productive - 8 * 3.6e6);
    return { productive: fmt(productive), breakMs: fmt(breakMs), overtime: fmt(overtime) };
  }, [punchRows]);

  const swaps = useQuery({
    queryKey: ["shift-swaps", user?.id, isLeader],
    queryFn: async () => {
      const q = supabase.from("shift_swap_requests" as any)
        .select("*, requester:profiles!shift_swap_requests_requester_id_fkey(full_name), target:profiles!shift_swap_requests_target_user_id_fkey(full_name), shift:attendance_shifts(starts_at,ends_at)")
        .order("created_at", { ascending: false }).limit(50);
      const { data } = await q;
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  const reviewSwap = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      await supabase.from("shift_swap_requests" as any)
        .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-swaps"] }),
  });

  return (
    <>
      <PageHeader
        title="Attendance & shifts"
        description="Clock in, take breaks, and review your scheduled shifts."
      />
      <div className="p-6 space-y-6">
        <CCWidget title="Time clock">
          <div className="flex items-center gap-3 flex-wrap">
            <CCStatusPill tone={onShift ? "success" : onBreak ? "warning" : "neutral"} dot>
              {onShift ? "On shift" : onBreak ? "On break" : "Off shift"}
            </CCStatusPill>
            {!onShift && !onBreak && (
              <CCButton onClick={() => punch.mutate("clock_in")}>Clock in</CCButton>
            )}
            {onShift && (
              <>
                <CCButton variant="secondary" onClick={() => punch.mutate("break_start")}>Start break</CCButton>
                <CCButton variant="danger" onClick={() => punch.mutate("clock_out")}>Clock out</CCButton>
              </>
            )}
            {onBreak && (
              <CCButton onClick={() => punch.mutate("break_end")}>End break</CCButton>
            )}
            {last && (
              <span className="text-xs text-[color:var(--cc-ink-500)] ml-auto">
                Last: {KIND_LABEL[last.kind]} · {new Date(last.at).toLocaleString()}
              </span>
            )}
          </div>
        </CCWidget>

        <CCWidget title="Upcoming shifts">
          <CCTable>
            <CCThead><tr><CCTh>Starts</CCTh><CCTh>Ends</CCTh><CCTh>Notes</CCTh><CCTh /></tr></CCThead>
            <tbody>
              {shiftRows.map((s) => (
                <CCTr key={s.id}>
                  <CCTd className="tabular-nums">{new Date(s.starts_at).toLocaleString()}</CCTd>
                  <CCTd className="tabular-nums">{new Date(s.ends_at).toLocaleString()}</CCTd>
                  <CCTd className="text-[color:var(--cc-ink-700)]">{s.notes ?? "—"}</CCTd>
                  <CCTd className="text-right">
                    {String(s.id).length === 36 && (
                      <CCButton size="sm" variant="ghost" onClick={() => setSwapFor(s)}>Request swap</CCButton>
                    )}
                  </CCTd>
                </CCTr>
              ))}
            </tbody>
          </CCTable>
        </CCWidget>

        <CCWidget title="Today" hint="Productive vs non-productive time (rolls over at midnight).">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{summary.productive}</div>
              <div className="text-xs text-[color:var(--cc-ink-500)] uppercase tracking-wide">Productive</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{summary.breakMs}</div>
              <div className="text-xs text-[color:var(--cc-ink-500)] uppercase tracking-wide">On break</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{summary.overtime}</div>
              <div className="text-xs text-[color:var(--cc-ink-500)] uppercase tracking-wide">Overtime</div>
            </div>
          </div>
        </CCWidget>

        <CCWidget title="Shift swap requests" hint={isLeader ? "Approve or reject pending requests." : "Your submitted swap requests."}>
          {(swaps.data ?? []).length === 0 ? (
            <div className="text-sm text-[color:var(--cc-ink-500)]">No swap requests.</div>
          ) : (
            <ul className="divide-y divide-[color:var(--cc-ink-100)]">
              {(swaps.data ?? []).map((s: any) => {
                const tone: any = s.status === "approved" ? "success" : s.status === "rejected" ? "danger" : s.status === "cancelled" ? "neutral" : "warning";
                return (
                  <li key={s.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {s.requester?.full_name ?? "—"} → {s.target?.full_name ?? "anyone"}
                      </div>
                      <div className="text-xs text-[color:var(--cc-ink-500)] tabular-nums">
                        {s.shift ? `${new Date(s.shift.starts_at).toLocaleString()} – ${new Date(s.shift.ends_at).toLocaleTimeString()}` : ""}
                      </div>
                      {s.reason && <div className="text-sm mt-1 text-[color:var(--cc-ink-700)]">{s.reason}</div>}
                    </div>
                    <CCStatusPill tone={tone} dot>{s.status}</CCStatusPill>
                    {isLeader && s.status === "pending" && (
                      <div className="flex gap-1">
                        <CCButton size="sm" onClick={() => reviewSwap.mutate({ id: s.id, status: "approved" })}>Approve</CCButton>
                        <CCButton size="sm" variant="ghost" onClick={() => reviewSwap.mutate({ id: s.id, status: "rejected" })}>Reject</CCButton>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CCWidget>

        <CCWidget title="Recent punches">
          <ul className="divide-y divide-[color:var(--cc-ink-100)]">
            {punchRows.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between">
                <span className="text-sm">{KIND_LABEL[p.kind] ?? p.kind}</span>
                <span className="text-xs text-[color:var(--cc-ink-500)] tabular-nums">{new Date(p.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </CCWidget>
      </div>
      {swapFor && (
        <SwapDialog
          shift={swapFor}
          onClose={() => { setSwapFor(null); qc.invalidateQueries({ queryKey: ["shift-swaps"] }); }}
        />
      )}
    </>
  );
}

function SwapDialog({ shift, onClose }: { shift: any; onClose: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shift_swap_requests" as any).insert({
        shift_id: shift.id, requester_id: user!.id, reason,
      });
      if (error) throw error;
    },
    onSuccess: onClose,
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CCFormSection title="Request shift swap">
          <CCFormGrid>
            <CCField label="Shift">
              <div className="text-sm tabular-nums">{new Date(shift.starts_at).toLocaleString()} – {new Date(shift.ends_at).toLocaleString()}</div>
            </CCField>
          </CCFormGrid>
          <CCField label="Reason"><CCTextarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need to swap?" /></CCField>
          <div className="flex justify-end gap-2">
            <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
            <CCButton onClick={() => submit.mutate()} disabled={submit.isPending}>Submit for approval</CCButton>
          </div>
        </CCFormSection>
      </div>
    </div>
  );
}