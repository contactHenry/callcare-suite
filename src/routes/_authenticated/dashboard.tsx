import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  CCMetricWidget, CCWidget, CCSparkline, CCBarChart, CCProgressBar,
  CCStatusPill, CCPresence, CCButton,
} from "@/components/cc";
import { upcomingFollowUps, listTasks } from "@/lib/workflow.functions";
import { qaTrend } from "@/lib/qa.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { atLeast } = useAuth();
  if (atLeast("supervisor")) return <ManagementDashboard />;
  if (atLeast("team_leader")) return <TeamLeaderDashboard />;
  return <AgentDashboard />;
}

/* ------------------------------- Agent ------------------------------- */
function AgentDashboard() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const stats = useQuery({
    enabled: !!userId,
    queryKey: ["agent-dash", userId],
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [callsToday, openTasks, myCalls] = await Promise.all([
        supabase.from("calls").select("id", { count: "exact", head: true }).eq("agent_id", userId).gte("started_at", startOfDay.toISOString()),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", userId).neq("status", "completed"),
        supabase.from("calls").select("id, duration_seconds").eq("agent_id", userId).gte("started_at", startOfDay.toISOString()),
      ]);
      const totalHandle = (myCalls.data ?? []).reduce((s, c: any) => s + (c.duration_seconds ?? 0), 0);
      const aht = myCalls.data?.length ? Math.round(totalHandle / myCalls.data.length) : 0;
      return { callsToday: callsToday.count ?? 0, openTasks: openTasks.count ?? 0, aht };
    },
  });

  const trend = useQuery({
    enabled: !!userId,
    queryKey: ["agent-qa-trend", userId],
    queryFn: () => qaTrend({ data: { days: 30 } }),
  });

  const upcoming = useQuery({
    enabled: !!userId,
    queryKey: ["agent-upcoming", userId],
    queryFn: () => upcomingFollowUps({ data: { windowMinutes: 240 } }),
  });

  const points = (trend.data ?? []).map((p: any) => p.score);
  const avg = points.length ? points.reduce((a: number, b: number) => a + b, 0) / points.length : 0;

  return (
    <>
      <PageHeader title="My day" description="Your live metrics, follow-ups, and coaching." />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <CCPresence status="available" />
          <span className="text-xs text-[color:var(--cc-ink-500)]">You're on shift.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CCMetricWidget title="Calls today" value={stats.data?.callsToday ?? 0} />
          <CCMetricWidget title="Avg handle time" value={`${stats.data?.aht ?? 0}s`} />
          <CCMetricWidget title="Open tasks" value={stats.data?.openTasks ?? 0} tone={(stats.data?.openTasks ?? 0) > 5 ? "warning" : "neutral"} />
          <CCMetricWidget title="QA 30-day avg" value={`${avg.toFixed(1)}%`} trend={{ points }} tone={avg >= 80 ? "positive" : avg >= 65 ? "warning" : "negative"} />
        </div>

        <CCWidget title="Upcoming follow-ups (next 4h)" footer={<Link to="/tasks" className="underline">View all tasks</Link>}>
          {upcoming.data && upcoming.data.length === 0 ? (
            <p className="text-sm text-[color:var(--cc-ink-500)]">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--cc-ink-100)]">
              {(upcoming.data ?? []).map((t: any) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[color:var(--cc-ink-900)] truncate">{t.title}</div>
                    <div className="text-xs text-[color:var(--cc-ink-500)] truncate">{t.client?.name ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CCStatusPill tone={t.priority === "urgent" || t.priority === "high" ? "danger" : "info"}>{t.priority}</CCStatusPill>
                    <span className="text-xs text-[color:var(--cc-ink-700)] tabular-nums">{new Date(t.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CCWidget>
      </div>
    </>
  );
}

/* ----------------------------- Team Leader --------------------------- */
function TeamLeaderDashboard() {
  const teamTasks = useQuery({
    queryKey: ["team-tasks"],
    queryFn: () => listTasks({ data: { scope: "team", overdueOnly: false, limit: 50 } }),
  });

  const liveCalls = useQuery({
    queryKey: ["live-calls"],
    queryFn: async () => {
      const { data } = await supabase.from("calls").select("id, agent_id, contact_id, status, started_at")
        .in("status", ["ringing", "active", "on_hold"]).limit(50);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const todayVolume = useQuery({
    queryKey: ["today-volume"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("calls").select("started_at")
        .gte("started_at", start.toISOString()).limit(2000);
      const buckets = Array.from({ length: 12 }, (_, i) => ({ label: `${i * 2}`, value: 0 }));
      for (const c of (data ?? [])) {
        const h = new Date(c.started_at as string).getHours();
        buckets[Math.floor(h / 2)].value++;
      }
      return buckets;
    },
  });

  const overdue = (teamTasks.data ?? []).filter((t: any) => t.due_at && new Date(t.due_at) < new Date() && t.status !== "completed");

  return (
    <>
      <PageHeader title="Team operations" description="Live floor view + today's performance for your team." />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CCMetricWidget title="Live calls" value={liveCalls.data?.length ?? 0} tone="positive" sub="Updated every 5s" />
          <CCMetricWidget title="Open tasks" value={teamTasks.data?.length ?? 0} />
          <CCMetricWidget title="Overdue" value={overdue.length} tone={overdue.length ? "negative" : "neutral"} />
          <CCMetricWidget title="Calls today" value={(todayVolume.data ?? []).reduce((s, b) => s + b.value, 0)} />
        </div>

        <CCWidget title="Call volume by hour" hint="2-hour buckets">
          <CCBarChart data={todayVolume.data ?? []} formatX={(l) => `${l}:00`} />
        </CCWidget>

        <CCWidget title="Live floor" footer={<Link to="/monitoring" className="underline">Open monitoring console →</Link>}>
          {liveCalls.data && liveCalls.data.length === 0 ? (
            <p className="text-sm text-[color:var(--cc-ink-500)]">No live calls.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--cc-ink-100)]">
              {(liveCalls.data ?? []).map((c: any) => (
                <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-[color:var(--cc-ink-700)]">Call #{c.id.slice(0, 8)}</span>
                  <CCStatusPill tone={c.status === "on_hold" ? "warning" : "info"} dot>{c.status}</CCStatusPill>
                </li>
              ))}
            </ul>
          )}
        </CCWidget>
      </div>
    </>
  );
}

/* ----------------------------- Management ---------------------------- */
function ManagementDashboard() {
  const overview = useQuery({
    queryKey: ["mgmt-overview"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const startWeek = new Date(); startWeek.setDate(startWeek.getDate() - 7);
      const [callsToday, openComplaints, reviewsWeek, conversions] = await Promise.all([
        supabase.from("calls").select("id", { count: "exact", head: true }).gte("started_at", start.toISOString()),
        supabase.from("call_notes").select("id", { count: "exact", head: true }).eq("complaint", true).gte("created_at", startWeek.toISOString()),
        supabase.from("qa_reviews").select("overall_score").gte("created_at", startWeek.toISOString()),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("lifecycle_status", "converted"),
      ]);
      const avgQa = reviewsWeek.data && reviewsWeek.data.length
        ? reviewsWeek.data.reduce((s, r: any) => s + Number(r.overall_score ?? 0), 0) / reviewsWeek.data.length
        : 0;
      return {
        callsToday: callsToday.count ?? 0,
        complaints: openComplaints.count ?? 0,
        avgQa,
        conversions: conversions.count ?? 0,
      };
    },
  });

  const last30 = useQuery({
    queryKey: ["mgmt-trend"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("calls").select("started_at").gte("started_at", since).limit(5000);
      const byDay: Record<string, number> = {};
      for (const c of (data ?? [])) {
        const day = (c.started_at as string).slice(0, 10);
        byDay[day] = (byDay[day] ?? 0) + 1;
      }
      return Object.entries(byDay).sort().map(([day, n]) => ({ day, value: n }));
    },
  });

  const trendPoints = (last30.data ?? []).map((p) => p.value);

  return (
    <>
      <PageHeader
        title="Management overview"
        description="Cross-team performance, compliance, and conversion."
        actions={<CCButton variant="secondary" onClick={() => window.print()}>Export</CCButton>}
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CCMetricWidget title="Calls today" value={overview.data?.callsToday ?? 0} trend={{ points: trendPoints }} />
          <CCMetricWidget title="QA avg (7d)" value={`${(overview.data?.avgQa ?? 0).toFixed(1)}%`} tone={(overview.data?.avgQa ?? 0) >= 80 ? "positive" : "warning"} />
          <CCMetricWidget title="Complaints (7d)" value={overview.data?.complaints ?? 0} tone={(overview.data?.complaints ?? 0) > 0 ? "negative" : "positive"} />
          <CCMetricWidget title="Conversions" value={overview.data?.conversions ?? 0} tone="positive" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CCWidget title="30-day call volume">
            <CCBarChart data={(last30.data ?? []).map((d) => ({ label: d.day.slice(5), value: d.value }))} formatX={(l) => l} />
          </CCWidget>
          <CCWidget title="Compliance gauge" hint="Target: 95% QA pass rate">
            <div className="py-2 space-y-3">
              <CCProgressBar value={Math.round(overview.data?.avgQa ?? 0)} max={100} tone={(overview.data?.avgQa ?? 0) >= 95 ? "success" : (overview.data?.avgQa ?? 0) >= 80 ? "brand" : "warning"} />
              <p className="text-xs text-[color:var(--cc-ink-500)]">QA aggregate across all teams over the last 7 days.</p>
            </div>
          </CCWidget>
        </div>

        <CCWidget title="Quick links">
          <div className="flex flex-wrap gap-2">
            <Link to="/qa/scorecards"><CCButton size="sm" variant="secondary">Scorecards</CCButton></Link>
            <Link to="/qa/reviews"><CCButton size="sm" variant="secondary">QA reviews</CCButton></Link>
            <Link to="/scripts"><CCButton size="sm" variant="secondary">Scripts</CCButton></Link>
            <Link to="/staff"><CCButton size="sm" variant="secondary">Staff</CCButton></Link>
            <Link to="/security/audit"><CCButton size="sm" variant="secondary">Audit log</CCButton></Link>
          </div>
        </CCWidget>
      </div>
    </>
  );
}