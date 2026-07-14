/**
 * Shared authorization helpers for the billing/plan surface.
 * Kept in its own module so it can be unit-tested without pulling in
 * TanStack server-fn machinery.
 */

export const UPGRADE_DISABLED_TOOLTIP = "Contact your administrator to upgrade.";

export type SupabaseRpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Throws if the user does not hold `ops_admin` or `super_admin`.
 * Uses the project's `has_role` SQL function for both checks.
 */
export async function assertOpsAdmin(
  supabase: SupabaseRpcClient,
  userId: string,
): Promise<void> {
  const [{ data: ops }, { data: sup }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "ops_admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (ops !== true && sup !== true) {
    throw new Error("Only administrators can change the plan.");
  }
}

/** Role hierarchy — mirrors src/lib/auth.tsx. Kept here for gating tests. */
const ROLE_LEVEL = {
  agent: 1,
  team_leader: 2,
  supervisor: 3,
  ops_admin: 4,
  super_admin: 5,
} as const;

export type Role = keyof typeof ROLE_LEVEL;

/** True when the given role set includes ops_admin or higher. */
export function canConfirmUpgrade(roles: Role[]): boolean {
  const level = roles.reduce((m, r) => Math.max(m, ROLE_LEVEL[r] ?? 0), 0);
  return level >= ROLE_LEVEL.ops_admin;
}