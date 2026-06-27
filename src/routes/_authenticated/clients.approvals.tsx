import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listApprovals, reviewApproval } from "@/lib/clients.functions";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCTable, CCThead, CCTh, CCTd, CCTr, CCSelect, CCField,
} from "@/components/cc";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listApprovals);
  const reviewFn = useServerFn(reviewApproval);
  const [state, setState] = useState<"pending"|"approved"|"rejected"|"cancelled">("pending");
  const q = useQuery({ queryKey: ["approvals", state], queryFn: () => listFn({ data: { state } }) });
  const rows = q.data?.rows ?? [];

  async function decide(id: string, decision: "approve" | "reject") {
    try {
      await reviewFn({ data: { id, decision } });
      toast.success(decision === "approve" ? "Approved" : "Rejected");
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["client"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <>
      <PageHeader
        title="Change approvals"
        description="Review and approve sensitive client field changes raised by agents."
        actions={<Link to="/clients"><CCButton variant="ghost"><ArrowLeft className="size-4 mr-1" />Back</CCButton></Link>}
      />
      <div className="px-6 py-4 max-w-xs">
        <CCField label="Show">
          <CCSelect value={state} onChange={(e) => setState(e.target.value as any)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </CCSelect>
        </CCField>
      </div>
      <div className="px-6 pb-6 bg-white">
        <CCTable>
          <CCThead>
            <tr>
              <CCTh>Client</CCTh>
              <CCTh>Field</CCTh>
              <CCTh>Old → New</CCTh>
              <CCTh>Requested</CCTh>
              <CCTh>State</CCTh>
              <CCTh className="text-right">Actions</CCTh>
            </tr>
          </CCThead>
          <tbody>
            {rows.length === 0 && <tr><CCTd className="text-[color:var(--cc-ink-500)]">No requests.</CCTd></tr>}
            {rows.map((a: any) => (
              <CCTr key={a.id}>
                <CCTd>
                  <Link to="/clients/$id" params={{ id: a.client_id }} className="hover:underline">{a.contacts?.name ?? a.client_id}</Link>
                </CCTd>
                <CCTd className="capitalize">{a.field}</CCTd>
                <CCTd className="text-xs">{a.old_value ?? "∅"} → <strong>{a.new_value ?? "∅"}</strong></CCTd>
                <CCTd className="text-xs text-[color:var(--cc-ink-500)]">{new Date(a.created_at).toLocaleString()}</CCTd>
                <CCTd><CCStatusPill tone={a.state === "pending" ? "warning" : a.state === "approved" ? "success" : "danger"}>{a.state}</CCStatusPill></CCTd>
                <CCTd className="text-right">
                  {a.state === "pending" && (
                    <div className="flex gap-2 justify-end">
                      <CCButton variant="ghost" size="sm" onClick={() => decide(a.id, "reject")}>Reject</CCButton>
                      <CCButton size="sm" onClick={() => decide(a.id, "approve")}>Approve</CCButton>
                    </div>
                  )}
                </CCTd>
              </CCTr>
            ))}
          </tbody>
        </CCTable>
      </div>
    </>
  );
}