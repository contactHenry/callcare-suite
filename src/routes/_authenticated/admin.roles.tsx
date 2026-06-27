import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listCustomRoles,
  listPermissionCatalog,
  listOrgMembers,
  createCustomRole,
  deleteCustomRole,
  toggleCustomRolePermission,
  assignCustomRole,
} from "@/lib/roles.functions";
import { PageHeader } from "@/components/AppShell";
import { CCButton, CCCard, CCInput, CCField, CCStatusPill } from "@/components/cc";
import { toast } from "sonner";
import { Check, Plus, Trash2, ShieldCheck, Users, KeyRound } from "lucide-react";
import { DUMMY_CUSTOM_ROLES, DUMMY_PERMISSION_CATALOG, DUMMY_ORG_MEMBERS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: ok } = await supabase.rpc("has_permission", {
      _user_id: data.user.id,
      _permission: "roles:assign",
    });
    if (!ok) throw redirect({ to: "/dashboard" });
  },
  component: RolesPage,
});

function RolesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomRoles);
  const catalogFn = useServerFn(listPermissionCatalog);
  const membersFn = useServerFn(listOrgMembers);
  const createFn = useServerFn(createCustomRole);
  const deleteFn = useServerFn(deleteCustomRole);
  const toggleFn = useServerFn(toggleCustomRolePermission);
  const assignFn = useServerFn(assignCustomRole);

  const rolesQ = useQuery({ queryKey: ["custom-roles"], queryFn: () => listFn() });
  const catalogQ = useQuery({ queryKey: ["permission-catalog"], queryFn: () => catalogFn() });
  const membersQ = useQuery({ queryKey: ["org-members"], queryFn: () => membersFn() });

  const apiRoles: any[] = rolesQ.data?.roles ?? [];
  const apiPerms: string[] = catalogQ.data?.permissions ?? [];
  const apiMembers: any[] = membersQ.data?.members ?? [];
  const usingDummy = apiRoles.length === 0;
  const roles: any[] = usingDummy ? DUMMY_CUSTOM_ROLES.roles : apiRoles;
  const allPerms: string[] = apiPerms.length > 0 ? apiPerms : DUMMY_PERMISSION_CATALOG;
  const members: any[] = apiMembers.length > 0 ? apiMembers : DUMMY_ORG_MEMBERS;
  const permsByRole = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    const source = usingDummy ? DUMMY_CUSTOM_ROLES.permissions : (rolesQ.data?.permissions ?? []);
    source.forEach((p: any) => {
      (m[p.role_id] ??= new Set()).add(p.permission);
    });
    return m;
  }, [rolesQ.data, usingDummy]);
  const usersByRole = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    const source = usingDummy ? DUMMY_CUSTOM_ROLES.assignments : (rolesQ.data?.assignments ?? []);
    source.forEach((a: any) => {
      (m[a.role_id] ??= new Set()).add(a.user_id);
    });
    return m;
  }, [rolesQ.data, usingDummy]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null;
  const selId = selected?.id ?? null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["custom-roles"] });

  const createMut = useMutation({
    mutationFn: (vars: { name: string; description: string }) =>
      createFn({ data: { name: vars.name, description: vars.description } }),
    onSuccess: (r) => { invalidate(); setSelectedId((r as any).id); toast.success("Role created"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create role"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { invalidate(); setSelectedId(null); toast.success("Role deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });
  const toggleMut = useMutation({
    mutationFn: (vars: { roleId: string; permission: string; granted: boolean }) =>
      toggleFn({ data: vars }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const assignMut = useMutation({
    mutationFn: (vars: { userId: string; roleId: string; assign: boolean }) =>
      assignFn({ data: vars }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  // Group perms by category prefix
  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    allPerms.forEach((p) => {
      const cat = p.split(":")[0] ?? "other";
      (g[cat] ??= []).push(p);
    });
    return g;
  }, [allPerms]);

  return (
    <>
      <PageHeader
        title="Roles & access"
        description="Design custom roles for your team — pick the exact permissions each role grants, then assign them to people."
      />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[320px_1fr]">
        {/* Roles column */}
        <div className="space-y-4">
          <CCCard className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--cc-ink-900)]">
              <Plus className="size-4" /> New role
            </div>
            <CCField label="Name">
              <CCInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Workforce Planner" />
            </CCField>
            <CCField label="Description">
              <CCInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this role does" />
            </CCField>
            <CCButton
              className="mt-2 w-full"
              disabled={!name.trim() || createMut.isPending}
              onClick={() => {
                createMut.mutate({ name: name.trim(), description: desc.trim() });
                setName(""); setDesc("");
              }}
            >
              Create role
            </CCButton>
          </CCCard>

          <CCCard className="p-0">
            <div className="px-4 py-3 border-b border-[color:var(--cc-ink-200)] text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">
              Custom roles ({roles.length})
            </div>
            <ul className="divide-y divide-[color:var(--cc-ink-100)]">
              {roles.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-[color:var(--cc-ink-500)]">
                  No custom roles yet. Create one to get started.
                </li>
              )}
              {roles.map((r) => {
                const pCount = permsByRole[r.id]?.size ?? 0;
                const uCount = usersByRole[r.id]?.size ?? 0;
                const active = r.id === selId;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={
                        "w-full text-left px-4 py-3 transition " +
                        (active
                          ? "bg-[color:var(--cc-brand-50)] border-l-2 border-[color:var(--cc-brand-500)]"
                          : "hover:bg-[color:var(--cc-ink-50)]")
                      }
                    >
                      <div className="text-sm font-medium text-[color:var(--cc-ink-900)] truncate">{r.name}</div>
                      {r.description && (
                        <div className="mt-0.5 text-xs text-[color:var(--cc-ink-500)] truncate">{r.description}</div>
                      )}
                      <div className="mt-1.5 flex gap-2 text-xs text-[color:var(--cc-ink-500)]">
                        <span className="inline-flex items-center gap-1"><KeyRound className="size-3" />{pCount}</span>
                        <span className="inline-flex items-center gap-1"><Users className="size-3" />{uCount}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CCCard>
        </div>

        {/* Detail column */}
        <div className="space-y-4 min-w-0">
          {!selected ? (
            <CCCard className="p-12 text-center text-sm text-[color:var(--cc-ink-500)]">
              <ShieldCheck className="mx-auto mb-3 size-8 text-[color:var(--cc-ink-300)]" />
              Select a role to manage its permissions and members, or create a new one.
            </CCCard>
          ) : (
            <>
              <CCCard className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-[color:var(--cc-ink-900)] truncate">{selected.name}</h2>
                    {selected.description && (
                      <p className="mt-1 text-sm text-[color:var(--cc-ink-500)]">{selected.description}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <CCStatusPill tone="info">{permsByRole[selected.id]?.size ?? 0} permissions</CCStatusPill>
                      <CCStatusPill tone="neutral">{usersByRole[selected.id]?.size ?? 0} members</CCStatusPill>
                    </div>
                  </div>
                  <CCButton
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete role "${selected.name}"? Members will lose its permissions.`)) {
                        deleteMut.mutate(selected.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" /> Delete
                  </CCButton>
                </div>
              </CCCard>

              {/* Permissions matrix */}
              <CCCard className="p-0">
                <div className="px-5 py-3 border-b border-[color:var(--cc-ink-200)] flex items-center gap-2">
                  <KeyRound className="size-4 text-[color:var(--cc-ink-500)]" />
                  <h3 className="text-sm font-semibold text-[color:var(--cc-ink-900)]">Permissions</h3>
                </div>
                <div className="p-5 space-y-5">
                  {Object.entries(grouped).map(([cat, perms]) => (
                    <div key={cat}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">
                        {cat}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {perms.map((perm) => {
                          const has = permsByRole[selected.id]?.has(perm) ?? false;
                          return (
                            <label
                              key={perm}
                              className={
                                "flex items-center gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer transition " +
                                (has
                                  ? "bg-[color:var(--cc-brand-50)] border-[color:var(--cc-brand-300)]"
                                  : "bg-[color:var(--cc-ink-50)] border-[color:var(--cc-ink-200)] hover:border-[color:var(--cc-ink-300)]")
                              }
                            >
                              <button
                                type="button"
                                onClick={() => toggleMut.mutate({ roleId: selected.id, permission: perm, granted: !has })}
                                className={
                                  "inline-flex size-5 items-center justify-center rounded border transition shrink-0 " +
                                  (has
                                    ? "bg-[color:var(--cc-success)] border-transparent text-white"
                                    : "bg-white border-[color:var(--cc-ink-300)]")
                                }
                              >
                                {has && <Check className="size-3" />}
                              </button>
                              <code className="font-mono text-[11px] truncate">{perm}</code>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CCCard>

              {/* Members */}
              <CCCard className="p-0">
                <div className="px-5 py-3 border-b border-[color:var(--cc-ink-200)] flex items-center gap-2">
                  <Users className="size-4 text-[color:var(--cc-ink-500)]" />
                  <h3 className="text-sm font-semibold text-[color:var(--cc-ink-900)]">Members</h3>
                </div>
                <ul className="divide-y divide-[color:var(--cc-ink-100)] max-h-[420px] overflow-y-auto">
                  {members.length === 0 && (
                    <li className="px-5 py-6 text-center text-sm text-[color:var(--cc-ink-500)]">No members.</li>
                  )}
                  {members.map((m) => {
                    const assigned = usersByRole[selected.id]?.has(m.id) ?? false;
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[color:var(--cc-ink-900)] truncate">
                            {m.full_name ?? m.username ?? "Unnamed"}
                          </div>
                          {m.username && <div className="text-xs text-[color:var(--cc-ink-500)] truncate">@{m.username}</div>}
                        </div>
                        <CCButton
                          variant={assigned ? "ghost" : "primary"}
                          onClick={() => assignMut.mutate({ userId: m.id, roleId: selected.id, assign: !assigned })}
                        >
                          {assigned ? "Remove" : "Assign"}
                        </CCButton>
                      </li>
                    );
                  })}
                </ul>
              </CCCard>
            </>
          )}
        </div>
      </div>
    </>
  );
}