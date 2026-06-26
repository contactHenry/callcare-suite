import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DUMMY_QA_SUMMARY } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/qa/dashboard")({
  component: QaDashboard,
});

function QaDashboard() {
  const { user, isManager } = useAuth();

  const { data: realData } = useQuery({
    queryKey: ["qa-trend", user?.id, isManager],
    enabled: !!user,
    queryFn: async () => {
      let callQuery = supabase.from("calls").select("id, agent_id, started_at");
      if (!isManager) callQuery = callQuery.eq("agent_id", user!.id);
      const { data: calls } = await callQuery;
      const callIds = (calls ?? []).map((c) => c.id);
      if (!callIds.length) return { trend: [], avg: null, count: 0 };
      const { data: reviews } = await supabase
        .from("qa_reviews")
        .select("call_id, overall_score, created_at")
        .in("call_id", callIds)
        .not("overall_score", "is", null)
        .order("created_at");
      const points = (reviews ?? []).map((r) => ({
        date: new Date(r.created_at).toLocaleDateString(),
        score: Number(r.overall_score),
      }));
      const avg = points.length
        ? Math.round((points.reduce((s, p) => s + p.score, 0) / points.length) * 10) / 10
        : null;
      return { trend: points, avg, count: points.length };
    },
  });

  const isSample = !realData || realData.count === 0;
  const data = isSample ? DUMMY_QA_SUMMARY : realData;

  return (
    <>
      <PageHeader
        title="QA scores"
        description={isManager ? "Quality trend across all reviewed calls." : "Your quality scores over time."}
      />
      <div className="p-6 grid gap-4 lg:grid-cols-3">
        {isSample && (
          <div className="lg:col-span-3 text-xs text-muted-foreground -mb-2">
            Showing sample data for preview. Score a call to see live trends.
          </div>
        )}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Average score</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{data?.avg != null ? `${data.avg}%` : "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Reviews</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{data?.count ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Latest score</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {data?.trend?.length ? `${data.trend[data.trend.length - 1].score}%` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Score trend</CardTitle></CardHeader>
          <CardContent className="h-80">
            {data?.trend?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No reviews yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}