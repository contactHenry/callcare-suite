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
import { Paperclip, LifeBuoy, X, Send } from "lucide-react";

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

function SupportPage() {
  const { user, atLeast } = useAuth();
  const qc = useQueryClient();
  const isAdmin = atLeast("ops_admin");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["support-tickets", user?.id, scope, statusFilter, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets" as any)
        .select("*, reporter:profiles!support_tickets_created_by_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!(isAdmin && scope === "all")) q = q.eq("created_by", user!.id);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  return (
    <>
      <PageHeader
        title="Support & tickets"
        description="Report an issue, request a feature, or track a support conversation with the platform team."
        actions={<CCButton onClick={() => setOpen(true)}><LifeBuoy className="size-4" />New ticket</CCButton>}
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="inline-flex rounded-full border border-[color:var(--cc-ink-200)] p-0.5">
                {(["mine", "all"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${
                      scope === s ? "bg-[color:var(--cc-ink-900)] text-white" : "text-[color:var(--cc-ink-700)]"
                    }`}
                  >
                    {s === "mine" ? "My tickets" : "All tickets"}
                  </button>
                ))}
              </div>
            )}
            <CCSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="max-w-[180px]">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="waiting">Waiting</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </CCSelect>
          </div>
          <div className="text-xs text-[color:var(--cc-ink-500)]">
            {list.data?.length ?? 0} ticket{(list.data?.length ?? 0) === 1 ? "" : "s"}
          </div>
        </div>

        <div className="cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] overflow-hidden">
          {list.isLoading ? (
            <div className="p-8 text-center text-sm text-[color:var(--cc-ink-500)]">Loading…</div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <CCEmpty
              title="No tickets yet"
              body="Send in a ticket when you hit an issue or need help — we'll get back to you."
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
                  {isAdmin && scope === "all" && <CCTh>Reporter</CCTh>}
                  <CCTh>Created</CCTh>
                </tr>
              </CCThead>
              <tbody>
                {list.data!.map((t) => (
                  <CCTr key={t.id} onClick={() => setDetailId(t.id)}>
                    <CCTd className="font-medium">{t.subject}</CCTd>
                    <CCTd>{CATEGORY_LABEL[t.category as Category]}</CCTd>
                    <CCTd><CCStatusPill tone={PRIORITY_TONE[t.priority as Priority]}>{t.priority}</CCStatusPill></CCTd>
                    <CCTd><CCStatusPill tone={STATUS_TONE[t.status as Status]}>{t.status.replace("_", " ")}</CCStatusPill></CCTd>
                    {isAdmin && scope === "all" && <CCTd className="text-xs text-[color:var(--cc-ink-500)]">{t.reporter?.full_name ?? "—"}</CCTd>}
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
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["support-tickets"] })}
        />
      )}
    </>
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

function TicketDetailDrawer({ ticketId, isAdmin, onClose, onUpdated }: {
  ticketId: string; isAdmin: boolean; onClose: () => void; onUpdated: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");

  const ticket = useQuery({
    queryKey: ["support-ticket", ticketId],
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
    enabled: !!ticket.data?.screenshot_path,
    queryFn: async () => {
      const { data } = await supabase.storage.from("support-attachments")
        .createSignedUrl(ticket.data.screenshot_path, 60 * 30);
      return data?.signedUrl ?? null;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: Status) => {
      const patch: any = { status };
      if (status === "resolved") { patch.resolved_at = new Date().toISOString(); patch.resolved_by = user!.id; }
      const { error } = await supabase.from("support_tickets" as any).update(patch).eq("id", ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      onUpdated();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update"),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!reply.trim()) return;
      const { error } = await supabase.from("support_ticket_comments" as any).insert({
        ticket_id: ticketId,
        author_id: user!.id,
        body: reply.trim(),
        is_staff_reply: isAdmin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["support-ticket-comments", ticketId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });

  const t = ticket.data;

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
              <div className="text-xs text-[color:var(--cc-ink-500)]">
                Reported by {t.reporter?.full_name ?? "—"} · {new Date(t.created_at).toLocaleString()}
              </div>
              <div className="text-sm whitespace-pre-wrap text-[color:var(--cc-ink-900)]">{t.description}</div>
              {screenshotUrl.data && (
                <a href={screenshotUrl.data} target="_blank" rel="noreferrer" className="block">
                  <img src={screenshotUrl.data} alt="Screenshot" className="max-h-64 rounded border" />
                </a>
              )}

              {isAdmin && (
                <div className="flex items-center gap-2 border-t pt-4">
                  <span className="text-xs font-medium text-[color:var(--cc-ink-500)]">Change status:</span>
                  {(["open","in_progress","waiting","resolved","closed"] as Status[]).map((s) => (
                    <button
                      key={s}
                      disabled={updateStatus.isPending || t.status === s}
                      onClick={() => updateStatus.mutate(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                        t.status === s
                          ? "bg-[color:var(--cc-ink-900)] text-white border-[color:var(--cc-ink-900)]"
                          : "border-[color:var(--cc-ink-200)] hover:bg-[color:var(--cc-ink-50)]"
                      }`}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">Conversation</div>
                {(comments.data ?? []).length === 0 ? (
                  <div className="text-xs text-[color:var(--cc-ink-500)]">No replies yet.</div>
                ) : (
                  <ul className="space-y-3">
                    {comments.data!.map((c) => (
                      <li key={c.id} className={`rounded-lg p-3 border ${c.is_staff_reply ? "bg-[color:var(--cc-brand-600)]/5 border-[color:var(--cc-brand-600)]/20" : "bg-[color:var(--cc-ink-50)] border-[color:var(--cc-ink-100)]"}`}>
                        <div className="flex items-center justify-between text-[11px] text-[color:var(--cc-ink-500)]">
                          <span className="font-medium text-[color:var(--cc-ink-900)]">
                            {c.author?.full_name ?? "User"}{c.is_staff_reply && " · Support"}
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