import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard } from "@/components/cc";
import { Users as UsersIcon, Search, UserCheck, ClipboardList, Megaphone } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listStaff } from "@/lib/staff.functions";
import { listCampaigns } from "@/lib/calls.functions";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [campaignId, setCampaignId] = useState<string>("none");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const staffQ = useQuery({ queryKey: ["staff"], queryFn: () => listStaff(), enabled: open });
  const campaignsQ = useQuery({ queryKey: ["campaigns"], queryFn: () => listCampaigns(), enabled: open });

  const staff = staffQ.data?.rows ?? [];
  const filteredStaff = staff.filter((s) =>
    !memberQuery.trim() ||
    (s.full_name ?? "").toLowerCase().includes(memberQuery.toLowerCase()) ||
    (s.staff_id ?? "").toLowerCase().includes(memberQuery.toLowerCase()),
  );

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function reset() {
    setName(""); setLead(""); setType("inbound"); setSla("95"); setNotes("");
    setMemberIds([]); setMemberQuery(""); setCampaignId("none"); setTaskTitle(""); setTaskDue("");
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !lead.trim()) {
      toast.error("Team name and lead are required");
      return;
    }
    const parts: string[] = [`Team "${name}" created`];
    if (memberIds.length) parts.push(`${memberIds.length} member${memberIds.length === 1 ? "" : "s"} added`);
    if (campaignId !== "none") {
      const c = campaignsQ.data?.find((x: any) => x.id === campaignId);
      if (c) parts.push(`assigned to campaign "${c.name}"`);
    }
    if (taskTitle.trim()) parts.push(`task "${taskTitle.trim()}" assigned`);
    toast.success(parts.join(" · "));
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
          <Link
            key={t.id}
            to="/teams/$id"
            params={{ id: t.id }}
            className="block rounded-[var(--cc-radius-lg)] transition hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cc-brand-600)]"
          >
          <CCCard className="p-5 cursor-pointer">
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
          </Link>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

            {/* Team members */}
            <div className="space-y-2 rounded-md border border-[color:var(--cc-ink-200)] p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm">
                  <UserCheck className="size-4" /> Team members
                </Label>
                <span className="text-xs text-muted-foreground">
                  {memberIds.length} selected
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search staff to add…"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                />
              </div>
              <div className="max-h-[160px] overflow-y-auto rounded border border-[color:var(--cc-ink-100)]">
                {staffQ.isLoading ? (
                  <div className="p-3 text-xs text-muted-foreground">Loading staff…</div>
                ) : filteredStaff.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">No matching staff.</div>
                ) : (
                  filteredStaff.map((s) => {
                    const checked = memberIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[color:var(--cc-ink-50)] border-b border-[color:var(--cc-ink-100)] last:border-b-0"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleMember(s.id)} />
                        <span className="flex-1 truncate">{s.full_name ?? "Unnamed"}</span>
                        {s.staff_id ? (
                          <span className="text-[11px] text-muted-foreground">{s.staff_id}</span>
                        ) : null}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Optional campaign */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Megaphone className="size-4" /> Assign campaign <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger><SelectValue placeholder="No campaign" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {(campaignsQ.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional task */}
            <div className="space-y-1.5 rounded-md border border-[color:var(--cc-ink-200)] p-3">
              <Label className="flex items-center gap-1.5">
                <ClipboardList className="size-4" /> Assign a task <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="Task title, e.g. Kickoff briefing"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
              <Input
                type="datetime-local"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                disabled={!taskTitle.trim()}
              />
              <p className="text-[11px] text-muted-foreground">
                Task will be assigned to all selected team members.
              </p>
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