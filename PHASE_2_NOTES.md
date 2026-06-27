# Phase 2 — Auth, RBAC & Staff Management

Shipped in three slices (2A → 2D) on top of the Phase 1 audit & `cc/*` design system.

## 2A — Foundation (database)
- Tenancy: `organizations`, `teams`, `team_members`.
- 5-role enum: `agent` < `team_leader` < `supervisor` < `ops_admin` < `super_admin`.
  Existing `manager` users were auto-migrated to `supervisor`.
- `role_permissions` catalogue + helpers `has_role`, `has_permission` (additive
  via hierarchy), `max_role_level`, `is_account_suspended`, `record_audit`.
- Profile extension: `staff_id`, `username`, `phone`, `working_hours`, `timezone`, `avatar_url`.
- `agent_availability` + `agent_availability_log` (7 statuses, auto-snapshot trigger).
- Security tables: `user_devices`, `login_history`, `failed_login_attempts`,
  `account_suspensions`, `two_factor_secrets`, `ip_allowlist`, `sso_providers`.
- `audit_log` + `record_audit()` helper.
- RLS reauthored on every table for the 5-role hierarchy (storage too).

## 2B — Server fns, middleware, UI
- `src/lib/permissions.functions.ts` — `requirePermission(perm)` middleware factory
  + structured `audit()` writer + `recordLoginEvent` / `recordFailedLogin` /
  `checkLockout` for failed-login monitoring (5 failures / 15 min signal).
- `src/lib/staff.functions.ts` — `listStaff`, `inviteStaff`, `updateStaff`,
  `suspendUser`, `liftSuspension`, `assignRole`, `revokeRole`, `setMyAvailability`.
  Every privileged fn audits its action.
- `src/lib/admin.functions.ts` — `listPermissions`, `togglePermission`, `listAuditLog`.
- `src/components/AppShell.tsx` — role-aware sidebar (Staff, Audit log, Permissions
  added based on `atLeast("ops_admin" | "super_admin")`) + correct role label.
- `src/routes/_authenticated/staff.index.tsx` — invite / edit / suspend / role grants.
- `src/routes/_authenticated/admin.permissions.tsx` — super-admin permission matrix.
- `src/routes/_authenticated/security.audit.tsx` — audit feed.
- `src/lib/auth.tsx` exposes `roles`, `roleLevel`, `hasRole(r)`, `atLeast(r)`,
  with legacy `isManager` preserved as `≥ team_leader`.

## 2C — Auth surface in `cc/*` DS
- `src/routes/auth.tsx` — added "Forgot password?" link; recorded successful
  and failed sign-ins via server fns.
- `src/routes/auth.forgot.tsx` — request reset email (`resetPasswordForEmail`,
  redirects to `/reset-password`).
- `src/routes/reset-password.tsx` — public route gated on `type=recovery` hash;
  calls `supabase.auth.updateUser({ password })`.
- `src/routes/auth.2fa.tsx` — TOTP-style challenge UI fully wired; backend
  verify call is a documented stub (Supabase MFA must be enabled in the
  project dashboard before flipping the stub to `supabase.auth.mfa.verify`).
- New `cc/*` primitives: `CCInput`, `CCSelect`, `CCField`, `CCTable*` —
  matches the bottom-line, zero-radius operational style already in use.

## 2D — Tests & docs
- `tests/permissions.test.ts` — boundary tests for role hierarchy + additive
  permission inheritance + privilege-escalation guard. Run with `bun test`.
- `PHASE_2_NOTES.md` (this file) + `mem://security/rbac.md` (security memory).

## Known stubs / follow-ups
1. **2FA verify** — UI shipped; wire to `supabase.auth.mfa` when MFA is
   enabled on the project. `two_factor_secrets` table is already in place.
2. **SSO** — `sso_providers` table seeded but no UI yet (Phase 3 candidate).
3. **IP allowlist** — table + RLS done, no admin UI.
4. **Session timeout** — Supabase JWT TTL controls this; no per-app override.
   If a stricter inactivity timeout is needed, add a client-side idle watcher.
5. **Device tracking** — `user_devices` populated only via `login_history`
   today; a "Devices" page can render this without further migrations.
6. **Lockout enforcement** — failed attempts are *recorded* and `lockedOut`
   flag is *returned* to the client. Hard enforcement (server-side block)
   should be added when SLA requires it, via an Edge Function pre-auth hook
   or by inserting an `account_suspensions` row from `recordFailedLogin`.

## Linter notes
The 7 "SECURITY DEFINER callable by signed-in users" warnings are the
documented Supabase RBAC pattern: RLS policies invoke `has_role`,
`has_permission`, `max_role_level`, `is_account_suspended` and **must** be
executable by `authenticated`. Revoking that grant would break every
policy. Logged in `mem://security/rbac.md`.