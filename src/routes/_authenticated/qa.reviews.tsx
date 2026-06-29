import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  qaTrend, addCoachingNote, openDispute, resolveDispute, acknowledgeReview,
  assignRandomReviews, listScorecards,
} from "@/lib/qa.functions";
import { listStaff } from "@/lib/staff.functions";
import {
  CCButton, CCStatusPill, CCFormSection, CCField, CCTextarea, CCWidget, CCSparkline, CCMetricWidget,
  CCDialog, CCInput, CCSelect, CCFormGrid,
} from "@/components/cc";
import { DUMMY_QA_REVIEWS, DUMMY_QA_DISPUTES, DUMMY_QA_POINTS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/qa/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  const { user, atLeast } = useAuth();
  const qc = useQueryClient();
  const isLeader = atLeast("team_leader");
  const [assignOpen, setAssignOpen] = useState(false);

  const trend = useQuery({
    queryKey: ["qa-trend", user?.id],
    queryFn: () => qaTrend({ data: { days: 30 } }),
  });

  const reviews = useQuery({
    queryKey: ["qa-reviews", user?.id, isLeader],
    queryFn: async () => {
      let q = supabase.from("qa_reviews")
        .select("*, call:calls(id, agent_id, started_at, contact:contacts(name))")
        .order("created_at", { ascending: false }).limit(50);
      if (!isLeader) q = q.eq("call.agent_id", user!.id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const disputes = useQuery({
    queryKey: ["qa-disputes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("qa_disputes")
        .select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const trendPoints = (trend.data ?? []).map((p: any) => p.score);
  const points = trendPoints.length > 0 ? trendPoints : DUMMY_QA_POINTS;
  const avg = points.length ? points.reduce((a: number, b: number) => a + b, 0) / points.length : 0;
  const reviewRows: any[] = (reviews.data && reviews.data.length > 0) ? reviews.data : DUMMY_QA_REVIEWS;
  const disputeRows: any[] = (disputes.data && disputes.data.length > 0) ? disputes.data : DUMMY_QA_DISPUTES;

  return (
    <>
      <PageHeader
        title="QA reviews"
        description={isLeader ? "Moderate team scores, coach, and resolve disputes." : "Your scored calls and feedback."}
        actions={isLeader ? <CCButton onClick={() => setAssignOpen(true)}>Assign random reviews</CCButton> : null}
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <CCMetricWidget
            title="30-day avg"
            value={`${avg.toFixed(1)}%`}
            tone={avg >= 80 ? "positive" : avg >= 65 ? "warning" : "negative"}
            trend={{ points }}
          />
          <CCMetricWidget title="Reviews" value={reviewRows.length.toString()} />
          <CCMetricWidget
            title="Open disputes"
            value={disputeRows.filter((d: any) => d.status === "open").length.toString()}
            tone="warning"
          />
        </div>

        <CCWidget title="Recent reviews">
          <ul className="divide-y divide-[color:var(--cc-ink-100)]">
            {reviewRows.map((r: any) => (
              <ReviewRow key={r.id} review={r} canModerate={isLeader} onChange={() => {
                qc.invalidateQueries({ queryKey: ["qa-reviews"] });
                qc.invalidateQueries({ queryKey: ["qa-disputes"] });
              }} />
            ))}
          </ul>
        </CCWidget>

        {isLeader && (
          <CCWidget title="Disputes queue">
            <ul className="divide-y divide-[color:var(--cc-ink-100)]">
              {disputeRows.map((d: any) => (
                <DisputeRow key={d.id} dispute={d} onResolved={() => qc.invalidateQueries({ queryKey: ["qa-disputes"] })} />
              ))}
            </ul>
          </CCWidget>
        )}
        {isLeader && (
          <AssignRandomDialog
            open={assignOpen}
            onOpenChange={setAssignOpen}
            onAssigned={() => qc.invalidateQueries({ queryKey: ["qa-reviews"] })}
          />
        )}
      </div>
    </>
  );
}

function AssignRandomDialog({
  open, onOpenChange, onAssigned,
}: { open: boolean; onOpenChange: (b: boolean) => void; onAssigned: () => void }) {
  const [reviewerId, setReviewerId] = useState("");
  const [scorecardId, setScorecardId] = useState("");
  const [count, setCount] = useState(5);
  const [sinceDays, setSinceDays] = useState(7);
  const [dueAt, setDueAt] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });

  const staff = useQuery({
    enabled: open,
    queryKey: ["qa-assign-staff"],
    queryFn: () => listStaff(),
  });
  const cards = useQuery({
    enabled: open,
    queryKey: ["qa-assign-cards"],
    queryFn: () => listScorecards(),
  });

  const assign = useMutation({
    mutationFn: () => assignRandomReviews({
      data: { reviewerId, scorecardId, count, sinceDays, dueAt: new Date(dueAt).toISOString() },
    }),
    onSuccess: () => { onAssigned(); onOpenChange(false); },
  });

  return (
    <CCDialog open={open} onOpenChange={onOpenChange} title="Assign random reviews" description="Pick a reviewer and a scorecard. We'll sample completed calls at random.">
      <CCFormGrid>
        <CCField label="Reviewer">
          <CCSelect value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
            <option value="">Select reviewer…</option>
            {(staff.data ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.full_name ?? s.staff_id ?? s.id.slice(0, 6)}</option>
            ))}
          </CCSelect>
        </CCField>
        <CCField label="Scorecard">
          <CCSelect value={scorecardId} onChange={(e) => setScorecardId(e.target.value)}>
            <option value="">Select scorecard…</option>
            {(cards.data ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </CCSelect>
        </CCField>
        <CCField label="How many calls">
          <CCInput type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </CCField>
        <CCField label="Look back (days)">
          <CCInput type="number" min={1} max={90} value={sinceDays} onChange={(e) => setSinceDays(Number(e.target.value))} />
        </CCField>
        <CCField label="Due by">
          <CCInput type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </CCField>
      </CCFormGrid>
      <div className="mt-4 flex justify-end gap-2">
        <CCButton variant="ghost" onClick={() => onOpenChange(false)}>Cancel</CCButton>
        <CCButton
          onClick={() => assign.mutate()}
          disabled={!reviewerId || !scorecardId || assign.isPending}
        >
          {assign.isPending ? "Assigning…" : "Assign"}
        </CCButton>
      </div>
      {assign.isError && (
        <p className="mt-2 text-xs text-[color:var(--cc-danger)]">{String((assign.error as any)?.message ?? "Failed to assign")}</p>
      )}
    </CCDialog>
  );
}

function ReviewRow({ review, canModerate, onChange }: { review: any; canModerate: boolean; onChange: () => void }) {
  const { user } = useAuth();
  const score = Number(review.overall_score ?? 0);
  const tone: any = score >= 80 ? "success" : score >= 65 ? "warning" : "danger";
  const isOwner = review.call?.agent_id === user?.id;
  const [coaching, setCoaching] = useState("");
  const [disputing, setDisputing] = useState("");

  const coach = useMutation({
    mutationFn: () => addCoachingNote({ data: { reviewId: review.id, body: coaching } }),
    onSuccess: () => { setCoaching(""); onChange(); },
  });
  const dispute = useMutation({
    mutationFn: () => openDispute({ data: { reviewId: review.id, reason: disputing } }),
    onSuccess: () => { setDisputing(""); onChange(); },
  });
  const ack = useMutation({
    mutationFn: () => acknowledgeReview({ data: { reviewId: review.id } }),
  });

  return (
    <li className="py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[color:var(--cc-ink-900)] truncate">
            {review.call?.contact?.name ?? "Unknown caller"}
          </div>
          <div className="text-xs text-[color:var(--cc-ink-500)]">{new Date(review.created_at).toLocaleString()}</div>
        </div>
        <CCStatusPill tone={tone} dot>{score}%</CCStatusPill>
      </div>
      {canModerate && (
        <div className="flex gap-2">
          <input
            value={coaching} onChange={(e) => setCoaching(e.target.value)}
            placeholder="Coaching note…"
            className="h-9 flex-1 rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] px-3 text-sm cc-focus-ring"
          />
          <CCButton size="sm" variant="secondary" onClick={() => coach.mutate()} disabled={!coaching || coach.isPending}>Save note</CCButton>
        </div>
      )}
      {isOwner && !canModerate && (
        <div className="flex gap-2 items-center">
          <CCButton size="sm" variant="ghost" onClick={() => ack.mutate()}>{ack.isSuccess ? "Acknowledged ✓" : "Acknowledge"}</CCButton>
          <input
            value={disputing} onChange={(e) => setDisputing(e.target.value)}
            placeholder="Dispute reason…"
            className="h-9 flex-1 rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] px-3 text-sm cc-focus-ring"
          />
          <CCButton size="sm" variant="secondary" onClick={() => dispute.mutate()} disabled={!disputing || dispute.isPending}>Dispute</CCButton>
        </div>
      )}
    </li>
  );
}

function DisputeRow({ dispute, onResolved }: { dispute: any; onResolved: () => void }) {
  const [note, setNote] = useState("");
  const resolve = useMutation({
    mutationFn: (status: "upheld" | "rejected") => resolveDispute({ data: { id: dispute.id, status, note } }),
    onSuccess: onResolved,
  });
  return (
    <li className="py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[color:var(--cc-ink-900)]">{dispute.reason}</div>
        <div className="text-xs text-[color:var(--cc-ink-500)]">{new Date(dispute.created_at).toLocaleString()}</div>
      </div>
      <CCStatusPill tone={dispute.status === "open" ? "warning" : dispute.status === "upheld" ? "success" : "neutral"}>{dispute.status}</CCStatusPill>
      {dispute.status === "open" && (
        <div className="flex flex-col gap-1">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Moderator note"
            className="h-8 rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] px-2 text-xs cc-focus-ring" />
          <div className="flex gap-1">
            <CCButton size="sm" variant="success" onClick={() => resolve.mutate("upheld")}>Uphold</CCButton>
            <CCButton size="sm" variant="danger" onClick={() => resolve.mutate("rejected")}>Reject</CCButton>
          </div>
        </div>
      )}
    </li>
  );
}