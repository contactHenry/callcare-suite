import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCWidget, CCFormSection, CCFormGrid, CCField,
  CCInput, CCTextarea, CCSelect, CCTable, CCThead, CCTh, CCTd, CCTr,
} from "@/components/cc";
import { DUMMY_DATA_REQUESTS } from "@/lib/dummy-data";
import { getOrgCompliance, updateOrgCompliance } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compliance/")({
  component: CompliancePage,
});

function CompliancePage() {
  const { user, atLeast } = useAuth();
  const qc = useQueryClient();
  const canReview = atLeast("ops_admin");
  const canConfigure = atLeast("super_admin");
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["data-requests", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("data_requests" as any)
        .select("*, client:contacts(name), requester:profiles!data_requests_requested_by_fkey(full_name)")
        .order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() };
      if (status === "completed") patch.fulfilled_at = new Date().toISOString();
      await supabase.from("data_requests" as any).update(patch).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data-requests"] }),
  });

  return (
    <>
      <PageHeader
        title="Compliance & data protection"
        description="Governance hub: DSARs, consent ledger, audit log, retention windows, and contact-hour restrictions."
        actions={<CCButton onClick={() => setOpen(true)}>New request</CCButton>}
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HubLink to="/security/audit" label="Audit log" hint="Append-only ledger" />
          <HubLink to="/integrations" label="Integrations" hint="Toggle providers" />
          <HubLink to="/clients/approvals" label="Approvals queue" hint="Sensitive client edits" />
          <HubLink to="/recordings" label="Recordings" hint="Access logged per playback" />
        </div>

        {canConfigure && <OrgComplianceCard />}

        <CCWidget title="Open requests">
          <CCTable>
            <CCThead><tr>
              <CCTh>Kind</CCTh><CCTh>Client</CCTh><CCTh>Requested by</CCTh>
              <CCTh>Status</CCTh><CCTh>Date</CCTh><CCTh></CCTh>
            </tr></CCThead>
            <tbody>
              {(((list.data && list.data.length > 0) ? list.data : DUMMY_DATA_REQUESTS) as any[]).map((r) => {
                const tone: any = r.status === "completed" ? "success"
                  : r.status === "rejected" ? "danger"
                  : r.status === "approved" ? "info" : "warning";
                return (
                  <CCTr key={r.id}>
                    <CCTd className="capitalize">{r.kind}</CCTd>
                    <CCTd>{r.client?.name ?? "—"}</CCTd>
                    <CCTd>{r.requester?.full_name ?? "—"}</CCTd>
                    <CCTd><CCStatusPill tone={tone} dot>{r.status}</CCStatusPill></CCTd>
                    <CCTd className="tabular-nums">{new Date(r.created_at).toLocaleDateString()}</CCTd>
                    <CCTd className="text-right">
                      {canReview && r.status === "pending" && (
                        <div className="flex gap-1 justify-end">
                          <CCButton size="sm" variant="success" onClick={() => review.mutate({ id: r.id, status: "approved" })}>Approve</CCButton>
                          <CCButton size="sm" variant="danger" onClick={() => review.mutate({ id: r.id, status: "rejected" })}>Reject</CCButton>
                        </div>
                      )}
                      {canReview && r.status === "approved" && (
                        <CCButton size="sm" onClick={() => review.mutate({ id: r.id, status: "completed" })}>Mark fulfilled</CCButton>
                      )}
                    </CCTd>
                  </CCTr>
                );
              })}
            </tbody>
          </CCTable>
        </CCWidget>

        <CCWidget title="Compliance posture">
          <ul className="text-sm space-y-2 text-[color:var(--cc-ink-700)]">
            <li>✅ All client tables are RLS-protected; agents see only assigned records.</li>
            <li>✅ Call recordings live in a private bucket with access logged per playback.</li>
            <li>✅ Critical client field changes require supervisor approval.</li>
            <li>✅ Do-not-call status and consent tracked per contact.</li>
            <li>✅ Audit log captures logins, exports, role changes, and recording access.</li>
            <li>⚙️ Configure data retention windows per record type with the ops admin.</li>
          </ul>
        </CCWidget>
      </div>
      {open && <NewDsarDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["data-requests"] }); }} />}
    </>
  );
}

function NewDsarDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [kind, setKind] = useState("export");
  const [reason, setReason] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("data_requests" as any).insert({
        kind, reason, requested_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: onClose,
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CCFormSection title="New data request" hint="An ops admin reviews and fulfils every request.">
          <CCFormGrid>
            <CCField label="Kind">
              <CCSelect value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="export">Export (DSAR)</option>
                <option value="deletion">Deletion (right to be forgotten)</option>
                <option value="restriction">Restrict processing</option>
                <option value="access">Access to record</option>
              </CCSelect>
            </CCField>
          </CCFormGrid>
          <CCField label="Reason / context"><CCTextarea value={reason} onChange={(e) => setReason(e.target.value)} /></CCField>
          <div className="flex justify-end gap-2">
            <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
            <CCButton onClick={() => create.mutate()} disabled={create.isPending}>Submit</CCButton>
          </div>
        </CCFormSection>
      </div>
    </div>
  );
}