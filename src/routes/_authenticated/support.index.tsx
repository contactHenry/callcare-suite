import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCFormSection, CCFormGrid, CCField, CCInput,
  CCTextarea, CCSelect, CCTable, CCThead, CCTh, CCTd, CCTr, CCEmpty,
} from "@/components/cc";
import { toast } from "sonner";
import {
  Paperclip, LifeBuoy, X, Send,
  Inbox, UserPlus, Wrench, CheckCircle2, Archive,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/support/")({
  component: SupportPage,
});

type Priority = "low" | "normal" | "high" | "urgent";
type Status = "open" | "in_progress" | "waiting" | "resolved" | "closed";
type Category = "bug" | "feature_request" | "billing" | "account" | "integration" | "other";

const PRIORITY_TONE: Record<Priority, "info" | "neutral" | "warning" | "danger"> = {
  low: "neutral", normal: "info", high: "warning", urgent: "danger",
};
const STATUS_TONE: Record<Status, "info" | "warning" | "success" | "neutral"> = {
  open: "info", in_progress: "warning", waiting: "warning", resolved: "success", closed: "neutral",
};
const CATEGORY_LABEL: Record<Category, string> = {
  bug: "Bug", feature_request: "Feature request", billing: "Billing",
  account: "Account", integration: "Integration", other: "Other",
};

// ---- Sample data (shown when the org has no real tickets yet) ------------
function hoursAgo(h: number) { return new Date(Date.now() - h * 3600_000).toISOString(); }

type DummyEvent = { kind: "submitted" | "assigned" | "in_progress" | "waiting" | "resolved" | "closed"; at: string; by?: string; note?: string };
type DummyComment = { id: string; author: string; is_staff_reply: boolean; body: string; created_at: string };
type DummyTicket = {
  id: string; subject: string; description: string; category: Category;
  priority: Priority; status: Status; created_at: string; resolved_at?: string;
  reporter: string; assignee: string | null; events: DummyEvent[]; comments: DummyComment[];
};

