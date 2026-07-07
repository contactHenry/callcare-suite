import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
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
import { Check, Plus, Trash2, ShieldCheck, Users, KeyRound, Search, X, ChevronDown, Shield } from "lucide-react";
import { DUMMY_CUSTOM_ROLES, DUMMY_PERMISSION_CATALOG, DUMMY_ORG_MEMBERS } from "@/lib/dummy-data";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesPage,
});

// Human-friendly labels for permission categories and actions.
const CATEGORY_META: Record<string, { label: string; hint: string }> = {
  calls:        { label: "Calls",              hint: "Place, view and export call activity" },
  clients:      { label: "Clients & contacts", hint: "Access to client records and exports" },
  tasks:        { label: "Tasks & follow-ups", hint: "Create, assign and update tasks" },
  scripts:      { label: "Call scripts",       hint: "Read, edit and approve call scripts" },
  qa:           { label: "Quality assurance",  hint: "Review, moderate and manage scorecards" },
  monitoring:   { label: "Live monitoring",    hint: "Listen, whisper, barge or take over calls" },
  complaints:   { label: "Complaints",         hint: "Assign and resolve complaints" },
  approvals:    { label: "Approvals",          hint: "Review pending change requests" },
  staff:        { label: "Staff management",   hint: "Invite, suspend and view staff" },
  roles:        { label: "Roles",              hint: "Assign roles to users" },
  permissions:  { label: "Permissions",        hint: "Change permission definitions" },
  integrations: { label: "Integrations",       hint: "Manage third-party integrations" },
  telephony:    { label: "Telephony",          hint: "Configure phone providers" },
  compliance:   { label: "Compliance",         hint: "Review compliance and DSAR requests" },
  reports:      { label: "Reports",            hint: "Export reports and analytics" },
  audit:        { label: "Audit",              hint: "Export audit trails" },
  org:          { label: "Organization",       hint: "Configure org-level settings" },
  billing:      { label: "Billing",            hint: "Manage billing and invoices" },
  attendance:   { label: "Attendance",         hint: "Manage shifts and punches" },
  other:        { label: "Other",              hint: "Miscellaneous permissions" },
};

