# Codebase Audit — Call Centre Management Platform

_Audit date: 2026-06-27_
_Auditor: senior full-stack review pass_

> **Important caveat.** The original brief referenced a "full requirements doc" (5 roles, 18-item main menu, Campaign entity, Client Profile entity) that was not provided. Where this audit maps current state to the spec, the spec side is **inferred from standard call-centre operations practice** and clearly marked `(inferred)`. Treat those rows as proposals to validate, not facts.

---

## 1. Tech stack in use

| Layer | Choice |
|---|---|
| Framework | TanStack Start v1 (React 19, Vite 7, SSR + server functions) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 (CSS-first via `src/styles.css`, no `tailwind.config.js`) |
| Component library | shadcn/ui (Radix primitives + cva variants) — full kit installed |
| State / data | TanStack Query v5, TanStack Router loaders |
| Forms / validation | react-hook-form + zod (installed; **not yet used in routes**) |
| Backend | Lovable Cloud (managed Supabase) — Postgres + Auth + Storage |
| Hosting | Cloudflare Workers (workerd) via TanStack Start |
| Auth | Supabase Auth, email/password only; no social providers configured |
| Charts | Recharts |

No telephony, no STT, no queue/ACD layer, no caching layer (Redis etc.), no background job runner.

---

## 2. Spec coverage matrix

Legend: ✅ implemented · 🟡 partial · ❌ missing

| Capability (inferred from a standard call-centre ops spec) | Status | Notes |
|---|---|---|
| Auth (email/password) | ✅ | `src/routes/auth.tsx`; no password-reset page, no MFA |
| Role-based access | 🟡 | Only 2 roles (`agent`, `manager`). Spec calls for **5**. |
| Client profile / CRM | 🟡 | `contacts` table — single owner, no household/account hierarchy, no consent fields |
| Call record | 🟡 | Manual log only; no telephony hook, no DTMF, no transfer trail |
| Audio recording | 🟡 | Manual upload to private bucket; no waveform, no retention policy |
| QA scorecards | ✅ | Weighted criteria + trigger-computed overall score |
| QA dashboard | ✅ | Per-agent only; no team/campaign rollups |
| Campaigns | ❌ | No table, no UI, no dialler list, no script builder |
| Dispositions / outcome catalog | 🟡 | Hard-coded enum, not configurable per campaign |
| Real-time agent status (Available/Busy/ACW) | ❌ | Nothing |
| Wallboards / live ops view | ❌ | Nothing |
| Coaching / training workflows | ❌ | Beyond QA, nothing |
| Reports & exports | ❌ | No CSV/PDF export, no scheduled reports |
| Audit log | ❌ | No `audit_log` table; admin actions untraceable |
| Notifications (email / in-app) | ❌ | Toast only |
| Knowledge base / scripts | ❌ | Nothing |
| Ticketing / case management | ❌ | Nothing |
| Workforce mgmt (schedules / shifts) | ❌ | Nothing |
| SLA & compliance tracking | ❌ | Nothing |
| Settings / org admin | ❌ | No tenancy, no org table |
| Multi-tenant org isolation | ❌ | Single-tenant; all RLS scopes to user, not org |

**Headline:** the build covers ~25% of a real call-centre platform. The shipped slice (CRM list + manual call log + QA scoring) is fine as a foundation but is missing every operational pillar (campaigns, real-time, reporting, audit, tenancy).

---

## 3. Current data model

```text
auth.users (managed)
   │
   ├──< profiles (id, full_name)
   ├──< user_roles (user_id, role: agent|manager)        ← only 2 roles
   ├──< contacts (owner_id, name, company, phone, email,
   │             status, tags[], notes)                    ← single-owner CRM
   ├──< calls (agent_id, contact_id, direction, started_at,
   │           duration_seconds, outcome, notes, audio_path)
   └──< qa_reviews (call_id, reviewer_id, overall_score, notes)
              └──< qa_review_scores (criterion_id, score 0-5)
                          ▲
                          └── qa_criteria (label, weight, active)
```

Gaps vs. the inferred spec:

- **No `organizations` table** → cannot host multiple tenants/clients.
- **No `teams` table** → Team Leader role has nothing to scope to.
- **No `campaigns` / `campaign_members` / `campaign_dispositions`** → core entity missing.
- **No `client_profile` separate from `contacts`** → no demographic, KYC, consent, segment fields.
- **`calls.outcome`** is a free `text` column — should reference a campaign-scoped disposition catalog.
- **No FK from `calls.contact_id` to `contacts`** declared in the public-facing schema review (verify in migrations); enforcement matters for QA review integrity.
- **No soft-delete / archival** columns. GDPR right-to-erasure will be a refactor later.
- **No `audit_log`**.
- **No `presence` / `agent_status` table** for live state.

---

## 4. Auth & RBAC

**Current:**
- `app_role` enum: `agent`, `manager`.
- `user_roles(user_id, role)` table — correct pattern (separate from profiles ✅).
- `has_role(_user_id, _role)` SECURITY DEFINER function ✅.
- RLS policies use `has_role()` — no recursive policy risk ✅.
- Trigger `handle_new_user()` auto-assigns `agent` on signup ✅.

**Gaps vs. 5-role spec (Agent / Team Leader / Supervisor / Ops Admin / Super Admin):**
- 3 of 5 roles do not exist.
- No team scoping → a Team Leader could only ever be "everyone or no-one".
- No org scoping → Ops Admin / Super Admin have no boundary to administer.
- No permission table — role checks are hard-coded role strings, not granular permissions. Migrating to capability-based later will require touching every policy.
- No self-service password reset route (`/reset-password` missing).
- No MFA; no session timeout; no failed-login lockout.
- No social/SSO providers configured despite the platform default recommending Google.

