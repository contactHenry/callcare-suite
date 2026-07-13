import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPermissions, togglePermission } from "@/lib/admin.functions";
import { PageHeader } from "@/components/AppShell";
import { CCStatusPill } from "@/components/cc";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { DUMMY_PERMISSIONS_ROWS } from "@/lib/dummy-data";
import { useAuth } from "@/lib/auth";

/** Super-admin permission matrix editor. */
export const Route = createFileRoute("/_authenticated/admin/permissions")({
  component: PermissionsPage,
});

const ROLES = ["agent", "team_leader", "supervisor", "ops_admin", "super_admin"] as const;

function PermissionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPermissions);
  const toggleFn = useServerFn(togglePermission);
  const { data } = useQuery({ queryKey: ["permissions"], queryFn: () => listFn() });
  const { atLeast } = useAuth();
  const canManage = atLeast("super_admin");

  const apiRows: any[] = (data?.rows ?? []) as any[];
  const usingDummy = apiRows.length === 0;
  const rows: any[] = usingDummy ? DUMMY_PERMISSIONS_ROWS : apiRows;
  const permissions: string[] = Array.from(new Set(rows.map((r) => String(r.permission)))).sort();
  const grants = new Set<string>(rows.map((r) => `${r.role}:${r.permission}`));

  const mut = useMutation({
    mutationFn: ({ role, permission, granted }: any) =>
      toggleFn({ data: { role, permission, granted } }),
    onMutate: ({ role, permission, granted }) => {
      // optimistic update
      const key = `${role}:${permission}`;
      if (granted) grants.add(key); else grants.delete(key);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissions"] }),
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  return (
    <>
      <PageHeader
        title="Role permissions"
        description="Grant or revoke individual permissions per role. Permission checks are additive across the role hierarchy."
      />
      <div className="px-6 py-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)] border-b border-[color:var(--cc-ink-200)]">
              <tr>
                <th className="px-4 py-3 font-medium">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-3 font-medium text-center">{r.replace("_", " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                <tr key={perm} className="border-b border-[color:var(--cc-ink-100)] last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--cc-ink-900)]">{perm}</td>
                  {ROLES.map((r) => {
                    const has = grants.has(`${r}:${perm}`);
                    return (
                      <td key={r} className="px-3 py-2 text-center">
                        <button
                          onClick={() => {
                            if (usingDummy) {
                              toast.info("Demo matrix — grants sync once real permissions load.");
                              return;
                            }
                            if (!canManage) {
                              toast.error("Only super admins can change role permissions.");
                              return;
                            }
                            mut.mutate({ role: r, permission: perm, granted: !has });
                          }}
                          disabled={!canManage && !usingDummy}
                          className={
                            "inline-flex size-7 items-center justify-center rounded-md border transition " +
                            (has
                              ? "bg-[color:var(--cc-success)] border-transparent text-white"
                              : "bg-[color:var(--cc-ink-50)] border-[color:var(--cc-ink-200)] text-[color:var(--cc-ink-500)] hover:border-[color:var(--cc-ink-300)]") +
                            (!canManage && !usingDummy ? " opacity-60 cursor-not-allowed" : "")
                          }
                          aria-pressed={has}
                          title={has ? "Granted — click to revoke" : "Not granted — click to grant"}
                        >
                          {has && <Check className="size-4" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {permissions.length === 0 && (
                <tr><td colSpan={ROLES.length + 1} className="px-4 py-12 text-center text-sm text-[color:var(--cc-ink-500)]">No permissions registered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-[color:var(--cc-ink-500)]">
          <CCStatusPill tone="info">Inheritance</CCStatusPill> Higher roles inherit every permission granted to lower roles —
          a permission granted to <code>agent</code> is automatically available to every other role.
        </p>
      </div>
    </>
  );
}