function humanizeAction(perm: string): string {
  const [, action = ""] = perm.split(":");
  return action
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

// Built-in system tiers — read-only summary above custom roles.
const SYSTEM_TIERS = [
  { key: "agent",        label: "Agent",        hint: "Handles calls, updates their own contacts and tasks." },
  { key: "team_leader",  label: "Team Leader",  hint: "Manages their team, assigns work, reviews QA." },
  { key: "supervisor",   label: "Supervisor",   hint: "Cross-team oversight, monitoring and approvals." },
  { key: "ops_admin",    label: "Ops Admin",    hint: "Full operational control, staff and role admin." },
  { key: "super_admin",  label: "Super Admin",  hint: "Everything, including org and billing." },
] as const;

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
  const [showCreate, setShowCreate] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null;
  const selId = selected?.id ?? null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["custom-roles"] });

  const createMut = useMutation({
    mutationFn: (vars: { name: string; description: string }) =>
      createFn({ data: { name: vars.name, description: vars.description } }),
    onSuccess: (r) => { invalidate(); setSelectedId((r as any).id); setShowCreate(false); toast.success("Role created"); },
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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isDemo = (id?: string | null) => !id || !UUID_RE.test(id);

  // Group perms by category prefix
  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    allPerms.forEach((p) => {
      const cat = p.split(":")[0] ?? "other";
      (g[cat] ??= []).push(p);
    });
    return g;
  }, [allPerms]);

  const filteredRoles = useMemo(
    () => roles.filter((r) => (r.name ?? "").toLowerCase().includes(roleSearch.toLowerCase())),
    [roles, roleSearch],
  );
  const filteredMembers = useMemo(
    () => members.filter((m) => {
      const q = memberSearch.toLowerCase();
      return !q
        || (m.full_name ?? "").toLowerCase().includes(q)
        || (m.username ?? "").toLowerCase().includes(q);
    }),
    [members, memberSearch],
  );

  const toggleAllInCategory = (perms: string[], grant: boolean) => {
    if (!selected) return;
    if (isDemo(selected.id)) {
      toast.info("Demo role — create a real role to edit permissions.");
      return;
    }
    const current = permsByRole[selected.id] ?? new Set<string>();
    perms.forEach((p) => {
      const has = current.has(p);
      if (grant && !has) toggleMut.mutate({ roleId: selected.id, permission: p, granted: true });
      if (!grant && has) toggleMut.mutate({ roleId: selected.id, permission: p, granted: false });
    });
  };

  return (
    <>
      <PageHeader
        title="Roles & access"
        description="Manage who can do what. Assign built-in tiers, or create a custom role with the exact permissions you want."
        actions={
          <CCButton onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> New role
          </CCButton>
        }
      />

      <div className="px-6 py-6 space-y-6">
        {/* Built-in tiers overview */}
        <CCCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="size-4 text-[color:var(--cc-ink-500)]" />
            <h3 className="text-sm font-semibold text-[color:var(--cc-ink-900)]">Built-in access tiers</h3>
            <span className="text-xs text-[color:var(--cc-ink-500)]">— assigned from a staff member's profile</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SYSTEM_TIERS.map((t, i) => (
              <div
                key={t.key}
                className="rounded-md border border-[color:var(--cc-ink-200)] bg-[color:var(--cc-ink-50)] p-3"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--cc-ink-900)]">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color:var(--cc-ink-900)] text-[10px] text-white">
                    {i + 1}
                  </span>
                  {t.label}
                </div>
                <p className="mt-1 text-xs text-[color:var(--cc-ink-500)] leading-snug">{t.hint}</p>
              </div>
            ))}
          </div>
        </CCCard>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Roles column */}
          <CCCard className="p-0">
            <div className="px-4 py-3 border-b border-[color:var(--cc-ink-200)] flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cc-ink-500)]">
                Custom roles ({roles.length})
              </div>
            </div>
            <div className="px-4 py-3 border-b border-[color:var(--cc-ink-100)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[color:var(--cc-ink-400)]" />
                <CCInput
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Search roles…"
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            <ul className="divide-y divide-[color:var(--cc-ink-100)] max-h-[560px] overflow-y-auto">
              {filteredRoles.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-[color:var(--cc-ink-500)]">
                  No custom roles.{" "}
                  <button
                    className="text-[color:var(--cc-brand-600)] underline"
                    onClick={() => setShowCreate(true)}
                  >
                    Create one
                  </button>
                  .
                </li>
              )}
              {filteredRoles.map((r) => {
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
                          : "hover:bg-[color:var(--cc-ink-50)] border-l-2 border-transparent")
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

          {/* Detail column */}
          <div className="space-y-4 min-w-0">
            {!selected ? (
              <CCCard className="p-12 text-center text-sm text-[color:var(--cc-ink-500)]">
                <ShieldCheck className="mx-auto mb-3 size-8 text-[color:var(--cc-ink-300)]" />
                Pick a role on the left, or{" "}
                <button className="text-[color:var(--cc-brand-600)] underline" onClick={() => setShowCreate(true)}>
                  create a new one
                </button>.
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

                {/* Permissions — grouped, collapsible, human labels */}
                <CCCard className="p-0">
                  <div className="px-5 py-3 border-b border-[color:var(--cc-ink-200)] flex items-center gap-2">
                    <KeyRound className="size-4 text-[color:var(--cc-ink-500)]" />
                    <h3 className="text-sm font-semibold text-[color:var(--cc-ink-900)]">Permissions</h3>
                    <span className="text-xs text-[color:var(--cc-ink-500)] ml-1">
                      — click a category to expand, tick actions to grant
                    </span>
                  </div>
                  <ul className="divide-y divide-[color:var(--cc-ink-100)]">
                    {Object.entries(grouped).map(([cat, perms]) => {
                      const meta = CATEGORY_META[cat] ?? { label: cat, hint: "" };
                      const granted = perms.filter((p) => permsByRole[selected.id]?.has(p)).length;
                      const allOn = granted === perms.length;
                      const isOpen = openCategories[cat] ?? granted > 0;
                      return (
                        <li key={cat}>
                          <div className="flex items-center gap-3 px-5 py-3">
                            <button
                              type="button"
                              onClick={() => setOpenCategories((s) => ({ ...s, [cat]: !isOpen }))}
                              className="flex flex-1 items-center gap-3 text-left"
                            >
                              <ChevronDown
                                className={"size-4 text-[color:var(--cc-ink-500)] transition " + (isOpen ? "" : "-rotate-90")}
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-[color:var(--cc-ink-900)]">{meta.label}</div>
                                <div className="text-xs text-[color:var(--cc-ink-500)] truncate">{meta.hint}</div>
                              </div>
                            </button>
                            <span className="text-xs tabular-nums text-[color:var(--cc-ink-500)] shrink-0">
                              {granted}/{perms.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleAllInCategory(perms, !allOn)}
                              className="text-xs font-medium text-[color:var(--cc-brand-600)] hover:underline shrink-0"
                            >
                              {allOn ? "Revoke all" : "Grant all"}
                            </button>
                          </div>
                          {isOpen && (
                            <div className="grid gap-2 sm:grid-cols-2 px-5 pb-4">
                              {perms.map((perm) => {
                                const has = permsByRole[selected.id]?.has(perm) ?? false;
                                return (
                                  <button
                                    key={perm}
                                    type="button"
                                    onClick={() => {
                                      if (isDemo(selected.id)) {
                                        toast.info("Demo role — create a real role to edit permissions.");
                                        return;
                                      }
                                      toggleMut.mutate({ roleId: selected.id, permission: perm, granted: !has });
                                    }}
                                    className={
                                      "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition " +
                                      (has
                                        ? "bg-[color:var(--cc-brand-50)] border-[color:var(--cc-brand-300)]"
                                        : "bg-white border-[color:var(--cc-ink-200)] hover:border-[color:var(--cc-ink-300)]")
                                    }
                                  >
                                    <span
                                      className={
                                        "inline-flex size-4 items-center justify-center rounded border transition shrink-0 " +
                                        (has
                                          ? "bg-[color:var(--cc-success)] border-transparent text-white"
                                          : "bg-white border-[color:var(--cc-ink-300)]")
                                      }
                                    >
                                      {has && <Check className="size-3" />}
                                    </span>
                                    <span className="text-sm text-[color:var(--cc-ink-900)] truncate">{humanizeAction(perm)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CCCard>

                {/* Members with search + checkbox */}
                <CCCard className="p-0">
                  <div className="px-5 py-3 border-b border-[color:var(--cc-ink-200)] flex items-center gap-2">
                    <Users className="size-4 text-[color:var(--cc-ink-500)]" />
                    <h3 className="text-sm font-semibold text-[color:var(--cc-ink-900)]">Members</h3>
                    <span className="text-xs text-[color:var(--cc-ink-500)] ml-1">
                      — tick to assign or remove this role
                    </span>
                  </div>
                  <div className="px-5 py-3 border-b border-[color:var(--cc-ink-100)]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[color:var(--cc-ink-400)]" />
                      <CCInput
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search staff by name or username…"
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
                  </div>
                  <ul className="divide-y divide-[color:var(--cc-ink-100)] max-h-[420px] overflow-y-auto">
                    {filteredMembers.length === 0 && (
                      <li className="px-5 py-6 text-center text-sm text-[color:var(--cc-ink-500)]">No staff match.</li>
                    )}
                    {filteredMembers.map((m) => {
                      const assigned = usersByRole[selected.id]?.has(m.id) ?? false;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isDemo(selected.id) || isDemo(m.id)) {
                                toast.info("Demo data — assignments need a real role and member.");
                                return;
                              }
                              assignMut.mutate({ userId: m.id, roleId: selected.id, assign: !assigned });
                            }}
                            className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[color:var(--cc-ink-50)] transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={
                                  "inline-flex size-5 items-center justify-center rounded border shrink-0 transition " +
                                  (assigned
                                    ? "bg-[color:var(--cc-success)] border-transparent text-white"
                                    : "bg-white border-[color:var(--cc-ink-300)]")
                                }
                              >
                                {assigned && <Check className="size-3" />}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-[color:var(--cc-ink-900)] truncate">
                                  {m.full_name ?? m.username ?? "Unnamed"}
                                </div>
                                {m.username && <div className="text-xs text-[color:var(--cc-ink-500)] truncate">@{m.username}</div>}
                              </div>
                            </div>
                            {assigned && <CCStatusPill tone="success">Assigned</CCStatusPill>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </CCCard>
              </>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateRoleDialog
          onClose={() => setShowCreate(false)}
          onCreate={(name, description) => createMut.mutate({ name, description })}
          isPending={createMut.isPending}
        />
      )}
    </>
  );
}

function CreateRoleDialog({
  onClose, onCreate, isPending,
}: { onClose: () => void; onCreate: (name: string, description: string) => void; isPending: boolean }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CCCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--cc-ink-900)]">
              <Plus className="size-4" /> New role
            </div>
            <button onClick={onClose} className="text-[color:var(--cc-ink-500)] hover:text-[color:var(--cc-ink-900)]">
              <X className="size-4" />
            </button>
          </div>
          <CCField label="Role name">
            <CCInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Workforce Planner" />
          </CCField>
          <CCField label="Description" hint="Optional — a short summary of what this role does">
            <CCInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Schedules shifts, manages exceptions…" />
          </CCField>
          <div className="flex justify-end gap-2">
            <CCButton variant="ghost" onClick={onClose}>Cancel</CCButton>
            <CCButton
              disabled={!name.trim() || isPending}
              onClick={() => onCreate(name.trim(), desc.trim())}
            >
              Create role
            </CCButton>
          </div>
        </CCCard>
      </div>
    </div>
  );
}