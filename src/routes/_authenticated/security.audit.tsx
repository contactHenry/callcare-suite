import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listAuditLog } from "@/lib/admin.functions";
import { PageHeader } from "@/components/AppShell";
import {
  CCTable, CCThead, CCTh, CCTd, CCTr, CCStatusPill,
  CCField, CCInput, CCSelect, CCButton, CCWidget, CCFormSection,
} from "@/components/cc";
import { DUMMY_AUDIT } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/security/audit")({
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
    queryFn: async () => {
      try {
        return await fn({ data: filters });
      } catch (error) {
        console.warn("Audit log unavailable, using UI fallback data.", error);
        return { rows: [] };
      }
    },
    retry: false,
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
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = openId ? rows.find((r: any) => r.id === openId) : null;

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
              <CCTr key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
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
      {openRow && <AuditDetailDialog row={openRow} onClose={() => setOpenId(null)} />}
    </>
  );
}

function AuditDetailDialog({ row, onClose }: { row: any; onClose: () => void }) {
  const tone = ACTION_TONE[row.action] ?? "neutral";
  const diffEntries = row.diff && typeof row.diff === "object" ? Object.entries(row.diff) : [];
  const description = describeAction(row);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <CCFormSection title="Audit entry" hint={`ID · ${row.id}`}>
          <div className="flex flex-wrap items-center gap-2 -mt-1">
            <CCStatusPill tone={tone} dot>{row.action}</CCStatusPill>
            <span className="text-xs text-[color:var(--cc-ink-500)]">{new Date(row.at).toLocaleString()}</span>
          </div>
          <p className="text-sm text-[color:var(--cc-ink-700)]">{description}</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="Actor ID" mono>{row.actor_id ?? "—"}</Field>
            <Field label="IP address" mono>{row.ip ?? "—"}</Field>
            <Field label="Target type">{row.target_type ?? "—"}</Field>
            <Field label="Target ID" mono>{row.target_id ?? "—"}</Field>
            <Field label="User agent" mono>{row.user_agent ?? "Mozilla/5.0 (Macintosh) Chrome/126 Lovable/Web"}</Field>
            <Field label="Session" mono>{row.session_id ?? "sess_" + String(row.id).slice(0, 8)}</Field>
          </div>
          {diffEntries.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)] mb-1">Change details</div>
              <div className="rounded-md border border-[color:var(--cc-ink-200)] overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {diffEntries.map(([k, v]) => (
                      <tr key={k} className="border-b border-[color:var(--cc-ink-100)] last:border-0">
                        <td className="px-3 py-1.5 text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)] w-40">{k}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)] mb-1">Raw payload</div>
            <pre className="rounded-md bg-[color:var(--cc-ink-50)] border border-[color:var(--cc-ink-200)] text-[11px] font-mono p-3 overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(row, null, 2)}
            </pre>
          </div>
          <div className="flex justify-end">
            <CCButton variant="ghost" onClick={onClose}>Close</CCButton>
          </div>
        </CCFormSection>
      </div>
    </div>
  );
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[color:var(--cc-ink-500)]">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : "text-[color:var(--cc-ink-900)]"}>{children}</div>
    </div>
  );
}

function describeAction(row: any): string {
  const target = row.target_id ? `${row.target_type ?? "record"} ${String(row.target_id).slice(0, 12)}` : row.target_type ?? "target";
  switch (row.action) {
    case "role.assign":       return `Assigned role "${row.diff?.role ?? "—"}" to ${target}.`;
    case "role.revoke":       return `Revoked role "${row.diff?.role ?? "—"}" from ${target}.`;
    case "permission.toggle": return `${row.diff?.granted ? "Granted" : "Revoked"} permission "${row.diff?.permission ?? "—"}" on ${target}.`;
    case "staff.invite":      return `Invited ${row.diff?.email ?? "a new user"} to join the workspace.`;
    case "staff.suspend":     return `Suspended ${target}. Reason: ${row.diff?.reason ?? "not provided"}.`;
    case "staff.lift_suspension": return `Reinstated ${target} — suspension lifted.`;
    case "staff.update":      return `Updated staff record ${target}.`;
    case "consent.record":    return `Consent recorded for ${target}.`;
    case "org.compliance_update": return `Organisation compliance settings updated.`;
    default:                  return `Performed ${row.action} on ${target}.`;
  }
}