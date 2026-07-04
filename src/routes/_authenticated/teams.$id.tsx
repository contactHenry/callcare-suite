import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard } from "@/components/cc";
import { ArrowLeft, Users as UsersIcon, ClipboardList, Megaphone, CheckCircle2, Circle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/teams/$id")({
  head: () => ({ meta: [{ title: "Team details" }] }),
  component: TeamDetailPage,
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Team not found. <Link to="/teams" className="underline">Back to teams</Link></div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  loader: ({ params }) => {
    const team = TEAMS_DETAIL[params.id];
    if (!team) throw notFound();
    return team;
  },
});

type Member = { id: string; name: string; role: string; taskProgress: number; status: "online" | "away" | "offline" };
type TeamTask = { id: string; title: string; assignee: string; due: string; status: "todo" | "in_progress" | "done" };
type TeamCampaign = { id: string; name: string; progress: number; contactsDialed: number; contactsTotal: number };

type TeamDetail = {
  id: string;
  name: string;
  lead: string;
  type: string;
  sla: string;
  aht: string;
  members: Member[];
  tasks: TeamTask[];
  campaigns: TeamCampaign[];
};

const TEAMS_DETAIL: Record<string, TeamDetail> = {
  t1: {
    id: "t1", name: "Retention — APAC", lead: "Priya Sharma", type: "Blended", sla: "98%", aht: "4m 12s",
    members: [
      { id: "m1", name: "Priya Sharma", role: "Team Lead", taskProgress: 82, status: "online" },
      { id: "m2", name: "Rahul Menon", role: "Sr. Agent", taskProgress: 74, status: "online" },
      { id: "m3", name: "Aiko Tanaka", role: "Agent", taskProgress: 61, status: "away" },
      { id: "m4", name: "Wei Chen", role: "Agent", taskProgress: 55, status: "online" },
      { id: "m5", name: "Nisha Patel", role: "Agent", taskProgress: 48, status: "offline" },
    ],
    tasks: [
      { id: "k1", title: "Follow up on churn-risk cohort", assignee: "Rahul Menon", due: "Today · 5:00 PM", status: "in_progress" },
      { id: "k2", title: "Kickoff briefing — Q3 retention", assignee: "All members", due: "Tomorrow · 9:00 AM", status: "todo" },
      { id: "k3", title: "Update save-offer script", assignee: "Priya Sharma", due: "Jul 2", status: "done" },
    ],
    campaigns: [
      { id: "c1", name: "Winback — Premium APAC", progress: 64, contactsDialed: 1280, contactsTotal: 2000 },
      { id: "c2", name: "Loyalty renewal push", progress: 41, contactsDialed: 615, contactsTotal: 1500 },
    ],
  },
  t2: {
    id: "t2", name: "Sales — Inbound", lead: "Tom Barker", type: "Inbound", sla: "94%", aht: "5m 02s",
    members: [
      { id: "m1", name: "Tom Barker", role: "Team Lead", taskProgress: 90, status: "online" },
      { id: "m2", name: "Sofia Alvarez", role: "Sr. Agent", taskProgress: 71, status: "online" },
      { id: "m3", name: "Ben Okafor", role: "Agent", taskProgress: 58, status: "away" },
      { id: "m4", name: "Emma Wilson", role: "Agent", taskProgress: 66, status: "online" },
    ],
    tasks: [
      { id: "k1", title: "Qualify enterprise leads", assignee: "Sofia Alvarez", due: "Today", status: "in_progress" },
      { id: "k2", title: "Demo scheduling sweep", assignee: "Ben Okafor", due: "Jul 5", status: "todo" },
    ],
    campaigns: [
      { id: "c1", name: "Inbound demo requests", progress: 78, contactsDialed: 940, contactsTotal: 1200 },
    ],
  },
  t3: {
    id: "t3", name: "Collections", lead: "Adaeze Nwosu", type: "Outbound", sla: "91%", aht: "6m 48s",
    members: [
      { id: "m1", name: "Adaeze Nwosu", role: "Team Lead", taskProgress: 77, status: "online" },
      { id: "m2", name: "Marco Rossi", role: "Sr. Agent", taskProgress: 65, status: "offline" },
      { id: "m3", name: "Jae-won Park", role: "Agent", taskProgress: 52, status: "online" },
    ],
    tasks: [
      { id: "k1", title: "30-day overdue outreach", assignee: "All members", due: "This week", status: "in_progress" },
    ],
    campaigns: [
      { id: "c1", name: "Q2 overdue recovery", progress: 55, contactsDialed: 825, contactsTotal: 1500 },
    ],
  },
  t4: {
    id: "t4", name: "Support — Tier 2", lead: "Jordan Liu", type: "Inbound", sla: "96%", aht: "7m 21s",
    members: [
      { id: "m1", name: "Jordan Liu", role: "Team Lead", taskProgress: 88, status: "online" },
      { id: "m2", name: "Hana Kim", role: "Sr. Agent", taskProgress: 72, status: "online" },
      { id: "m3", name: "Owen Grant", role: "Agent", taskProgress: 63, status: "away" },
    ],
    tasks: [
      { id: "k1", title: "Escalation triage — billing", assignee: "Hana Kim", due: "Today", status: "in_progress" },
      { id: "k2", title: "KB article: refund policy", assignee: "Owen Grant", due: "Jul 8", status: "todo" },
    ],
    campaigns: [],
  },
};