const DUMMY_TICKETS: DummyTicket[] = [
  {
    id: "d-t1", subject: "Live Calls board freezes when 20+ agents are on a call",
    description: "Around 09:30 our Live Calls wallboard stops updating whenever we go past ~20 concurrent calls. A hard refresh brings it back for a few minutes. Attached a screenshot of the frozen state.",
    category: "bug", priority: "high", status: "in_progress",
    created_at: hoursAgo(52), reporter: "Priya Shah (Ops Admin)",
    assignee: "Marcus Reid — Platform Support",
    events: [
      { kind: "submitted", at: hoursAgo(52), by: "Priya Shah" },
      { kind: "assigned", at: hoursAgo(48), by: "Support triage", note: "Assigned to Marcus Reid" },
      { kind: "in_progress", at: hoursAgo(30), by: "Marcus Reid", note: "Reproduced on staging with 25 concurrent calls" },
    ],
    comments: [
      { id: "c1", author: "Marcus Reid", is_staff_reply: true, created_at: hoursAgo(30), body: "Thanks for the report — I can reproduce this on staging. Looks like the realtime channel is backpressuring past 20 subscribers. Working on a fix." },
      { id: "c2", author: "Priya Shah", is_staff_reply: false, created_at: hoursAgo(28), body: "Appreciated. Any workaround in the meantime? We're at peak between 09:00–11:00." },
      { id: "c3", author: "Marcus Reid", is_staff_reply: true, created_at: hoursAgo(6), body: "Roll-out is scheduled for tonight 22:00 UTC. I'll post here once it's live." },
    ],
  },
  {
    id: "d-t2", subject: "Add bulk-reassign action on the Follow-Ups page",
    description: "When a team leader is off, we need to reassign 40–60 follow-ups at once. Doing it one-by-one is slow. Please add a multi-select with a bulk reassign action.",
    category: "feature_request", priority: "normal", status: "waiting",
    created_at: hoursAgo(120), reporter: "James O'Connor (Supervisor)",
    assignee: "Ada Chen — Product",
    events: [
      { kind: "submitted", at: hoursAgo(120), by: "James O'Connor" },
      { kind: "assigned", at: hoursAgo(96), by: "Support triage", note: "Assigned to Ada Chen (Product)" },
      { kind: "waiting", at: hoursAgo(40), by: "Ada Chen", note: "Waiting on customer for use-case volumes" },
    ],
    comments: [
      { id: "c1", author: "Ada Chen", is_staff_reply: true, created_at: hoursAgo(40), body: "This is on the roadmap for the next minor release. Could you share how many reassignments you'd typically batch at once, and whether you need cross-team reassign or just intra-team?" },
    ],
  },
  {
    id: "d-t3", subject: "Twilio webhook returning 401 after key rotation",
    description: "We rotated our Twilio auth token on Tuesday and now inbound-call webhooks fail with 401. We can see the calls in Twilio's logs but nothing lands in the Calls page.",
    category: "integration", priority: "urgent", status: "resolved",
    created_at: hoursAgo(72), resolved_at: hoursAgo(60),
    reporter: "Sofia Ramirez (Ops Admin)",
    assignee: "Marcus Reid — Platform Support",
    events: [
      { kind: "submitted", at: hoursAgo(72), by: "Sofia Ramirez" },
      { kind: "assigned", at: hoursAgo(71), by: "Support triage", note: "Escalated — Urgent" },
      { kind: "in_progress", at: hoursAgo(70), by: "Marcus Reid" },
      { kind: "resolved", at: hoursAgo(60), by: "Marcus Reid", note: "Stored signing secret updated; test call succeeded" },
    ],
    comments: [
      { id: "c1", author: "Marcus Reid", is_staff_reply: true, created_at: hoursAgo(70), body: "The stored signing secret didn't refresh after the rotation. I've updated it and re-verified. Please try a test inbound call and confirm." },
      { id: "c2", author: "Sofia Ramirez", is_staff_reply: false, created_at: hoursAgo(62), body: "Confirmed — calls are landing in the Calls page again. Thanks for the fast turnaround." },
      { id: "c3", author: "Marcus Reid", is_staff_reply: true, created_at: hoursAgo(60), body: "Great — marking this resolved. Reopen any time if it recurs." },
    ],
  },
  {
    id: "d-t4", subject: "Invoice for October shows the wrong seat count",
    description: "October invoice bills us for 42 seats but our active staff list shows 38. Can you check?",
    category: "billing", priority: "normal", status: "open",
    created_at: hoursAgo(6), reporter: "Fatima Al-Hassan (Ops Admin)",
    assignee: null,
    events: [
      { kind: "submitted", at: hoursAgo(6), by: "Fatima Al-Hassan" },
    ],
    comments: [],
  },
  {
    id: "d-t5", subject: "Password reset email never arrives for @cedarrealty.ae",
    description: "Two of our agents on @cedarrealty.ae addresses aren't receiving the reset email. Other domains are fine.",
    category: "account", priority: "high", status: "in_progress",
    created_at: hoursAgo(18), reporter: "Fatima Al-Hassan (Ops Admin)",
    assignee: "Leah Park — Platform Support",
    events: [
      { kind: "submitted", at: hoursAgo(18), by: "Fatima Al-Hassan" },
      { kind: "assigned", at: hoursAgo(16), by: "Support triage", note: "Assigned to Leah Park" },
      { kind: "in_progress", at: hoursAgo(12), by: "Leah Park", note: "Investigating deliverability logs" },
    ],
    comments: [
      { id: "c1", author: "Leah Park", is_staff_reply: true, created_at: hoursAgo(12), body: "I can see the sends going out. Looks like your DMARC policy is bouncing them. Could you check with your IT team whether @cedarrealty.ae has an aggressive quarantine rule?" },
    ],
  },
  {
    id: "d-t6", subject: "QA scorecard weights not applying on new reviews",
    description: "We updated criteria weights last week but new QA reviews still use the old weighting. Older reviews are correct.",
    category: "bug", priority: "normal", status: "closed",
    created_at: hoursAgo(240), resolved_at: hoursAgo(200),
    reporter: "Ethan Walker (Team Leader)",
    assignee: "Marcus Reid — Platform Support",
    events: [
      { kind: "submitted", at: hoursAgo(240), by: "Ethan Walker" },
      { kind: "assigned", at: hoursAgo(238), by: "Support triage" },
      { kind: "in_progress", at: hoursAgo(230), by: "Marcus Reid" },
      { kind: "resolved", at: hoursAgo(200), by: "Marcus Reid", note: "Cache invalidated on weight change" },
      { kind: "closed", at: hoursAgo(150), by: "Ethan Walker", note: "Verified fixed" },
    ],
    comments: [
      { id: "c1", author: "Marcus Reid", is_staff_reply: true, created_at: hoursAgo(200), body: "Deployed a fix — the weight cache wasn't invalidating on save. New reviews should now pick up the latest weights immediately." },
      { id: "c2", author: "Ethan Walker", is_staff_reply: false, created_at: hoursAgo(150), body: "Verified against three new reviews — looks good. Closing this out." },
    ],
  },
];

