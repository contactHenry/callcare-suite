/**
 * Custom role management — admins can define org-specific roles, assign
 * permissions to them, and grant them to users alongside the built-in
 * 5-tier hierarchy. has_permission() unions system + custom grants.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission, audit } from "./permissions.functions";

/** Anyone signed in may read custom roles (so sidebars / pickers can render). */
export const listCustomRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data: roles, error } = await supabase
      .from("custom_roles")
      .select("id, name, description, color, organization_id, created_at")
      .order("name");
    if (error) throw new Response(error.message, { status: 400 });
    const { data: perms } = await supabase
      .from("custom_role_permissions")
      .select("role_id, permission");
    const { data: assignments } = await supabase
      .from("user_custom_role_assignments")
      .select("role_id, user_id");
    return {
      roles: roles ?? [],
      permissions: perms ?? [],
      assignments: assignments ?? [],
    };
  });

/** Master permission catalogue (union of system-known permissions). */
export const listPermissionCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase.rpc("list_permission_catalog");
    if (error) throw new Response(error.message, { status: 400 });
    return { permissions: (data ?? []).map((r: any) => r.permission as string) };
  });

/** Org members for the assignment picker. */
export const listOrgMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .order("full_name");
    if (error) throw new Response(error.message, { status: 400 });
    return { members: data ?? [] };
  });

export const createCustomRole = createServerFn({ method: "POST" })
  .middleware([requirePermission("roles:assign")])
  .inputValidator((d: { name: string; description?: string; color?: string }) =>
    z
      .object({
        name: z.string().trim().min(2).max(50),
        description: z.string().max(280).optional(),
        color: z.string().max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    const { data: row, error } = await supabase
      .from("custom_roles")
      .insert({
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? null,
        organization_id: profile?.organization_id ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "custom_role.create", "custom_role", row.id, { name: data.name });
    return { id: row.id as string };
  });

export const updateCustomRole = createServerFn({ method: "POST" })
  .middleware([requirePermission("roles:assign")])
  .inputValidator((d: { id: string; name?: string; description?: string; color?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(2).max(50).optional(),
        description: z.string().max(280).nullable().optional(),
        color: z.string().max(20).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.color !== undefined) patch.color = data.color;
    const { error } = await supabase.from("custom_roles").update(patch).eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "custom_role.update", "custom_role", data.id, patch);
    return { ok: true };
  });

export const deleteCustomRole = createServerFn({ method: "POST" })
  .middleware([requirePermission("roles:assign")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase.from("custom_roles").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    await audit(supabase, userId, "custom_role.delete", "custom_role", data.id, {});
    return { ok: true };
  });

export const toggleCustomRolePermission = createServerFn({ method: "POST" })
  .middleware([requirePermission("roles:assign")])
  .inputValidator((d: { roleId: string; permission: string; granted: boolean }) =>
    z
      .object({
        roleId: z.string().uuid(),
        permission: z.string().trim().min(1).max(80),
        granted: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (data.granted) {
      const { error } = await supabase
        .from("custom_role_permissions")
        .upsert({ role_id: data.roleId, permission: data.permission }, { onConflict: "role_id,permission" });
      if (error) throw new Response(error.message, { status: 400 });
    } else {
      const { error } = await supabase
        .from("custom_role_permissions")
        .delete()
        .eq("role_id", data.roleId)
        .eq("permission", data.permission);
      if (error) throw new Response(error.message, { status: 400 });
    }
    await audit(supabase, userId, "custom_role.toggle_permission", "custom_role", data.roleId, {
      permission: data.permission,
      granted: data.granted,
    });
    return { ok: true };
  });

export const assignCustomRole = createServerFn({ method: "POST" })
  .middleware([requirePermission("roles:assign")])
  .inputValidator((d: { userId: string; roleId: string; assign: boolean }) =>
    z
      .object({
        userId: z.string().uuid(),
        roleId: z.string().uuid(),
        assign: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    if (data.assign) {
      const { error } = await supabase
        .from("user_custom_role_assignments")
        .upsert(
          { user_id: data.userId, role_id: data.roleId, assigned_by: userId },
          { onConflict: "user_id,role_id" },
        );
      if (error) throw new Response(error.message, { status: 400 });
    } else {
      const { error } = await supabase
        .from("user_custom_role_assignments")
        .delete()
        .eq("user_id", data.userId)
        .eq("role_id", data.roleId);
      if (error) throw new Response(error.message, { status: 400 });
    }
    await audit(supabase, userId, "custom_role.assign", "custom_role", data.roleId, {
      user: data.userId,
      assign: data.assign,
    });
    return { ok: true };
  });