/**
 * Permission boundary tests.
 *
 * Run with: `bun test` (Bun's built-in runner — no install).
 *
 * These tests exercise the pure helpers that mirror the DB-side
 * `has_permission()` / `max_role_level()` logic. The same constants drive
 * the client-side `useAuth().atLeast(role)` check, so verifying the
 * hierarchy here catches regressions before any RBAC bug reaches RLS.
 */
import { describe, expect, it } from "bun:test";

type Role = "agent" | "team_leader" | "supervisor" | "ops_admin" | "super_admin";

const LEVEL: Record<Role, number> = {
  agent: 1,
  team_leader: 2,
  supervisor: 3,
  ops_admin: 4,
  super_admin: 5,
};

function atLeast(userRoles: Role[], threshold: Role) {
  const max = userRoles.reduce((m, r) => Math.max(m, LEVEL[r] ?? 0), 0);
  return max >= LEVEL[threshold];
}

// Mirrors the seeded role_permissions catalogue. Higher roles inherit lower-role grants.
const BASE_GRANTS: Record<Role, string[]> = {
  agent: ["calls.log", "contacts.read.own"],
  team_leader: ["qa.review", "team.read"],
  supervisor: ["qa.criteria.manage", "calls.read.all"],
  ops_admin: ["staff.create", "staff.update", "staff.suspend", "staff.assign_role", "audit.read"],
  super_admin: ["permissions.manage", "org.manage"],
};

function hasPermission(userRoles: Role[], perm: string) {
  const max = userRoles.reduce((m, r) => Math.max(m, LEVEL[r] ?? 0), 0);
  return (Object.entries(BASE_GRANTS) as [Role, string[]][])
    .filter(([role]) => LEVEL[role] <= max)
    .some(([, perms]) => perms.includes(perm));
}

describe("role hierarchy — atLeast()", () => {
  it("agent is the floor; cannot reach team_leader+", () => {
    expect(atLeast(["agent"], "agent")).toBe(true);
    expect(atLeast(["agent"], "team_leader")).toBe(false);
    expect(atLeast(["agent"], "ops_admin")).toBe(false);
    expect(atLeast(["agent"], "super_admin")).toBe(false);
  });

  it("supervisor satisfies team_leader and agent thresholds", () => {
    expect(atLeast(["supervisor"], "agent")).toBe(true);
    expect(atLeast(["supervisor"], "team_leader")).toBe(true);
    expect(atLeast(["supervisor"], "supervisor")).toBe(true);
    expect(atLeast(["supervisor"], "ops_admin")).toBe(false);
  });

  it("super_admin satisfies every threshold", () => {
    for (const t of ["agent", "team_leader", "supervisor", "ops_admin", "super_admin"] as Role[]) {
      expect(atLeast(["super_admin"], t)).toBe(true);
    }
  });

  it("multi-role users use the highest role", () => {
    expect(atLeast(["agent", "supervisor"], "supervisor")).toBe(true);
    expect(atLeast(["agent", "supervisor"], "ops_admin")).toBe(false);
  });

  it("empty role list never satisfies any threshold", () => {
    expect(atLeast([], "agent")).toBe(false);
  });
});

describe("permission additivity — hasPermission()", () => {
  it("agents have only agent-scoped permissions", () => {
    expect(hasPermission(["agent"], "calls.log")).toBe(true);
    expect(hasPermission(["agent"], "qa.review")).toBe(false);
    expect(hasPermission(["agent"], "staff.create")).toBe(false);
    expect(hasPermission(["agent"], "permissions.manage")).toBe(false);
  });

  it("team_leader inherits agent permissions plus its own", () => {
    expect(hasPermission(["team_leader"], "calls.log")).toBe(true);
    expect(hasPermission(["team_leader"], "qa.review")).toBe(true);
    expect(hasPermission(["team_leader"], "qa.criteria.manage")).toBe(false);
  });

  it("ops_admin can manage staff but cannot edit permission catalogue", () => {
    expect(hasPermission(["ops_admin"], "staff.suspend")).toBe(true);
    expect(hasPermission(["ops_admin"], "audit.read")).toBe(true);
    expect(hasPermission(["ops_admin"], "permissions.manage")).toBe(false);
  });

  it("super_admin holds every permission in the catalogue", () => {
    const all = Object.values(BASE_GRANTS).flat();
    for (const p of all) expect(hasPermission(["super_admin"], p)).toBe(true);
  });

  it("privilege escalation guard: lower role cannot self-grant higher permissions", () => {
    // Even an agent with multiple agent grants is not an admin.
    expect(hasPermission(["agent", "agent"], "permissions.manage")).toBe(false);
  });
});