import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  qaTrend, addCoachingNote, openDispute, resolveDispute, acknowledgeReview,
} from "@/lib/qa.functions";
import {
  CCButton, CCStatusPill, CCFormSection, CCField, CCTextarea, CCWidget, CCSparkline, CCMetricWidget,
} from "@/components/cc";

export const Route = createFileRoute("/_authenticated/qa/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  const { user, atLeast } = useAuth();
  const qc = useQueryClient();
  const isLeader = atLeast("team_leader");

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

  const points = (trend.data ?? []).map((p: any) => p.score);
  const avg = points.length ? points.reduce((a: number, b: number) => a + b, 0) / points.length : 0;

  return (
    <>
      <PageHeader
        title="QA reviews"
        description={isLeader ? "Moderate team scores, coach, and resolve disputes." : "Your scored calls and feedback."}
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <CCMetricWidget
            title="30-day avg"
            value={`${avg.toFixed(1)}%`}
            tone={avg >= 80 ? "positive" : avg >= 65 ? "warning" : "negative"}
            trend={{ points }}
          />
          <CCMetricWidget title="Reviews" value={(reviews.data?.length ?? 0).toString()} />
          <CCMetricWidget
            title="Open disputes"
            value={(disputes.data?.filter((d: any) => d.status === "open").length ?? 0).toString()}
            tone="warning"
          />
        </div>

        <CCWidget title="Recent reviews">
          <ul className="divide-y divide-[color:var(--cc-ink-100)]">
            {(reviews.data ?? []).map((r: any) => (
              <ReviewRow key={r.id} review={r} canModerate={isLeader} onChange={() => {
                qc.invalidateQueries({ queryKey: ["qa-reviews"] });
                qc.invalidateQueries({ queryKey: ["qa-disputes"] });
              }} />
            ))}
            {reviews.data && reviews.data.length === 0 && (
              <li className="py-6 text-sm text-[color:var(--cc-ink-500)]">No reviews yet.</li>
            )}
          </ul>
        </CCWidget>

        {isLeader && (
          <CCWidget title="Disputes queue">
            <ul className="divide-y divide-[color:var(--cc-ink-100)]">
              {(disputes.data ?? []).map((d: any) => (
                <DisputeRow key={d.id} dispute={d} onResolved={() => qc.invalidateQueries({ queryKey: ["qa-disputes"] })} />
              ))}
              {disputes.data && disputes.data.length === 0 && (
                <li className="py-6 text-sm text-[color:var(--cc-ink-500)]">No disputes.</li>
              )}
            </ul>
          </CCWidget>
        )}
      </div>
    </>
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