const DUMMY_BY_ID: Record<string, DummyTicket> = Object.fromEntries(DUMMY_TICKETS.map((t) => [t.id, t]));

const EVENT_META: Record<DummyEvent["kind"], { label: string; icon: typeof Inbox; tone: string }> = {
  submitted:  { label: "Ticket submitted",     icon: Inbox,         tone: "text-[color:var(--cc-brand-600)]" },
  assigned:   { label: "Assigned to support",  icon: UserPlus,      tone: "text-[color:var(--cc-info)]" },
  in_progress:{ label: "Work in progress",     icon: Wrench,        tone: "text-amber-600" },
  waiting:    { label: "Waiting on you",       icon: Wrench,        tone: "text-amber-600" },
  resolved:   { label: "Resolved",             icon: CheckCircle2,  tone: "text-[color:var(--cc-success)]" },
  closed:     { label: "Closed",               icon: Archive,       tone: "text-[color:var(--cc-ink-500)]" },
};

function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["support-tickets", user?.id],
    queryFn: async () => {
      const q = supabase
        .from("support_tickets" as any)
        .select("*, reporter:profiles!support_tickets_created_by_fkey(full_name)")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  // If the org hasn't filed any real tickets yet, fall back to sample tickets
  // tailored to a call-centre organisation so the UI has a realistic story.
  const realRows = list.data ?? [];
  const isSample = !list.isLoading && realRows.length === 0;
  const rows = isSample
    ? DUMMY_TICKETS.map((t) => ({
        id: t.id, subject: t.subject, category: t.category, priority: t.priority,
        status: t.status, created_at: t.created_at, assignee: t.assignee,
        _sample: true,
      }))
    : realRows.map((t: any) => ({
        id: t.id, subject: t.subject, category: t.category, priority: t.priority,
        status: t.status, created_at: t.created_at,
        assignee: t.assignee_name ?? null,
        _sample: false,
      }));

  const filtered = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);
  const counts = {
    all: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    in_progress: rows.filter((r) => r.status === "in_progress").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
  };

  return (
    <>
      <PageHeader
        title="Support & tickets"
        description="Raise an issue or request with the platform team. Track every ticket's progress from submitted through resolved."
        actions={<CCButton onClick={() => setOpen(true)}><LifeBuoy className="size-4" />New ticket</CCButton>}
      />
      <div className="p-6 space-y-4">
        {isSample && (
          <div className="rounded-[var(--cc-radius-md)] border border-dashed border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-50)] px-4 py-3 text-xs text-[color:var(--cc-ink-700)]">
            Showing sample tickets for preview. Submit a real ticket to replace this list with your organisation's actual support history.
          </div>
        )}

        {/* Status summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTile label="All tickets"  value={counts.all}         tone="neutral" active={statusFilter === "all"}         onClick={() => setStatusFilter("all")} />
          <SummaryTile label="Open"         value={counts.open}        tone="info"    active={statusFilter === "open"}        onClick={() => setStatusFilter("open")} />
          <SummaryTile label="In progress"  value={counts.in_progress} tone="warning" active={statusFilter === "in_progress"} onClick={() => setStatusFilter("in_progress")} />
          <SummaryTile label="Resolved"     value={counts.resolved}    tone="success" active={statusFilter === "resolved"}    onClick={() => setStatusFilter("resolved")} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <CCSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="max-w-[200px]">
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="waiting">Waiting on you</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </CCSelect>
          <div className="text-xs text-[color:var(--cc-ink-500)]">
            {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="overflow-x-auto">
          {list.isLoading ? (
            <div className="p-8 text-center text-sm text-[color:var(--cc-ink-500)]">Loading…</div>
          ) : filtered.length === 0 ? (
            <CCEmpty
              title="No tickets match this filter"
              body="Try another status or open a new ticket."
              action={<CCButton onClick={() => setOpen(true)}>Open a ticket</CCButton>}
            />
          ) : (
            <CCTable>
              <CCThead>
                <tr>
                  <CCTh>Subject</CCTh>
                  <CCTh>Category</CCTh>
                  <CCTh>Priority</CCTh>
                  <CCTh>Status</CCTh>
                  <CCTh>Assigned to</CCTh>
                  <CCTh>Submitted</CCTh>
                </tr>
              </CCThead>
              <tbody>
                {filtered.map((t) => (
                  <CCTr key={t.id} onClick={() => setDetailId(t.id)}>
                    <CCTd className="font-medium">{t.subject}</CCTd>
                    <CCTd>{CATEGORY_LABEL[t.category as Category]}</CCTd>
                    <CCTd><CCStatusPill tone={PRIORITY_TONE[t.priority as Priority]}>{t.priority}</CCStatusPill></CCTd>
                    <CCTd><CCStatusPill tone={STATUS_TONE[t.status as Status]}>{t.status.replace("_", " ")}</CCStatusPill></CCTd>
                    <CCTd className="text-xs text-[color:var(--cc-ink-700)]">
                      {t.assignee ?? <span className="text-[color:var(--cc-ink-500)] italic">Awaiting triage</span>}
                    </CCTd>
                    <CCTd className="text-xs text-[color:var(--cc-ink-500)] tabular-nums">{new Date(t.created_at).toLocaleString()}</CCTd>
                  </CCTr>
                ))}
              </tbody>
            </CCTable>
          )}
        </div>
      </div>

      {open && (
        <NewTicketDialog
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["support-tickets"] });
          }}
        />
      )}
      {detailId && (
        <TicketDetailDrawer
          ticketId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["support-tickets"] })}
        />
      )}
    </>
  );
}

function SummaryTile({ label, value, tone, active, onClick }: {
  label: string; value: number;
  tone: "neutral" | "info" | "warning" | "success";
  active: boolean; onClick: () => void;
}) {
  const toneClass =
    tone === "info" ? "text-[color:var(--cc-info)]" :
    tone === "warning" ? "text-amber-600" :
    tone === "success" ? "text-[color:var(--cc-success)]" : "text-[color:var(--cc-ink-900)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] p-4 text-left transition-colors ${
        active
          ? "ring-2 ring-[color:var(--cc-brand-600)] ring-offset-1 ring-offset-background"
          : "hover:bg-[color:var(--cc-ink-50)]"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </button>
  );
}

function NewTicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("bug");
  const [priority, setPriority] = useState<Priority>("normal");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (subject.trim().length < 3) throw new Error("Subject is too short");
      if (description.trim().length < 10) throw new Error("Please describe the issue in more detail");

      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();

      const { data: inserted, error } = await supabase
        .from("support_tickets" as any)
        .insert({
          created_by: user.id,
          organization_id: (profile as any)?.organization_id ?? null,
          subject: subject.trim(),
          description: description.trim(),
          category, priority,
        })
        .select("id")
        .single();
      if (error) throw error;
      const ticketId = (inserted as any).id as string;

      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Screenshot must be under 10 MB");
        const ext = file.name.split(".").pop() ?? "png";
        const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("support-attachments").upload(path, file, {
          contentType: file.type || "image/png",
          upsert: false,
        });
        if (upErr) throw upErr;
        await supabase.from("support_tickets" as any).update({ screenshot_path: path }).eq("id", ticketId);
      }
    },
    onSuccess: () => { toast.success("Ticket submitted"); onCreated(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit ticket"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-background rounded-[var(--cc-radius-lg)] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <LifeBuoy className="size-4 text-[color:var(--cc-brand-600)]" />
            <h2 className="text-sm font-semibold">New support ticket</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <CCFormSection>
            <CCFormGrid cols={2}>
              <CCField label="Category">
                <CCSelect value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </CCSelect>
              </CCField>
              <CCField label="Priority" hint="How urgent is this?">
                <CCSelect value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="low">Low — no rush</option>
                  <option value="normal">Normal</option>
                  <option value="high">High — blocking work</option>
                  <option value="urgent">Urgent — service down</option>
                </CCSelect>
              </CCField>
            </CCFormGrid>
            <CCField label="Subject">
              <CCInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the issue" maxLength={140} />
            </CCField>
            <CCField label="Description" hint="Steps to reproduce, what you expected, what happened.">
              <CCTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={4000} className="min-h-[140px]" />
            </CCField>
            <CCField label="Screenshot" hint="Optional. PNG or JPG, up to 10 MB.">
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <CCButton type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Paperclip className="size-4" />{file ? "Change file" : "Attach screenshot"}
                </CCButton>
                {file && (
                  <div className="flex items-center gap-2 text-xs text-[color:var(--cc-ink-700)]">
                    <span className="truncate max-w-[240px]">{file.name}</span>
                    <button onClick={() => setFile(null)} className="text-[color:var(--cc-ink-500)] hover:text-[color:var(--cc-danger)]"><X className="size-3.5" /></button>
                  </div>
                )}
              </div>
            </CCField>
          </CCFormSection>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-[color:var(--cc-ink-50)] rounded-b-[var(--cc-radius-lg)]">
          <CCButton variant="ghost" onClick={onClose} disabled={submit.isPending}>Cancel</CCButton>
          <CCButton onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit ticket"}
          </CCButton>
        </div>
      </div>
    </div>
  );
}

function TicketDetailDrawer({ ticketId, onClose, onUpdated }: {
  ticketId: string; onClose: () => void; onUpdated: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [localComments, setLocalComments] = useState<DummyComment[]>([]);
  const dummy = DUMMY_BY_ID[ticketId];
  const isDummy = !!dummy;

  const ticket = useQuery({
    queryKey: ["support-ticket", ticketId],
    enabled: !isDummy,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*, reporter:profiles!support_tickets_created_by_fkey(full_name)")
        .eq("id", ticketId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const comments = useQuery({
    queryKey: ["support-ticket-comments", ticketId],
    enabled: !isDummy,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_comments" as any)
        .select("*, author:profiles!support_ticket_comments_author_id_fkey(full_name)")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const screenshotUrl = useQuery({
    queryKey: ["support-ticket-screenshot", ticket.data?.screenshot_path],
    enabled: !isDummy && !!ticket.data?.screenshot_path,
    queryFn: async () => {
      const { data } = await supabase.storage.from("support-attachments")
        .createSignedUrl(ticket.data.screenshot_path, 60 * 30);
      return data?.signedUrl ?? null;
    },
  });

  void onUpdated;

  const addComment = useMutation({
    mutationFn: async () => {
      if (!reply.trim()) return;
      if (isDummy) {
        setLocalComments((prev) => [
          ...prev,
          { id: `local-${Date.now()}`, author: "You", is_staff_reply: false, body: reply.trim(), created_at: new Date().toISOString() },
        ]);
        return;
      }
      const { error } = await supabase.from("support_ticket_comments" as any).insert({
        ticket_id: ticketId,
        author_id: user!.id,
        body: reply.trim(),
        is_staff_reply: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      if (!isDummy) qc.invalidateQueries({ queryKey: ["support-ticket-comments", ticketId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });

  // Normalise into one shape the render code can use for both dummy + real.
  const t: {
    subject: string; description: string; category: Category; priority: Priority;
    status: Status; created_at: string; reporter: string; assignee: string | null;
    events: DummyEvent[]; screenshot?: string | null;
  } | null = isDummy
    ? {
        subject: dummy.subject, description: dummy.description, category: dummy.category,
        priority: dummy.priority, status: dummy.status, created_at: dummy.created_at,
        reporter: dummy.reporter, assignee: dummy.assignee, events: dummy.events, screenshot: null,
      }
    : ticket.data
      ? {
          subject: ticket.data.subject, description: ticket.data.description,
          category: ticket.data.category, priority: ticket.data.priority,
          status: ticket.data.status, created_at: ticket.data.created_at,
          reporter: ticket.data.reporter?.full_name ?? "You",
          assignee: ticket.data.assignee_name ?? null,
          events: buildEventsFromRealTicket(ticket.data),
          screenshot: screenshotUrl.data ?? null,
        }
      : null;

  const shownComments: DummyComment[] = isDummy
    ? [...dummy.comments, ...localComments]
    : (comments.data ?? []).map((c: any) => ({
        id: c.id,
        author: c.author?.full_name ?? "User",
        is_staff_reply: !!c.is_staff_reply,
        body: c.body,
        created_at: c.created_at,
      }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-background flex flex-col shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--cc-ink-500)]">Ticket</div>
            <h2 className="text-sm font-semibold truncate">{t?.subject ?? "…"}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {t && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CCStatusPill tone={STATUS_TONE[t.status as Status]}>{t.status.replace("_", " ")}</CCStatusPill>
                <CCStatusPill tone={PRIORITY_TONE[t.priority as Priority]}>{t.priority} priority</CCStatusPill>
                <span className="text-xs text-[color:var(--cc-ink-500)]">{CATEGORY_LABEL[t.category as Category]}</span>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-[var(--cc-radius-md)] bg-[color:var(--cc-ink-50)] p-3 text-xs">
                <div>
                  <dt className="text-[color:var(--cc-ink-500)] uppercase tracking-wide">Reported by</dt>
                  <dd className="mt-0.5 font-medium text-[color:var(--cc-ink-900)]">{t.reporter}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--cc-ink-500)] uppercase tracking-wide">Assigned to</dt>
                  <dd className="mt-0.5 font-medium text-[color:var(--cc-ink-900)]">
                    {t.assignee ?? <span className="italic text-[color:var(--cc-ink-500)]">Awaiting triage</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[color:var(--cc-ink-500)] uppercase tracking-wide">Submitted</dt>
                  <dd className="mt-0.5 tabular-nums text-[color:var(--cc-ink-900)]">{new Date(t.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--cc-ink-500)] uppercase tracking-wide">Last update</dt>
                  <dd className="mt-0.5 tabular-nums text-[color:var(--cc-ink-900)]">
                    {t.events.length > 0 ? new Date(t.events[t.events.length - 1].at).toLocaleString() : "—"}
                  </dd>
                </div>
              </dl>

              <div className="text-sm whitespace-pre-wrap text-[color:var(--cc-ink-900)]">{t.description}</div>
              {t.screenshot && (
                <a href={t.screenshot} target="_blank" rel="noreferrer" className="block">
                  <img src={t.screenshot} alt="Screenshot" className="max-h-64 rounded border" />
                </a>
              )}

              <TicketProgression events={t.events} status={t.status} />

              <div className="border-t pt-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">Conversation with support</div>
                {shownComments.length === 0 ? (
                  <div className="text-xs text-[color:var(--cc-ink-500)]">No replies yet. Support will respond here.</div>
                ) : (
                  <ul className="space-y-3">
                    {shownComments.map((c) => (
                      <li key={c.id} className={`rounded-lg p-3 border ${c.is_staff_reply ? "bg-[color:var(--cc-brand-600)]/5 border-[color:var(--cc-brand-600)]/20" : "bg-[color:var(--cc-ink-50)] border-[color:var(--cc-ink-100)]"}`}>
                        <div className="flex items-center justify-between text-[11px] text-[color:var(--cc-ink-500)]">
                          <span className="font-medium text-[color:var(--cc-ink-900)]">
                            {c.author}{c.is_staff_reply && " · Platform Support"}
                          </span>
                          <span className="tabular-nums">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-sm whitespace-pre-wrap">{c.body}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t p-4 bg-[color:var(--cc-ink-50)] flex items-end gap-2">
          <CCTextarea
            placeholder="Write a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="min-h-[64px] bg-background"
          />
          <CCButton onClick={() => addComment.mutate()} disabled={!reply.trim() || addComment.isPending}>
            <Send className="size-4" />Send
          </CCButton>
        </div>
      </div>
    </div>
  );
}

// Derive a progression event list from a real DB ticket.
function buildEventsFromRealTicket(row: any): DummyEvent[] {
  const evs: DummyEvent[] = [
    { kind: "submitted", at: row.created_at, by: row.reporter?.full_name ?? "You" },
  ];
  if (row.status === "in_progress" || row.status === "waiting" || row.status === "resolved" || row.status === "closed") {
    evs.push({ kind: "assigned", at: row.created_at, by: "Support triage" });
    evs.push({ kind: row.status === "waiting" ? "waiting" : "in_progress", at: row.updated_at ?? row.created_at });
  }
  if (row.resolved_at) evs.push({ kind: "resolved", at: row.resolved_at });
  if (row.status === "closed") evs.push({ kind: "closed", at: row.updated_at ?? row.resolved_at ?? row.created_at });
  return evs;
}

function TicketProgression({ events, status }: { events: DummyEvent[]; status: Status }) {
  // The four canonical steps the org cares about.
  const steps: Array<{ key: DummyEvent["kind"]; label: string }> = [
    { key: "submitted",   label: "Submitted" },
    { key: "assigned",    label: "Assigned to support" },
    { key: "in_progress", label: status === "waiting" ? "Waiting on you" : "In progress" },
    { key: "resolved",    label: status === "closed" ? "Closed" : "Resolved" },
  ];
  const reached = new Set<DummyEvent["kind"]>(
    events.map((e) =>
      e.kind === "waiting" ? "in_progress"
      : e.kind === "closed" ? "resolved"
      : e.kind
    )
  );
  const lastEventAt = (kind: DummyEvent["kind"]): string | undefined =>
    events.find((e) => e.kind === kind)?.at;

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">Progression</div>

      <ol className="relative pl-6">
        {/* vertical rail */}
        <span className="absolute left-[10px] top-1 bottom-1 w-px bg-[color:var(--cc-ink-200)]" aria-hidden />
        {steps.map((step, i) => {
          const isDone = reached.has(step.key);
          const isCurrent = !isDone && i > 0 && reached.has(steps[i - 1].key);
          const evAt = lastEventAt(step.key) ?? (step.key === "in_progress" ? lastEventAt("waiting") : undefined);
          const meta = EVENT_META[step.key];
          const Icon = meta.icon;
          return (
            <li key={step.key} className="relative pb-3 last:pb-0">
              <span
                className={`absolute -left-6 top-0 inline-flex size-5 items-center justify-center rounded-full border ${
                  isDone
                    ? "bg-[color:var(--cc-brand-600)] border-[color:var(--cc-brand-600)] text-white"
                    : isCurrent
                      ? "bg-background border-[color:var(--cc-brand-600)] text-[color:var(--cc-brand-600)] ring-2 ring-[color:var(--cc-brand-600)]/20"
                      : "bg-background border-[color:var(--cc-ink-200)] text-[color:var(--cc-ink-500)]"
                }`}
              >
                <Icon className="size-3" />
              </span>
              <div className={`text-sm ${isDone || isCurrent ? "font-medium text-[color:var(--cc-ink-900)]" : "text-[color:var(--cc-ink-500)]"}`}>
                {step.label}
              </div>
              <div className="text-[11px] text-[color:var(--cc-ink-500)] tabular-nums">
                {evAt ? new Date(evAt).toLocaleString() : isCurrent ? "In progress…" : "Pending"}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Full event log */}
      {events.length > 0 && (
        <details className="rounded-[var(--cc-radius-md)] border border-[color:var(--cc-ink-200)] bg-background">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[color:var(--cc-ink-700)] hover:bg-[color:var(--cc-ink-50)]">
            View full activity log ({events.length})
          </summary>
          <ul className="divide-y divide-[color:var(--cc-ink-100)]">
            {events.map((e, i) => {
              const meta = EVENT_META[e.kind];
              const Icon = meta.icon;
              return (
                <li key={i} className="flex items-start gap-2 px-3 py-2">
                  <Icon className={`size-4 mt-0.5 shrink-0 ${meta.tone}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-[color:var(--cc-ink-900)]">{meta.label}</div>
                    {e.note && <div className="text-xs text-[color:var(--cc-ink-700)]">{e.note}</div>}
                    <div className="text-[11px] text-[color:var(--cc-ink-500)] tabular-nums">
                      {new Date(e.at).toLocaleString()}{e.by ? ` · ${e.by}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}