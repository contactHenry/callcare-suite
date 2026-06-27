import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Link } from "@tanstack/react-router";
import { DUMMY_DASHBOARD, DUMMY_CALLS } from "@/lib/dummy-data";
import { CCStat, CCCard, CCCardHeader, CCStatusPill, CCPresence } from "@/components/cc";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, isManager } = useAuth();
  const userId = user?.id ?? "";

  const { data: stats } = useQuery({
    enabled: !!userId,
    queryKey: ["dashboard", userId, isManager],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const callsToday = await supabase
        .from("calls")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", userId)
        .gte("started_at", startOfDay.toISOString());

      const contactsCount = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true });

      const myCalls = await supabase
        .from("calls")
        .select("id")
        .eq("agent_id", userId);
      const myCallIds = (myCalls.data ?? []).map((c) => c.id);

      let avg: number | null = null;
      let pending = 0;
      if (myCallIds.length) {
        const reviews = await supabase
          .from("qa_reviews")
          .select("overall_score, call_id")
          .in("call_id", myCallIds);
        const scored = (reviews.data ?? []).filter((r) => r.overall_score != null);
        avg = scored.length
          ? Math.round((scored.reduce((s, r) => s + Number(r.overall_score), 0) / scored.length) * 10) / 10
          : null;
        pending = myCallIds.length - (reviews.data ?? []).length;
      }

      return {
        callsToday: callsToday.count ?? 0,
        contacts: contactsCount.count ?? 0,
        avgScore: avg,
        pendingQa: pending,
      };
    },
  });

  const isEmpty =
    !stats ||
    ((stats.callsToday ?? 0) === 0 &&
      (stats.contacts ?? 0) === 0 &&
      stats.avgScore == null &&
      (stats.pendingQa ?? 0) === 0);
  const view = isEmpty ? DUMMY_DASHBOARD : stats!;

  const tiles = [
    { label: "Calls today", value: String(view.callsToday), to: "/calls" },
    { label: "Contacts", value: String(view.contacts), to: "/contacts" },
    { label: "Avg QA score", value: view.avgScore != null ? `${view.avgScore}%` : "—", to: "/qa/dashboard" },
    { label: "Awaiting QA", value: String(view.pendingQa), to: "/calls" },
  ];

  const recentCalls = DUMMY_CALLS.slice(0, 5);

  return (
    <>
      <PageHeader title="Dashboard" description="Your activity at a glance." />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <CCPresence status="available" />
          <span className="text-xs text-[color:var(--cc-ink-500)]">
            Design system: <span className="font-medium text-[color:var(--cc-ink-700)]">cc/* (proof-of-concept)</span>
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <Link key={t.label} to={t.to} className="block">
              <CCStat label={t.label} value={t.value} />
            </Link>
          ))}
        </div>
        <CCCard>
          <CCCardHeader
            title={isEmpty ? "Recent calls (sample)" : "Get started"}
            hint={isEmpty ? "Sample data" : undefined}
          />
          {isEmpty ? (
            <ul className="divide-y divide-[color:var(--cc-ink-200)]">
              {recentCalls.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-[color:var(--cc-ink-900)] truncate">
                      {c.contacts.name}
                    </div>
                    <div className="text-xs text-[color:var(--cc-ink-500)] truncate">
                      {c.agent_name} · {c.direction}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <CCStatusPill
                      tone={
                        c.outcome === "resolved"
                          ? "success"
                          : c.outcome === "escalated" || c.outcome === "no_answer"
                            ? "danger"
                            : "warning"
                      }
                      dot
                    >
                      {c.outcome.replace("_", " ")}
                    </CCStatusPill>
                    <span className="text-xs text-[color:var(--cc-ink-500)] whitespace-nowrap">
                      {new Date(c.started_at).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-[color:var(--cc-ink-700)] space-y-2">
              <p>1. Add a contact in the <Link to="/contacts" className="underline">CRM</Link>.</p>
              <p>2. Log a call from <Link to="/calls/new" className="underline">New call</Link> — optionally attach a recording.</p>
              <p>3. {isManager ? "Open any call to score it." : "Wait for a manager to review your calls."}</p>
            </div>
          )}
        </CCCard>
      </div>
    </>
  );
}