function statusDot(status: Member["status"]) {
  const color =
    status === "online" ? "bg-emerald-500" : status === "away" ? "bg-amber-500" : "bg-slate-400";
  return <span className={`inline-block size-2 rounded-full ${color}`} />;
}

function taskIcon(status: TeamTask["status"]) {
  if (status === "done") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "in_progress") return <Clock className="size-4 text-amber-600" />;
  return <Circle className="size-4 text-muted-foreground" />;
}

function TeamDetailPage() {
  const team = Route.useLoaderData() as TeamDetail;
  const doneTasks = team.tasks.filter((t) => t.status === "done").length;
  const taskCompletion = team.tasks.length ? Math.round((doneTasks / team.tasks.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title={team.name}
        description={`Lead · ${team.lead} · ${team.type} · SLA ${team.sla} · AHT ${team.aht}`}
        actions={
          <Link to="/teams">
            <CCButton size="sm" variant="ghost">
              <ArrowLeft className="size-4 mr-1.5" />Back to teams
            </CCButton>
          </Link>
        }
      />
      <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overview */}
        <CCCard className="p-5 lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Members</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{team.members.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Tasks completed</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{doneTasks}/{team.tasks.length}</div>
            <Progress value={taskCompletion} className="mt-2 h-1.5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Active campaigns</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{team.campaigns.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">SLA · AHT</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{team.sla}</div>
            <div className="text-xs text-muted-foreground">{team.aht} avg handle</div>
          </div>
        </CCCard>

        {/* Members */}
        <CCCard className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <UsersIcon className="size-4" />
            <h3 className="text-sm font-semibold">Team members</h3>
            <span className="text-xs text-muted-foreground">({team.members.length})</span>
          </div>
          <div className="divide-y divide-[color:var(--cc-ink-100)]">
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <div className="flex items-center gap-2 w-52">
                  {statusDot(m.status)}
                  <div>
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">{m.role}</div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Task progress</span>
                    <span className="tabular-nums font-medium">{m.taskProgress}%</span>
                  </div>
                  <Progress value={m.taskProgress} className="h-1.5" />
                </div>
              </div>
            ))}
          </div>
        </CCCard>

        {/* Tasks */}
        <CCCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="size-4" />
            <h3 className="text-sm font-semibold">Assigned tasks</h3>
          </div>
          {team.tasks.length === 0 ? (
            <div className="text-xs text-muted-foreground">No tasks assigned.</div>
          ) : (
            <ul className="space-y-3">
              {team.tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <div className="mt-0.5">{taskIcon(t.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.assignee} · Due {t.due}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CCCard>

        {/* Campaigns */}
        <CCCard className="p-5 lg:col-span-3">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="size-4" />
            <h3 className="text-sm font-semibold">Campaign progress</h3>
          </div>
          {team.campaigns.length === 0 ? (
            <div className="text-xs text-muted-foreground">No campaigns assigned to this team.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {team.campaigns.map((c) => (
                <div key={c.id} className="rounded border border-[color:var(--cc-ink-100)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{c.name}</div>
                    <span className="text-xs tabular-nums font-medium">{c.progress}%</span>
                  </div>
                  <Progress value={c.progress} className="h-1.5 mt-2" />
                  <div className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                    {c.contactsDialed.toLocaleString()} / {c.contactsTotal.toLocaleString()} contacts dialed
                  </div>
                </div>
              ))}
            </div>
          )}
        </CCCard>
      </div>
    </>
  );
}