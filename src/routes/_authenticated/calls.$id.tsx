import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calls/$id")({
  component: CallDetail,
});

function CallDetail() {
  const { id } = Route.useParams();
  const { user, isManager } = useAuth();
  const qc = useQueryClient();

  const { data: call } = useQuery({
    queryKey: ["call", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*, contacts(id,name,company)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: agent } = useQuery({
    queryKey: ["call-agent", call?.agent_id],
    enabled: !!call?.agent_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", call!.agent_id).maybeSingle();
      return data;
    },
  });

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!call?.audio_path) { setAudioUrl(null); return; }
    supabase.storage.from("call-recordings").createSignedUrl(call.audio_path, 3600).then(({ data }) => {
      setAudioUrl(data?.signedUrl ?? null);
    });
  }, [call?.audio_path]);

  const { data: criteria = [] } = useQuery({
    queryKey: ["criteria-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qa_criteria").select("*").eq("active", true).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: review } = useQuery({
    queryKey: ["review", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_reviews")
        .select("*, qa_review_scores(*)")
        .eq("call_id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const initialScores = useMemo(() => {
    const map: Record<string, number> = {};
    criteria.forEach((c) => (map[c.id] = 3));
    (review?.qa_review_scores ?? []).forEach((s: any) => (map[s.criterion_id] = s.score));
    return map;
  }, [criteria, review]);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  useEffect(() => { setScores(initialScores); }, [initialScores]);
  useEffect(() => { if (review?.notes) setNotes(review.notes); }, [review?.notes]);

  const previewScore = useMemo(() => {
    if (!criteria.length) return null;
    const totalWeight = criteria.reduce((s, c) => s + Number(c.weight), 0);
    const earned = criteria.reduce((s, c) => s + (scores[c.id] ?? 0) * Number(c.weight), 0);
    return Math.round((earned / (totalWeight * 5)) * 1000) / 10;
  }, [criteria, scores]);

  async function saveReview() {
    if (!user) return;
    const { data: existing } = await supabase
      .from("qa_reviews").select("id").eq("call_id", id).maybeSingle();
    let reviewId = existing?.id;
    if (!reviewId) {
      const { data, error } = await supabase
        .from("qa_reviews")
        .insert({ call_id: id, reviewer_id: user.id, notes })
        .select("id").single();
      if (error) return toast.error(error.message);
      reviewId = data.id;
    } else {
      const { error } = await supabase.from("qa_reviews").update({ notes }).eq("id", reviewId);
      if (error) return toast.error(error.message);
    }
    await supabase.from("qa_review_scores").delete().eq("review_id", reviewId);
    const rows = Object.entries(scores).map(([criterion_id, score]) => ({
      review_id: reviewId!, criterion_id, score,
    }));
    const { error: insErr } = await supabase.from("qa_review_scores").insert(rows);
    if (insErr) return toast.error(insErr.message);
    toast.success("QA review saved");
    qc.invalidateQueries({ queryKey: ["review", id] });
    qc.invalidateQueries({ queryKey: ["calls"] });
  }

  return (
    <>
      <PageHeader
        title={call?.contacts?.name ? `Call · ${call.contacts.name}` : "Call"}
        description={call ? new Date(call.started_at).toLocaleString() : ""}
        actions={
          <Button variant="outline" asChild>
            <Link to="/calls"><ArrowLeft className="size-4 mr-2" /> All calls</Link>
          </Button>
        }
      />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-3">
            <Field label="Agent" value={agent?.full_name ?? "—"} />
            <Field label="Contact" value={
              call?.contacts
                ? <Link to="/contacts/$id" params={{ id: call.contacts.id }} className="underline">{call.contacts.name}</Link>
                : "—"
            } />
            <Field label="Direction" value={<span className="capitalize">{call?.direction}</span>} />
            <Field label="Outcome" value={<span className="capitalize">{call?.outcome}</span>} />
            <Field label="Duration" value={`${Math.round((call?.duration_seconds ?? 0) / 60)} min`} />
            <Field label="Notes" value={call?.notes ?? "—"} />
            {audioUrl && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Recording</div>
                <audio controls src={audioUrl} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>QA Scorecard</CardTitle>
              {review?.overall_score != null && (
                <Badge variant="secondary">Saved: {Math.round(Number(review.overall_score))}%</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isManager && !review && (
              <p className="text-sm text-muted-foreground">This call hasn't been reviewed yet. A manager will score it.</p>
            )}
            {(isManager || review) && criteria.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{c.label}</div>
                    {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">weight {Number(c.weight)}</Badge>
                    <span className="text-sm w-6 text-right">{scores[c.id] ?? 0}</span>
                  </div>
                </div>
                <Slider
                  min={0}
                  max={5}
                  step={1}
                  value={[scores[c.id] ?? 0]}
                  disabled={!isManager}
                  onValueChange={([v]) => setScores({ ...scores, [c.id]: v })}
                />
              </div>
            ))}
            {(isManager || review) && (
              <div className="space-y-1.5">
                <Label>Reviewer notes</Label>
                <Textarea value={notes} disabled={!isManager} onChange={(e) => setNotes(e.target.value)} />
              </div>
            )}
            {isManager && (
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm text-muted-foreground">
                  Preview score: <span className="font-medium text-foreground">{previewScore ?? "—"}%</span>
                </div>
                <Button onClick={saveReview}>Save review</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}