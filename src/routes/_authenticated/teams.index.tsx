import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard } from "@/components/cc";
import { Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [lead, setLead] = useState("");
  const [type, setType] = useState("inbound");
  const [sla, setSla] = useState("95");
  const [notes, setNotes] = useState("");

  function reset() {
    setName(""); setLead(""); setType("inbound"); setSla("95"); setNotes("");
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !lead.trim()) {
      toast.error("Team name and lead are required");
      return;
    }
    toast.success(`Team "${name}" created`);
    reset();
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Teams"
        description="Squads of agents grouped by a Team Leader. Used for routing, monitoring, and reporting."
        actions={
          <CCButton size="sm" onClick={() => setOpen(true)}>
            <UsersIcon className="size-4 mr-1.5" />New team
          </CCButton>
        }
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new team</DialogTitle>
            <DialogDescription>
              Group agents under a Team Leader for routing, monitoring, and reporting.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Team name</Label>
              <Input id="t-name" placeholder="e.g. Retention — EMEA" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-lead">Team leader</Label>
              <Input id="t-lead" placeholder="Search staff…" value={lead} onChange={(e) => setLead(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="blended">Blended</SelectItem>
                    <SelectItem value="qa">Quality Assurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-sla">SLA target (%)</Label>
                <Input id="t-sla" type="number" min={0} max={100} value={sla} onChange={(e) => setSla(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-notes">Notes</Label>
              <Textarea id="t-notes" rows={3} placeholder="Optional charter or notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <CCButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</CCButton>
              <CCButton type="submit">Create team</CCButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}