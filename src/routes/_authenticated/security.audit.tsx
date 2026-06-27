import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listAuditLog } from "@/lib/admin.functions";
import { PageHeader } from "@/components/AppShell";
import { CCTable, CCThead, CCTh, CCTd, CCTr, CCStatusPill } from "@/components/cc";
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
};

function AuditPage() {
  const fn = useServerFn(listAuditLog);
  const { data } = useQuery({ queryKey: ["audit-log"], queryFn: () => fn() });
  const apiRows = data?.rows ?? [];
  const rows: any[] = apiRows.length > 0 ? apiRows : DUMMY_AUDIT;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every privileged action — role grants, suspensions, permission edits — is recorded here."
      />
      <div className="px-6 py-6 bg-white">
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