**Security findings (live scan):**
- ⚠ **WARN** — `has_role` is a `SECURITY DEFINER` function callable by any signed-in user. Intentional (it's the canonical Supabase RBAC pattern) and safe given its body, but flag is real. Action: leave as-is, document in `security-memory`.

---

## 5. Code quality issues

### High
- **No zod validation on any server function or form.** `zod` is installed but no `inputValidator` is wired anywhere. Every server function happily accepts arbitrary payloads.
- **No rate limiting** anywhere (auth, calls.new, file upload). Audio bucket is a free abuse vector.
- **Storage policies not reviewed in audit** — verify `call-recordings` bucket has per-agent read/write RLS, not just "authenticated".
- **Client trusts role from local `useAuth`** — fine for UI gating, but several queries don't pass through `requireSupabaseAuth` server functions; they hit Supabase directly from the browser with the user's RLS. Acceptable, but means "manager can see all" relies entirely on the policy being correct. No defence in depth.
- **Frontend leaks dummy data into prod** — `src/lib/dummy-data.ts` is imported by 4 routes as fallback. Real users see fake records when their DB is empty. Should be gated behind `import.meta.env.DEV` or removed before launch.

### Medium
- **Inconsistent fetch patterns** — some routes use `useQuery` directly against `supabase`, none use the recommended `createServerFn` + `ensureQueryData` loader pattern.
- **No error boundaries on most routes** — `errorComponent` / `notFoundComponent` only on root.
- **No pagination on `contacts` or `calls` list** — `select('*')` returns everything. Breaks at ~1k rows.
- **`AppShell` page title** comes from route hardcoding, not route `head()` metadata — SEO/OG tags are root-only.
- **N+1 risk** in `qa.dashboard.tsx` if it expands to render per-criterion averages (currently it doesn't, but the schema invites it).
- **No DB indexes declared** beyond PKs/FKs. `calls.agent_id`, `calls.started_at`, `qa_reviews.call_id` will need indexes once row counts grow.

### Low
- Dummy-data design-system inconsistencies have already been ironed out in recent turns (table style, typography hierarchy, status colours).
- `console.log`s in a few routes.
- No tests anywhere.
- No CI lint/typecheck gate visible.

### Dependency security
- `bun audit` → **no high/critical vulnerabilities**. ✅

---

## 6. Existing UI / design language

- **Component library:** shadcn/ui — full kit copied into `src/components/ui/`. Untouched from defaults except for the `button.tsx` cursor tweak.
- **Styling:** Tailwind v4 with semantic tokens in `src/styles.css` (`--primary`, `--muted`, etc.) using oklch. ✅ correct v4 pattern.
- **Brand:** auth screen has a deep-purple panel + dashboard mockup illustration. Inside the app, the palette reverts to shadcn-default slate. **Two different brand worlds.**
- **Typography:** system font stack. No web font loaded. Hierarchy was recently unified (`text-2xl/semibold` H1, `text-3xl/semibold` KPI).
- **Table convention:** bottom-line only, no card chrome, no border-radius (consistent across calls/contacts/qa).
- **Status colour coding:** green/yellow/red applied ad-hoc in route components with hard-coded Tailwind classes (`bg-green-100 text-green-700`) — **violates the "semantic tokens only" rule** and breaks the planned dark mode.
- **No motion language** beyond default Radix transitions.
- **No accessibility audit** done. Icon-only buttons (e.g. dialer panel) need `aria-label` review.

---

## 7. Scalability & ops concerns

| Area | Concern |
|---|---|
| Database | No pagination; no indexes beyond PK/FK; `select('*')` everywhere. |
| Caching | None. TanStack Query in-memory only. No edge cache, no Redis. |
| Storage | `call-recordings` bucket has no size cap enforced server-side; no lifecycle/retention; no transcoding. |
| Realtime | Not enabled. Live agent status / wallboards would need Supabase Realtime channels. |
| Background jobs | None. Future STT/transcription, scheduled reports, retention sweeps need a worker (pg_cron + edge function). |
| Observability | No structured logging, no metrics, no error tracking beyond the built-in `reportLovableError`. |
| Multi-tenancy | Single tenant baked in. Retrofitting `organization_id` on every table is a breaking change — do it **before** real customer data lands. |
| Modularity | Routes are thin; business logic is inline. No `src/features/<domain>` boundaries. Will not scale past ~30 routes. |

---

## 8. Summary scorecard

| Dimension | Score | One-line verdict |
|---|---|---|
| Foundation correctness | 7/10 | Stack is sound; RBAC pattern is right. |
| Feature completeness vs. spec | 3/10 | Major pillars missing (campaigns, real-time, reporting, tenancy). |
| Security | 5/10 | RLS in place; no validation, no rate limiting, no audit log. |
| Scalability | 4/10 | No indexes/pagination/caching/tenancy. Works for demo, not for 100 agents. |
| Design system | 4/10 | Default shadcn + ad-hoc colour classes; brand only on auth screen. |
| Code quality | 5/10 | Consistent at file level, inconsistent at architecture level. |

**Recommended order before any new features:** ① introduce `organizations` + `teams` + expand `app_role` to 5 values, ② lock down with zod validators + storage policies + audit log, ③ ship a real design system (see `ARCHITECTURE_PLAN.md`), ④ then build Campaigns as the first new vertical.