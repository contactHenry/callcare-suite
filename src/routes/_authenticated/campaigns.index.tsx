import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard, CCStatusPill, CCTable, CCThead, CCTh, CCTr, CCTd } from "@/components/cc";
import { Target, Phone, Users, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/campaigns/")({
  head: () => ({ meta: [{ title: "Campaigns" }] }),
  component: CampaignsPage,
});

const SAMPLE = [
  { id: "c1", name: "Q4 Renewal Drive", status: "Active", owner: "Adaeze N.", calls: 1240, contacts: 980, conversion: "32%" },
  { id: "c2", name: "Winback — Lapsed 30d", status: "Active", owner: "Tom B.", calls: 845, contacts: 612, conversion: "18%" },
  { id: "c3", name: "Mortgage Pre-Qual", status: "Paused", owner: "Priya S.", calls: 410, contacts: 320, conversion: "24%" },
  { id: "c4", name: "NPS Follow-up", status: "Draft", owner: "Jordan L.", calls: 0, contacts: 0, conversion: "—" },
];

function CampaignsPage() {
  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Outbound calling campaigns with dispositions, scripts, and contact lists. Supervisor+ only."
        actions={<CCButton size="sm"><Target className="size-4 mr-1.5" />New campaign</CCButton>}
      />
      <div className="px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CCCard className="p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-semibold mt-1">2</div></div><Target className="size-5 text-muted-foreground" /></div></CCCard>
          <CCCard className="p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">Calls today</div><div className="text-2xl font-semibold mt-1">1,284</div></div><Phone className="size-5 text-muted-foreground" /></div></CCCard>
          <CCCard className="p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">Contacts</div><div className="text-2xl font-semibold mt-1">1,912</div></div><Users className="size-5 text-muted-foreground" /></div></CCCard>
          <CCCard className="p-5"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground">Avg. conversion</div><div className="text-2xl font-semibold mt-1">24.6%</div></div><TrendingUp className="size-5 text-emerald-500" /></div></CCCard>
        </div>
        <section>
          <CCTable>
            <CCThead>
              <tr>
                <CCTh>Campaign</CCTh>
                <CCTh>Status</CCTh>
                <CCTh>Owner</CCTh>
                <CCTh className="text-right">Calls</CCTh>
                <CCTh className="text-right">Contacts</CCTh>
                <CCTh className="text-right">Conv.</CCTh>
              </tr>
            </CCThead>
            <tbody>
              {SAMPLE.map((c) => (
                <CCTr key={c.id}>
                  <CCTd className="font-medium">{c.name}</CCTd>
                  <CCTd>
                    {c.status === "Active" && <CCStatusPill tone="success">{c.status}</CCStatusPill>}
                    {c.status === "Paused" && <CCStatusPill tone="warning">{c.status}</CCStatusPill>}
                    {c.status === "Draft" && <CCStatusPill tone="neutral">{c.status}</CCStatusPill>}
                  </CCTd>
                  <CCTd className="text-[color:var(--cc-ink-500)]">{c.owner}</CCTd>
                  <CCTd className="text-right tabular-nums">{c.calls.toLocaleString()}</CCTd>
                  <CCTd className="text-right tabular-nums">{c.contacts.toLocaleString()}</CCTd>
                  <CCTd className="text-right tabular-nums">{c.conversion}</CCTd>
                </CCTr>
              ))}
            </tbody>
          </CCTable>
        </section>
      </div>
    </>
  );
}