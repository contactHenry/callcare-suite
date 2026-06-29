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
import {
  DUMMY_AGENT_STATS, DUMMY_QA_POINTS, DUMMY_UPCOMING_FOLLOWUPS,
  DUMMY_TEAM_VOLUME, DUMMY_LIVE_CALLS, DUMMY_TASKS,
  DUMMY_MGMT_TREND, DUMMY_MGMT_OVERVIEW,
} from "@/lib/dummy-data";

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

  // Daily task list — the agent's home base between calls.
  const myTasks = useQuery({
    enabled: !!userId,
    queryKey: ["agent-my-tasks", userId],
    queryFn: () => listTasks({ data: { scope: "mine", overdueOnly: false, limit: 25 } }),
  });

  const points = (trend.data ?? []).map((p: any) => p.score);
  const trendPoints = points.length ? points : DUMMY_QA_POINTS;
  const avg = trendPoints.reduce((a: number, b: number) => a + b, 0) / trendPoints.length;
  const statsData = stats.data && (stats.data.callsToday || stats.data.openTasks || stats.data.aht)
    ? stats.data : DUMMY_AGENT_STATS;
  const upcomingData = (upcoming.data && upcoming.data.length > 0)
    ? upcoming.data : DUMMY_UPCOMING_FOLLOWUPS;

  return (
    <>
      <PageHeader title="My day" description="Your live metrics, follow-ups, and coaching." />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <CCPresence status="available" />
          <span className="text-xs text-[color:var(--cc-ink-500)]">You're on shift.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CCMetricWidget title="Calls today" value={statsData.callsToday} />
          <CCMetricWidget title="Avg handle time" value={`${statsData.aht}s`} />
          <CCMetricWidget title="Open tasks" value={statsData.openTasks} tone={statsData.openTasks > 5 ? "warning" : "neutral"} />
          <CCMetricWidget title="QA 30-day avg" value={`${avg.toFixed(1)}%`} trend={{ points: trendPoints }} tone={avg >= 80 ? "positive" : avg >= 65 ? "warning" : "negative"} />
        </div>

        <CCWidget title="Upcoming follow-ups (next 4h)" footer={<Link to="/tasks" className="underline">View all tasks</Link>}>
          <ul className="divide-y divide-[color:var(--cc-ink-100)]">
              {upcomingData.map((t: any) => (
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
        </CCWidget>

        <CCWidget
          title="Today's tasks"
          footer={<Link to="/tasks" className="underline">Open task board</Link>}
        >
          <DailyTaskList tasks={(myTasks.data && myTasks.data.length > 0) ? myTasks.data : DUMMY_TASKS} />
        </CCWidget>
      </div>
    </>
  );
}

function DailyTaskList({ tasks }: { tasks: any[] }) {
  const now = Date.now();
  const buckets = {
    overdue: tasks.filter((t) => t.status !== "completed" && t.due_at && new Date(t.due_at).getTime() < now),
    today: tasks.filter((t) => {
      if (t.status === "completed" || !t.due_at) return false;
      const d = new Date(t.due_at); const today = new Date();
      return d.toDateString() === today.toDateString() && d.getTime() >= now;
    }),
    later: tasks.filter((t) => {
      if (t.status === "completed" || !t.due_at) return false;
      const d = new Date(t.due_at); const today = new Date();
      return d.toDateString() !== today.toDateString() && d.getTime() >= now;
    }),
  };
  const Section = ({ label, items, tone }: { label: string; items: any[]; tone: any }) =>
    items.length === 0 ? null : (
      <div className="py-2">
        <div className="flex items-center gap-2 px-1 pb-1">
          <CCStatusPill tone={tone}>{label}</CCStatusPill>
          <span className="text-xs text-[color:var(--cc-ink-500)]">{items.length}</span>
        </div>
        <ul className="divide-y divide-[color:var(--cc-ink-100)]">
          {items.slice(0, 6).map((t) => (
            <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-[color:var(--cc-ink-500)] truncate">
                  {t.client?.name ?? t.kind ?? "task"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CCStatusPill tone={t.priority === "urgent" || t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "neutral"}>
                  {t.priority ?? "normal"}
                </CCStatusPill>
                {t.due_at && (
                  <span className="text-xs text-[color:var(--cc-ink-700)] tabular-nums">
                    {new Date(t.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  if (!tasks.length) {
    return <div className="text-xs text-[color:var(--cc-ink-500)] py-4 text-center">All clear — no tasks for today.</div>;
  }
  return (
    <div>
      <Section label="Overdue" items={buckets.overdue} tone="danger" />
      <Section label="Today" items={buckets.today} tone="info" />
      <Section label="Later this week" items={buckets.later} tone="neutral" />
    </div>
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
        .in("status", ["ringing", "in_progress", "on_hold"]).limit(50);
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

  const tasksData = (teamTasks.data && teamTasks.data.length > 0) ? teamTasks.data : DUMMY_TASKS;
  const liveData = (liveCalls.data && liveCalls.data.length > 0) ? liveCalls.data : DUMMY_LIVE_CALLS;
  const volumeData = (todayVolume.data && (todayVolume.data ?? []).some((b) => b.value > 0)) ? todayVolume.data : DUMMY_TEAM_VOLUME;
  const overdue = tasksData.filter((t: any) => t.due_at && new Date(t.due_at) < new Date() && t.status !== "completed");

  return (
    <>
      <PageHeader title="Team operations" description="Live floor view + today's performance for your team." />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CCMetricWidget title="Live calls" value={liveData.length} tone="positive" sub="Updated every 5s" />
          <CCMetricWidget title="Open tasks" value={tasksData.length} />
          <CCMetricWidget title="Overdue" value={overdue.length} tone={overdue.length ? "negative" : "neutral"} />
          <CCMetricWidget title="Calls today" value={volumeData.reduce((s, b) => s + b.value, 0)} />
        </div>

        <CCWidget title="Call volume by hour" hint="2-hour buckets">
          <CCBarChart data={volumeData} formatX={(l) => `${l}:00`} />
        </CCWidget>

        <CCWidget title="Live floor" footer={<Link to="/monitoring" className="underline">Open monitoring console →</Link>}>
          <ul className="divide-y divide-[color:var(--cc-ink-100)]">
              {liveData.map((c: any) => (
                <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-[color:var(--cc-ink-700)]">Call #{String(c.id).slice(0, 8)} · {c.contacts?.name ?? ""}</span>
                  <CCStatusPill tone={c.status === "on_hold" ? "warning" : "info"} dot>{c.status}</CCStatusPill>
                </li>
              ))}
            </ul>
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

  const trendArr = (last30.data && last30.data.length > 0) ? last30.data : DUMMY_MGMT_TREND;
  const trendPoints = trendArr.map((p) => p.value);
  const ov = (overview.data && (overview.data.callsToday || overview.data.avgQa)) ? overview.data : DUMMY_MGMT_OVERVIEW;

  return (
    <>
      <PageHeader
        title="Management overview"
        description="Cross-team performance, compliance, and conversion."
        actions={<CCButton variant="secondary" onClick={() => window.print()}>Export</CCButton>}
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CCMetricWidget title="Calls today" value={ov.callsToday} trend={{ points: trendPoints }} />
          <CCMetricWidget title="QA avg (7d)" value={`${ov.avgQa.toFixed(1)}%`} tone={ov.avgQa >= 80 ? "positive" : "warning"} />
          <CCMetricWidget title="Complaints (7d)" value={ov.complaints} tone={ov.complaints > 0 ? "negative" : "positive"} />
          <CCMetricWidget title="Conversions" value={ov.conversions} tone="positive" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CCWidget title="30-day call volume">
            <CCBarChart data={trendArr.map((d) => ({ label: d.day.slice(5), value: d.value }))} formatX={(l) => l} />
          </CCWidget>
          <CCWidget title="Compliance gauge" hint="Target: 95% QA pass rate">
            <div className="py-2 space-y-3">
              <CCProgressBar value={Math.round(ov.avgQa)} max={100} tone={ov.avgQa >= 95 ? "success" : ov.avgQa >= 80 ? "brand" : "warning"} />
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