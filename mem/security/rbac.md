---
name: RBAC, RLS & security helpers
description: 5-role hierarchy, expected SECURITY DEFINER linter warnings, audit log writes, lockout, 2FA stub
type: feature
---
**Roles (ascending):** agent (1) → team_leader (2) → supervisor (3) → ops_admin (4) → super_admin (5).
Stored in `public.user_roles` (never `profiles`). Permissions live in `public.role_permissions` (role × permission). Permission checks are **additive via hierarchy** — a permission granted to `agent` is auto-available to everyone above.

**Helpers (SECURITY DEFINER, search_path=public):**
- `has_role(uuid, app_role)` — exact role check
- `has_permission(uuid, text)` — additive hierarchy-aware permission check
- `max_role_level(uuid)` — int 0-5 for `>= N` comparisons in RLS
- `is_account_suspended(uuid)` — active row in `account_suspensions`
- `record_audit(...)` — only path for clients to write `audit_log`

**Expected linter warnings (DO NOT "fix" by revoking EXECUTE):**
Seven WARN entries — "SECURITY DEFINER function callable by signed-in users" for the helpers above. These functions are invoked from RLS policies as the calling user; revoking `EXECUTE FROM authenticated` would break every policy. This is the canonical Supabase RBAC pattern. Leave granted; do not re-flag.

**Server-fn pattern:** every privileged mutation goes through `requirePermission(perm)` middleware (in `src/lib/permissions.functions.ts`) which (1) wraps `requireSupabaseAuth`, (2) calls `has_permission` RPC, (3) checks suspension, (4) 403s otherwise. After success the handler MUST call `audit(supabase, userId, action, targetType, targetId, diff)`.

**Lockout policy:** 5 failed logins per email in 15 min returns `{ lockedOut: true }` from `recordFailedLogin`. Hard enforcement (auto-suspension) is NOT in place — add an `account_suspensions` insert from the recorder if SLA needs it.

**2FA:** `two_factor_secrets` table + `/auth/2fa` UI are shipped; the verify call is a stub. To activate, enable Supabase Auth MFA in the project and replace the `setTimeout` in `auth.2fa.tsx` with `supabase.auth.mfa.challengeAndVerify(...)`.

**Privilege escalation guards already in code:**
- `assignRole` rejects granting `super_admin` unless caller is `super_admin`.
- `revokeRole` rejects self-demotion from `super_admin`.
- `togglePermission` requires `permissions.manage` (super_admin only).
