import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listStaff,
  inviteStaff,
  updateStaff,
  suspendUser,
  liftSuspension,
  assignRole,
  revokeRole,
} from "@/lib/staff.functions";
import { PageHeader } from "@/components/AppShell";
import {
  CCButton, CCCard, CCStatusPill, CCInput, CCSelect, CCField,
  CCTable, CCThead, CCTh, CCTd, CCTr,
} from "@/components/cc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, ShieldOff, ShieldCheck, Mail, Phone, IdCard, Users, Clock, Shield } from "lucide-react";
import { DUMMY_STAFF } from "@/lib/dummy-data";

/** Ops Admin (or higher) only — gated client-side AND by every server fn. */
export const Route = createFileRoute("/_authenticated/staff/")({
  component: StaffPage,
});

const ROLES = ["agent", "team_leader", "supervisor", "ops_admin", "super_admin"] as const;

function StaffPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listStaff);
  const { data } = useQuery({ queryKey: ["staff"], queryFn: () => listFn() });
  const apiRows = data?.rows ?? [];
  const rows: any[] = apiRows.length > 0 ? apiRows : (DUMMY_STAFF as any);
  const [detailStaff, setDetailStaff] = useState<any | null>(null);

  return (
    <>
      <PageHeader
        title="Staff management"
        description="Invite, edit, suspend, and assign roles to team members."
        actions={<InviteDialog onDone={() => qc.invalidateQueries({ queryKey: ["staff"] })} />}
      />
      <div className="px-6 py-6">
        <div className="bg-white">
          <CCTable>
            <CCThead>
              <tr>
                <CCTh>Name</CCTh>
                <CCTh>Staff ID</CCTh>
                <CCTh>Roles</CCTh>
                <CCTh>Availability</CCTh>
                <CCTh>Status</CCTh>
                <CCTh className="text-right">Actions</CCTh>
              </tr>
            </CCThead>
            <tbody>
              {rows.map((s: any) => (
                <CCTr
                  key={s.id}
                  className="cursor-pointer hover:bg-[color:var(--cc-surface-alt,#f8fafc)] transition-colors"
                  onClick={() => setDetailStaff(s)}
                >
                  <CCTd>
                    <div className="font-medium">{s.full_name ?? "—"}</div>
                    <div className="text-xs text-[color:var(--cc-ink-500)]">{s.phone ?? ""}</div>
                  </CCTd>
                  <CCTd>{s.staff_id ?? "—"}</CCTd>
                  <CCTd>
                    <div className="flex flex-wrap gap-1">
                      {(s.roles ?? []).length === 0
                        ? <span className="text-xs text-[color:var(--cc-ink-500)]">none</span>
                        : s.roles.map((r: string) => (
                          <CCStatusPill key={r} tone={r === "super_admin" ? "danger" : r === "ops_admin" ? "warning" : r === "agent" ? "neutral" : "info"}>
                            {r.replace("_", " ")}
                          </CCStatusPill>
                        ))}
                    </div>
                  </CCTd>
                  <CCTd>
                    <CCStatusPill tone={s.availability?.status === "available" ? "success" : s.availability?.status === "on_call" ? "danger" : "neutral"} dot>
                      {s.availability?.status ?? "offline"}
                    </CCStatusPill>
                  </CCTd>
                  <CCTd>
                    {s.suspended
                      ? <CCStatusPill tone="danger">Suspended</CCStatusPill>
                      : <CCStatusPill tone="success">Active</CCStatusPill>}
                  </CCTd>
                  <CCTd className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ManageDialog staff={s} onDone={() => qc.invalidateQueries({ queryKey: ["staff"] })} />
                  </CCTd>
                </CCTr>
              ))}
            </tbody>
          </CCTable>
        </div>
      </div>
      <StaffDetailDialog
        staff={detailStaff}
        onClose={() => setDetailStaff(null)}
        onManage={() => { /* keep detail open; user can use row's Manage */ }}
      />
    </>
  );
}

