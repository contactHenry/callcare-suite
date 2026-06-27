/**
 * Permission-aware server-fn middleware + security audit helpers.
 * All write operations go through `record_audit` so Ops Admins can review
 * sensitive actions later (role changes, suspensions, etc.).
 */
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Factory: require the calling user to hold `permission` (additively, via
 * role hierarchy). 403s otherwise. Composes with `requireSupabaseAuth`.
 */
export function requirePermission(permission: string) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const { supabase, userId } = context as { supabase: any; userId: string };
      const { data, error } = await supabase.rpc("has_permission", {
        _user_id: userId,
        _permission: permission,
      });
      if (error) throw new Response(`Permission check failed: ${error.message}`, { status: 500 });
      if (!data) throw new Response(`Forbidden: requires ${permission}`, { status: 403 });
      // Suspension check — block any privileged action by suspended accounts.
      const { data: suspended } = await supabase.rpc("is_account_suspended", { _user_id: userId });
      if (suspended) throw new Response("Account suspended", { status: 403 });
      return next();
    });
}

/** Record a structured audit entry from a server fn. */
export async function audit(
  supabase: any,
  actor: string,
  action: string,
  targetType: string,
  targetId: string,
  diff: Record<string, unknown> = {},
) {
  const ip = (() => {
    try { return getRequestIP({ xForwardedFor: true }); } catch { return null; }
  })();
  const ua = (() => {
    try { return getRequestHeader("user-agent") ?? null; } catch { return null; }
  })();
  await supabase.rpc("record_audit", {
    _actor: actor,
    _org: null,
    _action: action,
    _target_type: targetType,
    _target_id: targetId,
    _diff: diff,
    _ip: ip,
    _ua: ua,
  });
}

/* ------------------------------------------------------------------ */
/* Security event recorders (called from the auth UI)                  */
/* ------------------------------------------------------------------ */

/** Record a successful sign-in. Service role bypasses RLS to write the row. */
export const recordLoginEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { device?: string } | undefined) =>
    z.object({ device: z.string().max(200).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    let ip: string | null = null;
    let ua: string | null = null;
    try { ip = getRequestIP({ xForwardedFor: true }); } catch {}
    try { ua = getRequestHeader("user-agent") ?? null; } catch {}
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("login_history").insert({
      user_id: userId,
      ip,
      user_agent: ua,
      device_name: data.device ?? null,
      successful: true,
    });
    return { ok: true };
  });

/** Record a failed sign-in attempt for an email (lockout monitoring). */
export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; reason?: string }) =>
    z.object({
      email: z.string().email().max(255).toLowerCase(),
      reason: z.string().max(200).optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    let ip: string | null = null;
    try { ip = getRequestIP({ xForwardedFor: true }); } catch {}
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("failed_login_attempts").insert({
      email: data.email,
      ip,
      reason: data.reason ?? null,
    });
    // 5 failures in 15 minutes = lockout signal returned to client (account
    // freeze itself is enforced via `account_suspensions` by an Ops Admin).
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("failed_login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", data.email)
      .gte("attempted_at", since);
    return { failures: count ?? 0, lockedOut: (count ?? 0) >= 5 };
  });

/** Cheap lockout pre-check before submitting credentials. */
export const checkLockout = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) =>
    z.object({ email: z.string().email().max(255).toLowerCase() }).parse(data),
  )
  .handler(async ({ data }) => {
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("failed_login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", data.email)
      .gte("attempted_at", since);
    return { lockedOut: (count ?? 0) >= 5, failures: count ?? 0 };
  });