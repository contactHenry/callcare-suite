import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCStatusPill, CCWidget, CCTable, CCThead, CCTh, CCTd, CCTr } from "@/components/cc";
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
  const { user } = useAuth();
  const qc = useQueryClient();

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
            <CCThead><tr><CCTh>Starts</CCTh><CCTh>Ends</CCTh><CCTh>Notes</CCTh></tr></CCThead>
            <tbody>
              {shiftRows.map((s) => (
                <CCTr key={s.id}>
                  <CCTd className="tabular-nums">{new Date(s.starts_at).toLocaleString()}</CCTd>
                  <CCTd className="tabular-nums">{new Date(s.ends_at).toLocaleString()}</CCTd>
                  <CCTd className="text-[color:var(--cc-ink-700)]">{s.notes ?? "—"}</CCTd>
                </CCTr>
              ))}
            </tbody>
          </CCTable>
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
    </>
  );
}