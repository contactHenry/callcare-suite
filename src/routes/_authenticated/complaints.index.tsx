import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/complaints/")({
  component: ComplaintsPage,
});

function ComplaintsPage() {
  const { user, atLeast } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const isLeader = atLeast("team_leader");

  const list = useQuery({
    queryKey: ["complaints", user?.id, isLeader],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints" as any)
        .select("*, client:contacts(name), owner:profiles!complaints_owner_id_fkey(full_name)")
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
        <div className="cc-surface rounded-[var(--cc-radius-lg)] shadow-[var(--cc-shadow-sm)] overflow-hidden">
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
              {(((list.data && list.data.length > 0) ? list.data : DUMMY_COMPLAINTS) as any[]).map((c) => {
                const statusTone: any = c.status === "resolved" || c.status === "closed"
                  ? "success" : c.status === "escalated" ? "danger"
                  : c.status === "investigating" ? "info" : "warning";
                const prTone: any = c.priority === "urgent" || c.priority === "high" ? "danger"
                  : c.priority === "low" ? "neutral" : "info";
                return (
                  <CCTr key={c.id}>
                    <CCTd>
                      <div className="font-medium text-[color:var(--cc-ink-900)]">{c.subject}</div>
                      {c.category && <div className="text-xs text-[color:var(--cc-ink-500)]">{c.category}</div>}
                    </CCTd>
                    <CCTd className="text-[color:var(--cc-ink-700)]">{c.client?.name ?? "—"}</CCTd>
                    <CCTd className="text-[color:var(--cc-ink-700)]">{c.owner?.full_name ?? "Unassigned"}</CCTd>
                    <CCTd><CCStatusPill tone={prTone} dot>{c.priority}</CCStatusPill></CCTd>
                    <CCTd><CCStatusPill tone={statusTone} dot>{c.status}</CCStatusPill></CCTd>
                    <CCTd className="tabular-nums text-[color:var(--cc-ink-700)]">{new Date(c.created_at).toLocaleDateString()}</CCTd>
                  </CCTr>
                );
              })}
            </tbody>
          </CCTable>
        </div>
      </div>
      {open && <NewComplaintDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["complaints"] }); }} />}
    </>
  );
}

function NewComplaintDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("service");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("complaints" as any).insert({
        subject, category, priority, description, raised_by: user!.id,
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