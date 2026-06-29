import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listApprovals, reviewApproval, listExportRequests, decideExportRequest } from "@/lib/clients.functions";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCStatusPill, CCTable, CCThead, CCTh, CCTd, CCTr, CCSelect, CCField,
} from "@/components/cc";
import { toast } from "sonner";
import { ArrowLeft, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listApprovals);
  const reviewFn = useServerFn(reviewApproval);
  const exportListFn = useServerFn(listExportRequests);
  const decideExportFn = useServerFn(decideExportRequest);
  const [state, setState] = useState<"pending"|"approved"|"rejected"|"cancelled">("pending");
  const [tab, setTab] = useState<"fields"|"exports">("fields");
  const q = useQuery({ queryKey: ["approvals", state], queryFn: () => listFn({ data: { state } }) });
  const exportsQ = useQuery({ queryKey: ["export-requests", state], queryFn: () => exportListFn({ data: { state } }) });
  const rows = q.data?.rows ?? [];
  const exportRows = exportsQ.data?.rows ?? [];

  async function decide(id: string, decision: "approve" | "reject") {
    try {
      await reviewFn({ data: { id, decision } });
      toast.success(decision === "approve" ? "Approved" : "Rejected");
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["client"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function decideExport(id: string, decision: "approve" | "reject") {
    try {
      const res = await decideExportFn({ data: { id, decision } });
      if (decision === "approve" && res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `clients-export-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(decision === "approve" ? `Approved (${res.count} rows)` : "Rejected");
      qc.invalidateQueries({ queryKey: ["export-requests"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <>
      <PageHeader
        title="Change approvals"
        description="Review sensitive client field changes and export requests raised by agents."
        actions={<Link to="/clients"><CCButton variant="ghost"><ArrowLeft className="size-4 mr-1" />Back</CCButton></Link>}
      />
      <div className="px-6 pt-4 flex items-center gap-2 border-b border-[color:var(--cc-ink-200)]">
        <button onClick={() => setTab("fields")}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === "fields" ? "border-[color:var(--cc-info)] text-[color:var(--cc-ink-900)]" : "border-transparent text-[color:var(--cc-ink-500)]"}`}>
          Field changes
        </button>
        <button onClick={() => setTab("exports")}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === "exports" ? "border-[color:var(--cc-info)] text-[color:var(--cc-ink-900)]" : "border-transparent text-[color:var(--cc-ink-500)]"}`}>
          Export requests
        </button>
      </div>
      <div className="px-6 py-4 max-w-xs">
        <CCField label="Show">
          <CCSelect value={state} onChange={(e) => setState(e.target.value as any)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </CCSelect>
        </CCField>
      </div>
      {tab === "fields" && (
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
      )}
      {tab === "exports" && (
      <div className="px-6 pb-6 bg-white">
        <CCTable>
          <CCThead>
            <tr>
              <CCTh>Requested by</CCTh>
              <CCTh>Scope</CCTh>
              <CCTh>Reason</CCTh>
              <CCTh>Requested</CCTh>
              <CCTh>State</CCTh>
              <CCTh className="text-right">Actions</CCTh>
            </tr>
          </CCThead>
          <tbody>
            {exportRows.length === 0 && <tr><CCTd className="text-[color:var(--cc-ink-500)]">No export requests.</CCTd></tr>}
            {exportRows.map((r: any) => (
              <CCTr key={r.id}>
                <CCTd>{r.profiles?.full_name ?? r.requested_by}</CCTd>
                <CCTd className="capitalize">{r.scope}{Array.isArray(r.client_ids) && r.client_ids.length ? ` · ${r.client_ids.length} ids` : ""}</CCTd>
                <CCTd className="text-xs">{r.reason ?? "—"}</CCTd>
                <CCTd className="text-xs text-[color:var(--cc-ink-500)]">{new Date(r.created_at).toLocaleString()}</CCTd>
                <CCTd><CCStatusPill tone={r.state === "pending" ? "warning" : r.state === "approved" ? "success" : "danger"}>{r.state}</CCStatusPill></CCTd>
                <CCTd className="text-right">
                  {r.state === "pending" && (
                    <div className="flex gap-2 justify-end">
                      <CCButton variant="ghost" size="sm" onClick={() => decideExport(r.id, "reject")}>Reject</CCButton>
                      <CCButton size="sm" onClick={() => decideExport(r.id, "approve")}><Download className="size-4 mr-1" />Approve & download</CCButton>
                    </div>
                  )}
                </CCTd>
              </CCTr>
            ))}
          </tbody>
        </CCTable>
      </div>
      )}
    </>
  );
}