import { describe, it, expect, vi } from "vitest";
import {
  assertOpsAdmin,
  canConfirmUpgrade,
  UPGRADE_DISABLED_TOOLTIP,
  type Role,
} from "../authorization";

/**
 * Build a fake Supabase RPC client that answers `has_role` truthfully for
 * the given set of roles, and false for everything else.
 */
function makeSupabase(roles: Role[]) {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn !== "has_role") return { data: null, error: null };
    const role = args._role as Role;
    return { data: roles.includes(role), error: null };
  });
  return { client: { rpc }, rpc };
}

const USER = "00000000-0000-0000-0000-000000000001";

describe("assertOpsAdmin — server-side gate for initiateUpgrade", () => {
  it("allows ops_admin to confirm the upgrade", async () => {
    const { client } = makeSupabase(["ops_admin"]);
    await expect(assertOpsAdmin(client, USER)).resolves.toBeUndefined();
  });

  it("allows super_admin to confirm the upgrade", async () => {
    const { client } = makeSupabase(["super_admin"]);
    await expect(assertOpsAdmin(client, USER)).resolves.toBeUndefined();
  });

  it("allows users holding both privileged roles", async () => {
    const { client } = makeSupabase(["ops_admin", "super_admin"]);
    await expect(assertOpsAdmin(client, USER)).resolves.toBeUndefined();
  });

  it.each<Role>(["agent", "team_leader", "supervisor"])(
    "rejects %s with the administrator-only error",
    async (role) => {
      const { client } = makeSupabase([role]);
      await expect(assertOpsAdmin(client, USER)).rejects.toThrow(
        /only administrators/i,
      );
    },
  );

  it("rejects users with no roles at all", async () => {
    const { client } = makeSupabase([]);
    await expect(assertOpsAdmin(client, USER)).rejects.toThrow(
      /only administrators/i,
    );
  });

  it("checks both ops_admin and super_admin via has_role RPC", async () => {
    const { client, rpc } = makeSupabase(["ops_admin"]);
    await assertOpsAdmin(client, USER);
    const calledRoles = rpc.mock.calls.map((c) => (c[1] as any)._role);
    expect(calledRoles).toEqual(expect.arrayContaining(["ops_admin", "super_admin"]));
  });
});

describe("canConfirmUpgrade — client-side gate on the /plans upgrade buttons", () => {
  it.each<Role>(["ops_admin", "super_admin"])(
    "enables the confirm action for %s",
    (role) => {
      expect(canConfirmUpgrade([role])).toBe(true);
    },
  );

  it.each<Role>(["agent", "team_leader", "supervisor"])(
    "disables the confirm action for %s and shows the admin tooltip",
    (role) => {
      expect(canConfirmUpgrade([role])).toBe(false);
      expect(UPGRADE_DISABLED_TOOLTIP).toBe("Contact your administrator to upgrade.");
    },
  );

  it("disables the confirm action when the user has no roles", () => {
    expect(canConfirmUpgrade([])).toBe(false);
  });

  it("uses the highest role when a user holds several", () => {
    expect(canConfirmUpgrade(["agent", "supervisor"])).toBe(false);
    expect(canConfirmUpgrade(["agent", "ops_admin"])).toBe(true);
  });
});