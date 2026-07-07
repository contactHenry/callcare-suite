import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCFormSection, CCFormGrid, CCField, CCInput,
  CCTextarea, CCSelect, CCTable, CCThead, CCTh, CCTd, CCTr,
} from "@/components/cc";
import { DUMMY_COMPLAINTS } from "@/lib/dummy-data";
import { listStaff } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/complaints/")({
  component: ComplaintsPage,
});

function ComplaintsPage() {
  const { user, atLeast } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assignFilter, setAssignFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const isLeader = atLeast("team_leader");

  const list = useQuery({
    queryKey: ["complaints", user?.id, isLeader],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints" as any)
        .select("*, client:contacts(id,name), call:calls(id,started_at), owner:profiles!complaints_owner_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Complaints & escalations"
        description="Track client complaints, link the relevant call, and route to the right owner."
        actions={<CCButton onClick={() => setOpen(true)}>Log complaint</CCButton>}
      />
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          {(["all","assigned","unassigned"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setAssignFilter(k)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                assignFilter === k
                  ? "bg-[color:var(--cc-ink-900)] text-white border-[color:var(--cc-ink-900)]"
                  : "border-[color:var(--cc-ink-200)] text-[color:var(--cc-ink-700)] hover:bg-[color:var(--cc-ink-50)]"
              }`}
            >
              {k === "all" ? "All" : k === "assigned" ? "Assigned" : "Unassigned"}
            </button>
          ))}
        </div>
        <CCTable>
            <CCThead>
              <tr>
                <CCTh>Subject</CCTh>
                <CCTh>Client</CCTh>
                <CCTh>Owner</CCTh>
                <CCTh>Priority</CCTh>
                <CCTh>Status</CCTh>
                <CCTh>Raised</CCTh>
              </tr>
            </CCThead>
            <tbody>
              {(((list.data && list.data.length > 0) ? list.data : DUMMY_COMPLAINTS) as any[])
                .filter((c) => assignFilter === "all"
                  ? true
                  : assignFilter === "assigned"
                    ? !!c.owner?.full_name
                    : !c.owner?.full_name)
                .map((c) => {
                const statusTone: any = c.status === "resolved" || c.status === "closed"
                  ? "success" : c.status === "escalated" ? "danger"
                  : c.status === "investigating" ? "info" : "warning";
                const prTone: any = c.priority === "urgent" || c.priority === "high" ? "danger"
                  : c.priority === "low" ? "neutral" : "info";
                const overdue = c.due_at && !c.resolved_at && new Date(c.due_at) < new Date();
                const assigned = !!c.owner?.full_name;
                return (
                  <CCTr key={c.id} onClick={() => setDetailId(c.id)} className="cursor-pointer">
                    <CCTd>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[color:var(--cc-ink-900)]">{c.subject}</span>
                        {overdue && <CCStatusPill tone="danger" dot>overdue</CCStatusPill>}
                      </div>
                      <div className="text-xs text-[color:var(--cc-ink-500)] flex flex-wrap gap-2 mt-0.5">
                        {c.category && <span>{c.category}</span>}
                        {c.call?.id && <span>· linked call</span>}
                      </div>
                    </CCTd>
                    <CCTd className="text-[color:var(--cc-ink-700)]">
                      {c.client?.id ? (
                        <Link to="/clients/$id" params={{ id: c.client.id }} onClick={(e) => e.stopPropagation()} className="hover:underline">{c.client.name}</Link>
                      ) : (c.client?.name ?? "—")}
                    </CCTd>
                    <CCTd>
                      {assigned ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[color:var(--cc-ink-700)]">{c.owner.full_name}</span>
                          <CCStatusPill tone="success" dot>assigned</CCStatusPill>
                        </div>
                      ) : (
                        <CCStatusPill tone="warning" dot>unassigned</CCStatusPill>
                      )}
                    </CCTd>
                    <CCTd><CCStatusPill tone={prTone} dot>{c.priority}</CCStatusPill></CCTd>
                    <CCTd><CCStatusPill tone={statusTone} dot>{c.status}</CCStatusPill></CCTd>
                    <CCTd className="tabular-nums text-[color:var(--cc-ink-700)]">{new Date(c.created_at).toLocaleDateString()}</CCTd>
                  </CCTr>
                );
              })}
            </tbody>
        </CCTable>
      </div>
      {open && <NewComplaintDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["complaints"] }); }} />}
      {detailId && (
        <ComplaintDetailDialog
          id={detailId}
          canManage={isLeader}
          fallback={(DUMMY_COMPLAINTS as any[]).find((x) => x.id === detailId)}
          onClose={() => { setDetailId(null); qc.invalidateQueries({ queryKey: ["complaints"] }); }}
        />
      )}
    </>
  );
}

function NewComplaintDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("service");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");

  const staff = useQuery({
    queryKey: ["staff-for-complaints"],
    queryFn: () => listStaff(),
  });
  const agents = (staff.data ?? []).filter((s: any) =>
    (s.roles ?? []).some((r: string) => ["agent","team_leader","supervisor"].includes(r))
  );

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("complaints" as any).insert({
        subject, category, priority, description, raised_by: user!.id,
        owner_id: ownerId || null,
      });
      if (error) throw error;
    },
    onSuccess: onClose,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CCFormSection title="Log complaint">
          <CCFormGrid>
            <CCField label="Subject"><CCInput value={subject} onChange={(e) => setSubject(e.target.value)} /></CCField>
            <CCField label="Category">
              <CCSelect value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="service">Service</option>
                <option value="billing">Billing</option>
                <option value="agent_conduct">Agent conduct</option>
                <option value="data_protection">Data protection</option>
                <option value="other">Other</option>
              </CCSelect>
            </CCField>
            <CCField label="Priority">
              <CCSelect value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </CCSelect>
            </CCField>
            <CCField label="Assign to agent" hint="Optional — leave empty to triage later">
              <CCSelect value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {agents.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name ?? "Unnamed"}{a.roles?.[0] ? ` · ${a.roles[0]}` : ""}
                  </option>
                ))}
              </CCSelect>
            </CCField>
          </CCFormGrid>
          <CCField label="Description"><CCTextarea value={description} onChange={(e) => setDescription(e.target.value)} /></CCField>
          <div className="flex justify-end gap-2">
            <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
            <CCButton onClick={() => create.mutate()} disabled={!subject || create.isPending}>Log complaint</CCButton>
          </div>
          {create.isError && <div className="text-xs text-[color:var(--cc-danger)]">Could not save</div>}
        </CCFormSection>
      </div>
    </div>
  );
}

function ComplaintDetailDialog({ id, canManage, fallback, onClose }: { id: string; canManage: boolean; fallback?: any; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [statusChange, setStatusChange] = useState<string>("");
  const [resolution, setResolution] = useState("");
  const [priority, setPriority] = useState<string>("");

  const detail = useQuery({
    queryKey: ["complaint", id],
    queryFn: async () => {
      try {
        const { data } = await supabase
        .from("complaints" as any)
        .select("*, client:contacts(id,name), call:calls(id,started_at,direction), owner:profiles!complaints_owner_id_fkey(full_name)")
        .eq("id", id).maybeSingle();
        return data as any;
      } catch { return null; }
    },
    retry: false,
  });

  const thread = useQuery({
    queryKey: ["complaint-updates", id],
    queryFn: async () => {
      try {
        const { data } = await supabase
        .from("complaint_updates" as any)
        .select("*, author:profiles!complaint_updates_author_id_fkey(full_name)")
        .eq("complaint_id", id)
        .order("created_at", { ascending: true });
        return (data ?? []) as any[];
      } catch { return [] as any[]; }
    },
    retry: false,
  });

  const addUpdate = useMutation({
    mutationFn: async () => {
      const patch: any = {};
      if (statusChange) patch.status = statusChange;
      if (resolution && (statusChange === "resolved" || statusChange === "closed")) {
        patch.resolution = resolution;
        patch.resolved_at = new Date().toISOString();
      }
      if (priority) patch.priority = priority;
      if (Object.keys(patch).length > 0) {
        await supabase.from("complaints" as any).update(patch).eq("id", id);
      }
      if (body.trim()) {
        await supabase.from("complaint_updates" as any).insert({
          complaint_id: id, author_id: user!.id, body, status_change: statusChange || null,
        });
      }
    },
    onSuccess: () => {
      setBody(""); setStatusChange(""); setResolution(""); setPriority("");
      qc.invalidateQueries({ queryKey: ["complaint", id] });
      qc.invalidateQueries({ queryKey: ["complaint-updates", id] });
    },
  });

  const enriched = fallback ? {
    description:
      fallback.category === "billing"
        ? "Client reports being charged twice on the May invoice. Requests refund of the duplicate charge and written confirmation."
        : fallback.category === "agent_conduct"
        ? "Client states the agent raised their voice and interrupted repeatedly. Requests a formal apology and coaching for the agent."
        : fallback.category === "data_protection"
        ? "Client is invoking their right to erasure under GDPR Article 17. Confirm all systems, backups and downstream processors."
        : fallback.category === "service"
        ? "Callback promised within 24 hours was not delivered. Client asking for escalation and a clear resolution timeline."
        : "Client raised a concern. Full details captured during the call and follow-up email.",
    due_at: new Date(new Date(fallback.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    resolved_at: fallback.status === "resolved" ? new Date(new Date(fallback.created_at).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString() : null,
    resolution: fallback.status === "resolved" ? "Refund processed, apology issued, and account credited with a goodwill gesture." : null,
    call: { id: "call-" + fallback.id.slice(0, 6), started_at: fallback.created_at, direction: "inbound" },
    client: { ...fallback.client, id: "client-" + fallback.id.slice(0, 6) },
  } : null;
  const c = detail.data ?? (fallback ? { ...fallback, ...enriched } : null);
  const dummyThread = fallback ? [
    { id: "u1", author: { full_name: "Liam Carter" },  created_at: new Date(new Date(fallback.created_at).getTime() + 60 * 60 * 1000).toISOString(),      status_change: "investigating", body: "Acknowledged with client. Pulled call recording and account history for review." },
    { id: "u2", author: { full_name: "Olivia Brown" }, created_at: new Date(new Date(fallback.created_at).getTime() + 6 * 60 * 60 * 1000).toISOString(),  status_change: null, body: "Reviewed recording — duplicate charge confirmed on billing system. Coordinating with finance for refund." },
    ...(fallback.status === "resolved" ? [{ id: "u3", author: { full_name: "Olivia Brown" }, created_at: new Date(new Date(fallback.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(), status_change: "resolved", body: "Refund processed and confirmation email sent." }] : []),
    ...(fallback.status === "escalated" ? [{ id: "u3", author: { full_name: "Ava Singh" },   created_at: new Date(new Date(fallback.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(), status_change: "escalated", body: "Escalated to operations manager — requires HR involvement." }] : []),
  ] : [];
  const threadRows = (thread.data && thread.data.length > 0) ? thread.data : dummyThread;
  const overdue = c?.due_at && !c?.resolved_at && new Date(c.due_at) < new Date();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <CCFormSection title={c?.subject ?? "Complaint"}>
          {!c ? (
            <div className="text-sm text-[color:var(--cc-ink-500)]">Loading…</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 -mt-2 mb-2">
                <CCStatusPill tone={c.status === "resolved" || c.status === "closed" ? "success" : c.status === "escalated" ? "danger" : "info"} dot>{c.status}</CCStatusPill>
                <CCStatusPill tone={c.priority === "urgent" || c.priority === "high" ? "danger" : "info"} dot>{c.priority}</CCStatusPill>
                {overdue && <CCStatusPill tone="danger" dot>overdue</CCStatusPill>}
                <span className="text-xs text-[color:var(--cc-ink-500)]">Raised {new Date(c.created_at).toLocaleString()}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-[color:var(--cc-ink-500)]">Client</div>
                  {c.client?.id ? (
                    <Link to="/clients/$id" params={{ id: c.client.id }} className="font-medium hover:underline">{c.client.name}</Link>
                  ) : <div>—</div>}
                </div>
                <div>
                  <div className="text-xs text-[color:var(--cc-ink-500)]">Linked call</div>
                  {c.call?.id ? (
                    <Link to="/calls/$id" params={{ id: c.call.id }} className="font-medium hover:underline">
                      {c.call.direction ?? "call"} · {new Date(c.call.started_at).toLocaleString()}
                    </Link>
                  ) : <div>—</div>}
                </div>
                <div>
                  <div className="text-xs text-[color:var(--cc-ink-500)]">Owner</div>
                  <div>{c.owner?.full_name ?? "Unassigned"}</div>
                </div>
                <div>
                  <div className="text-xs text-[color:var(--cc-ink-500)]">Due</div>
                  <div className="tabular-nums">{c.due_at ? new Date(c.due_at).toLocaleString() : "—"}</div>
                </div>
              </div>
              {c.description && (
                <div className="mt-3 text-sm text-[color:var(--cc-ink-700)] whitespace-pre-wrap">{c.description}</div>
              )}
              {c.resolution && (
                <div className="mt-3 p-3 rounded-md bg-[color:var(--cc-success)]/10 text-sm">
                  <div className="text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)] mb-1">Resolution</div>
                  {c.resolution}
                </div>
              )}

              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)] mb-2">Investigation</div>
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {threadRows.map((u: any) => (
                    <li key={u.id} className="text-sm border-l-2 border-[color:var(--cc-ink-200)] pl-3">
                      <div className="text-xs text-[color:var(--cc-ink-500)]">
                        {u.author?.full_name ?? "—"} · {new Date(u.created_at).toLocaleString()}
                        {u.status_change && <> · changed status to <b>{u.status_change}</b></>}
                      </div>
                      <div className="whitespace-pre-wrap">{u.body}</div>
                    </li>
                  ))}
                  {threadRows.length === 0 && (
                    <li className="text-xs text-[color:var(--cc-ink-500)]">No updates yet.</li>
                  )}
                </ul>
              </div>

              <div className="mt-4 pt-3 border-t border-[color:var(--cc-ink-100)] space-y-3">
                <CCField label="Add update / note">
                  <CCTextarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Investigation step, finding, or comment…" />
                </CCField>
                {canManage && (
                  <CCFormGrid>
                    <CCField label="Change status">
                      <CCSelect value={statusChange} onChange={(e) => setStatusChange(e.target.value)}>
                        <option value="">— keep —</option>
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="escalated">Escalated</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </CCSelect>
                    </CCField>
                    <CCField label="Change priority">
                      <CCSelect value={priority} onChange={(e) => setPriority(e.target.value)}>
                        <option value="">— keep —</option>
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </CCSelect>
                    </CCField>
                  </CCFormGrid>
                )}
                {(statusChange === "resolved" || statusChange === "closed") && (
                  <CCField label="Resolution summary">
                    <CCTextarea value={resolution} onChange={(e) => setResolution(e.target.value)} />
                  </CCField>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <CCButton variant="ghost" onClick={onClose}>Close</CCButton>
                <CCButton onClick={() => addUpdate.mutate()} disabled={addUpdate.isPending || (!body && !statusChange && !priority)}>
                  Save update
                </CCButton>
              </div>
            </>
          )}
        </CCFormSection>
      </div>
    </div>
  );
}