import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCInput, CCSelect, CCField,
  CCTable, CCThead, CCTh, CCTd, CCTr,
  CCFormSection, CCFormGrid, CCTextarea,
} from "@/components/cc";
import { Phone, Mail, CalendarCheck2, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { DUMMY_FOLLOWUPS } from "@/lib/dummy-data";
import { createTask } from "@/lib/workflow.functions";
import { listStaff } from "@/lib/staff.functions";
import { listClients } from "@/lib/clients.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/follow-ups/")({
  head: () => ({ meta: [{ title: "Follow-Ups" }] }),
  component: FollowUpsPage,
});

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  urgent: "danger", high: "warning", normal: "info", low: "neutral",
};
const STATUS_TONE: Record<string, "success" | "warning" | "info" | "neutral"> = {
  open: "warning", in_progress: "info", completed: "success",
};

function dueLabel(iso: string) {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (diffMin < -60 * 24) return { text: `${Math.round(-diffMin / 60 / 24)}d overdue`, tone: "danger" as const };
  if (diffMin < 0)        return { text: `${-diffMin} min overdue`,                       tone: "danger" as const };
  if (diffMin < 60)       return { text: `Due in ${diffMin} min`,                          tone: "warning" as const };
  if (diffMin < 60 * 24)  return { text: `Due in ${Math.round(diffMin / 60)} h`,           tone: "info" as const };
  return                          { text: `Due in ${Math.round(diffMin / 60 / 24)} d`,      tone: "neutral" as const };
}

function FollowUpsPage() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const rows = useMemo(() => {
    return DUMMY_FOLLOWUPS.filter((f) => {
      if (priority && f.priority !== priority) return false;
      if (status && f.status !== status) return false;
      if (channel && f.channel !== channel) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${f.title} ${f.client.name} ${f.client.phone} ${f.reason}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  }, [search, priority, status, channel]);

  const overdue = rows.filter((r) => new Date(r.due_at).getTime() < Date.now() && r.status !== "completed").length;
  const dueSoon = rows.filter((r) => {
    const d = new Date(r.due_at).getTime() - Date.now();
    return d >= 0 && d < 60 * 60 * 1000;
  }).length;
  const open = rows.filter((r) => r.status !== "completed").length;

  return (
    <>
      <PageHeader
        title="Follow-Ups"
        description="Callbacks and outreach owed back to clients — every entry is a task tagged follow-up."
        actions={
          <div className="flex items-center gap-2">
            <CCButton size="sm" onClick={() => setOpenNew(true)}>
              <Plus className="size-4 mr-1" />
              Log / schedule follow-up
            </CCButton>
            <Link to="/tasks"><CCButton size="sm" variant="ghost">Open in Tasks</CCButton></Link>
          </div>
        }
      />

      <div className="px-6 -mb-2 text-xs text-muted-foreground">
        Showing sample follow-ups for preview. Real follow-ups appear here as call dispositions create them.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-4">
        <Stat icon={<AlertTriangle className="size-5" />} label="Overdue"  value={overdue} tone="danger" />
        <Stat icon={<Clock className="size-5" />}         label="Due in &lt;1h" value={dueSoon} tone="warning" />
        <Stat icon={<CalendarCheck2 className="size-5" />} label="Open"    value={open} tone="info" />
      </div>

      <div className="px-6 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr] items-end">
        <CCField label="Search">
          <CCInput placeholder="Client, phone, title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </CCField>
        <CCField label="Priority">
          <CCSelect value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </CCSelect>
        </CCField>
        <CCField label="Status">
          <CCSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </CCSelect>
        </CCField>
        <CCField label="Channel">
          <CCSelect value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">All</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </CCSelect>
        </CCField>
      </div>

      <div className="px-6 py-4">
        <CCTable>
          <CCThead>
            <tr>
              <CCTh>Due</CCTh>
              <CCTh>Follow-up</CCTh>
              <CCTh>Client</CCTh>
              <CCTh>Owner</CCTh>
              <CCTh>Channel</CCTh>
              <CCTh>Priority</CCTh>
              <CCTh>Status</CCTh>
              <CCTh className="text-right">Action</CCTh>
            </tr>
          </CCThead>
          <tbody>
            {rows.length === 0 && (
              <tr><CCTd className="text-[color:var(--cc-ink-500)]">No follow-ups match.</CCTd></tr>
            )}
            {rows.map((f) => {
              const due = dueLabel(f.due_at);
              return (
                <CCTr key={f.id}>
                  <CCTd>
                    <CCStatusPill tone={due.tone === "danger" ? "danger" : due.tone === "warning" ? "warning" : due.tone === "info" ? "info" : "neutral"} dot>
                      {due.text}
                    </CCStatusPill>
                    <div className="text-[11px] text-[color:var(--cc-ink-500)] mt-0.5">
                      {new Date(f.due_at).toLocaleString()}
                    </div>
                  </CCTd>
                  <CCTd>
                    <div className="font-medium">{f.title}</div>
                    <div className="text-xs text-[color:var(--cc-ink-500)] line-clamp-1">{f.reason}</div>
                  </CCTd>
                  <CCTd>
                    <div>{f.client.name}</div>
                    <a href={`tel:${f.client.phone}`} className="text-xs text-[color:var(--cc-info)] hover:underline inline-flex items-center gap-1">
                      <Phone className="size-3" />{f.client.phone}
                    </a>
                  </CCTd>
                  <CCTd className="text-sm">{f.owner.full_name}</CCTd>
                  <CCTd>
                    <span className="inline-flex items-center gap-1 text-xs text-[color:var(--cc-ink-600)]">
                      {f.channel === "phone" ? <Phone className="size-3" /> : <Mail className="size-3" />}
                      <span className="capitalize">{f.channel}</span>
                    </span>
                  </CCTd>
                  <CCTd>
                    <CCStatusPill tone={PRIORITY_TONE[f.priority] ?? "neutral"} dot>
                      {f.priority}
                    </CCStatusPill>
                  </CCTd>
                  <CCTd>
                    <CCStatusPill tone={STATUS_TONE[f.status] ?? "neutral"}>
                      {f.status === "completed" && <CheckCircle2 className="size-3 mr-1 inline" />}
                      {f.status.replace("_", " ")}
                    </CCStatusPill>
                  </CCTd>
                  <CCTd className="text-right">
                    <a href={`tel:${f.client.phone}`}>
                      <CCButton size="sm" variant="ghost"><Phone className="size-4 mr-1" />Call</CCButton>
                    </a>
                  </CCTd>
                </CCTr>
              );
            })}
          </tbody>
        </CCTable>
      </div>
    </>
  );
}

function Stat({ icon, label, value, tone }: {
  icon: React.ReactNode; label: React.ReactNode; value: number;
  tone: "danger" | "warning" | "info";
}) {
  const cls =
    tone === "danger"  ? "bg-rose-50 text-rose-900 border-rose-200" :
    tone === "warning" ? "bg-amber-50 text-amber-900 border-amber-200" :
                         "bg-sky-50 text-sky-900 border-sky-200";
  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      <div className="flex items-center justify-between mb-2 opacity-80">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="font-mono text-4xl font-bold tabular-nums leading-none">{value}</div>
    </div>
  );
}