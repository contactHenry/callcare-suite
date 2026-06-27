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
    if (error) throw new Response(error.message, { status: 400 });
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
      if (error) throw new Response(error.message, { status: 400 });
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role", data.role)
        .eq("permission", data.permission);
      if (error) throw new Response(error.message, { status: 400 });
    }
    await audit(supabase, userId, "permission.toggle", "role_permission", `${data.role}:${data.permission}`, {
      granted: data.granted,
    });
    return { ok: true };
  });

/** Ops Admin audit log feed. */
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requirePermission("audit.read")])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, actor_id, action, target_type, target_id, diff, ip, at")
      .order("at", { ascending: false })
      .limit(200);
    if (error) throw new Response(error.message, { status: 400 });
    return { rows: data ?? [] };
  });