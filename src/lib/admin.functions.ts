/**
 * Super-admin permission catalogue management.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission, audit } from "./permissions.functions";

const ROLE = z.enum(["agent", "team_leader", "supervisor", "ops_admin", "super_admin"]);

/** Anyone signed in can read the permission catalogue (sidebar gating reads it). */
export const listPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, permission")
      .order("permission", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

/** Grant or revoke a single role/permission cell. Super-admin only. */
export const togglePermission = createServerFn({ method: "POST" })
  .middleware([requirePermission("permissions.manage")])
  .inputValidator((data: { role: string; permission: string; granted: boolean }) =>
    z
      .object({
        role: ROLE,
        permission: z.string().trim().min(1).max(80),
        granted: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (data.granted) {
      const { error } = await supabase
        .from("role_permissions")
        .upsert({ role: data.role, permission: data.permission }, { onConflict: "role,permission" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role", data.role)
        .eq("permission", data.permission);
      if (error) throw new Error(error.message);
    }
    await audit(supabase, userId, "permission.toggle", "role_permission", `${data.role}:${data.permission}`, {
      granted: data.granted,
    });
    return { ok: true };
  });

/** Ops Admin audit log feed. */
export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { actorId?: string; action?: string; from?: string; to?: string; limit?: number } | undefined) =>
    z.object({
      actorId: z.string().uuid().optional(),
      action: z.string().trim().max(80).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    try {
      const { data: allowed } = await supabase.rpc("has_permission", {
        _user_id: (context as any).userId, _permission: "audit.read",
      });
      if (!allowed) return { rows: [] };
    } catch { return { rows: [] }; }
    let q = supabase
      .from("audit_log")
      .select("id, actor_id, action, target_type, target_id, diff, ip, at")
      .order("at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.from) q = q.gte("at", data.from);
    if (data.to) q = q.lte("at", data.to);
    const { data: rows, error } = await q;
    if (error) { console.error("audit_log query failed:", error.message); return { rows: [] }; }
    return { rows: rows ?? [] };
  });

/* ---------------------------------------------------------------- */
/* Organisation compliance settings (retention, contact hours)       */
/* ---------------------------------------------------------------- */

export const getOrgCompliance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (!prof?.organization_id) return { org: null };
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, region, recording_retention_days, record_retention_days, audit_retention_days, contact_hours_start, contact_hours_end, contact_hours_timezone, contact_days")
      .eq("id", prof.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { org: data };
  });

export const updateOrgCompliance = createServerFn({ method: "POST" })
  .middleware([requirePermission("permissions.manage")])
  .inputValidator((d: {
    region?: string;
    recordingRetentionDays?: number;
    recordRetentionDays?: number;
    auditRetentionDays?: number;
    contactHoursStart?: string;
    contactHoursEnd?: string;
    contactHoursTimezone?: string;
    contactDays?: number[];
  }) =>
    z.object({
      region: z.string().trim().max(60).optional(),
      recordingRetentionDays: z.number().int().min(1).max(36500).optional(),
      recordRetentionDays: z.number().int().min(1).max(36500).optional(),
      auditRetentionDays: z.number().int().min(30).max(36500).optional(),
      contactHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      contactHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      contactHoursTimezone: z.string().trim().max(60).optional(),
      contactDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (!prof?.organization_id) throw new Error("No organisation");
    const patch: Record<string, unknown> = {};
    if (data.region !== undefined) patch.region = data.region;
    if (data.recordingRetentionDays !== undefined) patch.recording_retention_days = data.recordingRetentionDays;
    if (data.recordRetentionDays !== undefined) patch.record_retention_days = data.recordRetentionDays;
    if (data.auditRetentionDays !== undefined) patch.audit_retention_days = data.auditRetentionDays;
    if (data.contactHoursStart !== undefined) patch.contact_hours_start = data.contactHoursStart;
    if (data.contactHoursEnd !== undefined) patch.contact_hours_end = data.contactHoursEnd;
    if (data.contactHoursTimezone !== undefined) patch.contact_hours_timezone = data.contactHoursTimezone;
    if (data.contactDays !== undefined) patch.contact_days = data.contactDays;
    const { error } = await supabase.from("organizations").update(patch).eq("id", prof.organization_id);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "org.compliance_update", "organization", prof.organization_id, patch);
    return { ok: true };
  });