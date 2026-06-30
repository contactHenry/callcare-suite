import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard } from "@/components/cc";
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
        <CCCard className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-5 py-3">Campaign</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3 text-right">Calls</th><th className="px-5 py-3 text-right">Contacts</th><th className="px-5 py-3 text-right">Conv.</th></tr>
            </thead>
            <tbody>
              {SAMPLE.map((c) => (
                <tr key={c.id} className="border-t hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3">
                    <span className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " +
                      (c.status === "Active" ? "bg-emerald-100 text-emerald-700"
                        : c.status === "Paused" ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700")
                    }>{c.status}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{c.owner}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.calls.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.contacts.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.conversion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CCCard>
      </div>
    </>
  );
}