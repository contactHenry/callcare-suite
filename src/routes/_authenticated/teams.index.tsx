import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard } from "@/components/cc";
import { Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teams/")({
  head: () => ({ meta: [{ title: "Teams" }] }),
  component: TeamsPage,
});

const TEAMS = [
  { id: "t1", name: "Retention — APAC", lead: "Priya Sharma", members: 14, sla: "98%", aht: "4m 12s" },
  { id: "t2", name: "Sales — Inbound", lead: "Tom Barker", members: 11, sla: "94%", aht: "5m 02s" },
  { id: "t3", name: "Collections", lead: "Adaeze Nwosu", members: 9, sla: "91%", aht: "6m 48s" },
  { id: "t4", name: "Support — Tier 2", lead: "Jordan Liu", members: 12, sla: "96%", aht: "7m 21s" },
];

function TeamsPage() {
  return (
    <>
      <PageHeader
        title="Teams"
        description="Squads of agents grouped by a Team Leader. Used for routing, monitoring, and reporting."
        actions={<CCButton size="sm"><UsersIcon className="size-4 mr-1.5" />New team</CCButton>}
      />
      <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEAMS.map((t) => (
          <CCCard key={t.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Lead · {t.lead}</div>
              </div>
              <span className="inline-flex items-center rounded-full bg-[color:var(--cc-brand-600)]/10 text-[color:var(--cc-brand-600)] px-2 py-0.5 text-[11px] font-medium">{t.members} members</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div><div className="text-xs text-muted-foreground">SLA attainment</div><div className="font-semibold tabular-nums mt-0.5">{t.sla}</div></div>
              <div><div className="text-xs text-muted-foreground">Avg. handle time</div><div className="font-semibold tabular-nums mt-0.5">{t.aht}</div></div>
            </div>
          </CCCard>
        ))}
      </div>
    </>
  );
}