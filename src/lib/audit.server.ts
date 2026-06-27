/**
 * Server-only audit helper. Lives in a *.server.ts file so the
 * `@tanstack/react-start/server` import (which the import-protection
 * plugin forbids from client-reachable modules) never leaks into the
 * client graph. Consumers `await import('./audit.server')` inside
 * `createServerFn().handler(...)` bodies.
 */
export async function audit(
  supabase: any,
  actor: string,
  action: string,
  targetType: string,
  targetId: string,
  diff: Record<string, unknown> = {},
) {
  const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
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