/**
 * Permission-aware server-fn middleware + security audit helpers.
 * All write operations go through `record_audit` so Ops Admins can review
 * sensitive actions later (role changes, suspensions, etc.).
 */
import { createMiddleware, createServerFn } from "@tanstack/react-start";
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
      if (error) throw new Error(`Permission check failed: ${error.message}`);
      if (!data) throw new Error(`Forbidden: requires ${permission}`);
      // Suspension check — block any privileged action by suspended accounts.
      const { data: suspended } = await supabase.rpc("is_account_suspended", { _user_id: userId });
      if (suspended) throw new Error("Account suspended");
      return next();
    });
}

/**
 * Record a structured audit entry from a server fn.
 *
 * IP/UA capture intentionally lives in dedicated security recorders
 * below — pulling `@tanstack/react-start/server` here would break the
 * import-protection boundary because this module is reachable from
 * client-bundled routes via several `*.functions.ts` consumers.
 */
export async function audit(
  supabase: any,
  actor: string,
  action: string,
  targetType: string,
  targetId: string,
  diff: Record<string, unknown> = {},
) {
  await supabase.rpc("record_audit", {
    _actor: actor,
    _org: null,
    _action: action,
    _target_type: targetType,
    _target_id: targetId,
    _diff: diff,
    _ip: null,
    _ua: null,
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
    const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
    let ip: string | undefined;
    let ua: string | undefined;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? undefined; } catch {}
    try { ua = getRequestHeader("user-agent") ?? undefined; } catch {}
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("login_history").insert({
      user_id: userId,
      ip: ip ?? null,
      user_agent: ua ?? null,
      identifier: data.device ?? null,
      success: true,
    });
    return { ok: true };
  });

/** Record a failed sign-in attempt for an identifier (email/username) — lockout monitoring. */
export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) =>
    z.object({ email: z.string().email().max(255).toLowerCase() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getRequestIP } = await import("@tanstack/react-start/server");
    let ip: string | undefined;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? undefined; } catch {}
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("failed_login_attempts").insert({
      identifier: data.email,
      ip: ip ?? null,
    });
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("failed_login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", data.email)
      .gte("at", since);
    const failures = count ?? 0;
    const lockedOut = failures >= 5;
    // Hard enforcement: auto-suspend the account for 15 minutes on the 5th
    // failure within the rolling window. Resolve the email to a user id first.
    if (lockedOut) {
      const { data: usr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", data.email) // no-op for email; safety net for username login
        .maybeSingle();
      let userId = usr?.id as string | undefined;
      if (!userId) {
        // Fall back to auth admin lookup by email.
        try {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers();
          userId = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === data.email)?.id;
        } catch {}
      }
      if (userId) {
        const ends = new Date(Date.now() + 15 * 60_000).toISOString();
        await supabaseAdmin.from("account_suspensions").insert({
          user_id: userId,
          reason: "Auto-suspended: 5+ failed login attempts in 15 minutes",
          ends_at: ends,
        });
      }
    }
    return { failures, lockedOut };
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
      .eq("identifier", data.email)
      .gte("at", since);
    return { lockedOut: (count ?? 0) >= 5, failures: count ?? 0 };
  });

/**
 * Resolve a login identifier (email, username, or staff ID) to the underlying
 * email so `signInWithPassword` can be called. Public endpoint — only ever
 * returns an email, never any other PII.
 */
export const resolveLoginIdentifier = createServerFn({ method: "POST" })
  .inputValidator((d: { identifier: string }) =>
    z.object({ identifier: z.string().trim().min(1).max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const id = data.identifier.trim();
    if (id.includes("@")) return { email: id.toLowerCase() };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("id, username, staff_id")
      .or(`username.eq.${id},staff_id.eq.${id}`)
      .maybeSingle();
    if (!row?.id) return { email: null as string | null };
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.id);
      return { email: u?.user?.email ?? null };
    } catch {
      return { email: null as string | null };
    }
  });