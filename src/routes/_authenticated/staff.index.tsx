import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { UserPlus, ShieldOff, ShieldCheck } from "lucide-react";

/** Ops Admin (or higher) only — gated client-side AND by every server fn. */
export const Route = createFileRoute("/_authenticated/staff/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const ok = (roles ?? []).some((r) => r.role === "ops_admin" || r.role === "super_admin");
    if (!ok) throw redirect({ to: "/dashboard" });
  },
  component: StaffPage,
});

const ROLES = ["agent", "team_leader", "supervisor", "ops_admin", "super_admin"] as const;

function StaffPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listStaff);
  const { data } = useQuery({ queryKey: ["staff"], queryFn: () => listFn() });
  const rows = data?.rows ?? [];

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
              {rows.map((s) => (
                <CCTr key={s.id}>
                  <CCTd>
                    <div className="font-medium">{s.full_name ?? "—"}</div>
                    <div className="text-xs text-[color:var(--cc-ink-500)]">{s.phone ?? ""}</div>
                  </CCTd>
                  <CCTd>{s.staff_id ?? "—"}</CCTd>
                  <CCTd>
                    <div className="flex flex-wrap gap-1">
                      {s.roles.length === 0
                        ? <span className="text-xs text-[color:var(--cc-ink-500)]">none</span>
                        : s.roles.map((r) => (
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
                  <CCTd className="text-right">
                    <ManageDialog staff={s} onDone={() => qc.invalidateQueries({ queryKey: ["staff"] })} />
                  </CCTd>
                </CCTr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[color:var(--cc-ink-500)]">No staff yet — invite your first agent.</td></tr>
              )}
            </tbody>
          </CCTable>
        </div>
      </div>
    </>
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