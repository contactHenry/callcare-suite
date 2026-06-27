/**
 * Staff management server functions.
 *
 * All mutations require an `ops_admin` or higher (via `requirePermission`)
 * and emit an audit-log entry. Read endpoints require any signed-in user
 * but RLS narrows the result set per role.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission, audit } from "./permissions.functions";

const ROLE = z.enum([
  "agent",
  "team_leader",
  "supervisor",
  "ops_admin",
  "super_admin",
]);

export type StaffRow = {
  id: string;
  full_name: string | null;
  staff_id: string | null;
  phone: string | null;
  team_id: string | null;
  timezone: string | null;
  roles: string[];
  availability: { status: string; updated_at: string } | null;
  suspended: boolean;
};

/** List every staff member with their role + availability. Visible to all signed-in users. */
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const [{ data: profiles }, { data: roles }, { data: avail }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, staff_id, phone, team_id, timezone")
        .order("full_name", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("agent_availability").select("user_id, status, updated_at"),
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: suspensions } = await supabaseAdmin
      .from("account_suspensions")
      .select("user_id, lifted_at, ends_at");
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    const availByUser = new Map((avail ?? []).map((a: any) => [a.user_id, a]));
    const suspendedSet = new Set(
      (suspensions ?? [])
        .filter((s: any) => !s.lifted_at && (!s.ends_at || new Date(s.ends_at) > new Date()))
        .map((s: any) => s.user_id),
    );
    const rows: StaffRow[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      staff_id: p.staff_id,
      phone: p.phone,
      team_id: p.team_id,
      timezone: p.timezone,
      roles: rolesByUser.get(p.id) ?? [],
      availability: availByUser.get(p.id) ?? null,
      suspended: suspendedSet.has(p.id),
    }));
    return { rows };
  });

/** Invite a new staff member by email. Triggers Supabase invite email. */
export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requirePermission("staff.create")])
  .inputValidator((data: { email: string; fullName: string; role?: string }) =>
    z
      .object({
        email: z.string().trim().email().max(255).toLowerCase(),
        fullName: z.string().trim().min(1).max(120),
        role: ROLE.optional().default("agent"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Invite via Supabase Auth Admin (sends magic-link email).
    const { data: invite, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { data: { full_name: data.fullName } },
    );
    if (error || !invite?.user) {
      throw new Response(error?.message ?? "Invite failed", { status: 400 });
    }
    // The handle_new_user trigger has already seeded profile + agent role.
    // Upgrade role if the inviter asked for something higher than agent.
    if (data.role && data.role !== "agent") {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: invite.user.id, role: data.role });
    }
    await audit(supabase, userId, "staff.invite", "user", invite.user.id, {
      email: data.email,
      role: data.role,
    });
    return { id: invite.user.id };
  });

/** Update a staff member's editable fields. */
export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requirePermission("staff.update")])
  .inputValidator(
    (data: {
      id: string;
      full_name?: string;
      staff_id?: string | null;
      phone?: string | null;
      team_id?: string | null;
      timezone?: string | null;
      working_hours?: Record<string, unknown> | null;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          full_name: z.string().trim().min(1).max(120).optional(),
          staff_id: z.string().trim().max(40).nullable().optional(),
          phone: z.string().trim().max(40).nullable().optional(),
          team_id: z.string().uuid().nullable().optional(),
          timezone: z.string().trim().max(60).nullable().optional(),
          working_hours: z.record(z.string(), z.unknown()).nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { id, ...patch } = data;
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "staff.update", "user", id, patch as Record<string, unknown>);
    return { ok: true };
  });

/** Suspend an account. Blocks the user from signing in (auth-side) and from
 * privileged server fns (via requirePermission). */
export const suspendUser = createServerFn({ method: "POST" })
  .middleware([requirePermission("staff.suspend")])
  .inputValidator((data: { userId: string; reason: string; endsAt?: string | null }) =>
    z
      .object({
        userId: z.string().uuid(),
        reason: z.string().trim().min(1).max(500),
        endsAt: z.string().datetime().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase.from("account_suspensions").insert({
      user_id: data.userId,
      reason: data.reason,
      ends_at: data.endsAt ?? null,
      created_by: userId,
    });
    if (error) throw new Response(error.message, { status: 400 });
    // Optionally ban via Auth Admin (24h or until ends_at).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const banDuration = data.endsAt
      ? `${Math.max(60, Math.floor((new Date(data.endsAt).getTime() - Date.now()) / 1000))}s`
      : "8760h"; // 1 year
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: banDuration });
    await audit(supabase, userId, "staff.suspend", "user", data.userId, {
      reason: data.reason,
      endsAt: data.endsAt ?? null,
    });
    return { ok: true };
  });

/** Lift the active suspension for a user. */
export const liftSuspension = createServerFn({ method: "POST" })
  .middleware([requirePermission("staff.suspend")])
  .inputValidator((data: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("account_suspensions")
      .update({ lifted_at: new Date().toISOString(), lifted_by: userId })
      .eq("user_id", data.userId)
      .is("lifted_at", null);
    if (error) throw new Response(error.message, { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    await audit(supabase, userId, "staff.lift_suspension", "user", data.userId, {});
    return { ok: true };
  });

/** Grant a role to a user. */
export const assignRole = createServerFn({ method: "POST" })
  .middleware([requirePermission("staff.assign_role")])
  .inputValidator((data: { userId: string; role: string }) =>
    z.object({ userId: z.string().uuid(), role: ROLE }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    // Only super_admin can mint another super_admin.
    if (data.role === "super_admin") {
      const { data: ok } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "super_admin",
      });
      if (!ok) throw new Response("Only super admins can grant super_admin", { status: 403 });
    }
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "role.assign", "user", data.userId, { role: data.role });
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requirePermission("staff.assign_role")])
  .inputValidator((data: { userId: string; role: string }) =>
    z.object({ userId: z.string().uuid(), role: ROLE }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (data.userId === userId && data.role === "super_admin") {
      throw new Response("Super admins cannot self-demote", { status: 400 });
    }
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "role.revoke", "user", data.userId, { role: data.role });
    return { ok: true };
  });

/** Set the caller's own availability status. */
export const setMyAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status: string; note?: string }) =>
    z
      .object({
        status: z.enum([
          "available",
          "busy",
          "on_call",
          "after_call_work",
          "break",
          "training",
          "offline",
        ]),
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("agent_availability")
      .upsert(
        { user_id: userId, status: data.status, note: data.note ?? null, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });