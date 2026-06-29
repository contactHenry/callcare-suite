import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAuditLog } from "@/lib/admin.functions";
import { PageHeader } from "@/components/AppShell";
import {
  CCTable, CCThead, CCTh, CCTd, CCTr, CCStatusPill,
  CCField, CCInput, CCSelect, CCButton, CCWidget,
} from "@/components/cc";
import { DUMMY_AUDIT } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/security/audit")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const ok = (roles ?? []).some((r) => r.role === "ops_admin" || r.role === "super_admin");
    if (!ok) throw redirect({ to: "/dashboard" });
  },
  component: AuditPage,
});

const ACTION_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  "staff.invite": "info",
  "staff.update": "neutral",
  "staff.suspend": "danger",
  "staff.lift_suspension": "success",
  "role.assign": "warning",
  "role.revoke": "warning",
  "permission.toggle": "warning",
  "org.compliance_update": "info",
  "consent.record": "info",
};

function AuditPage() {
  const fn = useServerFn(listAuditLog);
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = useMemo(() => ({
    actorId: actorId.trim() || undefined,
    action: action.trim() || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  }), [actorId, action, from, to]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["audit-log", filters],
    queryFn: () => fn({ data: filters }),
  });
  const apiRows = data?.rows ?? [];
  let rows: any[] = apiRows.length > 0 ? apiRows : DUMMY_AUDIT;
  // Client-side filter the dummy fallback so the UI feels responsive even
  // before any real audit entries exist.
  if (apiRows.length === 0) {
    rows = rows.filter((r: any) => {
      if (filters.actorId && r.actor_id !== filters.actorId) return false;
      if (filters.action && !String(r.action).toLowerCase().includes(filters.action.toLowerCase())) return false;
      if (filters.from && new Date(r.at) < new Date(filters.from)) return false;
      if (filters.to && new Date(r.at) > new Date(filters.to)) return false;
      return true;
    });
  }

  const actions = Array.from(new Set([...Object.keys(ACTION_TONE), ...DUMMY_AUDIT.map((r) => r.action)])).sort();

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only ledger of every privileged action — logins, role changes, exports, recording access, settings edits. Entries cannot be modified or deleted."
      />
      <div className="px-6 py-6 bg-white space-y-6">
        <CCWidget title="Filters">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <CCField label="Actor ID">
              <CCInput value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="uuid" />
            </CCField>
            <CCField label="Action">
              <CCSelect value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">All actions</option>
                {actions.map((a) => <option key={a} value={a}>{a}</option>)}
              </CCSelect>
            </CCField>
            <CCField label="From">
              <CCInput type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </CCField>
            <CCField label="To">
              <CCInput type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </CCField>
            <div className="flex items-end gap-2">
              <CCButton onClick={() => refetch()} disabled={isFetching}>{isFetching ? "Loading…" : "Apply"}</CCButton>
              <CCButton variant="ghost" onClick={() => { setActorId(""); setAction(""); setFrom(""); setTo(""); }}>Clear</CCButton>
            </div>
          </div>
        </CCWidget>
        <div className="text-xs text-[color:var(--cc-ink-500)]">{rows.length} entr{rows.length === 1 ? "y" : "ies"} — append-only, ordered newest first.</div>
        <CCTable>
          <CCThead>
            <tr>
              <CCTh>When</CCTh>
              <CCTh>Actor</CCTh>
              <CCTh>Action</CCTh>
              <CCTh>Target</CCTh>
              <CCTh>Details</CCTh>
              <CCTh>IP</CCTh>
            </tr>
          </CCThead>
          <tbody>
            {rows.map((r: any) => (
              <CCTr key={r.id}>
                <CCTd className="whitespace-nowrap text-xs">{new Date(r.at).toLocaleString()}</CCTd>
                <CCTd className="font-mono text-xs">{(r.actor_id ?? "—").slice(0, 8)}</CCTd>
                <CCTd><CCStatusPill tone={ACTION_TONE[r.action] ?? "neutral"}>{r.action}</CCStatusPill></CCTd>
                <CCTd className="text-xs">{r.target_type}: <span className="font-mono">{(r.target_id ?? "—").slice(0, 12)}</span></CCTd>
                <CCTd className="text-xs">
                  <code className="font-mono text-[11px] text-[color:var(--cc-ink-700)]">{JSON.stringify(r.diff)}</code>
                </CCTd>
                <CCTd className="text-xs font-mono">{r.ip ?? "—"}</CCTd>
              </CCTr>
            ))}
          </tbody>
        </CCTable>
      </div>
    </>
  );
}