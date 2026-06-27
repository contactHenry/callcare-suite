# Project Memory

## Core
Call-centre management + CRM. Stack: TanStack Start v1 + Tailwind v4 + Lovable Cloud.
Hybrid design system: shadcn/ui where shipped, hand-rolled `src/components/cc/*` for new surfaces. Use `cc/*` (CCButton, CCInput, CCField, CCTable*, CCStatusPill, CCCard, CCStat) for any new auth/admin work.
Brand color: deep purple. Primary CTA = `--cc-brand-600`. Auth left panel = purple gradient (#5b21b6 → #3b0d80).
Tables: bottom-line dividers only — no border radius, no card chrome.
RBAC: 5 roles agent < team_leader < supervisor < ops_admin < super_admin. Permissions additive via hierarchy; check via `useAuth().atLeast(role)` or server-side `requirePermission(perm)` middleware.
All privileged server fns must call `audit(...)` after mutation.
Never store roles on `profiles` — always `user_roles`. Never hardcode role checks in components; use `atLeast`/`hasRole`.

## Memories
- [Security & RBAC](mem://security/rbac.md) — RLS pattern, expected linter warnings, lockout policy, 2FA stub
