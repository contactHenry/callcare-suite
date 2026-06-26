import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Users, ClipboardCheck, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DUMMY_DASHBOARD, DUMMY_CALLS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, isManager } = useAuth();
  const userId = user!.id;

  const { data: stats } = useQuery({
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
    { label: "Calls today", value: view.callsToday, icon: Phone, to: "/calls" },
    { label: "Contacts", value: view.contacts, icon: Users, to: "/contacts" },
    {
      label: "Avg QA score",
      value: view.avgScore != null ? `${view.avgScore}%` : "—",
      icon: Star,
      to: "/qa/dashboard",
    },
    { label: "Awaiting QA", value: view.pendingQa, icon: ClipboardCheck, to: "/calls" },
  ];

  const recentCalls = DUMMY_CALLS.slice(0, 5);

  return (
    <>
      <PageHeader title="Dashboard" description="Your activity at a glance." />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.label} to={t.to}>
                <Card className="hover:bg-accent/30 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
                    <Icon className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{t.value}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{isEmpty ? "Recent calls (sample)" : "Get started"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {isEmpty ? (
              <ul className="divide-y">
                {recentCalls.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">{c.contacts.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.agent_name} · {c.direction} · {c.outcome}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.started_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground space-y-2">
                <p>1. Add a contact in the <Link to="/contacts" className="underline">CRM</Link>.</p>
                <p>2. Log a call against that contact from <Link to="/calls/new" className="underline">New call</Link> — optionally attach a recording.</p>
                <p>3. {isManager ? "Open any call to score it against the scorecard." : "Wait for a manager to review and score your calls."}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}