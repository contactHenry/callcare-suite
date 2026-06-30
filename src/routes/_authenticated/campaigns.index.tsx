import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard, CCStatusPill, CCTable, CCThead, CCTh, CCTr, CCTd } from "@/components/cc";
import { Target, Phone, Users, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", owner: "", type: "outbound", priority: "normal", goal: "", script: "none", notes: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    toast.success(`Campaign "${form.name}" created as draft`);
    setOpen(false);
    setForm({ name: "", owner: "", type: "outbound", priority: "normal", goal: "", script: "none", notes: "" });
  };

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Outbound calling campaigns with dispositions, scripts, and contact lists. Supervisor+ only."
        actions={<CCButton size="sm" onClick={() => setOpen(true)}><Target className="size-4 mr-1.5" />New campaign</CCButton>}
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>Set up an outbound calling campaign. It starts as a draft until you activate it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cn">Campaign name</Label>
              <Input id="cn" placeholder="e.g. Q1 Renewal Drive" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="co">Owner</Label>
                <Input id="co" placeholder="Supervisor name" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="winback">Winback</SelectItem>
                    <SelectItem value="survey">Survey / NPS</SelectItem>
                    <SelectItem value="collections">Collections</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Script</Label>
                <Select value={form.script} onValueChange={(v) => setForm({ ...form, script: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No script</SelectItem>
                    <SelectItem value="renewal">Renewal v2</SelectItem>
                    <SelectItem value="winback">Winback 30d</SelectItem>
                    <SelectItem value="mortgage">Mortgage Pre-Qual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cg">Goal</Label>
              <Input id="cg" placeholder="e.g. 30% conversion on 1,200 contacts" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cnotes">Notes</Label>
              <Textarea id="cnotes" rows={3} placeholder="Briefing for agents…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <CCButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</CCButton>
              <CCButton type="submit">Create draft</CCButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}