function StaffDetailDialog({ staff, onClose }: { staff: any | null; onClose: () => void; onManage?: () => void }) {
  const open = !!staff;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{staff?.full_name ?? "Staff member"}</DialogTitle>
        </DialogHeader>
        {staff && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full bg-[color:var(--cc-brand-100,#e0e7ff)] text-[color:var(--cc-brand-700,#4338ca)] flex items-center justify-center text-xl font-semibold">
                {(staff.full_name ?? "?").split(" ").map((n: string) => n[0]).slice(0,2).join("")}
              </div>
              <div className="flex-1">
                <div className="text-lg font-semibold">{staff.full_name}</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {staff.suspended
                    ? <CCStatusPill tone="danger">Suspended</CCStatusPill>
                    : <CCStatusPill tone="success">Active</CCStatusPill>}
                  <CCStatusPill
                    tone={staff.availability?.status === "available" ? "success" : staff.availability?.status === "on_call" ? "danger" : "neutral"}
                    dot
                  >
                    {staff.availability?.status ?? "offline"}
                  </CCStatusPill>
                </div>
              </div>
            </div>

            <CCCard>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><IdCard className="size-4" /> Contact & identity</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)]">Staff ID</dt>
                  <dd className="mt-0.5 font-medium">{staff.staff_id ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)] flex items-center gap-1"><Phone className="size-3" /> Phone</dt>
                  <dd className="mt-0.5 font-medium">{staff.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)] flex items-center gap-1"><Mail className="size-3" /> Email</dt>
                  <dd className="mt-0.5 font-medium">{staff.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)] flex items-center gap-1"><Users className="size-3" /> Team</dt>
                  <dd className="mt-0.5 font-medium">{staff.team_id ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[color:var(--cc-ink-500)] flex items-center gap-1"><Clock className="size-3" /> Timezone</dt>
                  <dd className="mt-0.5 font-medium">{staff.timezone ?? "—"}</dd>
                </div>
              </dl>
            </CCCard>

            <CCCard>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="size-4" /> Roles</h4>
              <div className="flex flex-wrap gap-2">
                {(staff.roles ?? []).length === 0
                  ? <span className="text-sm text-[color:var(--cc-ink-500)]">No roles assigned</span>
                  : staff.roles.map((r: string) => (
                    <CCStatusPill key={r} tone={r === "super_admin" ? "danger" : r === "ops_admin" ? "warning" : r === "agent" ? "neutral" : "info"}>
                      {r.replace("_", " ")}
                    </CCStatusPill>
                  ))}
              </div>
            </CCCard>

            <CCCard>
              <h4 className="text-sm font-semibold mb-3">Availability</h4>
              <div className="text-sm text-[color:var(--cc-ink-700)]">
                Current status: <span className="font-medium">{staff.availability?.status ?? "offline"}</span>
                {staff.availability?.updated_at && (
                  <span className="text-[color:var(--cc-ink-500)]"> · updated {new Date(staff.availability.updated_at).toLocaleString()}</span>
                )}
              </div>
            </CCCard>

            <div className="flex justify-end">
              <CCButton variant="ghost" onClick={onClose}>Close</CCButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("agent");
  const inviteFn = useServerFn(inviteStaff);
  const mut = useMutation({
    mutationFn: (input: { email: string; fullName: string; role: string }) =>
      inviteFn({ data: input }),
    onSuccess: () => {
      toast.success("Invite sent");
      setOpen(false); setEmail(""); setName(""); setRole("agent");
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Invite failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CCButton><UserPlus className="size-4" /> Invite staff</CCButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite a new team member</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate({ email, fullName: name, role });
          }}
        >
          <CCField label="Full name"><CCInput required value={name} onChange={(e) => setName(e.target.value)} /></CCField>
          <CCField label="Work email"><CCInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></CCField>
          <CCField label="Starting role">
            <CCSelect value={role} onChange={(e) => setRole(e.target.value as any)}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </CCSelect>
          </CCField>
          <div className="flex justify-end gap-2 pt-2">
            <CCButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</CCButton>
            <CCButton type="submit" disabled={mut.isPending}>{mut.isPending ? "Sending…" : "Send invite"}</CCButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageDialog({ staff, onDone }: { staff: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(staff.full_name ?? "");
  const [staffId, setStaffId] = useState(staff.staff_id ?? "");
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [reason, setReason] = useState("");
  const updateFn = useServerFn(updateStaff);
  const suspendFn = useServerFn(suspendUser);
  const liftFn = useServerFn(liftSuspension);
  const assignFn = useServerFn(assignRole);
  const revokeFn = useServerFn(revokeRole);

  const saveProfile = useMutation({
    mutationFn: () => updateFn({ data: { id: staff.id, full_name: fullName, staff_id: staffId || null, phone: phone || null } }),
    onSuccess: () => { toast.success("Saved"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const suspend = useMutation({
    mutationFn: () => suspendFn({ data: { userId: staff.id, reason } }),
    onSuccess: () => { toast.success("Account suspended"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Suspension failed"),
  });
  const lift = useMutation({
    mutationFn: () => liftFn({ data: { userId: staff.id } }),
    onSuccess: () => { toast.success("Suspension lifted"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggleRole = useMutation({
    mutationFn: ({ role, on }: { role: string; on: boolean }) =>
      on ? assignFn({ data: { userId: staff.id, role } }) : revokeFn({ data: { userId: staff.id, role } }),
    onSuccess: () => { toast.success("Roles updated"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Role update failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <CCButton size="sm" variant="secondary">Manage</CCButton>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Manage {staff.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <CCCard>
            <h4 className="text-sm font-semibold mb-3">Profile</h4>
            <div className="grid grid-cols-2 gap-3">
              <CCField label="Full name"><CCInput value={fullName} onChange={(e) => setFullName(e.target.value)} /></CCField>
              <CCField label="Staff ID"><CCInput value={staffId} onChange={(e) => setStaffId(e.target.value)} /></CCField>
              <CCField label="Phone"><CCInput value={phone} onChange={(e) => setPhone(e.target.value)} /></CCField>
            </div>
            <div className="mt-3 flex justify-end">
              <CCButton size="sm" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>Save</CCButton>
            </div>
          </CCCard>

          <CCCard>
            <h4 className="text-sm font-semibold mb-3">Roles</h4>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const has = staff.roles.includes(r);
                return (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={has}
                      onChange={(e) => toggleRole.mutate({ role: r, on: e.target.checked })}
                    />
                    <span>{r.replace("_", " ")}</span>
                  </label>
                );
              })}
            </div>
          </CCCard>

          <CCCard>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              {staff.suspended ? <ShieldCheck className="size-4 text-emerald-600" /> : <ShieldOff className="size-4 text-rose-600" />}
              Account status
            </h4>
            {staff.suspended
              ? (
                <div className="space-y-3">
                  <p className="text-sm text-[color:var(--cc-ink-700)]">This account is currently suspended.</p>
                  <CCButton variant="success" size="sm" onClick={() => lift.mutate()} disabled={lift.isPending}>Lift suspension</CCButton>
                </div>
              )
              : (
                <div className="space-y-3">
                  <CCField label="Suspension reason">
                    <CCInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Policy violation, leave of absence…" />
                  </CCField>
                  <CCButton variant="danger" size="sm" disabled={!reason || suspend.isPending} onClick={() => suspend.mutate()}>
                    Suspend account
                  </CCButton>
                </div>
              )}
          </CCCard>
        </div>
      </DialogContent>
    </Dialog>
  );
}